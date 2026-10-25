import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// T16, T20: full account numbers and the unfiltered transaction list stay inside bank-data/ and demo/
// (#25, #53, #77). Task 013 adds its masking function as the one other reader of accountNumber.
const srcDir = resolve(import.meta.dirname, '../src');
const allowedFolders = ['bank-data/', 'demo/'];

/** Every reference to the name, also as a string key or in destructuring. */
const guards = {
  accountNumber: /\baccountNumber\b/,
  // Later tasks read transactions through VisibleTransactions.list, never the provider (#53).
  listTransactions: /\blistTransactions\b/,
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('bank data in backend/src', () => {
  const files = sourceFiles(srcDir).map((file) => relative(srcDir, file).replaceAll('\\', '/'));
  const outside = files.filter((file) => !allowedFolders.some((folder) => file.startsWith(folder)));

  it('finds the source files inside and outside bank-data/ and demo/', () => {
    expect(files).toEqual(
      expect.arrayContaining([
        'bank-data/typeorm-bank-data-provider.ts',
        'demo/demo-seeder.ts',
        'auth/auth.service.ts',
      ]),
    );
    expect(outside.length).toBeGreaterThan(10);
  });

  it.each(Object.entries(guards))('uses %s only in bank-data/ and demo/', (_name, pattern) => {
    const offenders = outside.filter((file) => pattern.test(readFileSync(join(srcDir, file), 'utf8')));

    expect(offenders).toEqual([]);
  });

  it.each([
    ['accountNumber', 'return { number: account.accountNumber };'],
    ['accountNumber', 'const { accountNumber } = account;'],
    ['accountNumber', "account['accountNumber']"],
    ['listTransactions', 'await this.bankData.listTransactions(userId, {});'],
    ['listTransactions', "provider['listTransactions'](userId)"],
    ['listTransactions', 'const { listTransactions } = this.bankData;'],
  ] as const)('flags a use of %s: %s', (name, code) => {
    expect(guards[name].test(code)).toBe(true);
  });

  it.each([
    ['accountNumber', 'const masked = maskAccountNumber(row);'],
    ['accountNumber', 'SELECT account_number FROM accounts'],
    ['listTransactions', 'await this.visibleTransactions.list(userId, timeZone, filter);'],
  ] as const)('allows %s look-alikes: %s', (name, code) => {
    expect(guards[name].test(code)).toBe(false);
  });
});
