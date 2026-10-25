import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { VisibleTransactions } from '../src/bank-data/visible-transactions.js';
import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { createTestApp } from './helpers/test-app.js';

/**
 * Rows around midnight on 22 Oct 2026. Belgrade is UTC+2 (CEST) and New York UTC-4 (EDT) that day.
 * Item names say where each instant falls in each zone.
 */
const rows = [
  ['2026-10-21T22:30:00Z', 'belgrade 22 Oct 00:30, new york 21 Oct 18:30'],
  ['2026-10-22T21:30:00Z', 'belgrade 22 Oct 23:30, new york 22 Oct 17:30'],
  ['2026-10-22T22:30:00Z', 'belgrade 23 Oct 00:30, new york 22 Oct 18:30'],
  ['2026-10-23T03:30:00Z', 'belgrade 23 Oct 05:30, new york 22 Oct 23:30'],
  ['2026-10-23T04:30:00Z', 'belgrade 23 Oct 06:30, new york 23 Oct 00:30'],
  ['2026-10-23T22:30:00Z', 'belgrade 24 Oct 00:30, new york 23 Oct 18:30'],
] as const;

const BELGRADE = 'Europe/Belgrade';
const NEW_YORK = 'America/New_York';

// T19: AC16, entries dated after today in the user's zone are never listed (#53, #54, #80).
describe('VisibleTransactions', () => {
  let app: INestApplication;
  let clock: FixedClock;
  let visible: VisibleTransactions;
  let userId: number;
  let accountId: number;

  beforeAll(async () => {
    app = await createTestApp();
    clock = app.get(FixedClock);
    visible = app.get(VisibleTransactions);
    const db = app.get(DataSource);
    await db.query("INSERT INTO users (email, full_name, username) VALUES ('zone@example.com', 'Zone', 'zone')");
    [{ id: userId }] = await db.query<[{ id: number }]>('SELECT id FROM users');
    await db.query(
      `INSERT INTO accounts (user_id, account_type, bank_name, branch_name, card_network, account_number, opening_balance_cents)
       VALUES (?, 'checking', 'AB Bank Ltd', 'Park Street Branch', 'visa', '6934566990127310', 2500000)`,
      [userId],
    );
    [{ id: accountId }] = await db.query<[{ id: number }]>('SELECT id FROM accounts');
    for (const [instant, item] of rows) {
      await db.query(
        `INSERT INTO transactions (account_id, occurred_at, direction, status, category, item, shop_name, receipt, amount_cents)
         VALUES (?, ?, 'expense', 'complete', 'food', ?, 'Pizza Hit', 'Ab3dE5gH9jK', 1000)`,
        [accountId, instant.replace('T', ' ').replace('Z', '.000'), item],
      );
    }
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    clock.set(new Date('2026-10-22T10:00:00Z'));
  });

  const items = async (timeZone: string, filter = {}) =>
    (await visible.list(userId, timeZone, filter)).transactions.map((t) => t.item);

  it('lists today’s late evening in Belgrade, and nothing from tomorrow on', async () => {
    expect(await items(BELGRADE)).toEqual([
      'belgrade 22 Oct 23:30, new york 22 Oct 17:30',
      'belgrade 22 Oct 00:30, new york 21 Oct 18:30',
    ]);
  });

  it('lists today’s late evening in New York, and nothing from tomorrow on', async () => {
    expect(await items(NEW_YORK)).toEqual([
      'belgrade 23 Oct 05:30, new york 22 Oct 23:30',
      'belgrade 23 Oct 00:30, new york 22 Oct 18:30',
      'belgrade 22 Oct 23:30, new york 22 Oct 17:30',
      'belgrade 22 Oct 00:30, new york 21 Oct 18:30',
    ]);
  });

  it('follows the clock past midnight in Belgrade while New York is still on the day before', async () => {
    clock.set(new Date('2026-10-22T22:15:00Z')); // 00:15 on 23 Oct in Belgrade, 18:15 on 22 Oct in New York

    expect(await items(BELGRADE)).toEqual([
      'belgrade 23 Oct 06:30, new york 23 Oct 00:30',
      'belgrade 23 Oct 05:30, new york 22 Oct 23:30',
      'belgrade 23 Oct 00:30, new york 22 Oct 18:30',
      'belgrade 22 Oct 23:30, new york 22 Oct 17:30',
      'belgrade 22 Oct 00:30, new york 21 Oct 18:30',
    ]);
    expect(await items(NEW_YORK)).toHaveLength(4);
  });

  it('keeps a caller’s earlier occurredBefore and caps a later one at tomorrow', async () => {
    expect(await items(BELGRADE, { occurredBefore: new Date('2026-10-22T00:00:00Z') })).toEqual([
      'belgrade 22 Oct 00:30, new york 21 Oct 18:30',
    ]);
    expect(await items(BELGRADE, { occurredBefore: new Date('2027-01-01T00:00:00Z') })).toHaveLength(2);
  });

  it('passes an invalid occurredBefore on to fail, rather than replacing it with tomorrow', async () => {
    await expect(visible.list(userId, BELGRADE, { occurredBefore: new Date('not a date') })).rejects.toThrow(
      RangeError,
    );
  });

  it('passes the other filters through, cursor pages included', async () => {
    const first = await visible.list(userId, BELGRADE, { limit: 1, accountId });
    const second = await visible.list(userId, BELGRADE, { limit: 1, accountId, cursor: first.nextCursor! });

    expect(first.transactions.map((t) => t.item)).toEqual(['belgrade 22 Oct 23:30, new york 22 Oct 17:30']);
    expect(second.transactions.map((t) => t.item)).toEqual(['belgrade 22 Oct 00:30, new york 21 Oct 18:30']);
    expect(second.nextCursor).toBeNull();
    expect(await items(BELGRADE, { direction: 'income' })).toEqual([]);
  });

  it('lists only the signed-in user’s rows', async () => {
    expect(await items(BELGRADE, { accountId: accountId + 1 })).toEqual([]);
    expect((await visible.list(userId + 1, NEW_YORK)).transactions).toEqual([]);
  });
});
