import { describe, expect, it } from 'vitest';

import {
  RECENT_TRANSACTIONS_PER_TAB,
  type RecentTransactionRow,
  recentTransactionSchema,
  recentTransactionsResponseSchema,
  TRANSACTIONS_PAGE_SIZE,
  transactionRowSchema,
  transactionsContract,
  transactionsPageSchema,
  transactionsQuerySchema,
  transactionsTabSchema,
} from '../src/index.js';

const usd = (cents: number) => ({ cents, currency: 'USD' });

/** The newest demo transaction of a first login on 22 Oct 2026 (demo-data.md, "What a first login shows"). */
const jeans = {
  item: 'Jeans',
  shopName: 'Denim House',
  category: 'shopping',
  direction: 'expense',
  occurredAt: '2026-10-22T12:00:00.000Z',
  amount: usd(26_600),
};

/** The newest demo income on 22 Oct 2026. */
const freelance = {
  item: 'Freelance payment',
  shopName: 'Bright Studio',
  category: null,
  direction: 'income',
  occurredAt: '2026-10-17T12:00:00.000Z',
  amount: usd(17_920),
};

const without = (key: keyof typeof jeans) => Object.fromEntries(Object.entries(jeans).filter(([name]) => name !== key));

// T1, AC8: one listed transaction as the backend sends it: a UTC timestamp, integer cents 0 or more with USD, the
// category only for an expense, no ID, account, receipt or status (#11, #19, #56, #96).
describe('recentTransactionSchema', () => {
  it.each([
    ['an expense with its category', jeans],
    ['income with no category', freelance],
    ['an amount of 0 cents', { ...jeans, amount: usd(0) }],
    ['a timestamp without milliseconds', { ...jeans, occurredAt: '2026-10-22T12:00:00Z' }],
  ])('accepts %s', (_case, transaction) => {
    expect(recentTransactionSchema.parse(transaction)).toEqual(transaction);
  });

  it.each<[string, unknown]>([
    ['an unknown category', { ...jeans, category: 'travel' }],
    ['an expense with no category', { ...jeans, category: null }],
    ['income with a category', { ...freelance, category: 'others' }],
    ['an unknown direction', { ...jeans, direction: 'transfer' }],
    ['a plain date as the time', { ...jeans, occurredAt: '2026-10-22' }],
    ['a time with an offset, not UTC', { ...jeans, occurredAt: '2026-10-22T14:00:00+02:00' }],
    ['a formatted date', { ...jeans, occurredAt: '22 Oct, 2026' }],
    ['a float amount', { ...jeans, amount: usd(266.5) }],
    ['negative cents', { ...jeans, amount: usd(-26_600) }],
    ['another currency', { ...jeans, amount: { cents: 26_600, currency: 'EUR' } }],
    ['an amount as text', { ...jeans, amount: '-$266.00' }],
    ['a number for the item', { ...jeans, item: 266 }],
    ...(Object.keys(jeans) as (keyof typeof jeans)[]).map((key): [string, unknown] => [`no ${key}`, without(key)]),
  ])('rejects %s', (_case, transaction) => {
    expect(recentTransactionSchema.safeParse(transaction).success).toBe(false);
  });

  it('drops keys outside the contract: no ID, account, receipt, status or user ID', () => {
    const parsed = recentTransactionSchema.parse({
      ...jeans,
      id: 2342,
      accountId: 2,
      receipt: 'Ab3dE5gH9jK',
      status: 'complete',
      userId: 7,
    });

    expect(parsed).toEqual(jeans);
    expect(Object.keys(parsed).toSorted()).toEqual([
      'amount',
      'category',
      'direction',
      'item',
      'occurredAt',
      'shopName',
    ]);
  });
});

/** Five rows of the same kind, newest first. */
const five = (row: typeof jeans | typeof freelance) => Array.from({ length: 5 }, () => row);

// T1, AC8: one list per tab, at most 5 each, in the order the backend sends them (#19, #40).
describe('recentTransactionsResponseSchema', () => {
  it('accepts the three lists in the given order', () => {
    const body = { all: [jeans, freelance], revenue: [freelance], expenses: [jeans] };

    expect(recentTransactionsResponseSchema.parse(body)).toEqual(body);
  });

  it('accepts 5 rows in a list, and three empty lists', () => {
    const full = { all: five(jeans), revenue: five(freelance), expenses: five(jeans) };

    expect(recentTransactionsResponseSchema.parse(full)).toEqual(full);
    expect(recentTransactionsResponseSchema.parse({ all: [], revenue: [], expenses: [] })).toEqual({
      all: [],
      revenue: [],
      expenses: [],
    });
  });

  it.each<[string, unknown]>([
    ['6 rows in All', { all: [...five(jeans), jeans], revenue: [], expenses: [] }],
    ['6 rows in Revenue', { all: [], revenue: [...five(freelance), freelance], expenses: [] }],
    ['6 rows in Expenses', { all: [], revenue: [], expenses: [...five(jeans), jeans] }],
    ['no revenue list', { all: [], expenses: [] }],
    ['no expenses list', { all: [], revenue: [] }],
    ['no all list', { revenue: [], expenses: [] }],
    ['a list that is not a list', { all: jeans, revenue: [], expenses: [] }],
    ['an invalid row', { all: [{ ...jeans, amount: usd(1.5) }], revenue: [], expenses: [] }],
  ])('rejects %s', (_case, body) => {
    expect(recentTransactionsResponseSchema.safeParse(body).success).toBe(false);
  });

  it('drops keys outside the contract', () => {
    const parsed = recentTransactionsResponseSchema.parse({ all: [], revenue: [], expenses: [], userId: 7 });

    expect(Object.keys(parsed).toSorted()).toEqual(['all', 'expenses', 'revenue']);
  });
});

// The one place the per-tab count lives (#40, #74): the backend asks the provider for it, the schema caps each list at it.
describe('RECENT_TRANSACTIONS_PER_TAB', () => {
  it('is 5, the latest 5 per tab', () => {
    expect(RECENT_TRANSACTIONS_PER_TAB).toBe(5);
  });

  it('names one row of a list as the contract parses it', () => {
    const row: RecentTransactionRow = recentTransactionSchema.parse(jeans);

    expect(row.amount).toEqual(usd(26_600));
  });
});

describe('transactionsContract', () => {
  it('lists the recent transactions with GET /transactions/recent and no body', () => {
    expect(transactionsContract.recent).toMatchObject({
      method: 'GET',
      path: '/transactions/recent',
      request: undefined,
    });
    expect(transactionsContract.recent.response).toBe(recentTransactionsResponseSchema);
  });
});

/** Jeans as a Transactions row: its account is Checking (demo-data.md, Payment Method is the account's type, #57). */
const jeansRow = { ...jeans, paymentMethod: 'checking' };
/** The Freelance payment as a Transactions row, on Checking. */
const freelanceRow = { ...freelance, paymentMethod: 'checking' };

const withoutRowKey = (key: keyof typeof jeansRow) =>
  Object.fromEntries(Object.entries(jeansRow).filter(([name]) => name !== key));

// T1, AC11: the Transactions page's query: one of the three tabs and the provider's cursor, nothing else (#74).
describe('transactionsQuerySchema', () => {
  it.each(['all', 'revenue', 'expenses'])('accepts tab=%s with no cursor', (tab) => {
    expect(transactionsQuerySchema.parse({ tab })).toEqual({ tab });
  });

  it.each([1, 64])('accepts a cursor of %i characters', (length) => {
    const query = { tab: 'all', cursor: 'a'.repeat(length) };

    expect(transactionsQuerySchema.parse(query)).toEqual(query);
  });

  it.each<[string, unknown]>([
    ['no tab', {}],
    ['an unknown tab', { tab: 'other' }],
    ['a repeated tab', { tab: ['all', 'revenue'] }],
    ['the direction "income" as a tab', { tab: 'income' }],
    ['an empty cursor', { tab: 'all', cursor: '' }],
    ['a cursor of 65 characters', { tab: 'all', cursor: 'a'.repeat(65) }],
    ['a repeated cursor', { tab: 'all', cursor: ['a', 'b'] }],
  ])('rejects %s', (_case, query) => {
    expect(transactionsQuerySchema.safeParse(query).success).toBe(false);
  });

  it('drops keys outside the contract: no user, account or page size', () => {
    expect(transactionsQuerySchema.parse({ tab: 'revenue', userId: '7', accountId: '2', limit: '100' })).toEqual({
      tab: 'revenue',
    });
  });

  it('lists the tab values in the order of the tabs', () => {
    expect(transactionsTabSchema.options).toEqual(['all', 'revenue', 'expenses']);
  });
});

// T1, AC11: one Transactions row: Recent Transaction's keys and rules, plus the Payment Method, the account's type
// (#11, #19, #56, #57, #96).
describe('transactionRowSchema', () => {
  it.each<[string, unknown]>([
    ['an expense with its category', jeansRow],
    ['income with no category', freelanceRow],
    ...(['credit-card', 'checking', 'savings', 'investment', 'loan'] as const).map(
      (paymentMethod): [string, unknown] => [`the Payment Method ${paymentMethod}`, { ...jeansRow, paymentMethod }],
    ),
  ])('accepts %s', (_case, row) => {
    expect(transactionRowSchema.parse(row)).toEqual(row);
  });

  it.each<[string, unknown]>([
    ['an unknown Payment Method', { ...jeansRow, paymentMethod: 'Checking' }],
    ['an expense with no category', { ...jeansRow, category: null }],
    ['income with a category', { ...freelanceRow, category: 'others' }],
    ['a plain date as the time', { ...jeansRow, occurredAt: '2026-10-22' }],
    ['a time with an offset, not UTC', { ...jeansRow, occurredAt: '2026-10-22T14:00:00+02:00' }],
    ['a float amount', { ...jeansRow, amount: usd(266.5) }],
    ['negative cents', { ...jeansRow, amount: usd(-26_600) }],
    ['another currency', { ...jeansRow, amount: { cents: 26_600, currency: 'EUR' } }],
    ['an unknown direction', { ...jeansRow, direction: 'transfer' }],
    ...(Object.keys(jeansRow) as (keyof typeof jeansRow)[]).map((key): [string, unknown] => [
      `no ${key}`,
      withoutRowKey(key),
    ]),
  ])('rejects %s', (_case, row) => {
    expect(transactionRowSchema.safeParse(row).success).toBe(false);
  });

  it('drops keys outside the contract: no ID, account, number, receipt, status or user ID', () => {
    const parsed = transactionRowSchema.parse({
      ...jeansRow,
      id: 2342,
      accountId: 2,
      accountNumber: '6934566990127310',
      receipt: 'Ab3dE5gH9jK',
      status: 'failed',
      userId: 7,
    });

    expect(Object.keys(parsed).toSorted()).toEqual([
      'amount',
      'category',
      'direction',
      'item',
      'occurredAt',
      'paymentMethod',
      'shopName',
    ]);
  });

  it('leaves recentTransactionSchema without a Payment Method: it drops one', () => {
    expect(recentTransactionSchema.parse(jeansRow)).toEqual(jeans);
  });
});

/** `count` rows, newest first. */
const rows = (count: number) => Array.from({ length: count }, () => jeansRow);

// T1, AC11: one page of at most 10 rows and the cursor of the next, null on the last (#27, #74).
describe('transactionsPageSchema', () => {
  it.each<[string, unknown]>([
    ['10 rows and a cursor', { transactions: rows(10), nextCursor: 'MjAyNi0xMC0xNVQxMjowMDowMC4wMDBaXzIzMzM' }],
    ['the last page: 3 rows and null', { transactions: [jeansRow, freelanceRow, jeansRow], nextCursor: null }],
    ['no rows and null', { transactions: [], nextCursor: null }],
    ['a cursor of 64 characters', { transactions: rows(1), nextCursor: 'a'.repeat(64) }],
  ])('accepts %s', (_case, page) => {
    expect(transactionsPageSchema.parse(page)).toEqual(page);
  });

  it.each<[string, unknown]>([
    ['11 rows', { transactions: rows(11), nextCursor: null }],
    ['no nextCursor', { transactions: rows(1) }],
    ['an empty nextCursor', { transactions: rows(1), nextCursor: '' }],
    ['a nextCursor of 65 characters', { transactions: rows(1), nextCursor: 'a'.repeat(65) }],
    ['no transactions', { nextCursor: null }],
    ['a row with no Payment Method', { transactions: [jeans], nextCursor: null }],
  ])('rejects %s', (_case, page) => {
    expect(transactionsPageSchema.safeParse(page).success).toBe(false);
  });

  it('takes 10 rows at a time, TRANSACTIONS_PAGE_SIZE (#27)', () => {
    expect(TRANSACTIONS_PAGE_SIZE).toBe(10);
    const full = { transactions: rows(TRANSACTIONS_PAGE_SIZE), nextCursor: null };
    expect(transactionsPageSchema.safeParse(full).success).toBe(true);
  });

  it('drops keys outside the contract', () => {
    const parsed = transactionsPageSchema.parse({ transactions: [], nextCursor: null, total: 2342, userId: 7 });

    expect(Object.keys(parsed).toSorted()).toEqual(['nextCursor', 'transactions']);
  });
});

describe('transactionsContract.list', () => {
  it('lists a page with GET /transactions, the tab and cursor in the query and no body', () => {
    expect(transactionsContract.list).toMatchObject({ method: 'GET', path: '/transactions', request: undefined });
    expect(transactionsContract.list.query).toBe(transactionsQuerySchema);
    expect(transactionsContract.list.response).toBe(transactionsPageSchema);
  });

  it('leaves the recent entry without a query', () => {
    expect('query' in transactionsContract.recent).toBe(false);
  });
});
