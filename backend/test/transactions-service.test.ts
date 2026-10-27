import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { TransactionsService } from '../src/transactions/transactions.service.js';
import { signUp } from './helpers/auth.js';
import { userIdOf } from './helpers/finance.js';
import { createTestApp } from './helpers/test-app.js';

const FIXED_NOW = '2026-10-22T10:00:00.000Z';
const BELGRADE = 'Europe/Belgrade';
const NEW_YORK = 'America/New_York';

const usd = (cents: number) => ({ cents, currency: 'USD' as const });

/** A demo transaction of October 2026 as the contract sends it: every one is stored at 12:00 UTC (demo-data.md). */
const expense = (item: string, shopName: string, category: string, day: number, cents: number) => ({
  item,
  shopName,
  category,
  direction: 'expense',
  occurredAt: `2026-10-${String(day).padStart(2, '0')}T12:00:00.000Z`,
  amount: usd(cents),
});
const income = (item: string, shopName: string, day: number, cents: number) => ({
  item,
  shopName,
  category: null,
  direction: 'income',
  occurredAt: `2026-10-${String(day).padStart(2, '0')}T12:00:00.000Z`,
  amount: usd(cents),
});

const gift = expense('Gift', 'Gift Corner', 'others', 24, 2_128);
const biriyani = expense('Biriyani', 'Hajir Biriyani', 'food', 23, 1_478);
const jeans = expense('Jeans', 'Denim House', 'shopping', 22, 26_600);
const movieTicket = expense('Movie ticket', 'Inox', 'entertainment', 21, 1_764);
const pizza = expense('Pizza', 'Pizza Hit', 'food', 20, 2_464);
const taxiFare = expense('Taxi fare', 'Uber', 'transportation', 19, 1_064);
const restaurantBill = expense('Restaurant bill', 'Spice Garden', 'food', 18, 14_784);
const freelance = (day: number) => income('Freelance payment', 'Bright Studio', day, 17_920);
const dividend = income('Dividend', 'AB Bank Ltd', 15, 8_400);
const designProject = income('Design project', 'Acme Ltd.', 1, 78_400);

/** A first login's lists on 22 Oct 2026 (demo-data.md, "What a first login shows"; AC1, AC2). */
const firstLogin = {
  all: [jeans, movieTicket, pizza, taxiFare, restaurantBill],
  revenue: [freelance(17), dividend, freelance(10), freelance(3), designProject],
  expenses: [jeans, movieTicket, pizza, taxiFare, restaurantBill],
};

/** A stored `occurred_at` value for a UTC instant. */
const stored = (instant: string) => instant.replace('T', ' ').replace('Z', '.000');

// T2, T3: AC1 to AC4, the service on the test database with a seeded user (#27, #40, #53, #54, #57, #80).
describe('TransactionsService', () => {
  let app: INestApplication;
  let clock: FixedClock;
  let db: DataSource;
  let service: TransactionsService;
  let userId: number;

  beforeAll(async () => {
    app = await createTestApp({ config: { nodeEnv: 'test', testNow: FIXED_NOW } });
    clock = app.get(FixedClock);
    db = app.get(DataSource);
    service = app.get(TransactionsService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    clock.set(new Date(FIXED_NOW));
    userId = (await userIdOf(db, (await signUp(app)).user.email))!;
  });

  /** The user's transactions with plain SQL: the rows with this item stored at this instant. */
  const moveTo = (item: string, from: string, to: string) =>
    db.query(
      `UPDATE transactions SET occurred_at = ?
       WHERE item = ? AND occurred_at = ? AND account_id IN (SELECT id FROM accounts WHERE user_id = ?)`,
      [stored(to), item, stored(from), userId],
    );
  const items = async (list: 'all' | 'revenue' | 'expenses', zone = BELGRADE) =>
    (await service.recent(userId, zone))[list].map((row) => `${row.item} ${row.occurredAt.slice(5, 10)}`);

  it('answers a first login’s three lists, newest first, in integer cents with USD and only the contract’s keys', async () => {
    const answer = await service.recent(userId, BELGRADE);

    expect(answer).toEqual(firstLogin);
    expect(Object.keys(answer)).toEqual(['all', 'revenue', 'expenses']);
    for (const row of [...answer.all, ...answer.revenue, ...answer.expenses]) {
      expect(Object.keys(row).toSorted()).toEqual([
        'amount',
        'category',
        'direction',
        'item',
        'occurredAt',
        'shopName',
      ]);
    }
  });

  it('at 2026-10-23T22:30:00Z in Belgrade (24 Oct) lists 24 Oct, the same instant with the later stored first', async () => {
    clock.set(new Date('2026-10-23T22:30:00Z'));

    expect(await service.recent(userId, BELGRADE)).toEqual({
      all: [gift, freelance(24), biriyani, jeans, movieTicket],
      revenue: [freelance(24), freelance(17), dividend, freelance(10), freelance(3)],
      expenses: [gift, biriyani, jeans, movieTicket, pizza],
    });
  });

  it('at 2026-10-23T22:30:00Z in New York (23 Oct) lists up to 23 Oct', async () => {
    clock.set(new Date('2026-10-23T22:30:00Z'));

    expect(await service.recent(userId, NEW_YORK)).toEqual({
      all: [biriyani, jeans, movieTicket, pizza, taxiFare],
      revenue: firstLogin.revenue,
      expenses: [biriyani, jeans, movieTicket, pizza, taxiFare],
    });
  });

  // T3: the rows of 24 Oct (12:00 UTC) around midnight in Belgrade (UTC+2 until 25 Oct). The last second of 23 Oct
  // checks the exact top rows, so a read that is not capped at today fails it too (the gate's mutation, Marko).
  it('at 2026-10-23T21:59:59Z (23:59:59 on 23 Oct) lists up to 23 Oct: All from Biriyani, Revenue from 17 Oct', async () => {
    clock.set(new Date('2026-10-23T21:59:59Z'));

    const answer = await service.recent(userId, BELGRADE);

    expect(answer.all[0]).toEqual(biriyani);
    expect(answer.revenue[0]).toEqual(freelance(17));
    // Nothing from 00:00 on 24 Oct in Belgrade on: no row of 24 Oct in any list.
    const fromTomorrow = [...answer.all, ...answer.revenue, ...answer.expenses].filter(
      (row) => row.occurredAt >= '2026-10-23T22:00:00.000Z',
    );
    expect(fromTomorrow).toEqual([]);
  });

  it('at 2026-10-23T22:00:00Z (00:00 on 24 Oct) lists the rows of 24 Oct', async () => {
    clock.set(new Date('2026-10-23T22:00:00Z'));

    expect((await items('all')).slice(0, 2).includes('Gift 10-24')).toBe(true);
    expect((await items('revenue'))[0]).toBe('Freelance payment 10-24');
  });

  it('lists a Failed and a Pending transaction like a Complete one', async () => {
    // The demo's Failed Pizza (16 Oct) and Pending Polo shirt (25 Oct), moved to today.
    await moveTo('Pizza', '2026-10-16T12:00:00Z', '2026-10-22T13:00:00Z');
    await moveTo('Polo shirt', '2026-10-25T12:00:00Z', '2026-10-22T14:00:00Z');
    const statuses = await db.query<{ item: string; status: string }[]>(
      `SELECT item, status FROM transactions
       WHERE occurred_at > ? AND occurred_at < ? AND account_id IN (SELECT id FROM accounts WHERE user_id = ?)
       ORDER BY occurred_at DESC`,
      [stored('2026-10-22T12:30:00Z'), stored('2026-10-23T00:00:00Z'), userId],
    );
    expect(statuses).toEqual([
      { item: 'Polo shirt', status: 'pending' },
      { item: 'Pizza', status: 'failed' },
    ]);

    expect(await items('all')).toEqual([
      'Polo shirt 10-22',
      'Pizza 10-22',
      'Jeans 10-22',
      'Movie ticket 10-21',
      'Pizza 10-20',
    ]);
    expect(await items('expenses')).toEqual(await items('all'));
  });

  it('lists only what there is when a user has fewer than 5', async () => {
    await db.query('DELETE FROM transactions WHERE account_id IN (SELECT id FROM accounts WHERE user_id = ?)', [
      userId,
    ]);
    const [{ id: accountId }] = await db.query<[{ id: number }]>(
      'SELECT id FROM accounts WHERE user_id = ? ORDER BY id LIMIT 1',
      [userId],
    );
    for (const [instant, direction, category, item] of [
      ['2026-10-20T08:00:00Z', 'expense', 'food', 'Lunch'],
      ['2026-10-21T08:00:00Z', 'income', null, 'Salary'],
      ['2026-10-22T08:00:00Z', 'expense', 'shopping', 'Shoes'],
    ] as const) {
      await db.query(
        `INSERT INTO transactions (account_id, occurred_at, direction, status, category, item, shop_name, receipt, amount_cents)
         VALUES (?, ?, ?, 'complete', ?, ?, 'Shop', 'Ab3dE5gH9jK', 1000)`,
        [accountId, stored(instant), direction, category, item],
      );
    }

    expect(await items('all')).toEqual(['Shoes 10-22', 'Salary 10-21', 'Lunch 10-20']);
    expect(await items('revenue')).toEqual(['Salary 10-21']);
    expect(await items('expenses')).toEqual(['Shoes 10-22', 'Lunch 10-20']);
  });

  it('answers three empty lists before the dataset begins', async () => {
    clock.set(new Date('2021-12-31T10:00:00Z'));

    expect(await service.recent(userId, BELGRADE)).toEqual({ all: [], revenue: [], expenses: [] });
  });

  it('answers only the user’s own transactions', async () => {
    const other = (await userIdOf(db, (await signUp(app)).user.email))!;
    await db.query('DELETE FROM transactions WHERE account_id IN (SELECT id FROM accounts WHERE user_id = ?)', [
      userId,
    ]);

    expect(await service.recent(userId, BELGRADE)).toEqual({ all: [], revenue: [], expenses: [] });
    expect(await service.recent(other, BELGRADE)).toEqual(firstLogin);
  });
});
