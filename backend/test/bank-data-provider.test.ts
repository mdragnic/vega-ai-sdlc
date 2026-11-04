import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  BANK_DATA_PROVIDER,
  type BankDataProvider,
  type BankTransaction,
  InvalidCursorError,
  type TransactionFilter,
} from '../src/bank-data/bank-data-provider.js';
import { VisibleTransactions } from '../src/bank-data/visible-transactions.js';
import { signUp } from './helpers/auth.js';
import { userIdOf } from './helpers/finance.js';
import { createTestApp } from './helpers/test-app.js';

const accountKeys = [
  'id',
  'accountType',
  'bankName',
  'branchName',
  'cardNetwork',
  'accountNumber',
  'openingBalanceCents',
];
const transactionKeys = [
  'id',
  'accountId',
  'occurredAt',
  'direction',
  'status',
  'category',
  'item',
  'shopName',
  'receipt',
  'amountCents',
];

const day = (transaction: BankTransaction): string => transaction.occurredAt.toISOString().slice(0, 10);

/** The WHERE clause of a SELECT, up to its ORDER BY or LIMIT. */
const whereOf = (sql: string) => /\bWHERE\b(.*?)(\bORDER BY\b|\bLIMIT\b|$)/is.exec(sql)?.[1] ?? '';

describe('TypeOrmBankDataProvider', () => {
  let app: INestApplication;
  let provider: BankDataProvider;
  let userA: number;
  let userB: number;
  let accountsA: number[];
  let accountsB: number[];

  beforeAll(async () => {
    app = await createTestApp();
    provider = app.get<BankDataProvider>(BANK_DATA_PROVIDER);
    const db = app.get(DataSource);
    userA = (await userIdOf(db, (await signUp(app)).user.email))!;
    userB = (await userIdOf(db, (await signUp(app)).user.email))!;
    accountsA = (await provider.listAccounts(userA)).map((account) => account.id);
    accountsB = (await provider.listAccounts(userB)).map((account) => account.id);
  });

  afterAll(async () => {
    await app.close();
  });

  /** The SQL the data source runs while `run` runs (this driver writes the numbers into the text). */
  async function recordSql(run: () => Promise<unknown>) {
    const db = app.get(DataSource);
    const statements: string[] = [];
    const logQuery = vi.spyOn(db.logger, 'logQuery').mockImplementation((sql) => {
      statements.push(sql);
    });
    try {
      await run();
    } finally {
      logQuery.mockRestore();
    }
    return statements;
  }

  /** Every page of a filter with `limit`, following nextCursor to the end. */
  async function allPages(userId: number, filter: TransactionFilter, limit: number) {
    const pages = [];
    let cursor: string | undefined;
    do {
      const page = await provider.listTransactions(userId, { ...filter, limit, cursor });
      pages.push(page);
      cursor = page.nextCursor ?? undefined;
    } while (cursor !== undefined);
    return pages;
  }

  // T12: AC8.
  describe('accounts', () => {
    it('lists the user’s accounts oldest first, with only the raw fields', async () => {
      const accounts = await provider.listAccounts(userA);

      expect(accounts.map((account) => account.accountType)).toEqual([
        'credit-card',
        'checking',
        'savings',
        'investment',
        'loan',
      ]);
      expect(accounts.map((account) => account.id)).toEqual(accountsA.toSorted((a, b) => a - b));
      expect(accounts[0]).toEqual({
        id: accountsA[0],
        accountType: 'credit-card',
        bankName: 'Master Card',
        branchName: 'Main Branch',
        cardNetwork: 'mastercard',
        accountNumber: '3388455688602598',
        openingBalanceCents: 2_500_000,
      });
      for (const account of accounts) {
        expect(Object.keys(account)).toEqual(accountKeys);
      }
    });

    it('gets one account, or null when it does not exist', async () => {
      expect(await provider.getAccount(userA, accountsA[2]!)).toEqual({
        id: accountsA[2],
        accountType: 'savings',
        bankName: 'Brac Bank Ltd.',
        branchName: 'Gulshan Branch',
        cardNetwork: null,
        accountNumber: '1334568868014421',
        openingBalanceCents: 2_500_000,
      });
      expect(await provider.getAccount(userA, 999_999)).toBeNull();
    });

    it('stores Bank Name, Branch Name and Account Type, and returns the updated account', async () => {
      const updated = await provider.updateAccountDetails(userA, accountsA[4]!, {
        bankName: 'Loan Bank',
        branchName: 'North Branch',
        accountType: 'investment',
      });

      const expected = {
        id: accountsA[4],
        accountType: 'investment',
        bankName: 'Loan Bank',
        branchName: 'North Branch',
        cardNetwork: null,
        accountNumber: '3634568966019083',
        openingBalanceCents: 2_500_000,
      };
      expect(updated).toEqual(expected);
      expect(Object.keys(updated!)).toEqual(accountKeys);
      expect(await provider.getAccount(userA, accountsA[4]!)).toEqual(expected);
      expect(
        await provider.updateAccountDetails(userA, 999_999, { bankName: 'X', branchName: 'Y', accountType: 'loan' }),
      ).toBeNull();
    });
  });

  // T12: AC8.
  describe('transactions', () => {
    it('lists every transaction of the user, newest first, with only the raw fields', async () => {
      const { transactions, nextCursor } = await provider.listTransactions(userA, {});

      expect(transactions).toHaveLength(3411);
      expect(nextCursor).toBeNull();
      expect(transactions[0]).toMatchObject({
        accountId: accountsA[0],
        occurredAt: new Date('2028-12-31T12:00:00.000Z'),
        direction: 'expense',
        status: 'complete',
        category: 'food',
        item: 'Biriyani',
        shopName: 'Hajir Biriyani',
        amountCents: 1_800, // $12.00 x 120% x 125%
      });
      expect(transactions[0]!.receipt).toMatch(/^[A-Za-z0-9]{11}$/);
      expect(transactions.at(-1)).toMatchObject({
        item: 'Design project',
        occurredAt: new Date('2022-01-01T12:00:00Z'),
      });
      for (const transaction of transactions) {
        expect(Object.keys(transaction)).toEqual(transactionKeys);
      }
      const order = transactions.map((t) => [t.occurredAt.getTime(), t.id] as const);
      expect(
        order.every(
          ([time, id], i) => i === 0 || time < order[i - 1]![0] || (time === order[i - 1]![0] && id < order[i - 1]![1]),
        ),
      ).toBe(true);
    });

    it('breaks ties within a day by ID, the newest insert first', async () => {
      const { transactions } = await provider.listTransactions(userA, {
        occurredFrom: new Date('2026-10-16T00:00:00Z'),
        occurredBefore: new Date('2026-10-17T00:00:00Z'),
      });

      expect(transactions.map((t) => `${t.item} ${t.status}`)).toEqual(['Pizza failed', 'Biriyani complete']);
      expect(transactions[0]!.id).toBeGreaterThan(transactions[1]!.id);
    });

    it.each<[string, (accounts: number[]) => TransactionFilter, number]>([
      ['the Savings account', (a) => ({ accountId: a[2] }), 84],
      ['the Checking account', (a) => ({ accountId: a[1] }), 1344], // 5 income and 11 expense rows a month
      ['income', () => ({ direction: 'income' }), 672],
      ['expenses', () => ({ direction: 'expense' }), 2739],
      [
        '1 to 22 Oct 2026',
        () => ({ occurredFrom: new Date('2026-10-01T00:00:00Z'), occurredBefore: new Date('2026-10-23T00:00:00Z') }),
        28,
      ],
    ])('filters by %s', async (_case, filter, count) => {
      const { transactions } = await provider.listTransactions(userA, filter(accountsA));

      expect(transactions).toHaveLength(count);
    });

    it('combines the filters, occurredFrom inclusive and occurredBefore exclusive', async () => {
      const checkingIncome = await provider.listTransactions(userA, {
        accountId: accountsA[1],
        direction: 'income',
        occurredFrom: new Date('2026-10-01T12:00:00Z'),
        occurredBefore: new Date('2026-10-22T12:00:00Z'),
      });
      const jeansDay = await provider.listTransactions(userA, {
        occurredFrom: new Date('2026-10-22T12:00:00Z'),
        occurredBefore: new Date('2026-10-22T12:00:00.001Z'),
      });

      expect(checkingIncome.transactions.map((t) => `${day(t)} ${t.item}`)).toEqual([
        '2026-10-17 Freelance payment',
        '2026-10-10 Freelance payment',
        '2026-10-03 Freelance payment',
        '2026-10-01 Design project',
      ]);
      expect(jeansDay.transactions.map((t) => t.item)).toEqual(['Jeans']);
      expect(
        await provider.listTransactions(userA, {
          occurredFrom: new Date('2026-10-22T00:00:00Z'),
          occurredBefore: new Date('2026-10-22T12:00:00Z'),
        }),
      ).toEqual({ transactions: [], nextCursor: null });
    });
  });

  // T13: AC9, nothing of another user, by any method.
  describe('scoping', () => {
    it('returns only the user’s own rows', async () => {
      const { transactions } = await provider.listTransactions(userA, {});

      expect(accountsA.filter((id) => accountsB.includes(id))).toEqual([]);
      expect(new Set(transactions.map((t) => t.accountId))).toEqual(new Set(accountsA));
      expect((await provider.listAccounts(userB)).map((account) => account.id)).toEqual(accountsB);
    });

    it('gives null for another user’s account on get and update, and leaves it unchanged', async () => {
      const before = await provider.getAccount(userB, accountsB[1]!);

      expect(await provider.getAccount(userA, accountsB[1]!)).toBeNull();
      expect(
        await provider.updateAccountDetails(userA, accountsB[1]!, {
          bankName: 'Taken',
          branchName: 'Taken',
          accountType: 'loan',
        }),
      ).toBeNull();
      expect(await provider.getAccount(userB, accountsB[1]!)).toEqual(before);
      expect(before).toMatchObject({ bankName: 'AB Bank Ltd', accountType: 'checking' });
    });

    // Task 021 T7, AC12: the account check is one query whose WHERE holds the account and the user (#39).
    it('reads one account in one SELECT whose WHERE holds the account ID and the user ID', async () => {
      for (const [userId, accountId, found] of [
        [userA, accountsB[1]!, false],
        [userA, accountsA[1]!, true],
      ] as const) {
        let account: unknown;
        const statements = await recordSql(async () => {
          account = await provider.getAccount(userId, accountId);
        });

        expect(account === null).toBe(!found);
        expect(statements).toHaveLength(1);
        const [sql] = statements as [string];
        expect(sql).toMatch(/^SELECT\b/);
        expect(/"id" = (\d+)/.exec(whereOf(sql))?.[1]).toBe(String(accountId));
        expect(/"user_id" = (\d+)/.exec(whereOf(sql))?.[1]).toBe(String(userId));
      }
    });

    // Task 021 T7, AC14 (Marko's addition 1): the history's read filters by the user and the account in one query, so
    // another user's account gives no rows even without the account check.
    it.each([
      ['without a cursor', false],
      ['with a cursor', true],
    ])(
      'lists no rows of another user’s account through VisibleTransactions %s, in one SELECT on the user and the account',
      async (_case, withCursor) => {
        const visible = app.get(VisibleTransactions);
        const cursor = withCursor
          ? (await visible.list(userA, 'Europe/Belgrade', { accountId: accountsA[1], limit: 10 })).nextCursor!
          : undefined;
        let page: unknown;
        const statements = await recordSql(async () => {
          page = await visible.list(userA, 'Europe/Belgrade', {
            accountId: accountsB[1],
            limit: 10,
            ...(cursor !== undefined && { cursor }),
          });
        });

        expect(page).toEqual({ transactions: [], nextCursor: null });
        expect(statements).toHaveLength(1);
        const [sql] = statements as [string];
        expect(sql).toMatch(/^SELECT\b/);
        expect(/"a"\."user_id" = (\d+)/.exec(whereOf(sql))?.[1]).toBe(String(userA));
        expect(/"t"\."account_id" = (\d+)/.exec(whereOf(sql))?.[1]).toBe(String(accountsB[1]));
      },
    );

    it('lists no transactions of another user’s account', async () => {
      expect(await provider.listTransactions(userA, { accountId: accountsB[1] })).toEqual({
        transactions: [],
        nextCursor: null,
      });
      expect(await provider.listTransactions(userA, { accountId: accountsB[1], limit: 10 })).toEqual({
        transactions: [],
        nextCursor: null,
      });
    });
  });

  // T14: AC10, cursor pages of 10 (#27, #74).
  describe('cursor pages', () => {
    it.each<[string, (accounts: number[]) => TransactionFilter]>([
      ['every transaction', () => ({})],
      ['one account', (a) => ({ accountId: a[1] })],
      ['income only', () => ({ direction: 'income' })],
    ])('page through %s once each, newest first', async (_case, filter) => {
      const all = (await provider.listTransactions(userA, filter(accountsA))).transactions;

      const pages = await allPages(userA, filter(accountsA), 10);

      const paged = pages.flatMap((page) => page.transactions);
      expect(pages.slice(0, -1).every((page) => page.transactions.length === 10 && page.nextCursor !== null)).toBe(
        true,
      );
      expect(pages.at(-1)!.nextCursor).toBeNull();
      expect(paged.map((t) => t.id)).toEqual(all.map((t) => t.id));
      expect(new Set(paged.map((t) => t.id)).size).toBe(all.length);
    });

    it('ends with a full last page when the rows divide evenly', async () => {
      const pages = await allPages(userA, { accountId: accountsA[3] }, 12);

      expect(pages.map((page) => page.transactions.length)).toEqual([12, 12, 12, 12, 12, 12, 12]);
      expect(pages.at(-1)!.nextCursor).toBeNull();
    });

    it.each(['not a cursor', '', 'MjAyNi0xMC0yMlQxMjowMDowMC4wMDBa', '%%%'])(
      'rejects the cursor %j',
      async (cursor) => {
        await expect(provider.listTransactions(userA, { cursor, limit: 10 })).rejects.toThrow(InvalidCursorError);
      },
    );

    it.each([0, -1, 1.5, Number.NaN])('rejects a limit of %d', async (limit) => {
      await expect(provider.listTransactions(userA, { limit })).rejects.toThrow(RangeError);
    });

    // An invalid date would bind as 'NaN-NaN-NaN', dropping every row or the upper bound without a sound.
    it.each(['occurredFrom', 'occurredBefore'])('rejects an invalid %s date', async (field) => {
      await expect(provider.listTransactions(userA, { [field]: new Date('not a date') })).rejects.toThrow(RangeError);
    });
  });
});

/** An instant as the transactions table stores it: `YYYY-MM-DD HH:MM:SS.SSS` in UTC. */
const stored = (instant: string) => new Date(instant).toISOString().replace('T', ' ').replace('Z', '');

/** Adds an expense to an account at an instant, with plain SQL. */
async function addTransaction(db: DataSource, accountId: number, instant: string) {
  await db.query(
    `INSERT INTO transactions (account_id, occurred_at, direction, status, category, item, shop_name, receipt, amount_cents)
     VALUES (?, ?, 'expense', 'complete', 'food', 'Added row', 'Pizza Hit', 'Ab3dE5gH9jK', 1000)`,
    [accountId, stored(instant)],
  );
}

// Task 025 T4, AC6: the user's earliest transaction before an instant, for the Goals months (#39, #77, #123 a).
describe('TypeOrmBankDataProvider.earliestTransactionAt', () => {
  let app: INestApplication;
  let db: DataSource;
  let provider: BankDataProvider;
  let other: number;
  let userId: number;

  const FAR_FUTURE = new Date('2100-01-01T00:00:00Z');
  /** The demo dataset's first rows (demo-data.md, Transactions). */
  const DEMO_START = '2022-01-01T12:00:00.000Z';

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
    provider = app.get<BankDataProvider>(BANK_DATA_PROVIDER);
    // The other user signs up first, so IDs never equal positions, and has a row in 2021.
    other = (await userIdOf(db, (await signUp(app)).user.email))!;
    userId = (await userIdOf(db, (await signUp(app)).user.email))!;
    const [otherAccount] = await provider.listAccounts(other);
    await addTransaction(db, otherAccount!.id, '2021-06-15T12:00:00Z');
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers the user’s own earliest instant, never another user’s', async () => {
    expect((await provider.earliestTransactionAt(userId, FAR_FUTURE))?.toISOString()).toBe(DEMO_START);
    expect((await provider.earliestTransactionAt(other, FAR_FUTURE))?.toISOString()).toBe('2021-06-15T12:00:00.000Z');
  });

  it('counts only rows before `before`, which is exclusive', async () => {
    expect(await provider.earliestTransactionAt(userId, new Date(DEMO_START))).toBeNull();
    expect((await provider.earliestTransactionAt(userId, new Date('2022-01-01T12:00:00.001Z')))?.toISOString()).toBe(
      DEMO_START,
    );
    // The other user's row at 2021-06-15 is before it, and still not the user's.
    expect(await provider.earliestTransactionAt(userId, new Date('2021-12-31T00:00:00Z'))).toBeNull();
  });

  it('counts any status, direction and account', async () => {
    const accounts = await provider.listAccounts(userId);
    await db.query(
      `INSERT INTO transactions (account_id, occurred_at, direction, status, category, item, shop_name, receipt, amount_cents)
       VALUES (?, ?, 'income', 'pending', NULL, 'Pending refund', 'Bright Studio', 'Ab3dE5gH9jK', 500)`,
      [accounts.at(-1)!.id, stored('2021-11-30T08:00:00Z')],
    );

    expect((await provider.earliestTransactionAt(userId, FAR_FUTURE))?.toISOString()).toBe('2021-11-30T08:00:00.000Z');

    await db.query('DELETE FROM transactions WHERE item = ?', ['Pending refund']);
  });

  it('answers null for a user with no rows', async () => {
    await db.query("INSERT INTO users (email, full_name, username) VALUES ('empty@example.com', 'Empty', 'empty')");
    const empty = (await userIdOf(db, 'empty@example.com'))!;

    expect(await provider.earliestTransactionAt(empty, FAR_FUTURE)).toBeNull();
  });

  it('reads it in one query with the user and the bound in its WHERE', async () => {
    const statements: string[] = [];
    const logQuery = vi.spyOn(db.logger, 'logQuery').mockImplementation((sql) => {
      statements.push(sql);
    });
    try {
      await provider.earliestTransactionAt(userId, FAR_FUTURE);
    } finally {
      logQuery.mockRestore();
    }

    expect(statements).toHaveLength(1);
    const [sql] = statements as [string];
    expect(sql).toMatch(/^SELECT\b.*\bMIN\(/is);
    expect(/"a"\."user_id" = (\d+)/.exec(whereOf(sql))?.[1]).toBe(String(userId));
    expect(whereOf(sql)).toMatch(/"t"\."occurred_at" </);
  });

  it('rejects an invalid date, which would bind as NaN and drop the bound', async () => {
    await expect(provider.earliestTransactionAt(userId, new Date('not a date'))).rejects.toThrow(RangeError);
  });
});
