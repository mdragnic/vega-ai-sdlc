import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { CategoryLimitsService } from '../src/goals/category-limits.service.js';
import { signUp } from './helpers/auth.js';
import { userIdOf } from './helpers/finance.js';
import { createTestApp } from './helpers/test-app.js';

const usd = (cents: number) => ({ cents, currency: 'USD' as const });

/** The six in the designed order (#56, #61), each with a limit, written out. */
const limitsOf = (cents: [number, number, number, number, number, number]) => [
  { category: 'housing', limit: usd(cents[0]) },
  { category: 'food', limit: usd(cents[1]) },
  { category: 'transportation', limit: usd(cents[2]) },
  { category: 'entertainment', limit: usd(cents[3]) },
  { category: 'shopping', limit: usd(cents[4]) },
  { category: 'others', limit: usd(cents[5]) },
];

/** A first login's limits: $250.00 each (demo-data.md, Categories). */
const demoLimits = limitsOf([25_000, 25_000, 25_000, 25_000, 25_000, 25_000]);

type Row = { id: number; user_id: number; category: string; limit_cents: number };

// T3 and T4: AC1, AC5, AC9, AC10 and AC13, the service on the test database with seeded users (#32, #39, #85, #125).
// Another user signs up first, so IDs never equal positions.
describe('CategoryLimitsService', () => {
  let app: INestApplication;
  let db: DataSource;
  let service: CategoryLimitsService;
  let otherId: number;
  let userId: number;

  beforeAll(async () => {
    app = await createTestApp({ config: { nodeEnv: 'test' } });
    db = app.get(DataSource);
    service = app.get(CategoryLimitsService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    otherId = (await userIdOf(db, (await signUp(app)).user.email))!;
    userId = (await userIdOf(db, (await signUp(app)).user.email))!;
  });

  /** A user's rows, read with plain SQL in id order. */
  const rowsOf = (owner: number) =>
    db.query<Row[]>('SELECT id, user_id, category, limit_cents FROM category_limits WHERE user_id = ? ORDER BY id', [
      owner,
    ]);
  const allRows = () => db.query<Row[]>('SELECT id, user_id, category, limit_cents FROM category_limits ORDER BY id');

  describe('list', () => {
    it('answers a seeded user’s six limits in the designed order at $250.00 each', async () => {
      expect(await service.list(userId)).toEqual({ limits: demoLimits });
    });

    it('answers only the user’s own rows, never the other user’s changed ones', async () => {
      await db.query("UPDATE category_limits SET limit_cents = 77700 WHERE user_id = ? AND category = 'food'", [
        otherId,
      ]);
      await db.query("UPDATE category_limits SET limit_cents = 12300 WHERE user_id = ? AND category = 'others'", [
        userId,
      ]);

      expect(await service.list(userId)).toEqual({
        limits: limitsOf([25_000, 25_000, 25_000, 25_000, 25_000, 12_300]),
      });
      expect(await service.list(otherId)).toEqual({
        limits: limitsOf([25_000, 77_700, 25_000, 25_000, 25_000, 25_000]),
      });
    });

    it('answers the six in the designed order whatever order the rows were written in', async () => {
      await db.query("DELETE FROM category_limits WHERE user_id = ? AND category IN ('housing', 'food')", [userId]);
      await db.query(
        "INSERT INTO category_limits (user_id, category, limit_cents) VALUES (?, 'food', 200), (?, 'housing', 100)",
        [userId, userId],
      );

      expect(await service.list(userId)).toEqual({ limits: limitsOf([100, 200, 25_000, 25_000, 25_000, 25_000]) });
    });

    it('answers `limit: null` for a category without a row and writes no row (#125 a)', async () => {
      await db.query("DELETE FROM category_limits WHERE user_id = ? AND category = 'food'", [userId]);
      const before = await allRows();

      const answer = await service.list(userId);

      expect(answer.limits[1]).toEqual({ category: 'food', limit: null });
      expect(answer.limits.filter((_, index) => index !== 1)).toEqual(demoLimits.filter((_, index) => index !== 1));
      expect(await allRows()).toEqual(before);
    });

    it('answers six `null` limits for a user without rows', async () => {
      await db.query('DELETE FROM category_limits WHERE user_id = ?', [userId]);

      expect((await service.list(userId)).limits.map(({ limit }) => limit)).toEqual([
        null,
        null,
        null,
        null,
        null,
        null,
      ]);
    });
  });

  describe('save', () => {
    it('updates Food to 30050, then 40000: one Food row, the user’s other rows and the other user’s unchanged', async () => {
      const before = await rowsOf(userId);
      const otherBefore = await rowsOf(otherId);
      const food = before.find((row) => row.category === 'food')!;

      expect(await service.save(userId, { category: 'food', limit: usd(30_050) })).toEqual({
        category: 'food',
        limit: usd(30_050),
      });
      expect(await service.save(userId, { category: 'food', limit: usd(40_000) })).toEqual({
        category: 'food',
        limit: usd(40_000),
      });

      expect(await rowsOf(userId)).toEqual(
        before.map((row) => (row.id === food.id ? { ...row, limit_cents: 40_000 } : row)),
      );
      expect(await rowsOf(otherId)).toEqual(otherBefore);
    });

    it('creates the row of a category without one, one row for the user and category (#125 b)', async () => {
      await db.query("DELETE FROM category_limits WHERE user_id = ? AND category = 'food'", [userId]);
      const otherBefore = await rowsOf(otherId);

      expect(await service.save(userId, { category: 'food', limit: usd(25_000) })).toEqual({
        category: 'food',
        limit: usd(25_000),
      });

      const food = (await rowsOf(userId)).filter((row) => row.category === 'food');
      expect(food).toEqual([
        { id: expect.any(Number) as unknown, user_id: userId, category: 'food', limit_cents: 25_000 },
      ]);
      expect(await rowsOf(userId)).toHaveLength(6);
      expect(await rowsOf(otherId)).toEqual(otherBefore);
      expect(await service.list(userId)).toEqual({ limits: demoLimits });
    });

    it('saves the same value again and answers it', async () => {
      const before = await rowsOf(userId);

      expect(await service.save(userId, { category: 'shopping', limit: usd(25_000) })).toEqual({
        category: 'shopping',
        limit: usd(25_000),
      });
      expect(await rowsOf(userId)).toEqual(before);
    });
  });
});
