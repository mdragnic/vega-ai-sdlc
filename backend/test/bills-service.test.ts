import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { Bill } from '../src/bills/bill.entity.js';
import { BillsService } from '../src/bills/bills.service.js';
import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { signUp } from './helpers/auth.js';
import { userIdOf } from './helpers/finance.js';
import { createTestApp } from './helpers/test-app.js';

const FIXED_NOW = '2026-10-22T10:00:00.000Z';
const BELGRADE = 'Europe/Belgrade';
const NEW_YORK = 'America/New_York';

const usd = (cents: number) => ({ cents, currency: 'USD' as const });

/** The demo bills due in a year, as the contract sends them (demo-data.md, Bills). */
const figma = (year: number) => ({
  title: 'Figma - Yearly Plan',
  logo: 'figma',
  dueDate: `${year}-05-15`,
  lastChargeDate: `${year - 1}-05-14`,
  amount: usd(15_000),
});
const adobe = (year: number) => ({
  title: 'Adobe Inc - Yearly Plan',
  logo: 'adobe',
  dueDate: `${year}-06-16`,
  lastChargeDate: `${year - 1}-06-17`,
  amount: usd(55_900),
});

// T2, T3: AC2, AC3, AC4 and AC9, the service on the test database with a seeded user (#28, #41, #53, #54, #80).
describe('BillsService', () => {
  let app: INestApplication;
  let clock: FixedClock;
  let db: DataSource;
  let service: BillsService;
  let userId: number;

  beforeAll(async () => {
    app = await createTestApp({ config: { nodeEnv: 'test', testNow: FIXED_NOW } });
    clock = app.get(FixedClock);
    db = app.get(DataSource);
    service = app.get(BillsService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    clock.set(new Date(FIXED_NOW));
    userId = (await userIdOf(db, (await signUp(app)).user.email))!;
  });

  /** The due dates the service answers, in its order. */
  const dueDates = async (zone = BELGRADE) => (await service.upcoming(userId, zone)).bills.map((bill) => bill.dueDate);
  /** How many of the user's bills due on 15 May 2027 a query with this `today` parameter finds. */
  const dueOn15May = (today: string | Date) =>
    db
      .getRepository(Bill)
      .createQueryBuilder('bill')
      .where('bill.userId = :userId AND bill.dueDate >= :today', { userId, today })
      .andWhere('bill.dueDate = :due', { due: '2027-05-15' })
      .getCount();
  const moveDueDate = (from: string, to: string) =>
    db.query('UPDATE bills SET due_date = ? WHERE user_id = ? AND due_date = ?', [to, userId, from]);
  /** Replaces the user's bills with these, inserted in this order: titles and due dates, $1.00 each. */
  async function replaceBills(bills: [title: string, dueDate: string][]) {
    await db.query('DELETE FROM bills WHERE user_id = ?', [userId]);
    for (const [title, dueDate] of bills) {
      await db.query(
        `INSERT INTO bills (user_id, title, description, logo, due_date, last_charge_date, amount_cents)
         VALUES (?, ?, '', 'figma', ?, '2026-01-01', 100)`,
        [userId, title, dueDate],
      );
    }
  }

  it('answers the 4 upcoming demo bills, soonest first, in integer cents with USD and no other keys', async () => {
    const answer = await service.upcoming(userId, BELGRADE);

    expect(answer).toEqual({ bills: [figma(2027), adobe(2027), figma(2028), adobe(2028)] });
    for (const bill of answer.bills) {
      expect(Object.keys(bill).toSorted()).toEqual(['amount', 'dueDate', 'lastChargeDate', 'logo', 'title']);
    }
  });

  it('includes a bill due today in the zone and drops one due yesterday', async () => {
    await moveDueDate('2026-06-16', '2026-10-22');
    await moveDueDate('2026-05-15', '2026-10-21');

    expect(await dueDates()).toEqual(['2026-10-22', '2027-05-15', '2027-06-16', '2028-05-15', '2028-06-16']);
  });

  it('orders by due date, then by the order the bills were stored', async () => {
    await replaceBills([
      ['March', '2027-03-01'],
      ['December, stored first', '2026-12-01'],
      ['January', '2027-01-01'],
      ['December, stored second', '2026-12-01'],
    ]);

    const titles = (await service.upcoming(userId, BELGRADE)).bills.map((bill) => bill.title);

    expect(titles).toEqual(['December, stored first', 'December, stored second', 'January', 'March']);
  });

  it('answers no bills after the last due date (demo-data.md, review point 3)', async () => {
    clock.set(new Date('2028-06-17T10:00:00Z'));

    expect(await service.upcoming(userId, BELGRADE)).toEqual({ bills: [] });
  });

  it.each([
    // 00:30 on 16 May in Belgrade: the Figma bill due 15 May 2027 has passed.
    [BELGRADE, ['2027-06-16', '2028-05-15', '2028-06-16']],
    // 18:30 on 15 May in New York: it is due today.
    [NEW_YORK, ['2027-05-15', '2027-06-16', '2028-05-15', '2028-06-16']],
  ])('at 2027-05-15T22:30:00Z in %s answers today from the Clock in that zone', async (zone, expected) => {
    clock.set(new Date('2027-05-15T22:30:00Z'));

    expect(await dueDates(zone)).toEqual(expected);
  });

  // T3: the Figma bill due 15 May 2027 around midnight in Belgrade (UTC+2 in May).
  it.each([
    ['2027-05-14T22:00:00Z', '00:00 on the due day', true],
    ['2027-05-15T21:59:59Z', 'the due day’s last second', true],
    ['2027-05-15T22:00:00Z', '00:00 the next day', false],
  ])('at %s (%s) includes the bill: %s', async (now, _when, included) => {
    clock.set(new Date(now));

    expect((await dueDates()).includes('2027-05-15')).toBe(included);
  });

  it('answers only the user’s own bills', async () => {
    const other = (await userIdOf(db, (await signUp(app)).user.email))!;
    await db.query('UPDATE bills SET title = ? WHERE user_id = ?', ['Another user’s bill', other]);
    await db.query('DELETE FROM bills WHERE user_id = ?', [userId]);

    expect(await service.upcoming(userId, BELGRADE)).toEqual({ bills: [] });
  });

  // AC9: why today is bound as a plain-date string (task 008 review).
  it('keeps the bill due today, which a Date parameter for today would drop', async () => {
    clock.set(new Date('2027-05-15T10:00:00Z'));

    // A Date binds as `2027-05-15 00:00:00.000`, which sorts after the stored `2027-05-15`.
    expect(await dueOn15May(new Date('2027-05-15T00:00:00Z'))).toBe(0);
    expect(await dueOn15May('2027-05-15')).toBe(1);
    expect((await dueDates())[0]).toBe('2027-05-15');
  });
});
