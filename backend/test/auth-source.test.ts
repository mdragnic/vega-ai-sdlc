import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// T17: hashing never blocks the event loop, and secrets never come from Math.random (#75).
const srcDir = resolve(import.meta.dirname, '../src');
const folders = ['auth', 'users'];
const forbidden = [/\bscryptSync\b/, /\bMath\.random\b/];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('auth and users sources', () => {
  const files = folders.flatMap((folder) => sourceFiles(join(srcDir, folder)));

  it('finds the source files', () => {
    expect(files.map((file) => relative(srcDir, file).replaceAll('\\', '/'))).toEqual(
      expect.arrayContaining(['auth/password.ts', 'users/username.ts']),
    );
  });

  it('never use scryptSync or Math.random', () => {
    const offenders = files.filter((file) => forbidden.some((pattern) => pattern.test(readFileSync(file, 'utf8'))));

    expect(offenders).toEqual([]);
  });

  it.each(['scryptSync(password, salt, 64)', 'const n = Math.random();'])('flags %s', (code) => {
    expect(forbidden.some((pattern) => pattern.test(code))).toBe(true);
  });
});

/** A file's code without its comments, which may name the rules they point to. */
const codeOf = (file: string): string =>
  readFileSync(file, 'utf8')
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');

// Task 012 AC16: the backend redirects with the route paths, the Google routes, the marker and the message of
// @finebank/shared; it writes none of them itself (#74).
describe('Google sign-in sources', () => {
  const ownRules = [
    /(['"`])\/(login|sign-up|forgot-password|overview)\b/,
    /(['"`])returnTo\1/,
    /(['"`])googleSignIn\1/,
    /googleSignIn=/,
    /\/auth\/google/,
    /Google sign-in failed\. Please try again\./,
  ];

  it('writes no path, Google route, marker or message of its own', () => {
    const offenders = sourceFiles(srcDir)
      .filter((file) => ownRules.some((pattern) => pattern.test(codeOf(file))))
      .map((file) => relative(srcDir, file).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it.each([
    "const login = '/login';",
    "query.set('returnTo', target);",
    'const marker = `googleSignIn=failed`;',
    "@Get('/auth/google/callback')",
  ])('flags %s', (code) => {
    expect(ownRules.some((pattern) => pattern.test(code))).toBe(true);
  });
});
