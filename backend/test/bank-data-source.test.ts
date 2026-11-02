import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// T16, T20 (task 008), T7 (task 013): full account numbers and the unfiltered transaction list stay inside
// bank-data/ and demo/ (#25, #53, #77). The masking function is the one other reader of accountNumber.
const srcDir = resolve(import.meta.dirname, '../src');
const allowedFolders = ['bank-data/', 'demo/'];

/** Every reference to the name, also as a string key or in destructuring. */
const guards = {
  accountNumber: /\baccountNumber\b/,
  // Later tasks read transactions through VisibleTransactions.list, never the provider (#53).
  listTransactions: /\blistTransactions\b/,
};

/** The single files outside those folders that may use a name. */
const allowedFiles: Record<keyof typeof guards, string[]> = {
  accountNumber: ['accounts/mask-account-number.ts'],
  listTransactions: [],
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
        'accounts/accounts.service.ts',
        'accounts/mask-account-number.ts',
        // Task 016 T6: the Recent Transaction module reads through VisibleTransactions only.
        'transactions/transactions.service.ts',
        'transactions/transactions.controller.ts',
        // Task 017 T9: the Statistics module reads through VisibleTransactions only.
        'statistics/statistics.service.ts',
        'statistics/statistics.controller.ts',
        // Task 018 T8: the Expenses Breakdown module reads through VisibleTransactions only.
        'expenses/expenses.service.ts',
        'expenses/expenses.controller.ts',
        'expenses/percent-change.ts',
      ]),
    );
    expect(outside.length).toBeGreaterThan(10);
  });

  it.each(Object.entries(guards))('uses %s only in bank-data/, demo/ and its allowed files', (name, pattern) => {
    const offenders = outside.filter(
      (file) =>
        !allowedFiles[name as keyof typeof guards].includes(file) &&
        pattern.test(readFileSync(join(srcDir, file), 'utf8')),
    );

    expect(offenders).toEqual([]);
  });

  // The exception is the one that is needed: the masking function reads the number, nothing else outside does.
  it('allows accountNumber in the masking function, which reads it', () => {
    const masking = readFileSync(join(srcDir, allowedFiles.accountNumber[0]!), 'utf8');

    expect(guards.accountNumber.test(masking)).toBe(true);
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

// Task 021 T13, AC12 and AC19: one account is read only through the provider's getAccount, whose one query holds the
// user and the account (#39), and only by AccountsService; the accounts and transactions modules never pick an account
// by comparing IDs, so no account is fetched and then compared with the user.
describe('one account in backend/src', () => {
  const files = sourceFiles(srcDir).map((file) => relative(srcDir, file).replaceAll('\\', '/'));
  const outside = files.filter((file) => !allowedFolders.some((folder) => file.startsWith(folder)));
  const getAccount = /\bgetAccount\b/;
  const comparesAnId = /(===|!==|==|!=)\s*(\w+\.)?(accountId|id)\b|\b(accountId|\w+\.id)\s*(===|!==|==|!=)/;

  it('reads one account through getAccount in AccountsService only', () => {
    const users = outside.filter((file) => getAccount.test(readFileSync(join(srcDir, file), 'utf8')));

    expect(users).toEqual(['accounts/accounts.service.ts']);
  });

  it('never compares an account ID in the accounts and transactions modules', () => {
    const modules = files.filter((file) => file.startsWith('accounts/') || file.startsWith('transactions/'));
    const offenders = modules.filter((file) => comparesAnId.test(readFileSync(join(srcDir, file), 'utf8')));

    expect(modules).toEqual(
      expect.arrayContaining(['accounts/accounts.service.ts', 'transactions/transactions.service.ts']),
    );
    expect(offenders).toEqual([]);
  });

  // Task 022 T9, AC9 and AC20: accounts change only through the provider's updateAccountDetails, in AccountsService's
  // updateDetails, never after a getAccount or listAccounts in that method (#39, #77).
  it('changes an account through updateAccountDetails in AccountsService only', () => {
    const users = outside.filter((file) => /\bupdateAccountDetails\b/.test(readFileSync(join(srcDir, file), 'utf8')));

    expect(users).toEqual(['accounts/accounts.service.ts']);
  });

  it('reads no account in AccountsService.updateDetails: the write is the check', () => {
    const source = readFileSync(join(srcDir, 'accounts/accounts.service.ts'), 'utf8');
    const method = /\n {2}async updateDetails\([\s\S]*?\n {2}\}\n/.exec(source)?.[0];

    expect(method).toBeDefined();
    expect(method).toMatch(/this\.bankData\.updateAccountDetails\(/);
    expect(method).not.toMatch(/\b(getAccount|listAccounts|hasAccount|details|summary|accountTypes)\(/);
  });

  it.each([
    'accounts.find((account) => account.id === accountId)',
    'if (accountId !== row.accountId) return null;',
    'accounts.filter((a) => a.id == id)',
  ])('flags the comparison %s', (code) => {
    expect(comparesAnId.test(code)).toBe(true);
  });

  it.each(['balances.get(account.id)', 'this.bankData.getAccount(userId, accountId)', 'accountTypes.get(accountId)'])(
    'allows %s',
    (code) => {
      expect(comparesAnId.test(code)).toBe(false);
    },
  );
});
