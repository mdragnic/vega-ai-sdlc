import { accountsResponseSchema } from '@finebank/shared';
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

  // AC8, #25: only the contract's fields, the number masked.
  it('answers with the contract’s fields only, the number masked', async () => {
    const { service } = serviceWith([creditCard, { ...checking, cardNetwork: null }], []);

    const summary = await service.summary(USER_ID, ZONE);

    expect(accountsResponseSchema.strict().parse(summary)).toEqual(summary);
    expect(summary.accounts).toEqual([
      {
        id: 10,
        accountType: 'credit-card',
        cardNetwork: 'mastercard',
        maskedNumber: '**** **** **** 2598',
        balance: usd(100_000),
      },
      { id: 11, accountType: 'checking', cardNetwork: null, maskedNumber: '**** **** **** 7310', balance: usd(50_000) },
    ]);
    expect(JSON.stringify(summary)).not.toMatch(/3388|69345|Master Card|AB Bank|openingBalance|bankName/);
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
