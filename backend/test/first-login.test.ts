import type { INestApplication } from '@nestjs/common';
import { DataSource, MoreThanOrEqual } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  BANK_DATA_PROVIDER,
  type BankDataProvider,
  type BankTransaction,
} from '../src/bank-data/bank-data-provider.js';
import { VisibleTransactions } from '../src/bank-data/visible-transactions.js';
import { Bill } from '../src/bills/bill.entity.js';
import { CLOCK, type Clock } from '../src/common/clock/clock.js';
import { SavingsGoal } from '../src/goals/savings-goal.entity.js';
import { signUp } from './helpers/auth.js';
import { userIdOf } from './helpers/finance.js';
import { createTestApp } from './helpers/test-app.js';

const UTC = 'UTC';

const signed = (t: BankTransaction): number => (t.direction === 'income' ? t.amountCents : -t.amountCents);
const day = (t: BankTransaction): string => t.occurredAt.toISOString().slice(0, 10);
const complete = (rows: BankTransaction[]) => rows.filter((t) => t.status === 'complete');
const sum = (rows: BankTransaction[], amount: (t: BankTransaction) => number = (t) => t.amountCents) =>
  rows.reduce((total, t) => total + amount(t), 0);

/** Complete expenses per category. */
function categoryTotals(rows: BankTransaction[]): Map<string, number> {
  const byCategory = new Map<string, number>();
  for (const t of complete(rows).filter((row) => row.direction === 'expense')) {
    byCategory.set(t.category!, (byCategory.get(t.category!) ?? 0) + t.amountCents);
  }
  return byCategory;
}

// T15: AC11, a new user's first login on 22 Oct 2026 in UTC gives the values of demo-data.md (#78).
// The sums are the test's own; the backend's calculations are later tasks.
describe('first login on 22 Oct 2026', () => {
  let app: INestApplication;
  let provider: BankDataProvider;
  let visible: VisibleTransactions;
  let userId: number;
  /** Everything dated up to today, newest first. */
  let upToToday: BankTransaction[];

  beforeAll(async () => {
    app = await createTestApp();
    provider = app.get<BankDataProvider>(BANK_DATA_PROVIDER);
    visible = app.get(VisibleTransactions);
    userId = (await userIdOf(app.get(DataSource), (await signUp(app)).user.email))!;
    upToToday = (await visible.list(userId, UTC)).transactions;
  });

  afterAll(async () => {
    await app.close();
  });

  const range = async (from: string, before: string) =>
    (
      await visible.list(userId, UTC, {
        occurredFrom: new Date(`${from}T00:00:00Z`),
        occurredBefore: new Date(`${before}T00:00:00Z`),
      })
    ).transactions;

  it('runs on the fixed clock', () => {
    expect(app.get<Clock>(CLOCK).now().toISOString()).toBe('2026-10-22T10:00:00.000Z');
    expect(day(upToToday[0]!)).toBe('2026-10-22');
  });

  it('gives the balances and the Total Balance from Complete transactions dated up to today', async () => {
    const accounts = await provider.listAccounts(userId);
    const balances = accounts.map(
      (account) =>
        account.openingBalanceCents + sum(complete(upToToday.filter((t) => t.accountId === account.id)), signed),
    );

    expect(balances).toEqual([2_101_918, 3_336_248, 2_735_680, 2_950_300, 1_901_321]);
    expect(balances.reduce((total, cents) => total + cents, 0)).toBe(13_025_467);
  });

  it('has more than 10 transactions on every account, 57 or 58 on Savings, Investment and Loan, and income', async () => {
    const accounts = await provider.listAccounts(userId);
    const counts = accounts.map((account) => upToToday.filter((t) => t.accountId === account.id).length);

    expect(counts.slice(2)).toEqual([57, 58, 58]);
    expect(counts.every((count) => count > 10)).toBe(true);
    expect(upToToday.some((t) => t.direction === 'income')).toBe(true);
  });

  it('has the Oct 2026 savings goal', async () => {
    const goal = await app.get(DataSource).getRepository(SavingsGoal).findOneByOrFail({ userId, month: '2026-10' });

    expect([goal.targetCents, goal.presentCents]).toEqual([2_000_000, 1_625_000]);
  });

  it('has 4 upcoming bills, Figma in May 2027 and Adobe in June 2027 first', async () => {
    const bills = await app
      .get(DataSource)
      .getRepository(Bill)
      .find({ where: { userId, dueDate: MoreThanOrEqual('2026-10-22') }, order: { dueDate: 'ASC' } });

    expect(bills.map((bill) => [bill.title, bill.dueDate, bill.amountCents])).toEqual([
      ['Figma - Yearly Plan', '2027-05-15', 15_000],
      ['Adobe Inc - Yearly Plan', '2027-06-16', 55_900],
      ['Figma - Yearly Plan', '2028-05-15', 15_000],
      ['Adobe Inc - Yearly Plan', '2028-06-16', 55_900],
    ]);
  });

  it('lists the latest 5 transactions up to today', async () => {
    const { transactions } = await visible.list(userId, UTC, { limit: 5 });

    expect(transactions.map((t) => [day(t), t.item, t.amountCents])).toEqual([
      ['2026-10-22', 'Jeans', 26_600],
      ['2026-10-21', 'Movie ticket', 1_764],
      ['2026-10-20', 'Pizza', 2_464],
      ['2026-10-19', 'Taxi fare', 1_064],
      ['2026-10-18', 'Restaurant bill', 14_784],
    ]);
  });

  it('has a Complete expense on Mon 19 to Thu 22 Oct, nothing after, and last Thursday highest at $322.00', async () => {
    const twoWeeks = complete(await range('2026-10-12', '2026-10-26')).filter((t) => t.direction === 'expense');
    const perDay = new Map<string, number>();
    for (const t of twoWeeks) perDay.set(day(t), (perDay.get(day(t)) ?? 0) + t.amountCents);

    expect([...perDay.keys()].toSorted()).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
    ]);
    expect(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'].map((date) => perDay.get(date)! > 0)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(Math.max(...perDay.values())).toBe(32_200);
    expect(perDay.get('2026-10-15')).toBe(32_200);
  });

  it('gives the category totals of 1 to 22 Oct and their change vs all of September', async () => {
    const october = categoryTotals(await range('2026-10-01', '2026-11-01'));
    const september = categoryTotals(await range('2026-09-01', '2026-10-01'));
    const categories = ['housing', 'food', 'transportation', 'entertainment', 'shopping', 'others'];

    expect(categories.map((category) => october.get(category))).toEqual([
      25_200, 51_004, 5_320, 28_224, 65_800, 13_832,
    ]);
    expect(
      categories.map((category) =>
        Math.round(((october.get(category)! - september.get(category)!) / september.get(category)!) * 100),
      ),
    ).toEqual([-17, 7, -32, 16, 14, -31]);
  });

  it('gives daily savings from 1 to 22 Oct between -$283.36 and +$552.16', async () => {
    const perDay = new Map<string, number>();
    for (const t of complete(await range('2026-10-01', '2026-11-01'))) {
      perDay.set(day(t), (perDay.get(day(t)) ?? 0) + signed(t));
    }

    expect(perDay.size).toBe(22);
    expect([Math.min(...perDay.values()), Math.max(...perDay.values())]).toEqual([-28_336, 55_216]);
  });
});
