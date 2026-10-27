import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// T8: backend code reads "now" only through the injected Clock (#54, #80, AC10).
const srcDir = resolve(import.meta.dirname, '../src');
const clockFiles = ['common/clock/system-clock.ts'];
const directTime = [
  /\bDate\.now\s*\(/, // Date.now()
  /\bnew\s+Date\s*\(\s*\)/, // new Date()
  /\bnew\s+Date\b(?!\s*\()/, // new Date (no parentheses)
  /(?<![\w.$])(?<!new\s+)Date\s*\(/, // Date() called without new returns the current time as a string
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('time in backend/src', () => {
  it('finds the source files', () => {
    expect(sourceFiles(srcDir).length).toBeGreaterThan(5);
  });

  // Task 015 T6: the upcoming bills read today from the Clock only.
  it('scans the bills module', () => {
    const files = sourceFiles(srcDir).map((file) => relative(srcDir, file).replaceAll('\\', '/'));

    expect(files).toEqual(expect.arrayContaining(['bills/bills.service.ts', 'bills/bills.controller.ts']));
  });

  // Task 016 T6: the recent transactions read today from the Clock only, through VisibleTransactions.
  it('scans the transactions module', () => {
    const files = sourceFiles(srcDir).map((file) => relative(srcDir, file).replaceAll('\\', '/'));

    expect(files).toEqual(
      expect.arrayContaining(['transactions/transactions.service.ts', 'transactions/transactions.controller.ts']),
    );
  });

  it('never reads the system time outside the clock files', () => {
    const offenders = sourceFiles(srcDir)
      .map((file) => relative(srcDir, file).replaceAll('\\', '/'))
      .filter((file) => !clockFiles.includes(file))
      .filter((file) => directTime.some((pattern) => pattern.test(readFileSync(join(srcDir, file), 'utf8'))));

    expect(offenders).toEqual([]);
  });

  it.each(['const t = Date.now();', 'const d = new Date();', 'const d = new Date;', 'const s = Date();'])(
    'flags %s',
    (code) => {
      expect(directTime.some((p) => p.test(code))).toBe(true);
    },
  );

  it.each([
    "const d = new Date('2026-10-22');",
    'const d = new Date(this.instant);',
    'const t = Date.parse(value);',
    'const d: Date = clock.now();',
    'const u = updateDate();',
  ])('allows %s', (code) => {
    expect(directTime.some((p) => p.test(code))).toBe(false);
  });
});
