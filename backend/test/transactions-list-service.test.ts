import type { INestApplication } from '@nestjs/common';
import type { TransactionRow, TransactionsTab } from '@finebank/shared';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { VisibleTransactions } from '../src/bank-data/visible-transactions.js';
import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { TransactionsService } from '../src/transactions/transactions.service.js';
import { signUp } from './helpers/auth.js';
import { userIdOf } from './helpers/finance.js';
import { createTestApp } from './helpers/test-app.js';

const FIXED_NOW = '2026-10-22T10:00:00.000Z';
const BELGRADE = 'Europe/Belgrade';
const NEW_YORK = 'America/New_York';

/** A row as text: the item, the shop, the UTC day, the Payment Method and the amount with the direction's sign. */
const summary = (row: TransactionRow) =>
  [
    row.item,
    row.shopName,
    row.occurredAt.slice(0, 10),
    row.paymentMethod,
    `${row.direction === 'income' ? '+' : '-'}${row.amount.cents}`,
  ].join(' | ');

/** All's first page at the fixed clock, newest first, the same instant with the later stored first (task References). */
const allPage1 = [
  'Jeans | Denim House | 2026-10-22 | checking | -26600',
  'Movie ticket | Inox | 2026-10-21 | credit-card | -1764',
  'Pizza | Pizza Hit | 2026-10-20 | credit-card | -2464',
  'Taxi fare | Uber | 2026-10-19 | credit-card | -1064',
  'Restaurant bill | Spice Garden | 2026-10-18 | checking | -14784',
  'GTR 5 | Gadget & Gear | 2026-10-17 | credit-card | -18816',
  'Freelance payment | Bright Studio | 2026-10-17 | checking | +17920',
  // The demo's Failed Pizza, listed like a Complete row (#57).
  'Pizza | Pizza Hit | 2026-10-16 | credit-card | -2464',
  'Biriyani | Hajir Biriyani | 2026-10-16 | credit-card | -1478',
  'Shirt | XL fashions | 2026-10-15 | checking | -32200',
];

/** All's second page: Dividend, at Shirt's instant (2026-10-15T12:00:00Z), first. */
const allPage2 = [
  'Dividend | AB Bank Ltd | 2026-10-15 | investment | +8400',
  'Parking | City Parking | 2026-10-14 | checking | -2016',
  'Taxi fare | Uber | 2026-10-13 | credit-card | -1064',
  'iTunes | iTunes Store | 2026-10-12 | checking | -5880',
  'Donation | City Charity Trust | 2026-10-11 | checking | -3192',
  'Loan installment | City Bank Ltd. | 2026-10-10 | loan | -10640',
  'Freelance payment | Bright Studio | 2026-10-10 | checking | +17920',
  'Keyboard | Gadget & Gear | 2026-10-09 | credit-card | -4200',
  'Pizza | Pizza Hit | 2026-10-08 | credit-card | -2464',
  'Metro Card bill | Metro Rail | 2026-10-07 | checking | -2128',
];

const revenuePage1 = [
  'Freelance payment | Bright Studio | 2026-10-17 | checking | +17920',
  'Dividend | AB Bank Ltd | 2026-10-15 | investment | +8400',
  'Freelance payment | Bright Studio | 2026-10-10 | checking | +17920',
  'Freelance payment | Bright Studio | 2026-10-03 | checking | +17920',
  'Design project | Acme Ltd. | 2026-10-01 | checking | +78400',
  'Interest | Brac Bank Ltd. | 2026-09-28 | savings | +4480',
  'Card repayment | AB Bank Ltd | 2026-09-27 | credit-card | +50400',
  'Freelance payment | Bright Studio | 2026-09-24 | checking | +17920',
  'Freelance payment | Bright Studio | 2026-09-17 | checking | +17920',
  'Dividend | AB Bank Ltd | 2026-09-15 | investment | +8400',
];

/** All's first page without the Freelance payment, then Parking. */
const expensesPage1 = [...allPage1.filter((row) => !row.startsWith('Freelance')), allPage2[1]!];

/** Jeans as the contract sends it: only the contract's keys, UTC, integer cents with USD. */
const jeans = {
  item: 'Jeans',
  shopName: 'Denim House',
  category: 'shopping',
  direction: 'expense',
  occurredAt: '2026-10-22T12:00:00.000Z',
  paymentMethod: 'checking',
  amount: { cents: 26_600, currency: 'USD' },
};

/** A stored `occurred_at` value for a UTC instant. */
const stored = (instant: string) => instant.replace('T', ' ').replace('Z', '.000');

// T2 to T6: AC2 to AC4, AC6 to AC8 and AC10, the service on the test database with seeded users (#27, #53, #54, #57,
// #74, #80).
describe('TransactionsService.list', () => {
  let app: INestApplication;
  let clock: FixedClock;
  let db: DataSource;
  let service: TransactionsService;
  let visible: VisibleTransactions;
  let userId: number;

  beforeAll(async () => {
    app = await createTestApp({ config: { nodeEnv: 'test', testNow: FIXED_NOW } });
    clock = app.get(FixedClock);
    db = app.get(DataSource);
    service = app.get(TransactionsService);
    visible = app.get(VisibleTransactions);
    // Another user first, so the user's IDs never equal positions in their list.
    await signUp(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    clock.set(new Date(FIXED_NOW));
    userId = (await userIdOf(db, (await signUp(app)).user.email))!;
  });

  const page = (tab: TransactionsTab, cursor?: string, zone = BELGRADE) =>
    service.list(userId, zone, cursor === undefined ? { tab } : { tab, cursor });
  const summaries = async (tab: TransactionsTab, cursor?: string, zone = BELGRADE) =>
    (await page(tab, cursor, zone)).transactions.map(summary);

  /** The ID of the user's first account of a type, with plain SQL. */
  const accountOf = async (type: string) => {
    const [{ id }] = await db.query<[{ id: number }]>(
      'SELECT id FROM accounts WHERE user_id = ? AND account_type = ? ORDER BY id LIMIT 1',
      [userId, type],
    );
    return id;
  };
  /** Stores a transaction for the user on their Checking account, with plain SQL. */
  const insert = async (instant: string, item: string) =>
    db.query(
      `INSERT INTO transactions (account_id, occurred_at, direction, status, category, item, shop_name, receipt, amount_cents)
       VALUES (?, ?, 'expense', 'complete', 'food', ?, 'Shop', 'Ab3dE5gH9jK', 1000)`,
      [await accountOf('checking'), stored(instant), item],
    );
  const deleteItem = (item: string, instant: string) =>
    db.query(
      `DELETE FROM transactions WHERE item = ? AND occurred_at = ?
       AND account_id IN (SELECT id FROM accounts WHERE user_id = ?)`,
      [item, stored(instant), userId],
    );

  // T2: AC2 to AC4 and AC6.
  describe('pages', () => {
    it('answers All’s first 10 at the fixed clock with only the contract’s keys and a cursor', async () => {
      const first = await page('all');

      expect(first.transactions.map(summary)).toEqual(allPage1);
      expect(first.transactions[0]).toEqual(jeans);
      for (const row of first.transactions) {
        expect(Object.keys(row).toSorted()).toEqual([
          'amount',
          'category',
          'direction',
          'item',
          'occurredAt',
          'paymentMethod',
          'shopName',
        ]);
      }
      expect(first.nextCursor).toEqual(expect.any(String));
    });

    it('answers Revenue’s first 10, income only, and Expenses’ first 10, expenses only', async () => {
      expect(await summaries('revenue')).toEqual(revenuePage1);
      expect(await summaries('expenses')).toEqual(expensesPage1);
    });

    it('continues All from page 1’s cursor: Dividend after Shirt at the same instant, each once', async () => {
      const first = await page('all');

      const second = await page('all', first.nextCursor!);

      expect(second.transactions.map(summary)).toEqual(allPage2);
      expect(second.transactions[0]!.occurredAt).toBe(first.transactions.at(-1)!.occurredAt);
      expect(second.nextCursor).toEqual(expect.any(String));
      expect(second.nextCursor).not.toBe(first.nextCursor);
    });

    // At 2022-03-01 (Belgrade) the seed holds 81 rows up to today: 17 income, 64 expenses (demo-dataset.json).
    it.each<[TransactionsTab, 'income' | 'expense' | undefined, number]>([
      ['all', undefined, 81],
      ['revenue', 'income', 17],
      ['expenses', 'expense', 64],
    ])(
      'pages %s to its end at 2022-03-01: the pages together are the whole list, each row once, in order',
      async (tab, direction, count) => {
        clock.set(new Date('2022-03-01T10:00:00Z'));
        const pages: TransactionRow[][] = [];
        let next = await page(tab);
        pages.push(next.transactions);
        while (next.nextCursor !== null && pages.length < 20) {
          next = await page(tab, next.nextCursor);
          pages.push(next.transactions);
        }

        const { transactions: whole } = await visible.list(userId, BELGRADE, direction ? { direction } : {});
        expect(whole).toHaveLength(count);
        expect(pages.map((rows) => rows.length)).toEqual([
          ...Array.from({ length: Math.floor(count / 10) }, () => 10),
          count % 10,
        ]);
        expect(pages.flat().map((row) => `${row.item} ${row.occurredAt} ${row.amount.cents}`)).toEqual(
          whole.map((row) => `${row.item} ${row.occurredAt.toISOString()} ${row.amountCents}`),
        );
        expect(next.nextCursor).toBeNull();
      },
    );

    it('answers no rows and no cursor before the dataset begins', async () => {
      clock.set(new Date('2021-12-31T10:00:00Z'));

      for (const tab of ['all', 'revenue', 'expenses'] as const) {
        expect(await page(tab)).toEqual({ transactions: [], nextCursor: null });
      }
    });

    it('answers exactly 10 rows and no cursor at 2022-01-08; at 2022-01-09 Design project on page 2, after House Rent', async () => {
      clock.set(new Date('2022-01-08T10:00:00Z'));
      const only = await page('all');
      expect(only.transactions).toHaveLength(10);
      expect(only.nextCursor).toBeNull();

      clock.set(new Date('2022-01-09T10:00:00Z'));
      const first = await page('all');
      expect(first.transactions.at(-1)).toMatchObject({ item: 'House Rent', occurredAt: '2022-01-01T12:00:00.000Z' });
      const second = await page('all', first.nextCursor!);
      expect(second).toEqual({
        transactions: [
          {
            item: 'Design project',
            shopName: 'Acme Ltd.',
            category: null,
            direction: 'income',
            occurredAt: '2022-01-01T12:00:00.000Z',
            paymentMethod: 'checking',
            amount: { cents: 66_500, currency: 'USD' },
          },
        ],
        nextCursor: null,
      });
      expect((await summaries('revenue')).map((row) => row.split(' | ')[0])).toEqual([
        'Freelance payment',
        'Design project',
      ]);
      expect((await page('revenue')).nextCursor).toBeNull();
    });
  });

  // T3: AC6, a cursor, never an offset: rows added or removed before it leave the next page as it was (#74).
  describe('rows added and removed between pages', () => {
    it('continues after Shirt when a transaction is added today between the pages, which shows on a new first page', async () => {
      const first = await page('all');

      await insert('2026-10-22T12:00:00Z', 'New today');

      expect(await summaries('all', first.nextCursor!)).toEqual(allPage2);
      expect((await summaries('all'))[0]).toBe('New today | Shop | 2026-10-22 | checking | -1000');
    });

    it('continues with Dividend when Shirt, page 1’s last row, is deleted between the pages', async () => {
      const first = await page('all');

      await deleteItem('Shirt', '2026-10-15T12:00:00Z');

      expect(await summaries('all', first.nextCursor!)).toEqual(allPage2);
    });

    it('continues with Dividend when a row is added at Shirt’s instant between the pages: it sorts before Shirt', async () => {
      const first = await page('all');

      await insert('2026-10-15T12:00:00Z', 'Same instant');

      expect(await summaries('all', first.nextCursor!)).toEqual(allPage2);
      const fresh = await summaries('all');
      expect(fresh.slice(-2)).toEqual([allPage1[8], 'Same instant | Shop | 2026-10-15 | checking | -1000']);
    });
  });

  // T4: AC7, today from the Clock in the user's zone (#53, #54, #80).
  describe('today', () => {
    it('at 2026-10-23T22:30:00Z starts with 24 Oct in Belgrade and with 23 Oct in New York', async () => {
      clock.set(new Date('2026-10-23T22:30:00Z'));

      expect((await summaries('all')).slice(0, 4)).toEqual([
        'Gift | Gift Corner | 2026-10-24 | checking | -2128',
        'Freelance payment | Bright Studio | 2026-10-24 | checking | +17920',
        'Biriyani | Hajir Biriyani | 2026-10-23 | credit-card | -1478',
        allPage1[0],
      ]);
      expect((await summaries('all', undefined, NEW_YORK)).slice(0, 2)).toEqual([
        'Biriyani | Hajir Biriyani | 2026-10-23 | credit-card | -1478',
        allPage1[0],
      ]);
    });

    it('hides 24 Oct at 23:59:59 on 23 Oct in Belgrade and shows it at 00:00 on 24 Oct', async () => {
      clock.set(new Date('2026-10-23T21:59:59Z'));
      const before = await page('all');
      expect(before.transactions.map(summary)[0]).toBe('Biriyani | Hajir Biriyani | 2026-10-23 | credit-card | -1478');
      expect(before.transactions.filter((row) => row.occurredAt >= '2026-10-23T22:00:00.000Z')).toEqual([]);

      clock.set(new Date('2026-10-23T22:00:00Z'));
      expect((await summaries('all'))[0]).toBe('Gift | Gift Corner | 2026-10-24 | checking | -2128');
    });

    it('continues page 2 from the cursor after the clock moves to the next day: no 23 Oct row', async () => {
      const first = await page('all');

      clock.set(new Date('2026-10-23T10:00:00Z'));

      expect(await summaries('all', first.nextCursor!)).toEqual(allPage2);
    });
  });

  // T5: AC8, each tab's first 5 are Overview's Recent Transaction rows (#40).
  it.each<[string, string, string]>([
    ['the fixed clock in Belgrade', FIXED_NOW, BELGRADE],
    ['2026-10-23T22:30:00Z in Belgrade', '2026-10-23T22:30:00Z', BELGRADE],
    ['2026-10-23T22:30:00Z in New York', '2026-10-23T22:30:00Z', NEW_YORK],
    ['2022-01-09T10:00:00Z in Belgrade', '2022-01-09T10:00:00Z', BELGRADE],
    ['2021-12-31T10:00:00Z in Belgrade', '2021-12-31T10:00:00Z', BELGRADE],
  ])('gives each tab’s first 5 as Recent Transaction’s, in order, at %s', async (_case, now, zone) => {
    clock.set(new Date(now));

    const recent = await service.recent(userId, zone);
    for (const tab of ['all', 'revenue', 'expenses'] as const) {
      const firstFive = (await page(tab, undefined, zone)).transactions
        .slice(0, 5)
        .map(({ paymentMethod: _paymentMethod, ...row }) => row);
      expect({ tab, rows: firstFive }).toEqual({ tab, rows: recent[tab] });
    }
  });

  // T6: AC2 and AC10, the Payment Method is the account's type, read on every request (#57).
  describe('Payment Method', () => {
    it('is each row’s account type: Checking, Credit Card, Investment and Loan', async () => {
      const first = await page('all');
      const rows = [...first.transactions, ...(await page('all', first.nextCursor!)).transactions];
      const methodOf = (item: string) => rows.find((row) => row.item === item)!.paymentMethod;

      expect(['Jeans', 'Movie ticket', 'Dividend', 'Loan installment'].map(methodOf)).toEqual([
        'checking',
        'credit-card',
        'investment',
        'loan',
      ]);
    });

    it('follows a changed account type on the next request; the other rows keep theirs', async () => {
      await db.query(`UPDATE accounts SET account_type = 'savings' WHERE id = ?`, [await accountOf('checking')]);

      expect(await summaries('all')).toEqual(allPage1.map((row) => row.replace('| checking |', '| savings |')));
      expect(await summaries('revenue')).toEqual(revenuePage1.map((row) => row.replace('| checking |', '| savings |')));
    });
  });

  it('answers only the user’s own rows: another user’s cursor names a position in this user’s list', async () => {
    const other = (await userIdOf(db, (await signUp(app)).user.email))!;
    await db.query('DELETE FROM transactions WHERE account_id IN (SELECT id FROM accounts WHERE user_id = ?)', [other]);
    const first = await page('all');

    expect(await service.list(other, BELGRADE, { tab: 'all' })).toEqual({ transactions: [], nextCursor: null });
    expect(await service.list(other, BELGRADE, { tab: 'all', cursor: first.nextCursor! })).toEqual({
      transactions: [],
      nextCursor: null,
    });
  });
});
