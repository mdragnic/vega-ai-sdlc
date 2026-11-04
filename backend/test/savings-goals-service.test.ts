import type { INestApplication } from '@nestjs/common';
import { ConflictException } from '@nestjs/common';
import { goalMessages, savingsGoalMonthsResponseSchema } from '@finebank/shared';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { SavingsGoalsService } from '../src/goals/savings-goals.service.js';
import { signUp } from './helpers/auth.js';
import { userIdOf } from './helpers/finance.js';
import { createTestApp } from './helpers/test-app.js';

const FIXED_NOW = '2026-10-22T10:00:00.000Z';
const BELGRADE = 'Europe/Belgrade';
const NEW_YORK = 'America/New_York';

const usd = (cents: number) => ({ cents, currency: 'USD' as const });

// Task 014 T5: AC2, AC6, AC10, AC12 and AC14, the service on the test database with a seeded user (#18, #31, #58, #85);
// task 025 T6 and T7: the months, one month's goal and the save's month rule (#123). Another user signs up first, so
// IDs never equal positions.
describe('SavingsGoalsService', () => {
  let app: INestApplication;
  let clock: FixedClock;
  let db: DataSource;
  let service: SavingsGoalsService;
  let userId: number;

  beforeAll(async () => {
    app = await createTestApp({ config: { nodeEnv: 'test', testNow: FIXED_NOW } });
    clock = app.get(FixedClock);
    db = app.get(DataSource);
    service = app.get(SavingsGoalsService);
    await signUp(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    clock.set(new Date(FIXED_NOW));
    userId = (await userIdOf(db, (await signUp(app)).user.email))!;
  });

  /** The user's rows for a month, read with plain SQL. */
  const rows = (month: string) =>
    db.query<{ target_cents: number; present_cents: number }[]>(
      'SELECT target_cents, present_cents FROM savings_goals WHERE user_id = ? AND month = ?',
      [userId, month],
    );
  const setRow = (month: string, target: number, present: number) =>
    db.query('UPDATE savings_goals SET target_cents = ?, present_cents = ? WHERE user_id = ? AND month = ?', [
      target,
      present,
      userId,
      month,
    ]);
  const deleteRow = (month: string) =>
    db.query('DELETE FROM savings_goals WHERE user_id = ? AND month = ?', [userId, month]);
  /** Every goal row of the user, by month. */
  const allRows = () =>
    db.query<{ month: string; target_cents: number; present_cents: number }[]>(
      'SELECT month, target_cents, present_cents FROM savings_goals WHERE user_id = ? ORDER BY month',
      [userId],
    );
  /** A goal row for a month, of the user unless another is named. */
  const insertGoal = (month: string, owner = userId) =>
    db.query('INSERT INTO savings_goals (user_id, month, target_cents, present_cents) VALUES (?, ?, 100000, 0)', [
      owner,
      month,
    ]);
  /** An expense at an instant, on the user's first account unless another is named. */
  async function addTransaction(instant: string, accountId?: number) {
    const [first] = await db.query<{ id: number }[]>('SELECT id FROM accounts WHERE user_id = ? ORDER BY id LIMIT 1', [
      userId,
    ]);
    await db.query(
      `INSERT INTO transactions (account_id, occurred_at, direction, status, category, item, shop_name, receipt, amount_cents)
       VALUES (?, ?, 'expense', 'complete', 'food', 'Added row', 'Pizza Hit', 'Ab3dE5gH9jK', 1000)`,
      [accountId ?? first!.id, new Date(instant).toISOString().replace('T', ' ').replace('Z', '')],
    );
  }

  describe('current', () => {
    it('answers the demo goal of the current month with its progress from goalProgress', async () => {
      expect(await service.current(userId, BELGRADE)).toEqual({
        month: '2026-10',
        goal: { target: usd(2_000_000), present: usd(1_625_000), progress: 0.8125 },
      });
    });

    it('answers no goal for a month without a row (#58, #85)', async () => {
      await deleteRow('2026-10');

      expect(await service.current(userId, BELGRADE)).toEqual({ month: '2026-10', goal: null });
    });

    it.each([
      ['a Present above the Target', 2_500_000, 1],
      ['a Present of 0', 0, 0],
    ])('caps or floors the progress for %s', async (_case, present, progress) => {
      await setRow('2026-10', 2_000_000, present);

      expect((await service.current(userId, BELGRADE)).goal).toEqual({
        target: usd(2_000_000),
        present: usd(present),
        progress,
      });
    });

    it('takes the month from the Clock in the zone (#54, #80)', async () => {
      clock.set(new Date('2026-10-31T23:30:00Z'));

      expect(await service.current(userId, BELGRADE)).toMatchObject({
        month: '2026-11',
        goal: { present: usd(1_700_000) },
      });
      expect(await service.current(userId, 'America/New_York')).toMatchObject({
        month: '2026-10',
        goal: { present: usd(1_625_000) },
      });
    });
  });

  describe('save', () => {
    it('creates the month’s goal when there is none, and answers it', async () => {
      await deleteRow('2026-10');

      const saved = await service.save(userId, BELGRADE, {
        month: '2026-10',
        target: usd(50_000),
        present: usd(0),
      });

      expect(saved).toEqual({ month: '2026-10', goal: { target: usd(50_000), present: usd(0), progress: 0 } });
      expect(await rows('2026-10')).toEqual([{ target_cents: 50_000, present_cents: 0 }]);
    });

    it('updates the month’s goal, still one row for the user and month', async () => {
      const saved = await service.save(userId, BELGRADE, {
        month: '2026-10',
        target: usd(2_500_050),
        present: usd(3_000_000),
      });

      expect(saved).toEqual({
        month: '2026-10',
        goal: { target: usd(2_500_050), present: usd(3_000_000), progress: 1 },
      });
      expect(await rows('2026-10')).toEqual([{ target_cents: 2_500_050, present_cents: 3_000_000 }]);
      // The other months are untouched.
      expect(await rows('2026-09')).toEqual([{ target_cents: 2_000_000, present_cents: 1_550_000 }]);
    });

    // Task 025 (#123 b, which updates #108 d): a save after the month ended lands in the month the popup opened with.
    it('saves October at 00:30 on 1 Nov in Belgrade, now a past month, and leaves November as it was', async () => {
      clock.set(new Date('2026-10-31T23:30:00Z'));

      const saved = await service.save(userId, BELGRADE, { month: '2026-10', target: usd(100), present: usd(0) });

      expect(saved).toEqual({ month: '2026-10', goal: { target: usd(100), present: usd(0), progress: 0 } });
      expect(await rows('2026-10')).toEqual([{ target_cents: 100, present_cents: 0 }]);
      expect(await rows('2026-11')).toEqual([{ target_cents: 2_000_000, present_cents: 1_700_000 }]);
    });

    // Task 025 T7, AC16: any month from the earliest to the current one; only that month's row changes.
    it('saves a past month, March 2026, changing only its row', async () => {
      const before = await allRows();

      const saved = await service.save(userId, BELGRADE, {
        month: '2026-03',
        target: usd(2_500_050),
        present: usd(1_200_000),
      });

      expect(saved).toEqual({
        month: '2026-03',
        goal: { target: usd(2_500_050), present: usd(1_200_000), progress: 1_200_000 / 2_500_050 },
      });
      expect(await allRows()).toEqual(
        before.map((row) =>
          row.month === '2026-03' ? { ...row, target_cents: 2_500_050, present_cents: 1_200_000 } : row,
        ),
      );
    });

    it('creates the goal of a past month with no row', async () => {
      await deleteRow('2025-07');

      expect(await service.forMonth(userId, BELGRADE, '2025-07')).toEqual({ month: '2025-07', goal: null });
      const saved = await service.save(userId, BELGRADE, { month: '2025-07', target: usd(50_000), present: usd(0) });

      expect(saved).toEqual({ month: '2025-07', goal: { target: usd(50_000), present: usd(0), progress: 0 } });
      expect(await rows('2025-07')).toEqual([{ target_cents: 50_000, present_cents: 0 }]);
    });

    it.each([
      ['a future month with a demo goal', '2026-11'],
      ['a month far in the future', '2028-12'],
      ['the month before the earliest', '2021-12'],
      ['a month long before it', '1999-01'],
    ])('answers 409 monthUnavailable for %s, %s, and stores nothing (#123 b)', async (_case, month) => {
      const before = await allRows();

      const save = service.save(userId, BELGRADE, { month, target: usd(100), present: usd(0) });

      await expect(save).rejects.toThrow(ConflictException);
      await expect(save).rejects.toThrow(goalMessages.monthUnavailable);
      expect(await allRows()).toEqual(before);
    });

    it('saves December 2021 in New York once a row dated then there exists, still 409 in Belgrade', async () => {
      await addTransaction('2021-12-31T23:30:00Z');
      const body = { month: '2021-12', target: usd(10_000), present: usd(500) };

      await expect(service.save(userId, BELGRADE, body)).rejects.toThrow(goalMessages.monthUnavailable);
      expect(await rows('2021-12')).toEqual([]);

      expect(await service.save(userId, NEW_YORK, body)).toEqual({
        month: '2021-12',
        goal: { target: usd(10_000), present: usd(500), progress: 0.05 },
      });
      expect(await rows('2021-12')).toEqual([{ target_cents: 10_000, present_cents: 500 }]);
    });
  });

  // Task 025 T6, AC3, AC5 and AC6: from the current month in the zone back to the earliest, newest first (#60, #123 a).
  describe('months', () => {
    it('lists the 58 months from Oct, 2026 to Jan, 2022 at the fixed clock', async () => {
      const { months } = await service.months(userId, BELGRADE);

      expect(months).toHaveLength(58);
      expect(months.slice(0, 3)).toEqual(['2026-10', '2026-09', '2026-08']);
      expect(months.slice(8, 11)).toEqual(['2026-02', '2026-01', '2025-12']);
      expect(months.at(-1)).toBe('2022-01');
      expect(savingsGoalMonthsResponseSchema.parse({ months })).toEqual({ months });
    });

    it.each([
      [BELGRADE, 59, '2026-11'],
      [NEW_YORK, 58, '2026-10'],
    ])('at 2026-10-31T23:30:00Z in %s lists %i months from %s', async (zone, length, first) => {
      clock.set(new Date('2026-10-31T23:30:00Z'));

      const { months } = await service.months(userId, zone);

      expect([months.length, months[0], months.at(-1)]).toEqual([length, first, '2022-01']);
    });

    it('ends at Dec, 2021 in New York and at Jan, 2022 in Belgrade with a row at 2021-12-31T23:30:00Z', async () => {
      await addTransaction('2021-12-31T23:30:00Z');

      expect((await service.months(userId, NEW_YORK)).months.at(-1)).toBe('2021-12');
      expect((await service.months(userId, BELGRADE)).months.at(-1)).toBe('2022-01');
    });

    it('ends at Jun, 2021 in both zones with a goal row for that month', async () => {
      await insertGoal('2021-06');

      for (const zone of [BELGRADE, NEW_YORK]) {
        const { months } = await service.months(userId, zone);
        expect([months.length, months.at(-1)]).toEqual([65, '2021-06']);
      }
    });

    it('never counts a future goal or transaction: the demo’s Nov 2026 to Dec 2028', async () => {
      const { months } = await service.months(userId, BELGRADE);

      expect(months[0]).toBe('2026-10');
      expect(months.filter((month) => month > '2026-10')).toEqual([]);
    });

    it('lists the current month alone with no data up to today, the clock at 2021-12-31T10:00:00Z', async () => {
      clock.set(new Date('2021-12-31T10:00:00Z'));

      expect(await service.months(userId, BELGRADE)).toEqual({ months: ['2021-12'] });
    });

    it('lists 85 months from Jan, 2029, which has no goal, at 2029-01-15T10:00:00Z', async () => {
      clock.set(new Date('2029-01-15T10:00:00Z'));

      const { months } = await service.months(userId, BELGRADE);

      expect([months.length, months[0], months.at(-1)]).toEqual([85, '2029-01', '2022-01']);
      expect(await service.forMonth(userId, BELGRADE, '2029-01')).toEqual({ month: '2029-01', goal: null });
    });

    it('never moves for another user’s earlier transactions or goals', async () => {
      const other = (await userIdOf(db, (await signUp(app)).user.email))!;
      const [otherAccount] = await db.query<{ id: number }[]>('SELECT id FROM accounts WHERE user_id = ? LIMIT 1', [
        other,
      ]);
      await addTransaction('2020-03-01T12:00:00Z', otherAccount!.id);
      await insertGoal('2019-05', other);

      const { months } = await service.months(userId, NEW_YORK);

      expect([months.length, months.at(-1)]).toEqual([58, '2022-01']);
      expect((await service.months(other, NEW_YORK)).months.at(-1)).toBe('2019-05');
    });
  });

  // Task 025 T7, AC4, AC8 and AC15: one month's goal, by the same month rule as the save (#58, #85, #123 b).
  describe('forMonth', () => {
    it.each([
      ['2026-03', usd(1_100_000), 0.55],
      ['2026-09', usd(1_550_000), 0.775],
      ['2025-12', usd(2_100_000), 1],
      ['2026-10', usd(1_625_000), 0.8125],
      ['2022-01', usd(950_000), 0.475],
    ])('answers the demo goal of %s', async (month, present, progress) => {
      const answer = await service.forMonth(userId, BELGRADE, month);

      expect(answer).toEqual({ month, goal: { target: usd(2_000_000), present, progress } });
    });

    it('answers goal: null for a month without a row', async () => {
      await deleteRow('2026-03');

      expect(await service.forMonth(userId, BELGRADE, '2026-03')).toEqual({ month: '2026-03', goal: null });
    });

    it.each(['2026-11', '2027-05', '2021-12'])(
      'answers 409 monthUnavailable for %s and reads no goal',
      async (month) => {
        const read = service.forMonth(userId, BELGRADE, month);

        await expect(read).rejects.toThrow(ConflictException);
        await expect(read).rejects.toThrow(goalMessages.monthUnavailable);
      },
    );

    it('reads only the user’s own row of the month', async () => {
      const other = (await userIdOf(db, (await signUp(app)).user.email))!;
      await db.query('UPDATE savings_goals SET present_cents = 7 WHERE user_id = ? AND month = ?', [other, '2026-03']);

      expect((await service.forMonth(userId, BELGRADE, '2026-03')).goal?.present).toEqual(usd(1_100_000));
      expect((await service.forMonth(other, BELGRADE, '2026-03')).goal?.present).toEqual(usd(7));
    });
  });
});
