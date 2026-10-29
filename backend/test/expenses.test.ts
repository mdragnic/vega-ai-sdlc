import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { errorResponseSchema, expensesBreakdownResponseSchema, expensesContract } from '@finebank/shared';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { cookieFor, signUp } from './helpers/auth.js';
import { userIdOf } from './helpers/finance.js';
import { createTestApp } from './helpers/test-app.js';

// The path comes from the contract, so a route declared anywhere else would not answer it.
const breakdownPath = `/api${expensesContract.breakdown.path}`;

const FIXED_NOW = '2026-10-22T10:00:00.000Z';
const BELGRADE = 'Europe/Belgrade';

const usd = (cents: number) => ({ cents, currency: 'USD' });
const categories = ['housing', 'food', 'transportation', 'entertainment', 'shopping', 'others'];

/** A first login on Thu 22 Oct 2026 in Belgrade: 1 to 22 Oct against all of Sep (demo-data.md; AC1). */
const firstLogin = {
  categories: [
    { category: 'housing', total: usd(25_200), change: { percent: 17, direction: 'down' } },
    { category: 'food', total: usd(51_004), change: { percent: 7, direction: 'up' } },
    { category: 'transportation', total: usd(5_320), change: { percent: 32, direction: 'down' } },
    { category: 'entertainment', total: usd(28_224), change: { percent: 16, direction: 'up' } },
    { category: 'shopping', total: usd(65_800), change: { percent: 14, direction: 'up' } },
    { category: 'others', total: usd(13_832), change: { percent: 31, direction: 'down' } },
  ],
};

/** The answer for a user with no transactions: six $0.00 with no change. */
const allZero = { categories: categories.map((category) => ({ category, total: usd(0), change: null })) };

describe('the expenses breakdown API', () => {
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
    let req = request(app.getHttpServer()).get(options.path ?? breakdownPath);
    if (options.token !== undefined) req = req.set('Cookie', cookieFor(options.token));
    if (options.zone !== undefined) req = req.set('X-Time-Zone', options.zone);
    return req;
  };

  // T6: AC1, AC6 (#11, #54, #74, #75, #96).
  describe('GET /api/expenses/breakdown', () => {
    it('answers 200 with the six categories in order, plain cents with USD, the changes and only the contract’s keys', async () => {
      const { token } = await newUser();

      const response = await get({ token, zone: BELGRADE });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(firstLogin);
      expect(expensesBreakdownResponseSchema.parse(response.body)).toEqual(firstLogin);
      const body = response.body as { categories: Record<string, Record<string, unknown>>[] };
      expect(Object.keys(body)).toEqual(['categories']);
      for (const each of body.categories) {
        expect(Object.keys(each)).toEqual(['category', 'total', 'change']);
        expect(Object.keys(each.total!)).toEqual(['cents', 'currency']);
        expect(Object.keys(each.change!)).toEqual(['percent', 'direction']);
      }
      // No transaction, account or user ID, and no last-month total, anywhere in the body.
      expect(JSON.stringify(response.body)).not.toMatch(/"(id|userId|accountId|lastMonth|transactions)"/);
    });

    it('answers six $0.00 with no change before the dataset begins', async () => {
      // Signed up at the moved clock, so the session is valid then.
      clock.set(new Date('2021-12-31T10:00:00Z'));
      const { token } = await newUser();

      const response = await get({ token, zone: BELGRADE });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(allZero);
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

  // T7: AC7, each user reads only their own sums; nothing in a request names a user, account, category or
  // transaction (#39, #46).
  describe('user scoping', () => {
    it('answers each user from their own rows: one user’s change leaves the other’s answer as before', async () => {
      const first = await newUser();
      const second = await newUser();
      const firstBefore = (await get({ token: first.token, zone: BELGRADE })).body as object;

      await deleteTransactions(second.id);

      expect(firstBefore).toEqual(firstLogin);
      expect((await get({ token: first.token, zone: BELGRADE })).body).toEqual(firstBefore);
      expect((await get({ token: second.token, zone: BELGRADE })).body).toEqual(allZero);
    });

    it('ignores a userId, an accountId or a category in the query: the session decides', async () => {
      const first = await newUser();
      const second = await newUser();
      await deleteTransactions(first.id);
      const [{ id: secondAccount }] = await db.query<[{ id: number }]>(
        'SELECT id FROM accounts WHERE user_id = ? ORDER BY id LIMIT 1',
        [second.id],
      );

      for (const query of [`userId=${second.id}`, `accountId=${secondAccount}`, 'category=shopping']) {
        const response = await get({ token: first.token, zone: BELGRADE, path: `${breakdownPath}?${query}` });

        expect({ query, status: response.status, body: response.body as unknown }).toEqual({
          query,
          status: 200,
          body: allZero,
        });
      }
    });

    it('has no route that takes a user, account, category or transaction ID', async () => {
      const first = await newUser();
      const second = await newUser();
      const [{ id: transactionId, account_id: accountId }] = await db.query<[{ id: number; account_id: number }]>(
        `SELECT t.id, t.account_id FROM transactions t JOIN accounts a ON a.id = t.account_id
         WHERE a.user_id = ? ORDER BY t.id LIMIT 1`,
        [second.id],
      );

      for (const path of [
        `${breakdownPath}/${second.id}`,
        `${breakdownPath}/${accountId}`,
        `${breakdownPath}/shopping`,
        `/api/expenses/${transactionId}`,
        `/api/expenses?userId=${second.id}`,
        `/api/accounts/${accountId}/expenses`,
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

// T8, AC6, AC8: the path exists once, in the contract (#74); the module reads through VisibleTransactions (#53, #77)
// and today through the Clock (#80).
describe('expenses sources', () => {
  const files = sourceFiles(srcDir).map((file) => relative(srcDir, file).replaceAll('\\', '/'));
  const declaresPath = /['"`]\/expenses\b|@(Controller|Get|Post|Put|Patch|Delete)\(\s*['"`]\/?expenses\b/;
  const read = (file: string) => readFileSync(join(srcDir, file), 'utf8');

  it('never declares an expenses path outside the contract', () => {
    const offenders = files.filter((file) => declaresPath.test(read(file)));

    expect(files).toContain('expenses/expenses.controller.ts');
    expect(offenders).toEqual([]);
  });

  it.each(["@Get('/expenses/breakdown')", "@Controller('expenses')", "const path = '/expenses';"])(
    'flags %s',
    (code) => {
      expect(declaresPath.test(code)).toBe(true);
    },
  );

  it('allows the contract’s path', () => {
    expect(declaresPath.test('@Get(expensesContract.breakdown.path)')).toBe(false);
  });

  it('reads transactions only through VisibleTransactions, never the provider, and today from the Clock', () => {
    const service = read('expenses/expenses.service.ts');
    const module = read('expenses/expenses.module.ts');

    expect(service).toMatch(/\bVisibleTransactions\b/);
    expect(service).toMatch(/@Inject\(CLOCK\)/);
    expect(service).not.toMatch(/\bBANK_DATA_PROVIDER\b|\bBankDataProvider\b|\bRepository\b|\bInjectRepository\b/);
    expect(module).toMatch(/\bBankDataModule\b/);
    expect(module).not.toMatch(/\bTypeOrmModule\b/);
  });

  it('calculates the change in integer arithmetic: no float rounding or division of cents', () => {
    const change = read('expenses/percent-change.ts');

    expect(change).not.toMatch(/Math\.round|toFixed|parseFloat|\/\s*100\b/);
  });
});
