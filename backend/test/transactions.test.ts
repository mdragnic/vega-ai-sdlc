import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { errorResponseSchema, recentTransactionsResponseSchema, transactionsContract } from '@finebank/shared';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { cookieFor, signUp } from './helpers/auth.js';
import { userIdOf } from './helpers/finance.js';
import { createTestApp } from './helpers/test-app.js';

// The path comes from the contract, so a route declared anywhere else would not answer it.
const recentPath = `/api${transactionsContract.recent.path}`;

const FIXED_NOW = '2026-10-22T10:00:00.000Z';
const BELGRADE = 'Europe/Belgrade';

const usd = (cents: number) => ({ cents, currency: 'USD' });
const at = (day: number) => `2026-10-${String(day).padStart(2, '0')}T12:00:00.000Z`;

/** A first login's lists on 22 Oct 2026 (demo-data.md, "What a first login shows"; AC1, AC2). */
const expenses = [
  {
    item: 'Jeans',
    shopName: 'Denim House',
    category: 'shopping',
    direction: 'expense',
    occurredAt: at(22),
    amount: usd(26_600),
  },
  {
    item: 'Movie ticket',
    shopName: 'Inox',
    category: 'entertainment',
    direction: 'expense',
    occurredAt: at(21),
    amount: usd(1_764),
  },
  {
    item: 'Pizza',
    shopName: 'Pizza Hit',
    category: 'food',
    direction: 'expense',
    occurredAt: at(20),
    amount: usd(2_464),
  },
  {
    item: 'Taxi fare',
    shopName: 'Uber',
    category: 'transportation',
    direction: 'expense',
    occurredAt: at(19),
    amount: usd(1_064),
  },
  {
    item: 'Restaurant bill',
    shopName: 'Spice Garden',
    category: 'food',
    direction: 'expense',
    occurredAt: at(18),
    amount: usd(14_784),
  },
];
const freelance = (day: number) => ({
  item: 'Freelance payment',
  shopName: 'Bright Studio',
  category: null,
  direction: 'income',
  occurredAt: at(day),
  amount: usd(17_920),
});
const revenue = [
  freelance(17),
  {
    item: 'Dividend',
    shopName: 'AB Bank Ltd',
    category: null,
    direction: 'income',
    occurredAt: at(15),
    amount: usd(8_400),
  },
  freelance(10),
  freelance(3),
  {
    item: 'Design project',
    shopName: 'Acme Ltd.',
    category: null,
    direction: 'income',
    occurredAt: at(1),
    amount: usd(78_400),
  },
];
const firstLogin = { all: expenses, revenue, expenses };

const rowKeys = ['amount', 'category', 'direction', 'item', 'occurredAt', 'shopName'];

describe('the recent transactions API', () => {
  let app: INestApplication;
  let clock: FixedClock;
  let db: DataSource;

  beforeAll(async () => {
    app = await createTestApp({ config: { nodeEnv: 'test', testNow: FIXED_NOW } });
    clock = app.get(FixedClock);
    db = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    clock.set(new Date(FIXED_NOW));
  });

  /** A new user signed up through the API, with the demo transactions. */
  async function newUser() {
    const { user, token } = await signUp(app);
    return { token, id: (await userIdOf(db, user.email))! };
  }

  /** Deletes every transaction of a user, with plain SQL. */
  const deleteTransactions = (userId: number) =>
    db.query('DELETE FROM transactions WHERE account_id IN (SELECT id FROM accounts WHERE user_id = ?)', [userId]);

  const get = (options: { token?: string; zone?: string; path?: string }) => {
    let req = request(app.getHttpServer()).get(options.path ?? recentPath);
    if (options.token !== undefined) req = req.set('Cookie', cookieFor(options.token));
    if (options.zone !== undefined) req = req.set('X-Time-Zone', options.zone);
    return req;
  };

  // T4: AC1, AC2, AC6 and AC8 (#11, #19, #40, #54, #74, #75, #96).
  describe('GET /api/transactions/recent', () => {
    it('answers 200 with the three lists newest first, UTC timestamps, plain cents with USD and only the contract’s keys', async () => {
      const { token } = await newUser();

      const response = await get({ token, zone: BELGRADE });

      expect(response.status).toBe(200);
      expect(recentTransactionsResponseSchema.parse(response.body)).toEqual(firstLogin);
      const body = response.body as Record<string, Record<string, unknown>[]>;
      expect(Object.keys(body)).toEqual(['all', 'revenue', 'expenses']);
      for (const row of Object.values(body).flat()) {
        expect(Object.keys(row).toSorted()).toEqual(rowKeys);
        expect(Object.keys(row.amount as object).toSorted()).toEqual(['cents', 'currency']);
        expect(row.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(row.category === null).toBe(row.direction === 'income');
      }
    });

    it('answers three empty lists before the dataset begins', async () => {
      // Signed up at the moved clock, so the session is valid then.
      clock.set(new Date('2021-12-31T10:00:00Z'));
      const { token } = await newUser();

      const response = await get({ token, zone: BELGRADE });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ all: [], revenue: [], expenses: [] });
    });

    it('answers 401 without a session', async () => {
      const response = await get({ zone: BELGRADE });

      expect(response.status).toBe(401);
      expect(errorResponseSchema.strict().parse(response.body).message).toBe('Authentication required');
    });

    it.each([
      ['missing', undefined],
      ['an offset, not a zone', '+01:00'],
    ])('answers 400 in the shared error shape when X-Time-Zone is %s', async (_case, zone) => {
      const { token } = await newUser();

      const response = await get({ token, zone });

      expect(response.status).toBe(400);
      expect(errorResponseSchema.strict().parse(response.body).message).toMatch(/X-Time-Zone/);
    });
  });

  // T5: AC9, each user reads only their own transactions; nothing in a request names a user, account or transaction
  // (#39, #46).
  describe('user scoping', () => {
    it('answers each user from their own rows: one user’s change leaves the other’s answer as before', async () => {
      const first = await newUser();
      const second = await newUser();
      const firstBefore = (await get({ token: first.token, zone: BELGRADE })).body as object;

      await deleteTransactions(second.id);

      expect(firstBefore).toEqual(firstLogin);
      expect((await get({ token: first.token, zone: BELGRADE })).body).toEqual(firstBefore);
      expect((await get({ token: second.token, zone: BELGRADE })).body).toEqual({ all: [], revenue: [], expenses: [] });
    });

    it('ignores a userId or an accountId in the query: the session decides', async () => {
      const first = await newUser();
      const second = await newUser();
      await deleteTransactions(first.id);
      const [{ id: secondAccount }] = await db.query<[{ id: number }]>(
        'SELECT id FROM accounts WHERE user_id = ? ORDER BY id LIMIT 1',
        [second.id],
      );

      for (const query of [`userId=${second.id}`, `accountId=${secondAccount}`]) {
        const response = await get({ token: first.token, zone: BELGRADE, path: `${recentPath}?${query}` });

        expect({ query, status: response.status, body: response.body as unknown }).toEqual({
          query,
          status: 200,
          body: { all: [], revenue: [], expenses: [] },
        });
      }
    });

    it('has no route that takes a user, account or transaction ID', async () => {
      const first = await newUser();
      const second = await newUser();
      const [{ id: transactionId, account_id: accountId }] = await db.query<[{ id: number; account_id: number }]>(
        `SELECT t.id, t.account_id FROM transactions t JOIN accounts a ON a.id = t.account_id
         WHERE a.user_id = ? ORDER BY t.id LIMIT 1`,
        [second.id],
      );

      for (const path of [
        `${recentPath}/${second.id}`,
        `${recentPath}/${accountId}`,
        `/api/transactions/${transactionId}`,
        `/api/transactions?userId=${second.id}`,
        `/api/accounts/${accountId}/transactions`,
      ]) {
        expect((await get({ token: first.token, zone: BELGRADE, path })).status, `GET ${path}`).toBe(404);
      }
    });
  });
});

const srcDir = resolve(import.meta.dirname, '../src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

// T6, AC8, AC10: the path exists once, in the contract (#74); the module reads through VisibleTransactions (#53, #77).
describe('transaction sources', () => {
  const files = sourceFiles(srcDir).map((file) => relative(srcDir, file).replaceAll('\\', '/'));
  const declaresPath = /['"`]\/transactions\b|@(Controller|Get|Post|Put|Patch|Delete)\(\s*['"`]\/?transactions\b/;

  it('never declares a transactions path outside the contract', () => {
    const offenders = files.filter((file) => declaresPath.test(readFileSync(join(srcDir, file), 'utf8')));

    expect(files).toContain('transactions/transactions.controller.ts');
    expect(offenders).toEqual([]);
  });

  it.each(["@Get('/transactions/recent')", "@Controller('transactions')", "const path = '/transactions/recent';"])(
    'flags %s',
    (code) => {
      expect(declaresPath.test(code)).toBe(true);
    },
  );

  it.each(["@Entity({ name: 'transactions' })", '@Get(transactionsContract.recent.path)'])('allows %s', (code) => {
    expect(declaresPath.test(code)).toBe(false);
  });

  it('reads transactions only through VisibleTransactions, never the provider', () => {
    const service = readFileSync(join(srcDir, 'transactions/transactions.service.ts'), 'utf8');
    const module = readFileSync(join(srcDir, 'transactions/transactions.module.ts'), 'utf8');

    expect(service).toMatch(/\bVisibleTransactions\b/);
    expect(service).not.toMatch(/\bBANK_DATA_PROVIDER\b|\bBankDataProvider\b|\bRepository\b|\bInjectRepository\b/);
    expect(module).toMatch(/\bBankDataModule\b/);
    expect(module).not.toMatch(/\bTypeOrmModule\b/);
  });
});
