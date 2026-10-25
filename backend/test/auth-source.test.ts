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
