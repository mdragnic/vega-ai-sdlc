import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const tokensMd = readFileSync(resolve(import.meta.dirname, '../../../docs/figma/tokens.md'), 'utf8');
const tokensCss = readFileSync(resolve(import.meta.dirname, '../../src/styles/tokens.css'), 'utf8');

type Token = [name: string, value: string];

/** Table rows like: | `--color-white` | `#FFFFFF` | source | */
function markdownTokens(markdown: string): Token[] {
  return [...markdown.matchAll(/^\| `(--[a-z0-9-]+)` \| `([^`]+)` \|/gm)].map((m) => [m[1]!, m[2]!]);
}

/** Declarations inside the single :root rule, which must be the whole file apart from comments. */
function cssTokens(css: string): Token[] {
  const code = css
    .replaceAll('\r\n', '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
  const body = /^:root \{\n([^{}]*)\n\}$/.exec(code);
  if (!body) throw new Error('tokens.css must hold exactly one :root rule');
  return body[1]!
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = /^(--[a-z0-9-]+): (.+);$/.exec(line);
      if (!m) throw new Error(`Not a token declaration: ${line}`);
      return [m[1]!, m[2]!];
    });
}

const srcDir = resolve(import.meta.dirname, '../../src');

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}

/** Custom properties read with var() that are neither tokens nor declared in the same file. */
function unknownTokens(css: string, known: Set<string>): string[] {
  const local = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]!));
  const used = [...css.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map((m) => m[1]!);
  return [...new Set(used)].filter((name) => !known.has(name) && !local.has(name));
}

const crlf = (text: string) => text.replaceAll('\r\n', '\n').replaceAll('\n', '\r\n');

/** Measured tokens kept off the 4px grid: border widths, and the checkbox radius (decision #86). */
const offGridAllowed = (name: string) => name.startsWith('--border-width') || name === '--radius-checkbox';

// T3: tokens.css holds exactly the tokens in docs/figma/tokens.md (AC7).
describe('design tokens', () => {
  const fromMarkdown = markdownTokens(tokensMd);
  const fromCss = cssTokens(tokensCss);

  // AC6: every token has a source; measured values are halved and on the 4px grid, except offGridAllowed.
  it('gives every token a source and keeps measured sizes on the 4px grid', () => {
    const rows = [...tokensMd.matchAll(/^\| `(--[a-z0-9-]+)` \| `([^`]+)` \| (.*) \|\r?$/gm)];
    expect(rows).toHaveLength(fromMarkdown.length);

    const offGrid = rows
      .filter(([, name, , source]) => source!.startsWith('measured') && !offGridAllowed(name!))
      .flatMap(([, name, value]) =>
        [...value!.matchAll(/(\d+(?:\.\d+)?)px/g)].filter((m) => Number(m[1]) % 4 !== 0).map(() => `${name}: ${value}`),
      );

    expect(rows.filter(([, , , source]) => !source?.trim())).toEqual([]);
    expect(offGrid).toEqual([]);
  });

  it('lists every token once in tokens.md', () => {
    const names = fromMarkdown.map(([name]) => name);
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
  });

  it('has the same names and values in tokens.css as in tokens.md', () => {
    expect(fromCss).toEqual(fromMarkdown);
  });

  // Git for Windows checks files out with CRLF (core.autocrlf), so both files may arrive that way.
  it('reads both files with CRLF line endings', () => {
    expect(cssTokens(crlf(tokensCss))).toEqual(fromCss);
    expect(markdownTokens(crlf(tokensMd))).toEqual(fromMarkdown);
  });

  it('uses only existing tokens in frontend CSS', () => {
    const known = new Set(fromCss.map(([name]) => name));
    const unknown = cssFiles(srcDir)
      .filter((file) => !file.endsWith('tokens.css'))
      .flatMap((file) =>
        unknownTokens(readFileSync(file, 'utf8'), known).map((name) => `${relative(srcDir, file)}: ${name}`),
      );

    expect(unknown).toEqual([]);
  });

  it('reports a token that does not exist', () => {
    const css = '.a { --local: var(--color-white); color: var(--local); background: var(--does-not-exist); }';

    expect(unknownTokens(css, new Set(['--color-white']))).toEqual(['--does-not-exist']);
  });

  it('rejects a tokens.css with anything besides the :root rule', () => {
    expect(() => cssTokens(`${tokensCss}\n.extra {\n  color: red;\n}\n`)).toThrow(/exactly one :root rule/);
  });
});
