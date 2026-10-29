import { describe, expect, it } from 'vitest';

import {
  expenseChangeSchema,
  expensesBreakdownCategorySchema,
  expensesBreakdownResponseSchema,
  expensesContract,
} from '../src/index.js';

const usd = (cents: number) => ({ cents, currency: 'USD' });

/** One category of the answer: this month's total so far and the change, `null` when last month was $0.00. */
const item = (category: string, total: number, change: { percent: number; direction: string | null } | null) => ({
  category,
  total: usd(total),
  change,
});

/** A first login's answer on Thu 22 Oct 2026 (demo-data.md, "What a first login shows"; task 018 References). */
const firstLogin = {
  categories: [
    item('housing', 25_200, { percent: 17, direction: 'down' }),
    item('food', 51_004, { percent: 7, direction: 'up' }),
    item('transportation', 5_320, { percent: 32, direction: 'down' }),
    item('entertainment', 28_224, { percent: 16, direction: 'up' }),
    item('shopping', 65_800, { percent: 14, direction: 'up' }),
    item('others', 13_832, { percent: 31, direction: 'down' }),
  ],
};

const withCategories = (categories: unknown[]) => ({ categories });
const replaceAt = (index: number, value: unknown) =>
  withCategories(firstLogin.categories.map((each, i) => (i === index ? value : each)));

// T1, AC6: the change as the backend sends it: the size in whole percent, the arrow from its sign, none at 0 (#21,
// #61, #115 a).
describe('expenseChangeSchema', () => {
  it.each([
    ['an increase', { percent: 7, direction: 'up' }],
    ['a decrease', { percent: 17, direction: 'down' }],
    ['no change', { percent: 0, direction: null }],
    ['all of last month gone', { percent: 100, direction: 'down' }],
    ['more than double', { percent: 250, direction: 'up' }],
  ])('accepts %s', (_case, value) => {
    expect(expenseChangeSchema.parse(value)).toEqual(value);
  });

  it.each<[string, unknown]>([
    ['a float percent', { percent: 7.48, direction: 'up' }],
    ['a negative percent', { percent: -17, direction: 'down' }],
    ['a percent as text', { percent: '7', direction: 'up' }],
    ['an arrow on 0%', { percent: 0, direction: 'up' }],
    ['no arrow on 5%', { percent: 5, direction: null }],
    ['another direction', { percent: 5, direction: 'sideways' }],
    ['no direction', { percent: 5 }],
  ])('rejects %s', (_case, value) => {
    expect(expenseChangeSchema.safeParse(value).success).toBe(false);
  });
});

// T1, AC6: one category: its total in integer cents 0 or more with USD, and its change or none (#11, #21, #61, #96).
describe('expensesBreakdownCategorySchema', () => {
  it.each([
    ['a total with a change', item('food', 51_004, { percent: 7, direction: 'up' })],
    ['a total with no change (last month $0.00)', item('food', 27_379, null)],
    ['$0.00 with no change', item('food', 0, null)],
    ['$0.00 after a month with expenses', item('food', 0, { percent: 100, direction: 'down' })],
    ['$1,000,000,000.00', item('shopping', 100_000_000_000, { percent: 9_999_999_999_900, direction: 'up' })],
  ])('accepts %s', (_case, value) => {
    expect(expensesBreakdownCategorySchema.parse(value)).toEqual(value);
  });

  it.each<[string, unknown]>([
    ['an unknown category', item('bills', 100, null)],
    ['a display name as the category', item('Food', 100, null)],
    ['a float total', item('food', 510.04, null)],
    ['a negative total', item('food', -100, null)],
    ['another currency', { ...item('food', 100, null), total: { cents: 100, currency: 'EUR' } }],
    ['$0.00 with 15% up', item('food', 0, { percent: 15, direction: 'up' })],
    ['$0.00 with 15% down', item('food', 0, { percent: 15, direction: 'down' })],
    ['no change key', { category: 'food', total: usd(100) }],
  ])('rejects %s', (_case, value) => {
    expect(expensesBreakdownCategorySchema.safeParse(value).success).toBe(false);
  });

  it('drops a key the contract does not have', () => {
    expect(expensesBreakdownCategorySchema.parse({ ...item('food', 100, null), id: 7 })).toEqual(
      item('food', 100, null),
    );
  });
});

// T1, AC6: exactly the six categories, once each, in the designed order (#56, #61).
describe('expensesBreakdownResponseSchema', () => {
  it.each([
    ['a first login', firstLogin],
    [
      'every total $0.00 with no change',
      withCategories(firstLogin.categories.map((each) => item(each.category, 0, null))),
    ],
  ])('accepts %s', (_case, value) => {
    expect(expensesBreakdownResponseSchema.parse(value)).toEqual(value);
  });

  it.each<[string, unknown]>([
    ['five categories', withCategories(firstLogin.categories.slice(0, 5))],
    ['seven categories', withCategories([...firstLogin.categories, item('others', 1, null)])],
    ['a category twice', replaceAt(5, item('housing', 1, null))],
    ['the order changed', withCategories(firstLogin.categories.toReversed())],
    ['an unknown category', replaceAt(5, item('bills', 1, null))],
    ['an invalid item', replaceAt(2, item('transportation', -1, null))],
    ['no categories key', {}],
  ])('rejects %s', (_case, value) => {
    expect(expensesBreakdownResponseSchema.safeParse(value).success).toBe(false);
  });

  it('drops keys the contract does not have, at every level', () => {
    const extra = {
      userId: 7,
      categories: firstLogin.categories.map((each) => ({
        ...each,
        id: 1,
        lastMonth: usd(1),
        total: { ...each.total, raw: 1 },
        change: each.change && { ...each.change, exact: 1.5 },
      })),
    };

    expect(expensesBreakdownResponseSchema.parse(extra)).toEqual(firstLogin);
  });
});

// T1, AC6: one read-only route in the contract, no body (#74).
describe('expensesContract', () => {
  it('declares GET /expenses/breakdown with no body and the response schema', () => {
    expect(expensesContract.breakdown).toEqual({
      method: 'GET',
      path: '/expenses/breakdown',
      request: undefined,
      response: expensesBreakdownResponseSchema,
    });
  });
});
