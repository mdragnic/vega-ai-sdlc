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

const usd = (cents: number) => ({ cents, currency: 'USD' as const });
const up = (percent: number): Change => ({ percent, direction: 'up' });
const down = (percent: number): Change => ({ percent, direction: 'down' });
const none: Change = { percent: 0, direction: null };

/** The six categories of an answer in the designed order: each one's total in cents and its change. */
function breakdown(...rows: [total: number, change: Change][]) {
  const categories: Category[] = ['housing', 'food', 'transportation', 'entertainment', 'shopping', 'others'];
  return {
    categories: categories.map((category, index) => ({
      category,
      total: usd(rows[index]![0]),
      change: rows[index]![1],
    })),
  };
}

/** A first login on Thu 22 Oct 2026: 1 to 22 Oct against all of Sep (demo-data.md, "What a first login shows"; AC1). */
const firstLogin = breakdown(
  [25_200, down(17)],
  [51_004, up(7)],
  [5_320, down(32)],
  [28_224, up(16)],
  [65_800, up(14)],
  [13_832, down(31)],
);

/** All of October against all of September (References: the clock at 2026-10-31T22:59:59Z). */
const october = breakdown(
  [27_216, down(10)],
  [56_424, up(19)],
  [7_448, down(5)],
  [29_988, up(24)],
  [68_600, up(19)],
  [15_960, down(21)],
);

/** 1 Nov against all of October: the House Rent of 1 Nov only (References: 2026-10-31T23:00:00Z in Belgrade). */
const november = breakdown(
  [27_048, down(1)],
  [0, down(100)],
  [0, down(100)],
  [0, down(100)],
  [0, down(100)],
  [0, down(100)],
);

/** A stored `occurred_at` value for a UTC instant. */
const stored = (instant: string) => instant.replace('T', ' ').replace('Z', '.000');

// T3 to T5: AC1 to AC5, the service on the test database with a seeded user (#11, #21, #53, #54, #57, #61, #80).
describe('ExpensesService.breakdown', () => {
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
  const addExpense = async (instant: string, cents: number, category: Category, status = 'complete') => {
    const [{ id: accountId }] = await db.query<[{ id: number }]>(
      'SELECT id FROM accounts WHERE user_id = ? ORDER BY id LIMIT 1',
      [userId],
    );
    await db.query(
      `INSERT INTO transactions (account_id, occurred_at, direction, status, category, item, shop_name, receipt, amount_cents)
       VALUES (?, ?, 'expense', ?, ?, 'Watch', 'Time Shop', 'Ab3dE5gH9jK', ?)`,
      [accountId, stored(instant), status, category, cents],
    );
  };

  const deleteTransactions = () =>
    db.query('DELETE FROM transactions WHERE account_id IN (SELECT id FROM accounts WHERE user_id = ?)', [userId]);

  // T3: AC1, AC2.
  describe('a first login', () => {
    it('answers 1 to 22 Oct against all of Sep for the six categories, in the designed order', async () => {
      expect(await service.breakdown(userId, BELGRADE)).toEqual(firstLogin);
    });

    it('answers integer cents with USD and only the contract’s keys', async () => {
      const answer = await service.breakdown(userId, BELGRADE);

      expect(Object.keys(answer)).toEqual(['categories']);
      for (const each of answer.categories) {
        expect(Object.keys(each)).toEqual(['category', 'total', 'change']);
        expect(Object.keys(each.total)).toEqual(['cents', 'currency']);
        expect(Number.isSafeInteger(each.total.cents)).toBe(true);
        expect(Object.keys(each.change!)).toEqual(['percent', 'direction']);
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

    it('counts a Complete expense of today', async () => {
      await addExpense('2026-10-22T09:00:00Z', 50_000, 'others');

      expect((await service.breakdown(userId, BELGRADE)).categories[5]).toEqual({
        category: 'others',
        total: usd(63_832),
        change: up(217),
      });
    });

    it('answers only the user’s own transactions', async () => {
      const other = (await userIdOf(db, (await signUp(app)).user.email))!;
      await deleteTransactions();

      expect(await service.breakdown(userId, BELGRADE)).toEqual(
        breakdown([0, null], [0, null], [0, null], [0, null], [0, null], [0, null]),
      );
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

    // A month start taken with today's offset (+1 hour in Belgrade at the end of October) would miss the $500.00 row;
    // a month end as its start plus 31 x 24 hours (22:00Z) would miss the $300.00 row; a month in UTC would put the
    // $500.00 row in September.
    describe('with a $500.00 Shopping row at 2026-09-30T22:30:00Z and a $300.00 Food row at 2026-10-31T22:30:00Z', () => {
      beforeEach(async () => {
        await addExpense('2026-09-30T22:30:00Z', 50_000, 'shopping');
        await addExpense('2026-10-31T22:30:00Z', 30_000, 'food');
      });

      it('at 2026-10-31T22:59:59Z counts both in October in Belgrade (00:30 on 1 Oct, 23:30 on 31 Oct)', async () => {
        clock.set(new Date('2026-10-31T22:59:59Z'));

        expect(await service.breakdown(userId, BELGRADE)).toEqual(
          breakdown(
            [27_216, down(10)],
            [86_424, up(82)],
            [7_448, down(5)],
            [29_988, up(24)],
            [118_600, up(106)],
            [15_960, down(21)],
          ),
        );
      });

      it('at 2026-10-31T22:59:59Z counts the $500.00 in September in New York (18:30 on 30 Sep)', async () => {
        clock.set(new Date('2026-10-31T22:59:59Z'));

        expect(await service.breakdown(userId, NEW_YORK)).toEqual(
          breakdown(
            [27_216, down(10)],
            [86_424, up(82)],
            [7_448, down(5)],
            [29_988, up(24)],
            [68_600, down(36)],
            [15_960, down(21)],
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
        });
      });

      it('at the fixed clock counts the $500.00 this month in Belgrade and last month in New York', async () => {
        expect((await service.breakdown(userId, BELGRADE)).categories[4]).toEqual({
          category: 'shopping',
          total: usd(115_800),
          change: up(101),
        });
        expect((await service.breakdown(userId, NEW_YORK)).categories[4]).toEqual({
          category: 'shopping',
          total: usd(65_800),
          change: down(39),
        });
      });
    });
  });

  // T5: AC3, AC5, no change when last month was $0.00; all six always (#21, #61).
  describe('an empty month', () => {
    it('at 2022-01-15T10:00:00Z answers 1 to 15 Jan with no change: December 2021 is before the dataset', async () => {
      clock.set(new Date('2022-01-15T10:00:00Z'));

      expect(await service.breakdown(userId, BELGRADE)).toEqual(
        breakdown([23_750, null], [27_379, null], [3_611, null], [7_410, null], [30_591, null], [11_115, null]),
      );
    });

    it('at 2021-12-31T10:00:00Z answers six $0.00 with no change', async () => {
      clock.set(new Date('2021-12-31T10:00:00Z'));

      expect(await service.breakdown(userId, BELGRADE)).toEqual(
        breakdown([0, null], [0, null], [0, null], [0, null], [0, null], [0, null]),
      );
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
        breakdown([0, null], [thisMonth, change], [0, null], [0, null], [0, null], [0, null]),
      );
    });
  });
});
