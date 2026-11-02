import type { INestApplication } from '@nestjs/common';
import {
  errorResponseSchema,
  type TransactionHistoryPage,
  type TransactionHistoryRow,
  transactionHistoryPageSchema,
  type TransactionRow,
  transactionsContract,
} from '@finebank/shared';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { VisibleTransactions } from '../src/bank-data/visible-transactions.js';
import { Transaction } from '../src/bank-data/transaction.entity.js';
import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { TransactionsService } from '../src/transactions/transactions.service.js';
import { cookieFor, signUp } from './helpers/auth.js';
import { financeRows, userIdOf } from './helpers/finance.js';
import { createTestApp } from './helpers/test-app.js';

// The path comes from the contract, so a route declared anywhere else would not answer it.
const historyPath = (accountId: number | string) =>
  `/api${transactionsContract.history.path.replace(':accountId', String(accountId))}`;

const FIXED_NOW = '2026-10-22T10:00:00.000Z';
const BELGRADE = 'Europe/Belgrade';
const NEW_YORK = 'America/New_York';

/** The demo accounts' types, in the order every user's accounts are stored (demo-data.md). */
const accountTypes = ['credit-card', 'checking', 'savings', 'investment', 'loan'] as const;
const CREDIT_CARD = 0;
const CHECKING = 1;
const SAVINGS = 2;

/** A row as text: its UTC day, its status, and the amount with the direction's sign. */
const summary = (row: TransactionHistoryRow) =>
  `${row.occurredAt.slice(0, 10)} ${row.status} ${row.direction === 'income' ? '+' : '-'}${row.amount.cents}`;

/** Checking's first page at the fixed clock, newest first (task 021 References). */
const checkingPage1 = [
  '2026-10-22 complete -26600',
  '2026-10-18 complete -14784',
  '2026-10-17 complete +17920',
  '2026-10-15 complete -32200',
  '2026-10-14 complete -2016',
  '2026-10-12 complete -5880',
  '2026-10-11 complete -3192',
  '2026-10-10 complete +17920',
  '2026-10-07 complete -2128',
  '2026-10-04 complete -28336',
];

/** The receipts References names on Checking's first page, by row. */
const checkingPage1Receipts: [number, string][] = [
  [0, 'z7YBsODpLNW'],
  [1, 'nPcvc24YHB7'],
  [2, 'SVqWhlvmJqw'],
  [3, '5vSKgU8NCTh'],
  [7, 'IhN8Byqe5aj'],
  [9, 'CrSNatgkImu'],
];

/** The Credit Card's first page: its fifth row the Failed Pizza, then the Biriyani at the same instant. */
const creditCardPage1 = [
  '2026-10-21 complete -1764',
  '2026-10-20 complete -2464',
  '2026-10-19 complete -1064',
  '2026-10-17 complete -18816',
  '2026-10-16 failed -2464',
  '2026-10-16 complete -1478',
  '2026-10-13 complete -1064',
  '2026-10-09 complete -4200',
  '2026-10-08 complete -2464',
  '2026-10-06 complete -1764',
];

const rowKeys = ['amount', 'direction', 'occurredAt', 'receipt', 'status'];

/** A row's instant, direction and amount: what an account's history and the Transactions list share (#57). */
const key = (row: { occurredAt: string; direction: string; amount: { cents: number } }) =>
  `${row.occurredAt} ${row.direction} ${row.amount.cents}`;

/** The history path with a cursor. */
const withCursor = (accountId: number, cursor: string) =>
  `${historyPath(accountId)}?cursor=${encodeURIComponent(cursor)}`;

describe('Transactions History', () => {
  let app: INestApplication;
  let clock: FixedClock;
  let db: DataSource;
  let service: TransactionsService;

  beforeAll(async () => {
    app = await createTestApp({ config: { nodeEnv: 'test', testNow: FIXED_NOW } });
    clock = app.get(FixedClock);
    db = app.get(DataSource);
    service = app.get(TransactionsService);
    // Another user first, so no account ID equals its position.
    await signUp(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    clock.set(new Date(FIXED_NOW));
  });

  /** A new user signed up through the API, with the demo data, and its account IDs oldest first. */
  async function newUser() {
    const { user, token } = await signUp(app);
    const id = (await userIdOf(db, user.email))!;
    const accounts = (await financeRows(db, id)).accounts.map((account) => Number(account.id));
    return { token, id, accounts };
  }

  /** The service's page; fails the test when it answers not found. */
  async function historyPage(userId: number, accountId: number, cursor?: string, zone = BELGRADE) {
    const page = await service.history(userId, zone, accountId, cursor === undefined ? {} : { cursor });
    expect(page).not.toBeNull();
    return page!;
  }

  /** Every row of the Transactions All tab, page after page (task 020). */
  async function allListRows(userId: number) {
    const rows: TransactionRow[] = [];
    let cursor: string | undefined;
    do {
      const page = await service.list(userId, BELGRADE, cursor === undefined ? { tab: 'all' } : { tab: 'all', cursor });
      rows.push(...page.transactions);
      cursor = page.nextCursor ?? undefined;
    } while (cursor !== undefined);
    return rows;
  }

  /** Every page of an account's history, each with the cursor of the one before. */
  async function allPages(userId: number, accountId: number, zone = BELGRADE) {
    const pages: TransactionHistoryPage[] = [];
    let cursor: string | undefined;
    do {
      const page = await historyPage(userId, accountId, cursor, zone);
      pages.push(page);
      cursor = page.nextCursor ?? undefined;
    } while (cursor !== undefined);
    return pages;
  }

  // T8: AC4, AC6 and AC7, the account's next 10 of any status, newest first, page after page (#27, #57, #74).
  describe('TransactionsService.history', () => {
    it('answers Checking’s first 10 at the fixed clock, with their receipts, and a cursor', async () => {
      const user = await newUser();

      const page = await historyPage(user.id, user.accounts[CHECKING]!);

      expect(page.transactions.map(summary)).toEqual(checkingPage1);
      for (const [index, receipt] of checkingPage1Receipts) expect(page.transactions[index]!.receipt).toBe(receipt);
      expect(page.transactions.map((row) => row.direction === 'income')).toEqual([
        false,
        false,
        true,
        false,
        false,
        false,
        false,
        true,
        false,
        false,
      ]);
      expect(page.nextCursor).not.toBeNull();
    });

    it('answers the Credit Card’s first 10, the Failed Pizza fifth, listed like a Complete row', async () => {
      const user = await newUser();

      const page = await historyPage(user.id, user.accounts[CREDIT_CARD]!);

      expect(page.transactions.map(summary)).toEqual(creditCardPage1);
      expect(page.transactions[4]).toEqual({
        occurredAt: '2026-10-16T12:00:00.000Z',
        status: 'failed',
        direction: 'expense',
        receipt: 'CFP5E9VV2Fn',
        amount: { cents: 2_464, currency: 'USD' },
      });
    });

    it('answers Checking’s page 2 from page 1’s cursor: 3 Oct first, then House Rent', async () => {
      const user = await newUser();
      const first = await historyPage(user.id, user.accounts[CHECKING]!);

      const second = await historyPage(user.id, user.accounts[CHECKING]!, first.nextCursor!);

      expect(second.transactions.slice(0, 2)).toEqual([
        {
          occurredAt: '2026-10-03T12:00:00.000Z',
          status: 'complete',
          direction: 'income',
          receipt: 'gceoLfSMg8H',
          amount: { cents: 17_920, currency: 'USD' },
        },
        {
          occurredAt: '2026-10-01T12:00:00.000Z',
          status: 'complete',
          direction: 'expense',
          receipt: 'dR9mGBqImes',
          amount: { cents: 23_184, currency: 'USD' },
        },
      ]);
    });

    it.each(accountTypes.map((type, index) => [type, index] as const))(
      'pages %s to its end at 2022-03-01: the pages together are the account’s whole visible list, each row once',
      async (_type, index) => {
        const user = await newUser();
        clock.set(new Date('2022-03-01T10:00:00Z'));
        const accountId = user.accounts[index]!;
        const visible = await app.get(VisibleTransactions).list(user.id, BELGRADE, { accountId });

        const pages = await allPages(user.id, accountId);

        const rows = pages.flatMap((page) => page.transactions);
        expect(pages.slice(0, -1).every((page) => page.transactions.length === 10 && page.nextCursor !== null)).toBe(
          true,
        );
        expect(pages.at(-1)!.nextCursor).toBeNull();
        expect(rows.map((row) => [row.occurredAt, row.receipt, row.amount.cents])).toEqual(
          visible.transactions.map((row) => [row.occurredAt.toISOString(), row.receipt, row.amountCents]),
        );
        expect(new Set(rows.map((row) => row.receipt)).size).toBe(rows.length);
        expect(visible.transactions.every((row) => row.accountId === accountId)).toBe(true);
        expect(rows.length).toBeGreaterThan(0);
      },
    );

    it('answers null for another user’s account, reading nothing', async () => {
      const owner = await newUser();
      const requester = await newUser();

      expect(await service.history(requester.id, BELGRADE, owner.accounts[CHECKING]!, {})).toBeNull();
    });
  });

  // T9: AC7, rows added or removed between two requests change nothing after the cursor's position (#27, #74).
  describe('the cursor', () => {
    it('keeps page 2 from 3 Oct with a row added today, Grocery removed and a row added at Grocery’s instant', async () => {
      const user = await newUser();
      const checking = user.accounts[CHECKING]!;
      const first = await historyPage(user.id, checking);
      const grocery = (
        await db.getRepository(Transaction).findOneByOrFail({ accountId: checking, receipt: 'CrSNatgkImu' })
      ).occurredAt;
      const insert = (occurredAt: Date, receipt: string) =>
        db.getRepository(Transaction).insert({
          accountId: checking,
          occurredAt,
          direction: 'expense',
          status: 'complete',
          category: 'food',
          item: 'Added',
          shopName: 'Added Shop',
          receipt,
          amountCents: 999,
        });

      await insert(new Date('2026-10-22T12:00:00Z'), 'AddedToday1');
      await db.getRepository(Transaction).delete({ accountId: checking, receipt: 'CrSNatgkImu' });
      await insert(grocery, 'AddedAtGroc');
      const second = await historyPage(user.id, checking, first.nextCursor!);

      expect(second.transactions[0]).toMatchObject({ occurredAt: '2026-10-03T12:00:00.000Z', receipt: 'gceoLfSMg8H' });
      const receipts = second.transactions.map((row) => row.receipt);
      expect(receipts).not.toContain('AddedToday1');
      expect(receipts).not.toContain('AddedAtGroc');
      expect(receipts.filter((receipt) => first.transactions.some((row) => row.receipt === receipt))).toEqual([]);
      const newFirst = await historyPage(user.id, checking);
      expect(newFirst.transactions[0]!.receipt).toBe('AddedToday1');
    });

    it('answers only the Credit Card’s rows after the position of a cursor made on Checking’s list', async () => {
      const user = await newUser();
      const fromChecking = (await historyPage(user.id, user.accounts[CHECKING]!)).nextCursor!;
      const creditCardRows = (await allPages(user.id, user.accounts[CREDIT_CARD]!)).flatMap(
        (page) => page.transactions,
      );

      const page = await historyPage(user.id, user.accounts[CREDIT_CARD]!, fromChecking);

      // Checking's page 1 ends with Grocery, 4 Oct 2026: the Credit Card's rows from before that instant.
      const expected = creditCardRows.filter((row) => row.occurredAt < '2026-10-04T12:00:00.000Z').slice(0, 10);
      expect(page.transactions).toEqual(expected);
    });

    it('answers only this account’s rows for a cursor made on another user’s list', async () => {
      const other = await newUser();
      const user = await newUser();
      const othersCursor = (await historyPage(other.id, other.accounts[CHECKING]!)).nextCursor!;
      const ownRows = (await allPages(user.id, user.accounts[CHECKING]!)).flatMap((page) => page.transactions);

      const page = await historyPage(user.id, user.accounts[CHECKING]!, othersCursor);

      expect(page.transactions.length).toBe(10);
      for (const row of page.transactions) expect(ownRows).toContainEqual(row);
      expect(page.transactions[0]!.occurredAt < '2026-10-04T12:00:00.000Z').toBe(true);
    });
  });

  // T10: AC5, the same records as Transactions: an account's history is the All tab's rows with its Payment Method.
  describe('the same records as Transactions', () => {
    it.each([FIXED_NOW, '2022-01-17T10:00:00Z'])('gives every account the All rows of its type at %s', async (now) => {
      const user = await newUser();
      clock.set(new Date(now));
      const listed = await allListRows(user.id);

      for (const [index, type] of accountTypes.entries()) {
        const history = (await allPages(user.id, user.accounts[index]!)).flatMap((page) => page.transactions);
        expect(history.map(key)).toEqual(listed.filter((row) => row.paymentMethod === type).map(key));
      }
    });
  });

  // T11: AC8, today from the Clock in the user's zone; a cursor across midnight (#53, #54, #80).
  describe('today', () => {
    it('starts Checking with Gift and Freelance payment of 24 Oct in Belgrade, with Jeans in New York', async () => {
      const user = await newUser();
      clock.set(new Date('2026-10-23T22:30:00Z'));

      const belgrade = await historyPage(user.id, user.accounts[CHECKING]!, undefined, BELGRADE);
      const newYork = await historyPage(user.id, user.accounts[CHECKING]!, undefined, NEW_YORK);

      expect(belgrade.transactions.slice(0, 3).map(summary)).toEqual([
        '2026-10-24 complete -2128',
        '2026-10-24 complete +17920',
        '2026-10-22 complete -26600',
      ]);
      expect(newYork.transactions[0]!.receipt).toBe('z7YBsODpLNW');
    });

    it('continues page 2 from the cursor after midnight passes: 3 Oct first, no 24 Oct row', async () => {
      const user = await newUser();
      const first = await historyPage(user.id, user.accounts[CHECKING]!);
      clock.set(new Date('2026-10-23T22:30:00Z'));

      const second = await historyPage(user.id, user.accounts[CHECKING]!, first.nextCursor!);

      expect(second.transactions[0]!.occurredAt).toBe('2026-10-03T12:00:00.000Z');
      expect(second.transactions.some((row) => row.occurredAt.startsWith('2026-10-24'))).toBe(false);
    });

    it('starts the Credit Card with the Biriyani of 23 Oct at 2026-10-23T10:00:00Z', async () => {
      const user = await newUser();
      clock.set(new Date('2026-10-23T10:00:00Z'));

      const page = await historyPage(user.id, user.accounts[CREDIT_CARD]!);

      expect(summary(page.transactions[0]!)).toBe('2026-10-23 complete -1478');
    });
  });

  // T12: AC6, AC11 and AC17, the route's raw bodies (#11, #19, #27, #74, #75, #96).
  describe('GET /api/accounts/:accountId/transactions', () => {
    const get = (path: string, options: { token?: string; zone?: string | null } = {}) => {
      let req = request(app.getHttpServer()).get(path);
      if (options.token !== undefined) req = req.set('Cookie', cookieFor(options.token));
      const zone = options.zone === undefined ? BELGRADE : options.zone;
      if (zone !== null) req = req.set('X-Time-Zone', zone);
      return req;
    };

    it('answers 200 with exactly the contract’s keys, UTC timestamps, plain cents with USD, 10 rows and a cursor', async () => {
      const user = await newUser();

      const response = await get(historyPath(user.accounts[CHECKING]!), { token: user.token });

      expect(response.status).toBe(200);
      const body = response.body as { transactions: Record<string, unknown>[]; nextCursor: string };
      expect(Object.keys(body)).toEqual(['transactions', 'nextCursor']);
      expect(body.transactions[0]).toEqual({
        occurredAt: '2026-10-22T12:00:00.000Z',
        status: 'complete',
        direction: 'expense',
        receipt: 'z7YBsODpLNW',
        amount: { cents: 26_600, currency: 'USD' },
      });
      expect(body.transactions).toHaveLength(10);
      for (const row of body.transactions) {
        expect(Object.keys(row).toSorted()).toEqual(rowKeys);
        expect(Object.keys(row.amount as object).toSorted()).toEqual(['cents', 'currency']);
        expect(Number.isInteger((row.amount as { cents: number }).cents)).toBe(true);
        expect(row.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      }
      expect(body.nextCursor).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
      expect(response.text).not.toMatch(/"item"|"shopName"|"category"|"paymentMethod"|"id"|"accountId"/);

      const second = await get(withCursor(user.accounts[CHECKING]!, body.nextCursor), { token: user.token });
      expect(second.status).toBe(200);
      expect(transactionHistoryPageSchema.parse(second.body).transactions[0]!.receipt).toBe('gceoLfSMg8H');
    });

    it('answers Checking’s 10 rows and a null cursor at 2022-01-15, the end of the list', async () => {
      const user = await newUser();
      clock.set(new Date('2022-01-15T10:00:00Z'));

      const body = transactionHistoryPageSchema.parse(
        (await get(historyPath(user.accounts[CHECKING]!), { token: user.token })).body,
      );

      expect(body.transactions).toHaveLength(10);
      expect(body.nextCursor).toBeNull();
    });

    it('answers 10 and then the tie row at 2022-01-17: House Rent ends page 1, Design project is page 2', async () => {
      const user = await newUser();
      clock.set(new Date('2022-01-17T10:00:00Z'));

      const first = transactionHistoryPageSchema.parse(
        (await get(historyPath(user.accounts[CHECKING]!), { token: user.token })).body,
      );
      const second = transactionHistoryPageSchema.parse(
        (await get(withCursor(user.accounts[CHECKING]!, first.nextCursor!), { token: user.token })).body,
      );

      expect(first.transactions).toHaveLength(10);
      expect(first.transactions.at(-1)).toEqual({
        occurredAt: '2022-01-01T12:00:00.000Z',
        status: 'complete',
        direction: 'expense',
        receipt: 'XI4W7ubVUlR',
        amount: { cents: 21_850, currency: 'USD' },
      });
      expect(second).toEqual({
        transactions: [
          {
            occurredAt: '2022-01-01T12:00:00.000Z',
            status: 'complete',
            direction: 'income',
            receipt: 'zoHdsqIkr4v',
            amount: { cents: 66_500, currency: 'USD' },
          },
        ],
        nextCursor: null,
      });
    });

    it('answers Savings no rows and a null cursor at 2022-01-17', async () => {
      const user = await newUser();
      clock.set(new Date('2022-01-17T10:00:00Z'));

      const response = await get(historyPath(user.accounts[SAVINGS]!), { token: user.token });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ transactions: [], nextCursor: null });
    });

    it('answers 401 without a session', async () => {
      const user = await newUser();

      const response = await get(historyPath(user.accounts[CHECKING]!));

      expect(response.status).toBe(401);
      expect(errorResponseSchema.strict().parse(response.body).message).toBe('Authentication required');
    });

    it.each([
      ['no X-Time-Zone', null, '', /X-Time-Zone/],
      ['an invalid X-Time-Zone', 'Mars/Base', '', /X-Time-Zone/],
      ['a cursor the backend did not make', BELGRADE, '?cursor=not%20a%20cursor', /^The cursor is not valid$/],
      ['a cursor of 65 characters', BELGRADE, `?cursor=${'a'.repeat(65)}`, /./],
    ])('answers 400 in the shared error shape for %s, no stack or SQL', async (_case, zone, query, message) => {
      const user = await newUser();

      const response = await get(`${historyPath(user.accounts[CHECKING]!)}${query}`, { token: user.token, zone });

      expect(response.status).toBe(400);
      const body = errorResponseSchema.parse(response.body);
      expect(body.message).toMatch(message);
      expect(response.text).not.toMatch(/SELECT|stack|at .*\.(js|ts)/);
    });

    it('ignores userId, another account’s accountId and tab in the query: the path and the session decide', async () => {
      const other = await newUser();
      const user = await newUser();
      const own = (await get(historyPath(user.accounts[CHECKING]!), { token: user.token })).body as object;

      const response = await get(
        `${historyPath(user.accounts[CHECKING]!)}?userId=${other.id}&accountId=${other.accounts[CREDIT_CARD]}&tab=revenue`,
        { token: user.token },
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual(own);
    });
  });
});
