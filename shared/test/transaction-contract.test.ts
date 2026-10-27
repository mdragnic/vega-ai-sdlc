import { describe, expect, it } from 'vitest';

import {
  RECENT_TRANSACTIONS_PER_TAB,
  type RecentTransactionRow,
  recentTransactionSchema,
  recentTransactionsResponseSchema,
  transactionsContract,
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
