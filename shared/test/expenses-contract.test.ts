import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  expenseChangeSchema,
  expenseLineItemSchema,
  expensesBreakdownCategorySchema,
  expensesBreakdownResponseSchema,
  expensesContract,
  monthlyComparisonMonthSchema,
  monthlyComparisonResponseSchema,
} from '../src/index.js';

const usd = (cents: number) => ({ cents, currency: 'USD' });

/** One line item of a card: the item name, its amount and its time in UTC. */
const line = (item: string, cents: number, date: string) => ({
  item,
  amount: usd(cents),
  occurredAt: `${date}T12:00:00.000Z`,
});

/** One category of the answer: this month's total so far, the change (`null` when last month was $0.00), the items. */
const item = (
  category: string,
  total: number,
  change: { percent: number; direction: string | null } | null,
  recent: ReturnType<typeof line>[] = [],
) => ({ category, total: usd(total), change, recent });

/**
 * A first login's answer on Thu 22 Oct 2026 (demo-data.md, "What a first login shows"; task 018 References), with each
 * category's 2 most recent Complete expenses of October, newest first (task 024 References).
 */
const firstLogin = {
  categories: [
    item('housing', 25_200, { percent: 17, direction: 'down' }, [
      line('Parking', 2_016, '2026-10-14'),
      line('House Rent', 23_184, '2026-10-01'),
    ]),
    item('food', 51_004, { percent: 7, direction: 'up' }, [
      line('Pizza', 2_464, '2026-10-20'),
      line('Restaurant bill', 14_784, '2026-10-18'),
    ]),
    item('transportation', 5_320, { percent: 32, direction: 'down' }, [
      line('Taxi fare', 1_064, '2026-10-19'),
      line('Taxi fare', 1_064, '2026-10-13'),
    ]),
    item('entertainment', 28_224, { percent: 16, direction: 'up' }, [
      line('Movie ticket', 1_764, '2026-10-21'),
      line('GTR 5', 18_816, '2026-10-17'),
    ]),
    item('shopping', 65_800, { percent: 14, direction: 'up' }, [
      line('Jeans', 26_600, '2026-10-22'),
      line('Shirt', 32_200, '2026-10-15'),
    ]),
    item('others', 13_832, { percent: 31, direction: 'down' }, [
      line('Donation', 3_192, '2026-10-11'),
      line('Loan installment', 10_640, '2026-10-10'),
    ]),
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

// Task 024 T2, AC16: a card's line item: the item name, the amount in integer cents 0 or more with USD, the time in
// UTC; nothing that names a transaction, its account, shop, category or status (#11, #19, #96).
describe('expenseLineItemSchema', () => {
  it.each([
    ['a demo item', line('House Rent', 23_184, '2026-10-01')],
    ['$0.00', line('Refund', 0, '2026-10-01')],
    ['$1,000,000,000.00', line('Watch', 100_000_000_000, '2026-10-01')],
    ['a time with no milliseconds', { ...line('Taxi fare', 1_064, '2026-10-13'), occurredAt: '2026-10-13T12:00:00Z' }],
    ['an empty name', line('', 100, '2026-10-01')],
  ])('accepts %s', (_case, value) => {
    expect(expenseLineItemSchema.parse(value)).toEqual(value);
  });

  it.each<[string, unknown]>([
    ['a negative amount', line('Refund', -100, '2026-10-01')],
    ['a float amount', line('Pizza', 24.64, '2026-10-20')],
    ['another currency', { ...line('Pizza', 2_464, '2026-10-20'), amount: { cents: 2_464, currency: 'EUR' } }],
    ['a plain date', { ...line('Pizza', 2_464, '2026-10-20'), occurredAt: '2026-10-20' }],
    ['a time with an offset', { ...line('Pizza', 2_464, '2026-10-20'), occurredAt: '2026-10-20T14:00:00+02:00' }],
    ['a display date', { ...line('Pizza', 2_464, '2026-10-20'), occurredAt: '20 Oct, 2026' }],
    ['no item', { amount: usd(1), occurredAt: '2026-10-20T12:00:00.000Z' }],
    ['no amount', { item: 'Pizza', occurredAt: '2026-10-20T12:00:00.000Z' }],
    ['no time', { item: 'Pizza', amount: usd(1) }],
  ])('rejects %s', (_case, value) => {
    expect(expenseLineItemSchema.safeParse(value).success).toBe(false);
  });

  it('drops an ID, the account, the shop, the category, the status and the direction', () => {
    const parsed = expenseLineItemSchema.parse({
      ...line('Pizza', 2_464, '2026-10-20'),
      id: 7,
      accountId: 3,
      shopName: 'Pizza Hut',
      category: 'food',
      status: 'complete',
      direction: 'expense',
      receipt: 'Ab3dE5gH9jK',
    });

    expect(parsed).toEqual(line('Pizza', 2_464, '2026-10-20'));
    expect(Object.keys(parsed).toSorted()).toEqual(['amount', 'item', 'occurredAt']);
  });
});

// T1, AC6 of task 018, with task 024's `recent` (T2, AC12, AC16): one category: its total in integer cents 0 or
// more with USD, its change or none, and 0 to 2 items newest first (#11, #21, #61, #96).
describe('expensesBreakdownCategorySchema', () => {
  it.each([
    ['a total with a change', item('food', 51_004, { percent: 7, direction: 'up' })],
    ['a total with no change (last month $0.00)', item('food', 27_379, null)],
    ['$0.00 with no change', item('food', 0, null)],
    ['$0.00 after a month with expenses', item('food', 0, { percent: 100, direction: 'down' })],
    ['$1,000,000,000.00', item('shopping', 100_000_000_000, { percent: 9_999_999_999_900, direction: 'up' })],
    ['the demo’s two items', firstLogin.categories[0]],
    [
      'one item',
      item('housing', 27_048, { percent: 1, direction: 'down' }, [line('House Rent', 27_048, '2026-11-01')]),
    ],
    [
      'two items at one instant',
      item('food', 3_000, null, [line('Pizza', 1_000, '2026-10-20'), line('Burger', 2_000, '2026-10-20')]),
    ],
    [
      'one instant written with and without milliseconds',
      item('food', 3_000, null, [
        line('Pizza', 1_000, '2026-10-20'),
        { ...line('Burger', 2_000, '2026-10-20'), occurredAt: '2026-10-20T12:00:00Z' },
      ]),
    ],
    [
      'newest first across milliseconds',
      item('food', 3_000, null, [
        { ...line('Pizza', 1_000, '2026-10-20'), occurredAt: '2026-10-20T12:00:00.500Z' },
        { ...line('Burger', 2_000, '2026-10-20'), occurredAt: '2026-10-20T12:00:00Z' },
      ]),
    ],
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
    ['no change key', { category: 'food', total: usd(100), recent: [] }],
    ['no recent key', { category: 'food', total: usd(100), change: null }],
    ['recent not a list', { ...item('food', 100, null), recent: line('Pizza', 100, '2026-10-20') }],
    [
      'three items',
      item('food', 300, null, [
        line('Pizza', 100, '2026-10-20'),
        line('Pizza', 100, '2026-10-19'),
        line('Pizza', 100, '2026-10-18'),
      ]),
    ],
    [
      'two items oldest first',
      item('food', 200, null, [line('Pizza', 100, '2026-10-18'), line('Pizza', 100, '2026-10-20')]),
    ],
    ['an item with a negative amount', item('food', 100, null, [line('Refund', -100, '2026-10-20')])],
    [
      'an item dated in another zone',
      item('food', 100, null, [{ ...line('Pizza', 100, '2026-10-20'), occurredAt: '2026-10-20T14:00:00+02:00' }]),
    ],
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
      'every total $0.00 with no change and no item',
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
        recent: each.recent.map((recent) => ({ ...recent, id: 9, shopName: 'Shop', status: 'complete' })),
      })),
    };

    expect(expensesBreakdownResponseSchema.parse(extra)).toEqual(firstLogin);
  });
});

/** One month of the chart: this year's `YYYY-MM`, the same month a year earlier, this year's (null after today). */
const month = (key: string, lastYear: number, thisYear: number | null) => ({
  month: key,
  lastYear: usd(lastYear),
  thisYear: thisYear === null ? null : usd(thisYear),
});

const monthKeys = (year: number) =>
  Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`);

/** A first login's chart on Thu 22 Oct 2026 in Belgrade: 2025 against 2026 to October (task 024 References). */
const demoLastYear = [
  199_240, 165_261, 179_972, 174_445, 197_844, 247_912, 193_421, 191_231, 180_894, 198_295, 183_411, 234_036,
];
const demoThisYear = [206_616, 171_383, 186_636, 180_909, 204_616, 255_026, 200_588, 198_312, 187_595, 189_380];
const demoMonthly = {
  months: monthKeys(2026).map((key, index) => month(key, demoLastYear[index]!, demoThisYear[index] ?? null)),
  ticks: [0, 100_000, 200_000, 300_000, 400_000].map(usd),
};

/** Every value of both years 0 on 31 Dec 2021: the empty state, no axis (#55, #91 c). */
const allZeroMonthly = {
  months: monthKeys(2021).map((key) => month(key, 0, 0)),
  ticks: null,
};

const withMonths = (months: unknown[]) => ({ ...demoMonthly, months });
const replaceMonth = (index: number, value: unknown) =>
  withMonths(demoMonthly.months.map((each, i) => (i === index ? value : each)));

// T1, AC4, AC16: one month as the backend sends it (#11, #55, #96).
describe('monthlyComparisonMonthSchema', () => {
  it.each([
    ['a month with both values', month('2026-10', 198_295, 189_380)],
    ['a month after the current one', month('2026-11', 183_411, null)],
    ['a month with no expense in either year', month('2026-02', 0, 0)],
  ])('accepts %s', (_case, value) => {
    expect(monthlyComparisonMonthSchema.parse(value)).toEqual(value);
  });

  it.each<[string, unknown]>([
    ['a plain date as the month', { ...month('2026-10', 1, 1), month: '2026-10-01' }],
    ['a month 13', { ...month('2026-10', 1, 1), month: '2026-13' }],
    ['a one-digit month', { ...month('2026-10', 1, 1), month: '2026-1' }],
    ['a label as the month', { ...month('2026-10', 1, 1), month: 'Oct' }],
    ['a float amount', { ...month('2026-10', 1, 1), lastYear: usd(1_982.95) }],
    ['negative cents last year', month('2026-10', -1, 1)],
    ['negative cents this year', month('2026-10', 1, -1)],
    ['another currency', { ...month('2026-10', 1, 1), thisYear: { cents: 1, currency: 'EUR' } }],
    ['last year null', { ...month('2026-10', 1, 1), lastYear: null }],
    ['no thisYear', { month: '2026-10', lastYear: usd(1) }],
  ])('rejects %s', (_case, value) => {
    expect(monthlyComparisonMonthSchema.safeParse(value).success).toBe(false);
  });
});

// T1, AC4, AC6, AC16: January to December of one year, the nulls only after the current month, the 5 ticks from $0
// or null exactly when all is 0, the rule shared with the weekly comparison (#29, #55, #91).
describe('monthlyComparisonResponseSchema', () => {
  it.each([
    ['a first login in October', demoMonthly],
    ['every value 0, with no ticks', allZeroMonthly],
    [
      'January the only month with a value, last year all 0',
      {
        months: monthKeys(2022).map((key, index) => month(key, 0, index === 0 ? 103_856 : null)),
        ticks: [0, 50_000, 100_000, 150_000, 200_000].map(usd),
      },
    ],
    [
      'December, every month with a value',
      withMonths(demoMonthly.months.map((each) => ({ ...each, thisYear: usd(100) }))),
    ],
    [
      'a top tick equal to last year’s highest value',
      withMonths(demoMonthly.months.map((each, i) => (i === 0 ? { ...each, lastYear: usd(400_000) } : each))),
    ],
    [
      'this year all 0 with last year’s values',
      withMonths(demoMonthly.months.map((each) => ({ ...each, thisYear: each.thisYear && usd(0) }))),
    ],
  ])('accepts %s', (_case, body) => {
    expect(monthlyComparisonResponseSchema.parse(body)).toEqual(body);
  });

  it.each<[string, unknown]>([
    ['11 months', withMonths(demoMonthly.months.slice(0, 11))],
    ['13 months', withMonths([...demoMonthly.months, month('2027-01', 0, null)])],
    ['February first', withMonths([...demoMonthly.months.slice(1), month('2027-01', 0, null)])],
    [
      'the months out of order',
      withMonths([demoMonthly.months[1], demoMonthly.months[0], ...demoMonthly.months.slice(2)]),
    ],
    ['a month twice', replaceMonth(4, month('2026-04', 197_844, 204_616))],
    ['months of two years', replaceMonth(11, month('2027-12', 234_036, null))],
    ['a null before a value', replaceMonth(3, month('2026-04', 174_445, null))],
    ['January null', replaceMonth(0, month('2026-01', 199_240, null))],
    ['a float amount', replaceMonth(5, month('2026-06', 247_912.5, 255_026))],
    ['negative cents', replaceMonth(5, month('2026-06', -247_912, 255_026))],
    ['EUR', replaceMonth(5, { ...month('2026-06', 247_912, 255_026), lastYear: { cents: 247_912, currency: 'EUR' } })],
    ['4 ticks', { ...demoMonthly, ticks: [0, 100_000, 200_000, 400_000].map(usd) }],
    ['6 ticks', { ...demoMonthly, ticks: [0, 100_000, 200_000, 300_000, 400_000, 500_000].map(usd) }],
    ['ticks not from $0', { ...demoMonthly, ticks: [100_000, 200_000, 300_000, 400_000, 500_000].map(usd) }],
    ['ticks in unequal steps', { ...demoMonthly, ticks: [0, 100_000, 200_000, 350_000, 400_000].map(usd) }],
    ['a top below this year’s highest', { ...demoMonthly, ticks: [0, 62_500, 125_000, 187_500, 250_000].map(usd) }],
    [
      'a top below last year’s highest',
      withMonths(demoMonthly.months.map((each, i) => (i === 0 ? { ...each, lastYear: usd(450_000) } : each))),
    ],
    ['null ticks with a value above 0', { ...demoMonthly, ticks: null }],
    [
      'null ticks with only a value last year',
      {
        ...allZeroMonthly,
        months: allZeroMonthly.months.map((each, i) => (i === 11 ? month(each.month, 1, 0) : each)),
      },
    ],
    ['ticks with every value 0', { ...allZeroMonthly, ticks: demoMonthly.ticks }],
    ['no ticks key', { months: demoMonthly.months }],
    ['no months key', { ticks: demoMonthly.ticks }],
  ])('rejects %s', (_case, body) => {
    expect(monthlyComparisonResponseSchema.safeParse(body).success).toBe(false);
  });

  it('leaves the months after the current one out of the highest value', () => {
    // November's and December's last-year values are below the top; a null this year counts as nothing.
    const body = {
      months: monthKeys(2026).map((key, index) => month(key, 1_000, index < 10 ? 2_000 : null)),
      ticks: [0, 500, 1_000, 1_500, 2_000].map(usd),
    };

    expect(monthlyComparisonResponseSchema.parse(body)).toEqual(body);
  });

  it('drops keys outside the contract: no user, account or transaction ID', () => {
    const parsed = monthlyComparisonResponseSchema.parse({
      ...demoMonthly,
      id: 7,
      userId: 7,
      year: 2026,
      months: demoMonthly.months.map((each) => ({ ...each, id: 11, transactionIds: [1, 2] })),
    });

    expect(parsed).toEqual(demoMonthly);
    expect(Object.keys(parsed).toSorted()).toEqual(['months', 'ticks']);
    for (const parsedMonth of parsed.months) {
      expect(Object.keys(parsedMonth).toSorted()).toEqual(['lastYear', 'month', 'thisYear']);
    }
  });
});

// T1, AC6 of task 018 and task 024 AC16: two read-only routes in the contract, no body (#74).
describe('expensesContract', () => {
  it('declares GET /expenses/breakdown with no body and the response schema', () => {
    expect(expensesContract.breakdown).toEqual({
      method: 'GET',
      path: '/expenses/breakdown',
      request: undefined,
      response: expensesBreakdownResponseSchema,
    });
  });

  it('declares GET /expenses/monthly-comparison with no body and the response schema', () => {
    expect(expensesContract.monthlyComparison).toEqual({
      method: 'GET',
      path: '/expenses/monthly-comparison',
      request: undefined,
      response: monthlyComparisonResponseSchema,
    });
  });

  it('has exactly these two routes', () => {
    expect(Object.keys(expensesContract).toSorted()).toEqual(['breakdown', 'monthlyComparison']);
  });
});

const srcDir = resolve(import.meta.dirname, '../src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

// Task 024 code review, #74: the `YYYY-MM` rule is written once (task 014's `goalMonthSchema`); the Expenses chart's
// months and `formatMonthAxisLabel` use it, no copy.
describe('the YYYY-MM month rule', () => {
  it('is declared once in shared/src', () => {
    const declaring = sourceFiles(srcDir)
      .filter((file) => readFileSync(file, 'utf8').includes('(0[1-9]|1[0-2])'))
      .map((file) => relative(srcDir, file).replaceAll('\\', '/'));

    expect(declaring).toEqual(['contract/savings-goal.ts']);
  });
});
