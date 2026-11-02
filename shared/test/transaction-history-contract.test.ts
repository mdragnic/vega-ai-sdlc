import { describe, expect, it } from 'vitest';

import {
  accountParamsSchema,
  transactionHistoryPageSchema,
  transactionHistoryQuerySchema,
  transactionHistoryRowSchema,
  transactionsContract,
  transactionsPageSchema,
  transactionsQuerySchema,
  transactionStatusLabel,
  transactionTypeLabel,
} from '../src/index.js';

const usd = (cents: number) => ({ cents, currency: 'USD' });

/** Checking's newest row at the fixed clock: Jeans (task 021 References). */
const jeans = {
  occurredAt: '2026-10-22T12:00:00.000Z',
  status: 'complete',
  direction: 'expense',
  receipt: 'z7YBsODpLNW',
  amount: usd(26_600),
};

/** The Credit Card's Failed Pizza, its fifth row. */
const failedPizza = {
  occurredAt: '2026-10-16T12:00:00.000Z',
  status: 'failed',
  direction: 'expense',
  receipt: 'CFP5E9VV2Fn',
  amount: usd(2_464),
};

/** A Freelance payment on Checking. */
const freelance = { ...jeans, direction: 'income', receipt: 'SVqWhlvmJqw', amount: usd(17_920) };

const without = (key: keyof typeof jeans) => Object.fromEntries(Object.entries(jeans).filter(([name]) => name !== key));

// Task 021 T1, AC11: one history row: the UTC timestamp, the status, the direction, the receipt as text and the amount
// in integer cents 0 or more with USD, the listed rows' rules (#11, #19, #27, #96). No item, shop, category, Payment
// Method, ID or account.
describe('transactionHistoryRowSchema', () => {
  it.each<[string, unknown]>([
    ['a Complete expense', jeans],
    ['a Failed expense', failedPizza],
    ['a Pending one', { ...jeans, status: 'pending' }],
    ['income', freelance],
    ['an amount of 0 cents', { ...jeans, amount: usd(0) }],
    ['a 120-character receipt', { ...jeans, receipt: 'R'.repeat(120) }],
  ])('accepts %s', (_case, row) => {
    expect(transactionHistoryRowSchema.parse(row)).toEqual(row);
  });

  it.each<[string, unknown]>([
    ['an unknown status', { ...jeans, status: 'Complete' }],
    ['an unknown direction', { ...jeans, direction: 'debit' }],
    ['a plain date as the time', { ...jeans, occurredAt: '2026-10-22' }],
    ['a time with an offset, not UTC', { ...jeans, occurredAt: '2026-10-22T14:00:00+02:00' }],
    ['a float amount', { ...jeans, amount: usd(266.5) }],
    ['negative cents', { ...jeans, amount: usd(-26_600) }],
    ['another currency', { ...jeans, amount: { cents: 26_600, currency: 'EUR' } }],
    ['a receipt that is a number', { ...jeans, receipt: 7 }],
    ...(Object.keys(jeans) as (keyof typeof jeans)[]).map((key): [string, unknown] => [`no ${key}`, without(key)]),
  ])('rejects %s', (_case, row) => {
    expect(transactionHistoryRowSchema.safeParse(row).success).toBe(false);
  });

  it('drops keys outside the contract: no item, shop, category, Payment Method, ID or account', () => {
    const parsed = transactionHistoryRowSchema.parse({
      ...jeans,
      item: 'Jeans',
      shopName: 'Denim House',
      category: 'shopping',
      paymentMethod: 'checking',
      id: 2342,
      accountId: 2,
      userId: 7,
    });

    expect(Object.keys(parsed).toSorted()).toEqual(['amount', 'direction', 'occurredAt', 'receipt', 'status']);
  });
});

// T1, AC11: only the cursor, task 020's (1 to 64 characters); nothing names a user, an account, a tab or a page size.
describe('transactionHistoryQuerySchema', () => {
  it('accepts no cursor', () => {
    expect(transactionHistoryQuerySchema.parse({})).toEqual({});
  });

  it.each([1, 64])('accepts a cursor of %i characters', (length) => {
    const query = { cursor: 'a'.repeat(length) };

    expect(transactionHistoryQuerySchema.parse(query)).toEqual(query);
  });

  it.each<[string, unknown]>([
    ['an empty cursor', { cursor: '' }],
    ['a cursor of 65 characters', { cursor: 'a'.repeat(65) }],
    ['a repeated cursor', { cursor: ['a', 'b'] }],
  ])('rejects %s', (_case, query) => {
    expect(transactionHistoryQuerySchema.safeParse(query).success).toBe(false);
  });

  it('drops keys outside the contract: no tab, user, account or page size', () => {
    expect(
      transactionHistoryQuerySchema.parse({ cursor: 'abc', tab: 'revenue', userId: '7', accountId: '3', limit: '100' }),
    ).toEqual({ cursor: 'abc' });
  });

  it('takes the cursor rule of the Transactions query, written once', () => {
    expect(transactionHistoryQuerySchema.shape.cursor).toBe(transactionsQuerySchema.shape.cursor);
  });
});

/** `count` rows. */
const rows = (count: number) => Array.from({ length: count }, () => jeans);

// T1, AC11: one page: at most 10 rows and the next page's cursor, null on the last (#27, #74).
describe('transactionHistoryPageSchema', () => {
  it.each<[string, unknown]>([
    ['10 rows and a cursor', { transactions: rows(10), nextCursor: 'MjAyNi0xMC0wNFQxMjowMDowMC4wMDBaXzIzMzM' }],
    ['the last page: 3 rows and null', { transactions: [jeans, failedPizza, freelance], nextCursor: null }],
    ['no rows and null', { transactions: [], nextCursor: null }],
    ['a cursor of 64 characters', { transactions: rows(1), nextCursor: 'a'.repeat(64) }],
  ])('accepts %s', (_case, page) => {
    expect(transactionHistoryPageSchema.parse(page)).toEqual(page);
  });

  it.each<[string, unknown]>([
    ['11 rows', { transactions: rows(11), nextCursor: null }],
    ['no nextCursor', { transactions: rows(1) }],
    ['an empty nextCursor', { transactions: rows(1), nextCursor: '' }],
    ['a nextCursor of 65 characters', { transactions: rows(1), nextCursor: 'a'.repeat(65) }],
    ['no transactions', { nextCursor: null }],
    ['a row with no receipt', { transactions: [without('receipt')], nextCursor: null }],
  ])('rejects %s', (_case, page) => {
    expect(transactionHistoryPageSchema.safeParse(page).success).toBe(false);
  });

  it('drops keys outside the contract', () => {
    const parsed = transactionHistoryPageSchema.parse({ transactions: [], nextCursor: null, total: 925, accountId: 2 });

    expect(Object.keys(parsed).toSorted()).toEqual(['nextCursor', 'transactions']);
  });
});

// T1: the history entry, a sub-resource of the account, with task 020's page shape and cursor.
describe('transactionsContract.history', () => {
  it('lists a page with GET /accounts/:accountId/transactions, the ID in the path, the cursor in the query', () => {
    expect(transactionsContract.history).toMatchObject({
      method: 'GET',
      path: '/accounts/:accountId/transactions',
      request: undefined,
    });
    expect(transactionsContract.history.params).toBe(accountParamsSchema);
    expect(transactionsContract.history.query).toBe(transactionHistoryQuerySchema);
    expect(transactionsContract.history.response).toBe(transactionHistoryPageSchema);
  });

  it('leaves the other transaction entries without params', () => {
    expect('params' in transactionsContract.recent).toBe(false);
    expect('params' in transactionsContract.list).toBe(false);
    expect(transactionsContract.list.response).toBe(transactionsPageSchema);
  });
});

// T1, AC4: the Status and Transaction Type columns' texts (#27).
describe('transactionStatusLabel', () => {
  it.each([
    ['complete', 'Complete'],
    ['pending', 'Pending'],
    ['failed', 'Failed'],
  ] as const)('shows %j as %j', (status, label) => {
    expect(transactionStatusLabel(status)).toBe(label);
  });
});

describe('transactionTypeLabel', () => {
  it.each([
    ['income', 'Credit'],
    ['expense', 'Debit'],
  ] as const)('shows %j as %j', (direction, label) => {
    expect(transactionTypeLabel(direction)).toBe(label);
  });
});
