import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { ExpensesService } from '../src/expenses/expenses.service.js';
import { signUp } from './helpers/auth.js';
import { userIdOf } from './helpers/finance.js';
import { createTestApp } from './helpers/test-app.js';

const FIXED_NOW = '2026-10-22T10:00:00.000Z';
const BELGRADE = 'Europe/Belgrade';
const NEW_YORK = 'America/New_York';

type Category = 'housing' | 'food' | 'transportation' | 'entertainment' | 'shopping' | 'others';
type Change = { percent: number; direction: 'up' | 'down' | null } | null;
type LineItem = { item: string; amount: { cents: number; currency: 'USD' }; occurredAt: string };

const usd = (cents: number) => ({ cents, currency: 'USD' as const });
const up = (percent: number): Change => ({ percent, direction: 'up' });
const down = (percent: number): Change => ({ percent, direction: 'down' });
const none: Change = { percent: 0, direction: null };

/** A line item as the service maps it: the name, the amount and the instant in UTC ISO. */
const line = (item: string, cents: number, instant: string): LineItem => ({
  item,
  amount: usd(cents),
  occurredAt: new Date(instant).toISOString(),
});
/** A demo row: every one is stored at 12:00 UTC. */
const demo = (item: string, cents: number, date: string) => line(item, cents, `${date}T12:00:00Z`);

/** The six categories of an answer in the designed order: each one's total in cents, its change and its items. */
function breakdown(...rows: [total: number, change: Change, recent?: LineItem[]][]) {
  const categories: Category[] = ['housing', 'food', 'transportation', 'entertainment', 'shopping', 'others'];
  return {
    categories: categories.map((category, index) => ({
      category,
      total: usd(rows[index]![0]),
      change: rows[index]![1],
      recent: rows[index]![2] ?? [],
    })),
  };
}

/** The 2 most recent Complete expenses of 1 to 22 Oct per category, newest first (task 024 References). */
const firstLoginItems = {
  housing: [demo('Parking', 2_016, '2026-10-14'), demo('House Rent', 23_184, '2026-10-01')],
  food: [demo('Pizza', 2_464, '2026-10-20'), demo('Restaurant bill', 14_784, '2026-10-18')],
  transportation: [demo('Taxi fare', 1_064, '2026-10-19'), demo('Taxi fare', 1_064, '2026-10-13')],
  entertainment: [demo('Movie ticket', 1_764, '2026-10-21'), demo('GTR 5', 18_816, '2026-10-17')],
  shopping: [demo('Jeans', 26_600, '2026-10-22'), demo('Shirt', 32_200, '2026-10-15')],
  others: [demo('Donation', 3_192, '2026-10-11'), demo('Loan installment', 10_640, '2026-10-10')],
};

/** A first login on Thu 22 Oct 2026: 1 to 22 Oct against all of Sep (demo-data.md, "What a first login shows"; AC1). */
const firstLogin = breakdown(
  [25_200, down(17), firstLoginItems.housing],
  [51_004, up(7), firstLoginItems.food],
  [5_320, down(32), firstLoginItems.transportation],
  [28_224, up(16), firstLoginItems.entertainment],
  [65_800, up(14), firstLoginItems.shopping],
  [13_832, down(31), firstLoginItems.others],
);

/** The 2 most recent Complete expenses of all of October per category (the Pending Polo shirt of 25 Oct left out). */
const octoberItems = {
  housing: [demo('Parking', 2_016, '2026-10-27'), demo('Parking', 2_016, '2026-10-14')],
  food: [demo('Biriyani', 1_478, '2026-10-31'), demo('Pizza', 2_464, '2026-10-28')],
  transportation: [demo('Taxi fare', 1_064, '2026-10-29'), demo('Taxi fare', 1_064, '2026-10-25')],
  entertainment: [demo('Movie ticket', 1_764, '2026-10-30'), demo('Movie ticket', 1_764, '2026-10-21')],
  shopping: [demo('Polo shirt', 2_800, '2026-10-26'), demo('Jeans', 26_600, '2026-10-22')],
  others: [demo('Gift', 2_128, '2026-10-24'), demo('Donation', 3_192, '2026-10-11')],
};

/** All of October against all of September (References: the clock at 2026-10-31T22:59:59Z). */
const october = breakdown(
  [27_216, down(10), octoberItems.housing],
  [56_424, up(19), octoberItems.food],
  [7_448, down(5), octoberItems.transportation],
  [29_988, up(24), octoberItems.entertainment],
  [68_600, up(19), octoberItems.shopping],
  [15_960, down(21), octoberItems.others],
);

/** 1 Nov against all of October: the House Rent of 1 Nov only (References: 2026-10-31T23:00:00Z in Belgrade). */
const november = breakdown(
  [27_048, down(1), [demo('House Rent', 27_048, '2026-11-01')]],
  [0, down(100)],
  [0, down(100)],
  [0, down(100)],
  [0, down(100)],
  [0, down(100)],
);

/** No expense at all: six $0.00 with no change and no item. */
const allZero = breakdown([0, null], [0, null], [0, null], [0, null], [0, null], [0, null]);

/** A stored `occurred_at` value for a UTC instant. */
const stored = (instant: string) => instant.replace('T', ' ').replace('Z', '.000');

/** A month of the chart: this year's `YYYY-MM`, last year's same month in cents, this year's (null after today). */
const month = (key: string, lastYear: number, thisYear: number | null) => ({
  month: key,
  lastYear: usd(lastYear),
  thisYear: thisYear === null ? null : usd(thisYear),
});

/** The 12 months of `year` with last year's and this year's values in cents (this year's shorter: null after it). */
const months = (year: number, lastYear: number[], thisYear: number[]) =>
  lastYear.map((value, index) =>
    month(`${year}-${String(index + 1).padStart(2, '0')}`, value, thisYear[index] ?? null),
  );

const ticks = (...dollars: number[]) => dollars.map((value) => usd(value * 100));
const demoTicks = ticks(0, 1_000, 2_000, 3_000, 4_000);

// Checked against demo-dataset.json with a script in the session scratchpad that takes each row's month with Intl in
// the zone, not with this backend's helpers (task 024 References).
const year2025 = [
  199_240, 165_261, 179_972, 174_445, 197_844, 247_912, 193_421, 191_231, 180_894, 198_295, 183_411, 234_036,
];
/** 2026 to 22 Oct: October is 1 to 22 Oct, the six first-login totals added up ($1,893.80). */
const year2026ToToday = [206_616, 171_383, 186_636, 180_909, 204_616, 255_026, 200_588, 198_312, 187_595, 189_380];
/** All of 2026: October in full, then November and December. */
const year2026 = [...year2026ToToday.slice(0, 9), 205_636, 190_204, 242_704];

/** A first login's chart on Thu 22 Oct 2026 in Belgrade: 2025 against 2026 to October (AC3). */
const firstLoginChart = { months: months(2026, year2025, year2026ToToday), ticks: demoTicks };

/** All of October 2026, no Nov bar: the clock on 31 Oct in the zone. */
const octoberChart = { months: months(2026, year2025, year2026.slice(0, 10)), ticks: demoTicks };

/** 1 Jan 2027: 2027's January (the House Rent of 1 Jan, $266.80, and any row added), against all of 2026. */
const january2027 = (january: number) => ({ months: months(2027, year2026, [january]), ticks: demoTicks });

/** 31 Dec 2026: every month of 2026 against 2025, December as given. */
const december2026 = (december: number) => ({
  months: months(2026, year2025, [...year2026.slice(0, 11), december]),
  ticks: demoTicks,
});

/** 1 Nov 2026: November's bar is the House Rent of 1 Nov, dated today ($270.48). */
const novemberChart = { months: months(2026, year2025, [...year2026.slice(0, 10), 27_048]), ticks: demoTicks };

// T3 to T5 of task 018, T8 of task 024: AC1 to AC5 and AC12 to AC14, the service on the test database with a seeded
// user (#11, #21, #53, #54, #57, #61, #80).
describe('ExpensesService', () => {
  let app: INestApplication;
  let clock: FixedClock;
  let db: DataSource;
  let service: ExpensesService;
  let userId: number;

  beforeAll(async () => {
    app = await createTestApp({ config: { nodeEnv: 'test', testNow: FIXED_NOW } });
    clock = app.get(FixedClock);
    db = app.get(DataSource);
    service = app.get(ExpensesService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    clock.set(new Date(FIXED_NOW));
    // Another user signed up first, so the user's IDs never equal positions.
    await signUp(app);
    userId = (await userIdOf(db, (await signUp(app)).user.email))!;
  });

  /** Moves the user's row with this item stored at `from` to `to`, with plain SQL. */
  const moveTo = async (item: string, from: string, to: string) => {
    await db.query(
      `UPDATE transactions SET occurred_at = ?
       WHERE item = ? AND occurred_at = ? AND account_id IN (SELECT id FROM accounts WHERE user_id = ?)`,
      [stored(to), item, stored(from), userId],
    );
    const [{ count }] = await db.query<[{ count: number }]>(
      `SELECT COUNT(*) AS count FROM transactions
       WHERE item = ? AND occurred_at = ? AND account_id IN (SELECT id FROM accounts WHERE user_id = ?)`,
      [item, stored(to), userId],
    );
    expect(count, `${item} moved to ${to}`).toBe(1);
  };

  /** Adds an expense of `cents` at `instant` in `category` to the user's first account, with plain SQL. */
  const addExpense = async (
    instant: string,
    cents: number,
    category: Category,
    status = 'complete',
    item = 'Watch',
  ) => {
    const [{ id: accountId }] = await db.query<[{ id: number }]>(
      'SELECT id FROM accounts WHERE user_id = ? ORDER BY id LIMIT 1',
      [userId],
    );
    await db.query(
      `INSERT INTO transactions (account_id, occurred_at, direction, status, category, item, shop_name, receipt, amount_cents)
       VALUES (?, ?, 'expense', ?, ?, ?, 'Time Shop', 'Ab3dE5gH9jK', ?)`,
      [accountId, stored(instant), status, category, item, cents],
    );
  };

  const deleteTransactions = () =>
    db.query('DELETE FROM transactions WHERE account_id IN (SELECT id FROM accounts WHERE user_id = ?)', [userId]);

  /** The chart's current month (its last value this year), in cents. */
  const currentMonth = async (zone: string) => {
    const { months: chart } = await service.monthlyComparison(userId, zone);
    return chart.findLast((each) => each.thisYear !== null)!.thisYear!.cents;
  };
  /** The sum of the breakdown's six totals, in cents. */
  const sumOfTotals = async (zone: string) =>
    (await service.breakdown(userId, zone)).categories.reduce((sum, each) => sum + each.total.cents, 0);

  describe('breakdown', () => {
    // T3: AC1, AC2.
    describe('a first login', () => {
      it('answers 1 to 22 Oct against all of Sep for the six categories, in the designed order, with their items', async () => {
        expect(await service.breakdown(userId, BELGRADE)).toEqual(firstLogin);
      });

      it('answers integer cents with USD, ISO times in UTC and only the contract’s keys', async () => {
        const answer = await service.breakdown(userId, BELGRADE);

        expect(Object.keys(answer)).toEqual(['categories']);
        for (const each of answer.categories) {
          expect(Object.keys(each)).toEqual(['category', 'total', 'change', 'recent']);
          expect(Object.keys(each.total)).toEqual(['cents', 'currency']);
          expect(Number.isSafeInteger(each.total.cents)).toBe(true);
          expect(Object.keys(each.change!)).toEqual(['percent', 'direction']);
          for (const item of each.recent) {
            expect(Object.keys(item)).toEqual(['item', 'amount', 'occurredAt']);
            expect(Object.keys(item.amount)).toEqual(['cents', 'currency']);
            expect(item.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
          }
        }
      });

      it('counts neither a Failed nor a Pending expense this month', async () => {
        // The demo's Failed Pizza (16 Oct, $24.64) and Pending Polo shirt (25 Oct, $28.00), moved to Tue 20 Oct.
        await moveTo('Pizza', '2026-10-16T12:00:00Z', '2026-10-20T08:00:00Z');
        await moveTo('Polo shirt', '2026-10-25T12:00:00Z', '2026-10-20T09:00:00Z');
        await addExpense('2026-10-21T08:00:00Z', 50_000, 'others', 'failed');
        await addExpense('2026-10-21T09:00:00Z', 50_000, 'others', 'pending');

        expect(await service.breakdown(userId, BELGRADE)).toEqual(firstLogin);
      });

      it('counts neither a Failed nor a Pending expense last month', async () => {
        await addExpense('2026-09-21T08:00:00Z', 50_000, 'others', 'failed');
        await addExpense('2026-09-21T09:00:00Z', 50_000, 'others', 'pending');

        expect(await service.breakdown(userId, BELGRADE)).toEqual(firstLogin);
      });

      it('counts no income', async () => {
        // The Design project of 1 Sep ($784.00) moved to 20 Oct, the Dividend of 15 Oct to 2 Sep.
        await moveTo('Design project', '2026-09-01T12:00:00Z', '2026-10-20T08:00:00Z');
        await moveTo('Dividend', '2026-10-15T12:00:00Z', '2026-09-02T08:00:00Z');

        expect(await service.breakdown(userId, BELGRADE)).toEqual(firstLogin);
      });

      it('counts nothing dated after today: a Complete expense on Fri 23 Oct', async () => {
        // 08:00 on 23 Oct in Belgrade, and the demo's own rows from 23 Oct on.
        await addExpense('2026-10-23T06:00:00Z', 50_000, 'shopping');

        expect(await service.breakdown(userId, BELGRADE)).toEqual(firstLogin);
      });

      it('counts a Complete expense of today and lists it first', async () => {
        await addExpense('2026-10-22T09:00:00Z', 50_000, 'others');

        expect((await service.breakdown(userId, BELGRADE)).categories[5]).toEqual({
          category: 'others',
          total: usd(63_832),
          change: up(217),
          recent: [line('Watch', 50_000, '2026-10-22T09:00:00Z'), firstLoginItems.others[0]],
        });
      });

      it('answers only the user’s own transactions', async () => {
        const other = (await userIdOf(db, (await signUp(app)).user.email))!;
        await deleteTransactions();

        expect(await service.breakdown(userId, BELGRADE)).toEqual(allZero);
        expect(await service.breakdown(other, BELGRADE)).toEqual(firstLogin);
      });
    });

    // T4: AC4, the month change. Belgrade's November starts at 2026-10-31T23:00:00Z, after it left summer time on
    // 25 Oct (a 745-hour October); New York's at 2026-11-01T04:00:00Z, before it leaves summer time.
    describe('the month change', () => {
      it.each([BELGRADE, NEW_YORK])(
        'at 2026-10-31T22:59:59Z answers all of October against September in %s',
        async (zone) => {
          clock.set(new Date('2026-10-31T22:59:59Z'));

          expect(await service.breakdown(userId, zone)).toEqual(october);
        },
      );

      it('at 2026-10-31T23:00:00Z (00:00 Sun 1 Nov in Belgrade) answers 1 Nov against October', async () => {
        clock.set(new Date('2026-10-31T23:00:00Z'));

        expect(await service.breakdown(userId, BELGRADE)).toEqual(november);
      });

      it('at 2026-10-31T23:00:00Z (19:00 Sat 31 Oct in New York) still answers October', async () => {
        clock.set(new Date('2026-10-31T23:00:00Z'));

        expect(await service.breakdown(userId, NEW_YORK)).toEqual(october);
      });

      it('in New York answers October at 2026-11-01T03:59:59Z and November at 04:00:00Z', async () => {
        clock.set(new Date('2026-11-01T03:59:59Z'));
        expect(await service.breakdown(userId, NEW_YORK)).toEqual(october);

        clock.set(new Date('2026-11-01T04:00:00Z'));
        expect(await service.breakdown(userId, NEW_YORK)).toEqual(november);
      });

      // A month start taken with today's offset (+1 hour in Belgrade at the end of October) would miss the $500.00
      // row; a month end as its start plus 31 x 24 hours (22:00Z) would miss the $300.00 row; a month in UTC would put
      // the $500.00 row in September.
      describe('with a $500.00 Shopping row at 2026-09-30T22:30:00Z and a $300.00 Food row at 2026-10-31T22:30:00Z', () => {
        beforeEach(async () => {
          await addExpense('2026-09-30T22:30:00Z', 50_000, 'shopping');
          await addExpense('2026-10-31T22:30:00Z', 30_000, 'food');
        });

        /** The $300.00 row (23:30 on 31 Oct in Belgrade, 18:30 in New York), then the demo's Biriyani of 31 Oct. */
        const foodOn31Oct = [line('Watch', 30_000, '2026-10-31T22:30:00Z'), octoberItems.food[0]!];

        it('at 2026-10-31T22:59:59Z counts both in October in Belgrade (00:30 on 1 Oct, 23:30 on 31 Oct)', async () => {
          clock.set(new Date('2026-10-31T22:59:59Z'));

          expect(await service.breakdown(userId, BELGRADE)).toEqual(
            breakdown(
              [27_216, down(10), octoberItems.housing],
              [86_424, up(82), foodOn31Oct],
              [7_448, down(5), octoberItems.transportation],
              [29_988, up(24), octoberItems.entertainment],
              [118_600, up(106), octoberItems.shopping],
              [15_960, down(21), octoberItems.others],
            ),
          );
        });

        it('at 2026-10-31T22:59:59Z counts the $500.00 in September in New York (18:30 on 30 Sep)', async () => {
          clock.set(new Date('2026-10-31T22:59:59Z'));

          expect(await service.breakdown(userId, NEW_YORK)).toEqual(
            breakdown(
              [27_216, down(10), octoberItems.housing],
              [86_424, up(82), foodOn31Oct],
              [7_448, down(5), octoberItems.transportation],
              [29_988, up(24), octoberItems.entertainment],
              [68_600, down(36), octoberItems.shopping],
              [15_960, down(21), octoberItems.others],
            ),
          );
        });

        it('at 2026-10-31T23:00:00Z counts both as last month in Belgrade', async () => {
          clock.set(new Date('2026-10-31T23:00:00Z'));

          expect(await service.breakdown(userId, BELGRADE)).toEqual(november);
        });

        // October starts in summer time and 1 Nov is in winter time: October's start taken with today's offset
        // (+1 hour) would be 2026-09-30T23:00:00Z and leave the $500.00 out of last month.
        it('at 2026-11-01T10:00:00Z counts the $500.00 in October, last month, in Belgrade', async () => {
          clock.set(new Date('2026-11-01T10:00:00Z'));
          await addExpense('2026-11-01T09:00:00Z', 10_000, 'shopping');

          expect((await service.breakdown(userId, BELGRADE)).categories[4]).toEqual({
            category: 'shopping',
            total: usd(10_000),
            // $100.00 against $1,186.00: -91.57%.
            change: down(92),
            recent: [line('Watch', 10_000, '2026-11-01T09:00:00Z')],
          });
        });

        it('at the fixed clock counts the $500.00 this month in Belgrade and last month in New York', async () => {
          expect((await service.breakdown(userId, BELGRADE)).categories[4]).toEqual({
            category: 'shopping',
            total: usd(115_800),
            change: up(101),
            recent: firstLoginItems.shopping,
          });
          expect((await service.breakdown(userId, NEW_YORK)).categories[4]).toEqual({
            category: 'shopping',
            total: usd(65_800),
            change: down(39),
            recent: firstLoginItems.shopping,
          });
        });
      });
    });

    // T5: AC3, AC5, no change when last month was $0.00; all six always (#21, #61).
    describe('an empty month', () => {
      it('at 2022-01-15T10:00:00Z answers 1 to 15 Jan with no change: December 2021 is before the dataset', async () => {
        clock.set(new Date('2022-01-15T10:00:00Z'));

        expect(await service.breakdown(userId, BELGRADE)).toEqual(
          breakdown(
            [23_750, null, [demo('Parking', 1_900, '2022-01-14'), demo('House Rent', 21_850, '2022-01-01')]],
            [27_379, null, [demo('Pizza', 2_090, '2022-01-08'), demo('Biriyani', 1_254, '2022-01-05')]],
            [3_611, null, [demo('Taxi fare', 903, '2022-01-13'), demo('Metro Card bill', 1_805, '2022-01-07')]],
            [7_410, null, [demo('iTunes', 5_700, '2022-01-12'), demo('Movie ticket', 1_710, '2022-01-06')]],
            [30_591, null, [demo('Shirt', 25_128, '2022-01-15'), demo('Keyboard', 3_278, '2022-01-09')]],
            [11_115, null, [demo('Donation', 2_565, '2022-01-11'), demo('Loan installment', 8_550, '2022-01-10')]],
          ),
        );
      });

      it('at 2021-12-31T10:00:00Z answers six $0.00 with no change and no item', async () => {
        clock.set(new Date('2021-12-31T10:00:00Z'));

        expect(await service.breakdown(userId, BELGRADE)).toEqual(allZero);
      });
    });

    // T5: AC3, the rounding cases of References: the user's rows replaced by one Food expense on 15 Sep and one on
    // 10 Oct (#115 a).
    describe('the rounding', () => {
      it.each<[string, number, number, Change]>([
        ['$200.00 to $225.00', 20_000, 22_500, up(13)],
        ['$200.00 to $175.00', 20_000, 17_500, down(13)],
        ['$200.00 to $201.00', 20_000, 20_100, up(1)],
        ['$200.00 to $199.00', 20_000, 19_900, down(1)],
        ['$200.00 to $200.99', 20_000, 20_099, none],
        ['$200.00 to $199.20', 20_000, 19_920, none],
        ['$200.00 to $200.00', 20_000, 20_000, none],
        ['$200.00 to $0.00', 20_000, 0, down(100)],
        ['$0.00 to $50.00', 0, 5_000, null],
      ])('%s', async (_case, lastMonth, thisMonth, change) => {
        await deleteTransactions();
        if (lastMonth > 0) await addExpense('2026-09-15T12:00:00Z', lastMonth, 'food');
        if (thisMonth > 0) await addExpense('2026-10-10T12:00:00Z', thisMonth, 'food');

        expect(await service.breakdown(userId, BELGRADE)).toEqual(
          breakdown(
            [0, null],
            [thisMonth, change, thisMonth > 0 ? [demo('Watch', thisMonth, '2026-10-10')] : []],
            [0, null],
            [0, null],
            [0, null],
            [0, null],
          ),
        );
      });
    });

    // Task 024 T8: AC12, AC14, the items: the category's 2 most recent Complete expenses of this month, from the
    // breakdown's one read, in the provider's order (`occurredAt`, then ID, newest first; #57, #61).
    describe('the items', () => {
      it('never lists a Failed or Pending expense or income moved onto today after the newest items', async () => {
        // The Failed Pizza (16 Oct) and the Pending Polo shirt (25 Oct) moved to 13:00 and 14:00 UTC today, after the
        // Jeans of 12:00; the Dividend (income, 15 Oct) to 15:00.
        await moveTo('Pizza', '2026-10-16T12:00:00Z', '2026-10-22T13:00:00Z');
        await moveTo('Polo shirt', '2026-10-25T12:00:00Z', '2026-10-22T14:00:00Z');
        await moveTo('Dividend', '2026-10-15T12:00:00Z', '2026-10-22T15:00:00Z');

        expect(await service.breakdown(userId, BELGRADE)).toEqual(firstLogin);
      });

      it('lists the one item of a category with one this month and none for the others (1 Nov in Belgrade)', async () => {
        clock.set(new Date('2026-10-31T23:00:00Z'));

        const { categories } = await service.breakdown(userId, BELGRADE);

        expect(categories.map(({ recent }) => recent)).toEqual([
          [demo('House Rent', 27_048, '2026-11-01')],
          [],
          [],
          [],
          [],
          [],
        ]);
      });

      it('lists the later of two rows of one day first: the $300.00 Food row before Biriyani on 31 Oct', async () => {
        clock.set(new Date('2026-10-31T22:59:59Z'));
        await addExpense('2026-10-31T22:30:00Z', 30_000, 'food');

        for (const zone of [BELGRADE, NEW_YORK]) {
          expect((await service.breakdown(userId, zone)).categories[1]!.recent, `the items in ${zone}`).toEqual([
            line('Watch', 30_000, '2026-10-31T22:30:00Z'),
            demo('Biriyani', 1_478, '2026-10-31'),
          ]);
        }
      });

      it('lists the higher ID first of two rows of one category at one instant', async () => {
        await addExpense('2026-10-22T09:00:00Z', 1_000, 'others', 'complete', 'Lower ID');
        await addExpense('2026-10-22T09:00:00Z', 2_000, 'others', 'complete', 'Higher ID');

        expect((await service.breakdown(userId, BELGRADE)).categories[5]!.recent).toEqual([
          line('Higher ID', 2_000, '2026-10-22T09:00:00Z'),
          line('Lower ID', 1_000, '2026-10-22T09:00:00Z'),
        ]);
      });

      it('lists this month’s rows in the zone: the $500.00 of 00:30 on 1 Oct in Belgrade is October’s oldest', async () => {
        await deleteTransactions();
        await addExpense('2026-09-30T22:30:00Z', 50_000, 'shopping', 'complete', 'Early');
        await addExpense('2026-09-30T21:30:00Z', 40_000, 'shopping', 'complete', 'September');

        expect((await service.breakdown(userId, BELGRADE)).categories[4]!.recent).toEqual([
          line('Early', 50_000, '2026-09-30T22:30:00Z'),
        ]);
        // 18:30 and 17:30 on 30 Sep in New York: both last month.
        expect((await service.breakdown(userId, NEW_YORK)).categories[4]!.recent).toEqual([]);
      });
    });
  });

  // Task 024 T5 to T7: AC3 to AC7, the Expenses chart: this year against last year, each month the sum of the six
  // categories' Complete expenses from the one calculation (#29, #53, #54, #55, #57, #91).
  describe('monthlyComparison', () => {
    describe('a first login', () => {
      it('answers 2025 against 2026 to October, Nov and Dec null, the ticks $0 to $4k', async () => {
        expect(await service.monthlyComparison(userId, BELGRADE)).toEqual(firstLoginChart);
      });

      it('answers integer cents with USD and only the contract’s keys', async () => {
        const answer = await service.monthlyComparison(userId, BELGRADE);

        expect(Object.keys(answer)).toEqual(['months', 'ticks']);
        for (const each of answer.months) {
          expect(Object.keys(each)).toEqual(['month', 'lastYear', 'thisYear']);
          expect(Object.keys(each.lastYear)).toEqual(['cents', 'currency']);
          expect(Number.isSafeInteger(each.lastYear.cents)).toBe(true);
        }
        for (const tick of answer.ticks!) expect(Object.keys(tick)).toEqual(['cents', 'currency']);
      });

      it('counts no Failed, Pending or income row and nothing dated after today', async () => {
        // The Failed Pizza (16 Oct) and the Pending Polo shirt (25 Oct) moved to 20 Oct, the Design project (income)
        // of 1 Sep to 20 Oct; a Complete expense on Fri 23 Oct; a Failed and a Pending expense in May 2025.
        await moveTo('Pizza', '2026-10-16T12:00:00Z', '2026-10-20T08:00:00Z');
        await moveTo('Polo shirt', '2026-10-25T12:00:00Z', '2026-10-20T09:00:00Z');
        await moveTo('Design project', '2026-09-01T12:00:00Z', '2026-10-20T10:00:00Z');
        await addExpense('2026-10-23T06:00:00Z', 50_000, 'shopping');
        await addExpense('2025-05-10T12:00:00Z', 50_000, 'others', 'failed');
        await addExpense('2025-05-11T12:00:00Z', 50_000, 'others', 'pending');

        expect(await service.monthlyComparison(userId, BELGRADE)).toEqual(firstLoginChart);
      });

      it('answers $0.00 for a month with no expense, in either year', async () => {
        await deleteTransactions();
        await addExpense('2025-03-15T12:00:00Z', 10_000, 'food');
        await addExpense('2026-02-10T12:00:00Z', 20_000, 'food');

        const zeros = Array.from({ length: 12 }, () => 0);
        expect(await service.monthlyComparison(userId, BELGRADE)).toEqual({
          months: months(
            2026,
            zeros.map((zero, index) => (index === 2 ? 10_000 : zero)),
            zeros.slice(0, 10).map((zero, index) => (index === 1 ? 20_000 : zero)),
          ),
          ticks: ticks(0, 50, 100, 150, 200),
        });
      });

      it('answers only the user’s own transactions', async () => {
        const other = (await userIdOf(db, (await signUp(app)).user.email))!;
        await deleteTransactions();

        expect(await service.monthlyComparison(userId, BELGRADE)).toEqual({
          months: months(
            2026,
            Array.from({ length: 12 }, () => 0),
            Array.from({ length: 10 }, () => 0),
          ),
          ticks: null,
        });
        expect(await service.monthlyComparison(other, BELGRADE)).toEqual(firstLoginChart);
      });
    });

    // T6: AC5, the month and year edges per zone, the whole `months` array compared (#54, #55, #80).
    describe('the month change', () => {
      it.each([BELGRADE, NEW_YORK])(
        'at 2026-10-31T22:59:59Z answers all of October and no Nov bar in %s',
        async (zone) => {
          clock.set(new Date('2026-10-31T22:59:59Z'));

          expect(await service.monthlyComparison(userId, zone)).toEqual(octoberChart);
        },
      );

      it('at 2026-10-31T23:00:00Z answers November’s bar in Belgrade and none in New York', async () => {
        clock.set(new Date('2026-10-31T23:00:00Z'));

        expect(await service.monthlyComparison(userId, BELGRADE)).toEqual(novemberChart);
        expect(await service.monthlyComparison(userId, NEW_YORK)).toEqual(octoberChart);
      });

      it('in New York answers no Nov bar at 2026-11-01T03:59:59Z and November’s at 04:00:00Z', async () => {
        clock.set(new Date('2026-11-01T03:59:59Z'));
        expect(await service.monthlyComparison(userId, NEW_YORK)).toEqual(octoberChart);

        clock.set(new Date('2026-11-01T04:00:00Z'));
        expect(await service.monthlyComparison(userId, NEW_YORK)).toEqual(novemberChart);
      });

      describe('with a $500.00 row at 2026-09-30T22:30:00Z and a $300.00 row at 2026-10-31T22:30:00Z', () => {
        beforeEach(async () => {
          await addExpense('2026-09-30T22:30:00Z', 50_000, 'shopping');
          await addExpense('2026-10-31T22:30:00Z', 30_000, 'food');
          clock.set(new Date('2026-10-31T22:59:59Z'));
        });

        it('counts both in October in Belgrade: Sep $1,875.95, Oct $2,856.36', async () => {
          expect(await service.monthlyComparison(userId, BELGRADE)).toEqual({
            months: months(2026, year2025, [...year2026.slice(0, 8), 187_595, 285_636]),
            ticks: demoTicks,
          });
        });

        it('counts the $500.00 in September in New York: Sep $2,375.95, Oct $2,356.36', async () => {
          expect(await service.monthlyComparison(userId, NEW_YORK)).toEqual({
            months: months(2026, year2025, [...year2026.slice(0, 8), 237_595, 235_636]),
            ticks: demoTicks,
          });
        });
      });
    });

    describe('the year change', () => {
      it('at 2026-12-31T23:00:00Z answers 2027 against 2026 in Belgrade and 2026 against 2025 in New York', async () => {
        clock.set(new Date('2026-12-31T23:00:00Z'));

        expect(await service.monthlyComparison(userId, BELGRADE)).toEqual(january2027(26_680));
        expect(await service.monthlyComparison(userId, NEW_YORK)).toEqual(december2026(242_704));
      });

      it('in New York turns at 2027-01-01T05:00:00Z', async () => {
        clock.set(new Date('2027-01-01T04:59:59Z'));
        expect(await service.monthlyComparison(userId, NEW_YORK)).toEqual(december2026(242_704));

        clock.set(new Date('2027-01-01T05:00:00Z'));
        expect(await service.monthlyComparison(userId, NEW_YORK)).toEqual(january2027(26_680));
      });

      it('counts a $500.00 row at 2026-12-31T23:30:00Z in Jan 2027 in Belgrade and in Dec 2026 in New York', async () => {
        await addExpense('2026-12-31T23:30:00Z', 50_000, 'others');
        clock.set(new Date('2026-12-31T23:30:00Z'));

        expect(await service.monthlyComparison(userId, BELGRADE)).toEqual(january2027(76_680));
        expect(await service.monthlyComparison(userId, NEW_YORK)).toEqual(december2026(292_704));
      });
    });

    // T7: AC6, AC7, the empty state and the axis from both years (#55, #91).
    describe('the axis and the empty state', () => {
      it('at 2021-12-31T10:00:00Z answers every value of both years $0.00 and no ticks', async () => {
        clock.set(new Date('2021-12-31T10:00:00Z'));

        const zeros = Array.from({ length: 12 }, () => 0);
        expect(await service.monthlyComparison(userId, BELGRADE)).toEqual({
          months: months(2021, zeros, zeros),
          ticks: null,
        });
      });

      it('at 2022-01-15T10:00:00Z answers 2021 all $0.00, January $1,038.56 and the ticks $0 to $2k', async () => {
        clock.set(new Date('2022-01-15T10:00:00Z'));

        expect(await service.monthlyComparison(userId, BELGRADE)).toEqual({
          months: months(
            2022,
            Array.from({ length: 12 }, () => 0),
            [103_856],
          ),
          ticks: ticks(0, 500, 1_000, 1_500, 2_000),
        });
      });

      it('takes the ticks from the highest value of both years: last year’s $900.00 over this year’s $100.00', async () => {
        await deleteTransactions();
        await addExpense('2025-03-15T12:00:00Z', 90_000, 'food');
        await addExpense('2026-02-10T12:00:00Z', 10_000, 'food');

        expect((await service.monthlyComparison(userId, BELGRADE)).ticks).toEqual(ticks(0, 250, 500, 750, 1_000));
      });

      it('leaves the months after the current one out of the ticks: none of them is read for this year', async () => {
        await deleteTransactions();
        await addExpense('2026-02-10T12:00:00Z', 10_000, 'food');
        // Dated in December 2026, after today: never read, so neither a value nor the axis.
        await addExpense('2026-12-10T12:00:00Z', 90_000, 'food');

        const answer = await service.monthlyComparison(userId, BELGRADE);
        expect(answer.months[11]).toEqual(month('2026-12', 0, null));
        expect(answer.ticks).toEqual(ticks(0, 25, 50, 75, 100));
      });
    });
  });

  // Task 024 T9: AC13, one calculation: the chart's current month is the sum of the breakdown's six totals.
  describe('the chart and the cards', () => {
    it('agree at the fixed clock: $1,893.80', async () => {
      expect(await currentMonth(BELGRADE)).toBe(189_380);
      expect(await sumOfTotals(BELGRADE)).toBe(189_380);
    });

    it.each([BELGRADE, NEW_YORK])('agree at 2026-10-31T23:00:00Z in %s, with the edge rows', async (zone) => {
      await addExpense('2026-09-30T22:30:00Z', 50_000, 'shopping');
      await addExpense('2026-10-31T22:30:00Z', 30_000, 'food');

      for (const instant of ['2026-10-31T22:59:59Z', '2026-10-31T23:00:00Z']) {
        clock.set(new Date(instant));
        expect(await currentMonth(zone), `${zone} at ${instant}`).toBe(await sumOfTotals(zone));
      }
    });
  });
});
