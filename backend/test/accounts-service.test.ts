import { type AccountDetailsRequest, accountsResponseSchema } from '@finebank/shared';
import { describe, expect, it, vi } from 'vitest';

import { AccountsService } from '../src/accounts/accounts.service.js';
import type { BankAccount, BankDataProvider, BankTransaction } from '../src/bank-data/bank-data-provider.js';
import type { VisibleTransactions } from '../src/bank-data/visible-transactions.js';

const USER_ID = 7;
const ZONE = 'Europe/Belgrade';

const creditCard: BankAccount = {
  id: 10,
  accountType: 'credit-card',
  bankName: 'Master Card',
  branchName: 'Main Branch',
  cardNetwork: 'mastercard',
  accountNumber: '3388455688602598',
  openingBalanceCents: 100_000,
};

const checking: BankAccount = {
  id: 11,
  accountType: 'checking',
  bankName: 'AB Bank Ltd',
  branchName: 'Park Street Branch',
  cardNetwork: 'visa',
  accountNumber: '6934566990127310',
  openingBalanceCents: 50_000,
};

let nextId = 1;

function transaction(
  fields: Pick<BankTransaction, 'accountId' | 'direction' | 'status' | 'amountCents'>,
): BankTransaction {
  nextId += 1;
  return {
    id: nextId,
    occurredAt: new Date('2026-10-20T12:00:00Z'),
    category: fields.direction === 'expense' ? 'food' : null,
    item: `Item ${nextId}`,
    shopName: 'Pizza Hit',
    receipt: `R${nextId}`,
    ...fields,
  };
}

/** The service on a fake provider, whose listTransactions fails the test, and a fake VisibleTransactions. */
function serviceWith(accounts: BankAccount[], transactions: BankTransaction[]) {
  const listTransactions = vi.fn<BankDataProvider['listTransactions']>(() => {
    throw new Error('Transactions are read through VisibleTransactions only');
  });
  const listAccounts = vi.fn<BankDataProvider['listAccounts']>((userId) =>
    Promise.resolve(userId === USER_ID ? accounts : []),
  );
  const provider: BankDataProvider = {
    listAccounts,
    getAccount: vi.fn<BankDataProvider['getAccount']>(),
    updateAccountDetails: vi.fn<BankDataProvider['updateAccountDetails']>(),
    listTransactions,
    earliestTransactionAt: vi.fn<BankDataProvider['earliestTransactionAt']>(),
  };
  const list = vi.fn<VisibleTransactions['list']>(() => Promise.resolve({ transactions, nextCursor: null }));
  const visible = { list } as unknown as VisibleTransactions;
  return { service: new AccountsService(provider, visible), listAccounts, list, listTransactions };
}

const usd = (cents: number) => ({ cents, currency: 'USD' });

// T2, AC9 and AC11: balance = opening balance + Complete income − Complete expense, in integer cents (#11, #57).
describe('AccountsService.summary', () => {
  it('adds Complete income and subtracts Complete expenses per account; Pending and Failed never count', async () => {
    const { service } = serviceWith(
      [creditCard, checking],
      [
        transaction({ accountId: 10, direction: 'income', status: 'complete', amountCents: 20_000 }),
        transaction({ accountId: 10, direction: 'expense', status: 'complete', amountCents: 5_000 }),
        transaction({ accountId: 10, direction: 'expense', status: 'pending', amountCents: 7_000 }),
        transaction({ accountId: 10, direction: 'income', status: 'failed', amountCents: 9_000 }),
        transaction({ accountId: 11, direction: 'expense', status: 'complete', amountCents: 1_234 }),
        transaction({ accountId: 11, direction: 'income', status: 'pending', amountCents: 3_000 }),
        transaction({ accountId: 11, direction: 'expense', status: 'failed', amountCents: 4_000 }),
      ],
    );

    const summary = await service.summary(USER_ID, ZONE);

    expect(summary.accounts.map((account) => [account.id, account.balance])).toEqual([
      [10, usd(115_000)],
      [11, usd(48_766)],
    ]);
    expect(summary.totalBalance).toEqual(usd(163_766));
  });

  it('counts a transaction only on its own account, never on one the user does not have', async () => {
    const { service } = serviceWith(
      [creditCard, checking],
      [
        transaction({ accountId: 11, direction: 'income', status: 'complete', amountCents: 2_500 }),
        transaction({ accountId: 99, direction: 'income', status: 'complete', amountCents: 1_000_000 }),
      ],
    );

    const summary = await service.summary(USER_ID, ZONE);

    expect(summary.accounts.map((account) => account.balance.cents)).toEqual([100_000, 52_500]);
    expect(summary.totalBalance).toEqual(usd(152_500));
  });

  it('gives the opening balances with no transactions, and a balance below zero as it is', async () => {
    const { service } = serviceWith(
      [creditCard, { ...checking, openingBalanceCents: 0 }],
      [transaction({ accountId: 11, direction: 'expense', status: 'complete', amountCents: 999 })],
    );
    const empty = serviceWith([creditCard, checking], []).service;

    expect((await empty.summary(USER_ID, ZONE)).accounts.map((account) => account.balance.cents)).toEqual([
      100_000, 50_000,
    ]);
    expect((await empty.summary(USER_ID, ZONE)).totalBalance).toEqual(usd(150_000));
    expect((await service.summary(USER_ID, ZONE)).accounts[1]!.balance).toEqual(usd(-999));
  });

  it('gives 0 cents and no accounts to a user without accounts', async () => {
    const { service } = serviceWith([], []);

    expect(await service.summary(USER_ID, ZONE)).toEqual({ totalBalance: usd(0), accounts: [] });
  });

  it('keeps the provider’s order, oldest first (#24)', async () => {
    const { service } = serviceWith([checking, creditCard], []);

    expect((await service.summary(USER_ID, ZONE)).accounts.map((account) => account.id)).toEqual([11, 10]);
  });

  it('reads transactions through VisibleTransactions with the user and the zone, never the provider (#53)', async () => {
    const { service, listAccounts, list, listTransactions } = serviceWith([creditCard], []);

    await service.summary(USER_ID, ZONE);

    expect(listAccounts).toHaveBeenCalledWith(USER_ID);
    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledWith(USER_ID, ZONE);
    expect(listTransactions).not.toHaveBeenCalled();
  });

  // AC8, #25; task 019 T2, AC6 and AC7: only the contract's fields, the number masked, each account's own Bank Name.
  it('answers with the contract’s fields only, the number masked', async () => {
    const { service } = serviceWith([creditCard, { ...checking, cardNetwork: null }], []);

    const summary = await service.summary(USER_ID, ZONE);

    expect(accountsResponseSchema.strict().parse(summary)).toEqual(summary);
    expect(summary.accounts).toEqual([
      {
        id: 10,
        accountType: 'credit-card',
        bankName: 'Master Card',
        cardNetwork: 'mastercard',
        maskedNumber: '**** **** **** 2598',
        balance: usd(100_000),
      },
      {
        id: 11,
        accountType: 'checking',
        bankName: 'AB Bank Ltd',
        cardNetwork: null,
        maskedNumber: '**** **** **** 7310',
        balance: usd(50_000),
      },
    ]);
    expect(Object.keys(summary).toSorted()).toEqual(['accounts', 'totalBalance']);
    for (const account of summary.accounts) {
      expect(Object.keys(account).toSorted()).toEqual([
        'accountType',
        'balance',
        'bankName',
        'cardNetwork',
        'id',
        'maskedNumber',
      ]);
    }
    expect(JSON.stringify(summary)).not.toMatch(/3388|69345|Main Branch|Park Street|openingBalance|branchName/);
  });

  // Task 019 T2, AC6: the Bank Name of each account is its own, in the provider's order (#57).
  it('gives each account its own Bank Name, whatever the order', async () => {
    const { service } = serviceWith(
      [
        { ...checking, bankName: 'City Bank Ltd.' },
        { ...creditCard, bankName: 'Brac Bank Ltd.' },
      ],
      [],
    );

    const summary = await service.summary(USER_ID, ZONE);

    expect(summary.accounts.map(({ id, bankName }) => [id, bankName])).toEqual([
      [11, 'City Bank Ltd.'],
      [10, 'Brac Bank Ltd.'],
    ]);
  });

  // #11: an amount past Number.MAX_SAFE_INTEGER cents is an error (a 500), never a wrong amount.
  it.each([
    [
      'an account balance',
      [{ ...creditCard, openingBalanceCents: Number.MAX_SAFE_INTEGER }],
      [transaction({ accountId: 10, direction: 'income', status: 'complete', amountCents: 1 })],
    ],
    [
      'an account balance below the safe range',
      [{ ...creditCard, openingBalanceCents: Number.MIN_SAFE_INTEGER }],
      [transaction({ accountId: 10, direction: 'expense', status: 'complete', amountCents: 1 })],
    ],
    [
      'the total',
      [
        { ...creditCard, openingBalanceCents: 2 ** 52 },
        { ...checking, openingBalanceCents: 2 ** 52 },
      ],
      [],
    ],
    ['an opening balance that is not an integer', [{ ...creditCard, openingBalanceCents: 0.5 }], []],
  ])('throws on %s past the safe integers', async (_case, accounts, transactions) => {
    const { service } = serviceWith(accounts, transactions);

    await expect(service.summary(USER_ID, ZONE)).rejects.toThrow(RangeError);
  });
});

// Task 020 T6, AC10: each account's type by its ID, the Payment Method of its transactions, from the provider's accounts
// (#57, #77); read fresh on every call, so a changed type shows on the next request.
describe('AccountsService.accountTypes', () => {
  it('maps each of the user’s accounts to its type, reading no transaction', async () => {
    const { service, listAccounts, list, listTransactions } = serviceWith([creditCard, checking], []);

    const types = await service.accountTypes(USER_ID);

    expect([...types]).toEqual([
      [10, 'credit-card'],
      [11, 'checking'],
    ]);
    expect(listAccounts).toHaveBeenCalledWith(USER_ID);
    expect(list).not.toHaveBeenCalled();
    expect(listTransactions).not.toHaveBeenCalled();
  });

  it('answers another user’s accounts only for that user: here none', async () => {
    const { service } = serviceWith([creditCard, checking], []);

    expect([...(await service.accountTypes(USER_ID + 1))]).toEqual([]);
  });

  it('reads the types again on every call', async () => {
    const accounts = [creditCard, checking];
    const { service } = serviceWith(accounts, []);
    await service.accountTypes(USER_ID);

    accounts[1] = { ...checking, accountType: 'savings' };

    expect((await service.accountTypes(USER_ID)).get(11)).toBe('savings');
  });
});

/**
 * The service on a fake provider whose `getAccount` finds an account only for its user and ID, as the provider's one
 * query does, and a fake VisibleTransactions that filters by the account as the provider does.
 */
function detailsServiceWith(accounts: BankAccount[], transactions: BankTransaction[]) {
  const listTransactions = vi.fn<BankDataProvider['listTransactions']>(() => {
    throw new Error('Transactions are read through VisibleTransactions only');
  });
  const listAccounts = vi.fn<BankDataProvider['listAccounts']>((userId) =>
    Promise.resolve(userId === USER_ID ? accounts : []),
  );
  const getAccount = vi.fn<BankDataProvider['getAccount']>((userId, accountId) =>
    Promise.resolve(userId === USER_ID ? (accounts.find((account) => account.id === accountId) ?? null) : null),
  );
  const provider: BankDataProvider = {
    listAccounts,
    getAccount,
    updateAccountDetails: vi.fn<BankDataProvider['updateAccountDetails']>(),
    listTransactions,
    earliestTransactionAt: vi.fn<BankDataProvider['earliestTransactionAt']>(),
  };
  const list = vi.fn<VisibleTransactions['list']>((userId, _zone, filter = {}) =>
    Promise.resolve({
      transactions:
        userId === USER_ID
          ? transactions.filter((row) => filter.accountId === undefined || row.accountId === filter.accountId)
          : [],
      nextCursor: null,
    }),
  );
  const visible = { list } as unknown as VisibleTransactions;
  return { service: new AccountsService(provider, visible), listAccounts, getAccount, list, listTransactions };
}

/** Task 013 T2's two accounts with Complete, Pending and Failed rows on each. */
const mixedRows = () => [
  transaction({ accountId: 10, direction: 'income', status: 'complete', amountCents: 20_000 }),
  transaction({ accountId: 10, direction: 'expense', status: 'complete', amountCents: 5_000 }),
  transaction({ accountId: 10, direction: 'expense', status: 'pending', amountCents: 7_000 }),
  transaction({ accountId: 10, direction: 'income', status: 'failed', amountCents: 9_000 }),
  transaction({ accountId: 11, direction: 'expense', status: 'complete', amountCents: 1_234 }),
  transaction({ accountId: 11, direction: 'income', status: 'pending', amountCents: 3_000 }),
  transaction({ accountId: 11, direction: 'expense', status: 'failed', amountCents: 4_000 }),
];

// Task 021 T2, AC9, AC10, AC12 and AC19: one account's five fields, the balance from the one calculation (#57), the
// account read only through getAccount, the user and the account in one query (#39).
describe('AccountsService.details', () => {
  it('answers exactly the five fields, the number masked, the balance the Complete rows only', async () => {
    const { service } = detailsServiceWith([creditCard, checking], mixedRows());

    const details = await service.details(USER_ID, ZONE, 10);

    expect(details).toEqual({
      accountType: 'credit-card',
      bankName: 'Master Card',
      branchName: 'Main Branch',
      maskedNumber: '**** **** **** 2598',
      balance: usd(115_000),
    });
    expect(Object.keys(details!).toSorted()).toEqual([
      'accountType',
      'balance',
      'bankName',
      'branchName',
      'maskedNumber',
    ]);
    expect(JSON.stringify(details)).not.toMatch(/3388|4556|8860|openingBalance|cardNetwork|mastercard|"id"/);
  });

  it('gives each account the balance summary gives it', async () => {
    const { service } = detailsServiceWith([creditCard, checking], mixedRows());

    const summary = await service.summary(USER_ID, ZONE);

    for (const account of summary.accounts) {
      expect((await service.details(USER_ID, ZONE, account.id))!.balance).toEqual(account.balance);
    }
    expect(summary.accounts.map((account) => account.balance.cents)).toEqual([115_000, 48_766]);
  });

  it('reads the account once through getAccount with the user and the account, never listAccounts', async () => {
    const { service, getAccount, listAccounts, list, listTransactions } = detailsServiceWith(
      [creditCard, checking],
      mixedRows(),
    );

    await service.details(USER_ID, ZONE, 11);

    expect(getAccount).toHaveBeenCalledTimes(1);
    expect(getAccount).toHaveBeenCalledWith(USER_ID, 11);
    expect(listAccounts).not.toHaveBeenCalled();
    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledWith(USER_ID, ZONE, { accountId: 11 });
    expect(listTransactions).not.toHaveBeenCalled();
  });

  it.each([
    ['an ID no account has', USER_ID, 99],
    ['another user’s request for this user’s account', USER_ID + 1, 10],
  ])('answers null for %s, reading no transaction', async (_case, userId, accountId) => {
    const { service, list, listTransactions } = detailsServiceWith([creditCard, checking], mixedRows());

    expect(await service.details(userId, ZONE, accountId)).toBeNull();
    expect(list).not.toHaveBeenCalled();
    expect(listTransactions).not.toHaveBeenCalled();
  });

  it('throws on a balance past the safe integers, as summary does (#11)', async () => {
    const { service } = detailsServiceWith(
      [{ ...creditCard, openingBalanceCents: Number.MAX_SAFE_INTEGER }],
      [transaction({ accountId: 10, direction: 'income', status: 'complete', amountCents: 1 })],
    );

    await expect(service.details(USER_ID, ZONE, 10)).rejects.toThrow(RangeError);
  });
});

// Task 021: whether the account is the user's, for the history's 404; one getAccount, no transaction read.
describe('AccountsService.hasAccount', () => {
  it.each([
    ['the user’s own account', USER_ID, 11, true],
    ['an ID no account has', USER_ID, 99, false],
    ['another user’s request for this user’s account', USER_ID + 1, 11, false],
  ])('answers %s: %s', async (_case, userId, accountId, expected) => {
    const { service, getAccount, listAccounts, list } = detailsServiceWith([creditCard, checking], mixedRows());

    expect(await service.hasAccount(userId, accountId)).toBe(expected);
    expect(getAccount).toHaveBeenCalledExactlyOnceWith(userId, accountId);
    expect(listAccounts).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });
});

/**
 * The service on a fake provider that stores the details only for its user and an account it has, in one call, as the
 * provider's one `UPDATE` does, and answers the stored account (null when no row matched); every provider and
 * VisibleTransactions call is recorded in order.
 */
function updateServiceWith(accounts: BankAccount[], transactions: BankTransaction[]) {
  const calls: string[] = [];
  const stored = accounts.map((account) => ({ ...account }));
  const updateAccountDetails = vi.fn<BankDataProvider['updateAccountDetails']>((userId, accountId, details) => {
    calls.push('updateAccountDetails');
    const account = userId === USER_ID ? stored.find((row) => row.id === accountId) : undefined;
    if (account === undefined) return Promise.resolve(null);
    Object.assign(account, details);
    return Promise.resolve({ ...account });
  });
  const getAccount = vi.fn<BankDataProvider['getAccount']>((userId, accountId) => {
    calls.push('getAccount');
    return Promise.resolve(userId === USER_ID ? (stored.find((row) => row.id === accountId) ?? null) : null);
  });
  const listAccounts = vi.fn<BankDataProvider['listAccounts']>((userId) => {
    calls.push('listAccounts');
    return Promise.resolve(userId === USER_ID ? stored : []);
  });
  const listTransactions = vi.fn<BankDataProvider['listTransactions']>(() => {
    throw new Error('Transactions are read through VisibleTransactions only');
  });
  const provider: BankDataProvider = {
    listAccounts,
    getAccount,
    updateAccountDetails,
    listTransactions,
    earliestTransactionAt: vi.fn<BankDataProvider['earliestTransactionAt']>(),
  };
  const list = vi.fn<VisibleTransactions['list']>((userId, _zone, filter = {}) => {
    calls.push('list');
    return Promise.resolve({
      transactions:
        userId === USER_ID
          ? transactions.filter((row) => filter.accountId === undefined || row.accountId === filter.accountId)
          : [],
      nextCursor: null,
    });
  });
  const visible = { list } as unknown as VisibleTransactions;
  return { service: new AccountsService(provider, visible), calls, updateAccountDetails, list, listTransactions };
}

const nordic: AccountDetailsRequest = { bankName: 'Nordic Bank', branchName: 'Harbour Branch', accountType: 'savings' };

// T2, AC7, AC9 and AC20: the write is the provider's one update (#77), never after a read of the account (#39); the
// answer is the account's details from the one balance calculation (#57).
describe('AccountsService.updateDetails', () => {
  it('stores the three fields through updateAccountDetails once and answers exactly the five keys', async () => {
    const { service, updateAccountDetails } = updateServiceWith([creditCard, checking], mixedRows());

    const details = await service.updateDetails(USER_ID, ZONE, 11, nordic);

    expect(updateAccountDetails).toHaveBeenCalledExactlyOnceWith(USER_ID, 11, nordic);
    expect(details).toEqual({
      accountType: 'savings',
      bankName: 'Nordic Bank',
      branchName: 'Harbour Branch',
      maskedNumber: '**** **** **** 7310',
      balance: usd(48_766),
    });
    expect(Object.keys(details!).toSorted()).toEqual([
      'accountType',
      'balance',
      'bankName',
      'branchName',
      'maskedNumber',
    ]);
    expect(JSON.stringify(details)).not.toMatch(/6934|5669|9012|openingBalance|cardNetwork|visa|"id"/);
  });

  it('writes first, reading no account before it and never listAccounts; then the account’s transactions', async () => {
    const { service, calls, list, listTransactions } = updateServiceWith([creditCard, checking], mixedRows());

    await service.updateDetails(USER_ID, ZONE, 11, nordic);

    expect(calls).toEqual(['updateAccountDetails', 'list']);
    expect(list).toHaveBeenCalledExactlyOnceWith(USER_ID, ZONE, { accountId: 11 });
    expect(listTransactions).not.toHaveBeenCalled();
  });

  it('passes only the three editable fields, whatever else the request object holds', async () => {
    const { service, updateAccountDetails } = updateServiceWith([creditCard, checking], mixedRows());
    const request = {
      ...nordic,
      id: 10,
      userId: USER_ID + 1,
      accountNumber: '1111222233334444',
      cardNetwork: null,
      openingBalanceCents: 1,
    } as AccountDetailsRequest;

    await service.updateDetails(USER_ID, ZONE, 11, request);

    expect(updateAccountDetails).toHaveBeenCalledExactlyOnceWith(USER_ID, 11, nordic);
  });

  it('gives the balance details gives the account after the write', async () => {
    const { service } = updateServiceWith([creditCard, checking], mixedRows());

    const updated = await service.updateDetails(USER_ID, ZONE, 10, nordic);

    expect(updated!.balance).toEqual((await service.details(USER_ID, ZONE, 10))!.balance);
    expect(updated!.balance).toEqual(usd(115_000));
  });

  it.each([
    ['an ID no account has', USER_ID, 99],
    ['another user’s request for this user’s account', USER_ID + 1, 10],
  ])('answers null for %s, reading no transaction', async (_case, userId, accountId) => {
    const { service, calls, listTransactions } = updateServiceWith([creditCard, checking], mixedRows());

    expect(await service.updateDetails(userId, ZONE, accountId, nordic)).toBeNull();
    expect(calls).toEqual(['updateAccountDetails']);
    expect(listTransactions).not.toHaveBeenCalled();
  });
});
