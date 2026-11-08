import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * Task 031 part 3. Vitest's CSS-module stub answers a name for any key, so a class a component uses but its module
 * does not define passes every test and is `undefined` in the build (task 026's `styles.fill`). This test reads every
 * `.ts` and `.tsx` file in `frontend/src` and checks each class it takes from a CSS module against that module's
 * selectors. Task 026's and 030's per-file checks are other tests and stay.
 */

/** A file to check: its path relative to `frontend/src`, with `/`, and its text. */
type SourceFile = { path: string; text: string };

/**
 * The dynamic keys: per file, each `<module>[expr]` access by its source text and the values `expr` can take, from
 * the prop's type. Each value is checked like a static key. An access not listed here fails the test, so a new one
 * cannot slip past; a listed access the file no longer has fails too.
 */
type DynamicKeys = Record<string, Record<string, readonly string[]>>;

const dynamicKeys: DynamicKeys = {
  // AmountBoxProps['size']
  'components/AmountBox/AmountBox.tsx': { 'styles[size]': ['compact', 'large'] },
  // DateBoxProps['size']
  'components/DateBox/DateBox.tsx': { 'styles[size]': ['compact', 'large'] },
  // CategoryIconProps['variant']
  'components/CategoryIcon/CategoryIcon.tsx': {
    'styles[variant]': ['recent', 'breakdown', 'header', 'goal', 'plain'],
  },
  // DropdownProps['variant']
  'components/Dropdown/Dropdown.tsx': { 'styles[variant]': ['box', 'plain', 'inline', 'input', 'comparison'] },
  // SkeletonProps['shape']
  'components/Skeleton/Skeleton.tsx': { 'styles[shape]': ['text', 'block', 'circle'] },
};

/**
 * The classes a CSS module defines: every `.name` in a rule's selector (a comma list and a compound selector
 * included), never in a comment, a declaration or an at-rule's prelude.
 */
function definedClasses(css: string): Set<string> {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const classes = new Set<string>();
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '{') {
      // A `:global(...)` class is not the module's.
      const prelude = text
        .slice(start, index)
        .trim()
        .replaceAll(/:global\([^)]*\)/g, '');
      if (!prelude.startsWith('@')) {
        for (const match of prelude.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) classes.add(match[1]!);
      }
      start = index + 1;
    } else if (char === '}' || char === ';') {
      start = index + 1;
    }
  }
  return classes;
}

type Report = { files: number; imports: number; uses: number; problems: string[] };

/**
 * Checks every CSS-module import of `files`: the default import only, and each `<name>.<key>`, `<name>['key']` or
 * listed `<name>[expr]` against the module's selectors. `readCss` reads a module by its path relative to `src`.
 */
function checkCssModuleClasses(files: SourceFile[], readCss: (path: string) => string, dynamic: DynamicKeys): Report {
  const report: Report = { files: files.length, imports: 0, uses: 0, problems: [] };
  for (const file of files) {
    const source = parse(file);
    const modules = new Map<string, { path: string; classes: Set<string> }>();
    const importNames = new Set<ts.Node>();
    for (const statement of source.statements) {
      if (
        ts.isExportDeclaration(statement) &&
        statement.moduleSpecifier !== undefined &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text.endsWith('.module.css')
      ) {
        report.problems.push(
          `${file.path}: '${statement.moduleSpecifier.text}' is re-exported; import it where it is used`,
        );
        continue;
      }
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const specifier = statement.moduleSpecifier.text;
      if (!specifier.endsWith('.module.css')) continue;
      report.imports += 1;
      const clause = statement.importClause;
      if (clause?.name === undefined || clause.namedBindings !== undefined) {
        report.problems.push(`${file.path}: '${specifier}' must be imported as one default name`);
        continue;
      }
      const path = join(dirname(file.path), specifier).replaceAll('\\', '/');
      modules.set(clause.name.text, { path, classes: definedClasses(readCss(path)) });
      importNames.add(clause.name);
    }
    const dynamicImports = (node: ts.Node) => {
      const [argument] = ts.isCallExpression(node) ? node.arguments : [];
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        argument !== undefined &&
        ts.isStringLiteralLike(argument) &&
        argument.text.endsWith('.module.css')
      ) {
        report.problems.push(`${file.path}: '${argument.text}' is imported dynamically; import it as one default name`);
      }
      ts.forEachChild(node, dynamicImports);
    };
    dynamicImports(source);
    if (modules.size === 0) continue;

    const listed = dynamic[file.path] ?? {};
    const seenDynamic = new Set<string>();
    const check = (name: string, key: string, at: string) => {
      report.uses += 1;
      const cssModule = modules.get(name)!;
      if (!cssModule.classes.has(key)) report.problems.push(`${file.path}: ${at} has no .${key} in ${cssModule.path}`);
    };
    const visit = (node: ts.Node) => {
      if (ts.isIdentifier(node) && modules.has(node.text) && !importNames.has(node) && !isOtherName(node)) {
        const parent = node.parent;
        const name = node.text;
        if (ts.isPropertyAccessExpression(parent) && parent.expression === node) {
          check(name, parent.name.text, `${name}.${parent.name.text}`);
        } else if (ts.isElementAccessExpression(parent) && parent.expression === node) {
          const argument = parent.argumentExpression;
          if (ts.isStringLiteralLike(argument)) {
            check(name, argument.text, `${name}['${argument.text}']`);
          } else {
            const access = parent.getText(source);
            const values = listed[access];
            seenDynamic.add(access);
            if (values === undefined) {
              report.problems.push(`${file.path}: ${access} is a dynamic key the test's table does not list`);
            } else {
              for (const value of values) check(name, value, `${access} as '${value}'`);
            }
          }
        } else {
          report.problems.push(`${file.path}: '${name}' is used as a whole, so its classes cannot be checked`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    for (const access of Object.keys(listed)) {
      if (!seenDynamic.has(access)) report.problems.push(`${file.path}: the table lists ${access}, not in the file`);
    }
  }
  return report;
}

/** A source file's syntax tree, `.tsx` as TSX and `.ts` as TS (a `<T>value` assertion is valid only there). */
function parse(file: SourceFile): ts.SourceFile {
  const kind = file.path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true, kind);
}

/**
 * The string values a prop's type allows in `file`: its declaration `<prop>: 'a' | 'b'` (a property of the props type),
 * or `undefined` when the file has no such declaration, or more than one.
 */
function literalUnion(file: SourceFile, prop: string): string[] | undefined {
  const found: string[][] = [];
  const visit = (node: ts.Node) => {
    if (ts.isPropertySignature(node) && ts.isIdentifier(node.name) && node.name.text === prop && node.type) {
      const members = ts.isUnionTypeNode(node.type) ? node.type.types : [node.type];
      const values = members.flatMap((member) =>
        ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal) ? [member.literal.text] : [],
      );
      if (values.length === members.length) found.push(values);
    }
    ts.forEachChild(node, visit);
  };
  visit(parse(file));
  return found.length === 1 ? found[0] : undefined;
}

/** An identifier that only shares the module's name: a property name, a key or a JSX attribute, not a reference. */
function isOtherName(node: ts.Identifier): boolean {
  const parent = node.parent;
  return (
    (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
    (ts.isPropertyAssignment(parent) && parent.name === node) ||
    (ts.isPropertySignature(parent) && parent.name === node) ||
    (ts.isJsxAttribute(parent) && parent.name === node) ||
    (ts.isBindingElement(parent) && parent.propertyName === node)
  );
}

const srcDir = resolve(import.meta.dirname, '../../src');

function sourceFiles(dir: string): SourceFile[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!/\.tsx?$/.test(entry.name)) return [];
    return [{ path: relative(srcDir, path).replaceAll('\\', '/'), text: readFileSync(path, 'utf8') }];
  });
}

const files = sourceFiles(srcDir);
const project = checkCssModuleClasses(files, (path) => readFileSync(resolve(srcDir, path), 'utf8'), dynamicKeys);

/** Each listed dynamic access with the values the table gives it, sorted. */
const listedValues = Object.entries(dynamicKeys).flatMap(([path, accesses]) =>
  Object.entries(accesses).map(([access, values]) => ({ path, access, values: values.toSorted() })),
);

/** The values the prop in the brackets of `access` allows in the file at `path`, sorted. */
function allowedValues(path: string, access: string): string[] | undefined {
  const prop = /\[(\w+)\]$/.exec(access)?.[1];
  const file = files.find((candidate) => candidate.path === path);
  return prop === undefined || file === undefined ? undefined : literalUnion(file, prop)?.toSorted();
}

// T7: every class used from a CSS module in frontend/src has a selector in that module (task 031 AC5).
describe('CSS-module classes in frontend/src', () => {
  it(`checks ${project.files} files, ${project.imports} CSS-module imports and ${project.uses} class uses`, () => {
    expect(project.files).toBeGreaterThan(100);
    expect(project.imports).toBeGreaterThan(100);
    expect(project.uses).toBeGreaterThan(500);
  });

  it('finds every class in its module, and every dynamic key listed', () => {
    expect(project.problems).toEqual([]);
  });

  // A value added to a prop's type without its rule would pass a hand-kept table: the table must equal the type.
  it('lists, for each dynamic key, exactly the values its prop’s type allows', () => {
    expect(listedValues).toHaveLength(5);
    expect(listedValues.map(({ path, access }) => [path, access, allowedValues(path, access)])).toEqual(
      listedValues.map(({ path, access, values }) => [path, access, values]),
    );
  });
});

/** The detector on one inline file and its module. */
function checkOne(text: string, css: string, dynamic: DynamicKeys = {}) {
  return checkCssModuleClasses([{ path: 'components/Box/Box.tsx', text }], () => css, dynamic).problems;
}

// T8: the detector's self-checks on inline fixtures (task 031 AC5).
describe('the CSS-module class detector', () => {
  const css =
    '/* .commented { color: red; } */\n.box, .wide { display: flex; }\n.box.open:hover > .label { gap: 0; }\n';

  it('accepts a class in a comma list and in a compound selector', () => {
    const text = [
      "import styles from './Box.module.css';",
      'export const a = [styles.box, styles.wide, styles.open, styles.label];',
    ].join('\n');

    expect(checkOne(text, css)).toEqual([]);
  });

  it('flags a class the module does not define', () => {
    const text = "import styles from './Box.module.css';\nexport const a = styles.missing;";

    expect(checkOne(text, css)).toEqual([
      'components/Box/Box.tsx: styles.missing has no .missing in components/Box/Box.module.css',
    ]);
  });

  it('flags a class found only in a comment', () => {
    const text = "import styles from './Box.module.css';\nexport const a = styles.commented;";

    expect(checkOne(text, css)).toEqual([
      'components/Box/Box.tsx: styles.commented has no .commented in components/Box/Box.module.css',
    ]);
  });

  it('finds a class inside an at-rule, and flags one found only in a declaration', () => {
    const declared = '@media (min-width: 1.5em) { .box { background: url(./x.png); } }';
    const text = "import styles from './Box.module.css';\nexport const a = [styles.box, styles.png];";

    expect(checkOne(text, declared)).toEqual([
      'components/Box/Box.tsx: styles.png has no .png in components/Box/Box.module.css',
    ]);
  });

  it('checks a static string key and every listed value of a dynamic key, under any local name', () => {
    const text = [
      "import boxStyles from './Box.module.css';",
      "export const a = (size: 'box' | 'wide' | 'tall') => [boxStyles['label'], boxStyles[size]];",
    ].join('\n');
    const listed = { 'components/Box/Box.tsx': { 'boxStyles[size]': ['box', 'wide', 'tall'] } };

    expect(checkOne(text, css, listed)).toEqual([
      "components/Box/Box.tsx: boxStyles[size] as 'tall' has no .tall in components/Box/Box.module.css",
    ]);
  });

  it('flags a dynamic key the table does not list, and a listed one the file does not have', () => {
    const text = "import styles from './Box.module.css';\nexport const a = (x: string) => styles[x];";
    const listed = { 'components/Box/Box.tsx': { 'styles[size]': ['box'] } };

    expect(checkOne(text, css, listed)).toEqual([
      "components/Box/Box.tsx: styles[x] is a dynamic key the test's table does not list",
      'components/Box/Box.tsx: the table lists styles[size], not in the file',
    ]);
  });

  it.each([
    ["import * as styles from './Box.module.css';"],
    ["import { box } from './Box.module.css';"],
    ["import styles, { box } from './Box.module.css';"],
    ["import './Box.module.css';"],
  ])('flags another import form: %s', (line) => {
    expect(checkOne(`${line}\nexport const a = 1;`, css)).toEqual([
      "components/Box/Box.tsx: './Box.module.css' must be imported as one default name",
    ]);
  });

  it('flags the module used as a whole', () => {
    const text = "import styles from './Box.module.css';\nexport const a = { ...styles };";

    expect(checkOne(text, css)).toEqual([
      "components/Box/Box.tsx: 'styles' is used as a whole, so its classes cannot be checked",
    ]);
  });

  it('ignores a property, key or attribute that only shares the name', () => {
    const text = [
      "import styles from './Box.module.css';",
      'export const a = { styles: 1 }.styles;',
      'export const b = <div styles="x" className={styles.box} />;',
    ].join('\n');

    expect(checkOne(text, css)).toEqual([]);
  });

  it('flags a CSS module re-exported or imported dynamically', () => {
    const text = [
      "export { default as boxStyles } from './Box.module.css';",
      "export const load = () => import('./Box.module.css');",
    ].join('\n');

    expect(checkOne(text, css)).toEqual([
      "components/Box/Box.tsx: './Box.module.css' is re-exported; import it where it is used",
      "components/Box/Box.tsx: './Box.module.css' is imported dynamically; import it as one default name",
    ]);
  });

  it('does not count a :global class as the module’s', () => {
    const text = "import styles from './Box.module.css';\nexport const a = [styles.box, styles.page];";

    expect(checkOne(text, ':global(.page) .box { gap: 0; }')).toEqual([
      'components/Box/Box.tsx: styles.page has no .page in components/Box/Box.module.css',
    ]);
  });

  it('reads the values a prop’s type allows, so a value missing from the table shows', () => {
    const file = {
      path: 'components/Box/Box.tsx',
      text: "type BoxProps = { size: 'small' | 'large' | 'huge'; label?: string };\nexport const box = (p: BoxProps) => p;",
    };

    expect(literalUnion(file, 'size')).toEqual(['small', 'large', 'huge']);
    expect(literalUnion(file, 'label')).toBeUndefined();
    expect(literalUnion(file, 'tone')).toBeUndefined();
  });
});
