import type { INestApplication } from '@nestjs/common';
import { ConflictException } from '@nestjs/common';
import { goalMessages } from '@finebank/shared';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { SavingsGoalsService } from '../src/goals/savings-goals.service.js';
import { signUp } from './helpers/auth.js';
import { userIdOf } from './helpers/finance.js';
import { createTestApp } from './helpers/test-app.js';

const FIXED_NOW = '2026-10-22T10:00:00.000Z';
const BELGRADE = 'Europe/Belgrade';

const usd = (cents: number) => ({ cents, currency: 'USD' as const });

// T5: AC2, AC6, AC10, AC12 and AC14, the service on the test database with a seeded user (#18, #31, #58, #85).
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

    it('answers 409 for another month and stores nothing (#108 d)', async () => {
      clock.set(new Date('2026-10-31T23:30:00Z'));

      const save = service.save(userId, BELGRADE, { month: '2026-10', target: usd(100), present: usd(0) });

      await expect(save).rejects.toThrow(ConflictException);
      await expect(save).rejects.toThrow(goalMessages.monthEnded);
      expect(await rows('2026-10')).toEqual([{ target_cents: 2_000_000, present_cents: 1_625_000 }]);
      expect(await rows('2026-11')).toEqual([{ target_cents: 2_000_000, present_cents: 1_700_000 }]);
    });
  });
});
