import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { StatisticsService } from '../src/statistics/statistics.service.js';
import { signUp } from './helpers/auth.js';
import { userIdOf } from './helpers/finance.js';
import { createTestApp } from './helpers/test-app.js';

const FIXED_NOW = '2026-10-22T10:00:00.000Z';
const BELGRADE = 'Europe/Belgrade';
const NEW_YORK = 'America/New_York';

const usd = (cents: number) => ({ cents, currency: 'USD' as const });
const ticks = (step: number) => [0, 1, 2, 3, 4].map((index) => usd(index * step));

/**
 * The 7 days of an answer from this week's Monday, `YYYY-MM-DD` as `2026-10-19`: last week's and this week's cents
 * per weekday, `null` for a day after today.
 */
function week(dates: string[], lastWeek: number[], thisWeek: (number | null)[]) {
  return dates.map((date, index) => ({
    date,
    lastWeek: usd(lastWeek[index]!),
    thisWeek: thisWeek[index] === null ? null : usd(thisWeek[index]!),
  }));
}

const oct19to25 = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];
const oct26toNov1 = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];

/**
 * Mon 12 to Sun 18 Oct 2026 (demo-data.md): iTunes, Taxi fare, Parking, Shirt (the Dividend is income), Biriyani (the
 * Failed Pizza not counted), GTR 5 (the Freelance payment is income), Restaurant bill.
 */
const oct12to18 = [5_880, 1_064, 2_016, 32_200, 1_478, 18_816, 14_784];
/** Mon 19 to Thu 22 Oct: Taxi fare, Pizza, Movie ticket, Jeans. */
const oct19to22 = [1_064, 2_464, 1_764, 26_600];
/** Mon 19 to Sun 25 Oct: then Biriyani, Gift (the Freelance payment is income), Taxi fare (the Pending Polo shirt not counted). */
const oct19to25Values = [...oct19to22, 1_478, 2_128, 1_064];

/** A first login on Thu 22 Oct 2026 in Belgrade (demo-data.md, "What a first login shows"; AC1). */
const firstLogin = {
  days: week(oct19to25, oct12to18, [...oct19to22, null, null, null]),
  ticks: ticks(10_000),
};

/** A stored `occurred_at` value for a UTC instant. */
const stored = (instant: string) => instant.replace('T', ' ').replace('Z', '.000');

// T4 to T6: AC1 to AC5, the service on the test database with a seeded user (#11, #20, #53, #54, #55, #57, #80, #91).
describe('StatisticsService.weeklyComparison', () => {
  let app: INestApplication;
  let clock: FixedClock;
  let db: DataSource;
  let service: StatisticsService;
  let userId: number;

  beforeAll(async () => {
    app = await createTestApp({ config: { nodeEnv: 'test', testNow: FIXED_NOW } });
    clock = app.get(FixedClock);
    db = app.get(DataSource);
    service = app.get(StatisticsService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    clock.set(new Date(FIXED_NOW));
    userId = (await userIdOf(db, (await signUp(app)).user.email))!;
  });

  /** Moves the user's row with this item stored at `from` to `to`, with plain SQL. */
  const moveTo = (item: string, from: string, to: string) =>
    db.query(
      `UPDATE transactions SET occurred_at = ?
       WHERE item = ? AND occurred_at = ? AND account_id IN (SELECT id FROM accounts WHERE user_id = ?)`,
      [stored(to), item, stored(from), userId],
    );

  /** Adds a Complete expense of `cents` at `instant` to the user's first account, with plain SQL. */
  const addExpense = async (instant: string, cents: number) => {
    const [{ id: accountId }] = await db.query<[{ id: number }]>(
      'SELECT id FROM accounts WHERE user_id = ? ORDER BY id LIMIT 1',
      [userId],
    );
    await db.query(
      `INSERT INTO transactions (account_id, occurred_at, direction, status, category, item, shop_name, receipt, amount_cents)
       VALUES (?, ?, 'expense', 'complete', 'shopping', 'Watch', 'Time Shop', 'Ab3dE5gH9jK', ?)`,
      [accountId, stored(instant), cents],
    );
  };

  // T4: AC1, AC2, AC5.
  describe('a first login', () => {
    it('answers this week Mon 19 to Sun 25 Oct and last week Mon 12 to Sun 18 Oct, nothing after today, ticks $0 to $400', async () => {
      expect(await service.weeklyComparison(userId, BELGRADE)).toEqual(firstLogin);
    });

    it('answers integer cents with USD and only the contract’s keys', async () => {
      const answer = await service.weeklyComparison(userId, BELGRADE);

      expect(Object.keys(answer)).toEqual(['days', 'ticks']);
      for (const day of answer.days) {
        expect(Object.keys(day)).toEqual(['date', 'lastWeek', 'thisWeek']);
        for (const money of [day.lastWeek, day.thisWeek].filter((value) => value !== null)) {
          expect(Object.keys(money)).toEqual(['cents', 'currency']);
          expect(Number.isSafeInteger(money.cents)).toBe(true);
        }
      }
    });

    it('counts neither a Failed nor a Pending expense on a counted day', async () => {
      // The demo's Failed Pizza (16 Oct) and Pending Polo shirt (25 Oct), moved to Wed 21 Oct.
      await moveTo('Pizza', '2026-10-16T12:00:00Z', '2026-10-21T08:00:00Z');
      await moveTo('Polo shirt', '2026-10-25T12:00:00Z', '2026-10-21T09:00:00Z');
      const moved = await db.query<{ status: string }[]>(
        `SELECT status FROM transactions
         WHERE occurred_at IN (?, ?) AND account_id IN (SELECT id FROM accounts WHERE user_id = ?) ORDER BY status`,
        [stored('2026-10-21T08:00:00Z'), stored('2026-10-21T09:00:00Z'), userId],
      );
      expect(moved).toEqual([{ status: 'failed' }, { status: 'pending' }]);

      expect(await service.weeklyComparison(userId, BELGRADE)).toEqual(firstLogin);
    });

    it('counts no income', async () => {
      // The Freelance payment of Sat 17 Oct ($179.20) moved to Wed 21 Oct, the Dividend of Thu 15 Oct to Mon 12 Oct.
      await moveTo('Freelance payment', '2026-10-17T12:00:00Z', '2026-10-21T08:00:00Z');
      await moveTo('Dividend', '2026-10-15T12:00:00Z', '2026-10-12T08:00:00Z');

      expect(await service.weeklyComparison(userId, BELGRADE)).toEqual(firstLogin);
    });

    it('answers $0.00 for a day with no expense', async () => {
      await db.query(
        `DELETE FROM transactions WHERE item IN ('Pizza', 'Parking') AND occurred_at IN (?, ?)
         AND account_id IN (SELECT id FROM accounts WHERE user_id = ?)`,
        [stored('2026-10-20T12:00:00Z'), stored('2026-10-14T12:00:00Z'), userId],
      );

      expect(await service.weeklyComparison(userId, BELGRADE)).toEqual({
        days: week(
          oct19to25,
          [5_880, 1_064, 0, 32_200, 1_478, 18_816, 14_784],
          [1_064, 0, 1_764, 26_600, null, null, null],
        ),
        ticks: ticks(10_000),
      });
    });

    it('answers every value 0 and no ticks before the dataset begins', async () => {
      clock.set(new Date('2021-12-31T10:00:00Z'));

      expect(await service.weeklyComparison(userId, BELGRADE)).toEqual({
        days: week(
          ['2021-12-27', '2021-12-28', '2021-12-29', '2021-12-30', '2021-12-31', '2022-01-01', '2022-01-02'],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, null, null],
        ),
        ticks: null,
      });
    });

    it('answers this week all 0 with last week’s values and their ticks', async () => {
      await db.query(
        `DELETE FROM transactions WHERE occurred_at >= ? AND account_id IN (SELECT id FROM accounts WHERE user_id = ?)`,
        [stored('2026-10-19T00:00:00Z'), userId],
      );

      expect(await service.weeklyComparison(userId, BELGRADE)).toEqual({
        days: week(oct19to25, oct12to18, [0, 0, 0, 0, null, null, null]),
        ticks: ticks(10_000),
      });
    });

    it('answers only the user’s own transactions', async () => {
      const other = (await userIdOf(db, (await signUp(app)).user.email))!;
      await db.query('DELETE FROM transactions WHERE account_id IN (SELECT id FROM accounts WHERE user_id = ?)', [
        userId,
      ]);

      expect((await service.weeklyComparison(userId, BELGRADE)).ticks).toBeNull();
      expect(await service.weeklyComparison(other, BELGRADE)).toEqual(firstLogin);
    });
  });

  // T5: AC3, the midnight of 22 Oct in Belgrade (UTC+2) against New York (UTC-4).
  describe('around midnight', () => {
    it('at 2026-10-22T21:59:59Z (23:59:59 Thu in Belgrade) has no value on Friday', async () => {
      clock.set(new Date('2026-10-22T21:59:59Z'));

      expect(await service.weeklyComparison(userId, BELGRADE)).toEqual(firstLogin);
    });

    it('at 2026-10-22T22:00:00Z (00:00 Fri in Belgrade) answers Friday’s Biriyani, $14.78', async () => {
      clock.set(new Date('2026-10-22T22:00:00Z'));

      expect(await service.weeklyComparison(userId, BELGRADE)).toEqual({
        days: week(oct19to25, oct12to18, [...oct19to22, 1_478, null, null]),
        ticks: ticks(10_000),
      });
    });

    it('at 2026-10-22T22:00:00Z (18:00 Thu in New York) still has no value on Friday', async () => {
      clock.set(new Date('2026-10-22T22:00:00Z'));

      expect(await service.weeklyComparison(userId, NEW_YORK)).toEqual(firstLogin);
    });

    it('counts $500.00 at 2026-10-20T22:30:00Z on Wednesday in Belgrade and on Tuesday in New York', async () => {
      await addExpense('2026-10-20T22:30:00Z', 50_000);

      expect(await service.weeklyComparison(userId, BELGRADE)).toEqual({
        days: week(oct19to25, oct12to18, [1_064, 2_464, 51_764, 26_600, null, null, null]),
        ticks: ticks(15_000),
      });
      expect(await service.weeklyComparison(userId, NEW_YORK)).toEqual({
        days: week(oct19to25, oct12to18, [1_064, 52_464, 1_764, 26_600, null, null, null]),
        ticks: ticks(15_000),
      });
    });

    it('counts $500.00 at 2026-10-18T22:30:00Z on this week’s Monday in Belgrade and last week’s Sunday in New York', async () => {
      await addExpense('2026-10-18T22:30:00Z', 50_000);

      expect(await service.weeklyComparison(userId, BELGRADE)).toEqual({
        days: week(oct19to25, oct12to18, [51_064, 2_464, 1_764, 26_600, null, null, null]),
        ticks: ticks(15_000),
      });
      expect(await service.weeklyComparison(userId, NEW_YORK)).toEqual({
        days: week(oct19to25, [5_880, 1_064, 2_016, 32_200, 1_478, 18_816, 64_784], [...oct19to22, null, null, null]),
        ticks: ticks(20_000),
      });
    });
  });

  // T6: AC4, Belgrade's Monday 26 Oct starts at 2026-10-25T23:00:00Z, after it leaves summer time (a 169-hour week).
  describe('the start of a week', () => {
    it('at 2026-10-25T22:59:59Z (23:59:59 Sun in Belgrade) answers the week 19 to 25 Oct with all seven days', async () => {
      clock.set(new Date('2026-10-25T22:59:59Z'));

      expect(await service.weeklyComparison(userId, BELGRADE)).toEqual({
        days: week(oct19to25, oct12to18, oct19to25Values),
        ticks: ticks(10_000),
      });
    });

    it('at 2026-10-25T23:00:00Z (00:00 Mon in Belgrade) answers the week 26 Oct to 1 Nov, Monday’s Polo shirt only', async () => {
      clock.set(new Date('2026-10-25T23:00:00Z'));

      expect(await service.weeklyComparison(userId, BELGRADE)).toEqual({
        days: week(oct26toNov1, oct19to25Values, [2_800, null, null, null, null, null, null]),
        ticks: ticks(10_000),
      });
    });

    // A week of Monday plus 7 x 24 hours would end at 2026-10-25T22:00:00Z and leave this row out.
    it('counts $500.00 at 2026-10-25T22:30:00Z (23:30 Sun in Belgrade) on that Sunday, then as last week’s', async () => {
      await addExpense('2026-10-25T22:30:00Z', 50_000);

      clock.set(new Date('2026-10-25T22:59:59Z'));
      expect(await service.weeklyComparison(userId, BELGRADE)).toEqual({
        days: week(oct19to25, oct12to18, [...oct19to25Values.slice(0, 6), 51_064]),
        ticks: ticks(15_000),
      });

      clock.set(new Date('2026-10-25T23:00:00Z'));
      expect(await service.weeklyComparison(userId, BELGRADE)).toEqual({
        days: week(oct26toNov1, [...oct19to25Values.slice(0, 6), 51_064], [2_800, null, null, null, null, null, null]),
        ticks: ticks(15_000),
      });
    });

    it('at 2026-10-25T23:00:00Z (19:00 Sun in New York) still answers the week 19 to 25 Oct with all seven days', async () => {
      clock.set(new Date('2026-10-25T23:00:00Z'));

      expect(await service.weeklyComparison(userId, NEW_YORK)).toEqual({
        days: week(oct19to25, oct12to18, oct19to25Values),
        ticks: ticks(10_000),
      });
    });
  });
});
