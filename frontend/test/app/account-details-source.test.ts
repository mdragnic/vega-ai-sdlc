import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { accountMessages, writeGuardMessages } from '@finebank/shared';
import { describe, expect, it } from 'vitest';

const srcDir = resolve(import.meta.dirname, '../../src');
// The development-only gallery shows sample texts; it is dropped from the production build (gallery-build.test.ts).
const devDir = join(srcDir, 'app', 'dev');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (path === devDir) return [];
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const source = (path: string) => readFileSync(join(srcDir, path), 'utf8');

/** The screens of Account Details: they show the values as sent and only format them (#11, #74). */
const screens = [
  'components/AccountDetailsForm/AccountDetailsForm.tsx',
  'components/AccountDetailsCard/AccountDetailsCard.tsx',
  'app/pages/AccountDetailsPage.tsx',
];

// T20: AC20, the form's rules come only from the shared schema; the screens check, trim, count and calculate nothing.
describe('Account Details sources', () => {
  /** A rule of its own: a trim, a code point count, a Unicode class, a length limit, an arithmetic on amounts. */
  const ownRule = /\.trim(Start|End)?\(|\[\.\.\.|codePointAt|Segmenter|\\p\{|\.cents\b|\bmaxLength\b|maxlength/;

  it.each(screens)('%s has no rule or arithmetic of its own', (path) => {
    expect(source(path)).not.toMatch(ownRule);
  });

  // The page's one `.length` is task 021's empty history check; the form and the card count nothing.
  it.each(screens.slice(0, 2))('%s measures no length', (path) => {
    expect(source(path)).not.toMatch(/\.length\b/);
  });

  it('takes the form’s rule from accountDetailsRequestSchema', () => {
    expect(source(screens[0]!)).toMatch(/zodResolver\(accountDetailsRequestSchema\)/);
  });

  it.each([
    'name.trim()',
    '[...name].length',
    '/^\\p{White_Space}*$/u',
    'balance.cents - 1',
    '<input maxLength={100} />',
  ])('flags %s', (code) => {
    expect(ownRule.test(code)).toBe(true);
  });

  it('writes none of the rule’s or the guard’s texts in frontend/src: they come from @finebank/shared', () => {
    const texts = [...Object.values(accountMessages), ...Object.values(writeGuardMessages)];
    const written = sourceFiles(srcDir).flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return texts
        .filter((message) => text.includes(message))
        .map((message) => `${relative(srcDir, file)}: ${message}`);
    });

    expect(written).toEqual([]);
  });
});

/** Each `useMutation({ ... })` call of a source, up to its `mutationFn`'s line. */
const mutationFns = (text: string) =>
  [...text.matchAll(/useMutation\(\{[\s\S]*?mutationFn:([^\n]*\n[^\n]*)/g)].map((match) => match[1]!);

/** How many times a source calls `name(`. */
const calls = (text: string, name: string) => text.split(new RegExp(String.raw`\b${name}\(`)).length - 1;

// T20: AC20, every write in frontend/src/api but login, sign up and logout sends X-Expected-User through `sendWrite`.
describe('the writes in frontend/src/api', () => {
  const apiDir = join(srcDir, 'api');
  const files = readdirSync(apiDir).filter((name) => name.endsWith('.ts'));

  // Task 025: the goal save is sent through the shared write helper, `useUserWrite` in session.ts (its one
  // `useMutation`), so session.ts holds three: its two hooks (login and sign up, logout) and the helper's.
  /** How many times each file of frontend/src/api calls `name(`. */
  const counts = (name: string) =>
    Object.fromEntries(files.map((file) => [file, calls(readFileSync(join(apiDir, file), 'utf8'), name)]));

  // Task 027: the limit save is the second write through `useUserWrite`.
  it('finds the mutations: the goal and limit saves (through useUserWrite), the account save and the session’s hooks', () => {
    expect(counts('useMutation')).toMatchObject({
      'accounts.ts': 1,
      'savings-goals.ts': 0,
      'category-limits.ts': 0,
      'session.ts': 3,
    });
    expect(Object.values(counts('useMutation')).reduce((sum, count) => sum + count, 0)).toBe(4);
    expect(counts('useUserWrite')).toMatchObject({ 'savings-goals.ts': 1, 'category-limits.ts': 1 });
    expect(Object.values(counts('useUserWrite')).reduce((sum, count) => sum + count, 0)).toBe(2);
  });

  it.each(files.filter((name) => name !== 'session.ts'))('sends every mutation of %s through sendWrite', (name) => {
    const text = readFileSync(join(apiDir, name), 'utf8');
    expect(mutationFns(text)).toHaveLength(calls(text, 'useMutation'));
    for (const mutationFn of mutationFns(text)) {
      expect(mutationFn).toMatch(/\bsendWrite\(queryClient,/);
      expect(mutationFn).not.toMatch(/\bapiRequest\(/);
    }
  });

  // Task 025: session.ts calls it once, as the shared write helper's mutationFn; its own mutations never do.
  it('sends the session’s own mutations (login, sign up, logout) without it: only useUserWrite calls it', () => {
    const text = source('api/session.ts');
    const helper = /\nexport function useUserWrite<[\s\S]*?\n\}\n/.exec(text)?.[0] ?? '';

    expect(text).toMatch(/export async function sendWrite</);
    expect(mutationFns(helper)).toHaveLength(1);
    expect(mutationFns(helper)[0]).toMatch(/\bsendWrite\(queryClient,/);
    expect(calls(text.replace(helper, ''), 'sendWrite')).toBe(0);
  });

  it('calls apiWrite only from sendWrite', () => {
    const callers = sourceFiles(srcDir)
      .filter((file) => /\bapiWrite\(/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(srcDir, file).replaceAll('\\', '/'));

    expect(callers).toEqual(['api/session.ts']);
    expect(source('api/session.ts').match(/\bapiWrite\(/g)).toHaveLength(1);
  });
});
