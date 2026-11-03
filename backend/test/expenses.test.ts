import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import {
  errorResponseSchema,
  expensesBreakdownResponseSchema,
  expensesContract,
  monthlyComparisonResponseSchema,
} from '@finebank/shared';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { cookieFor, signUp } from './helpers/auth.js';
import { userIdOf } from './helpers/finance.js';
import { registeredRoutes } from './helpers/routes.js';
import { createTestApp } from './helpers/test-app.js';

// The paths come from the contract, so a route declared anywhere else would not answer them.
const breakdownPath = `/api${expensesContract.breakdown.path}`;
const monthlyPath = `/api${expensesContract.monthlyComparison.path}`;

const FIXED_NOW = '2026-10-22T10:00:00.000Z';
const BELGRADE = 'Europe/Belgrade';

const usd = (cents: number) => ({ cents, currency: 'USD' });
const categories = ['housing', 'food', 'transportation', 'entertainment', 'shopping', 'others'];

/** A line item as sent: the name, the amount and the instant in UTC ISO (every demo row at 12:00 UTC). */
const line = (item: string, cents: number, date: string) => ({
  item,
  amount: usd(cents),
  occurredAt: `${date}T12:00:00.000Z`,
});

/** A first login on Thu 22 Oct 2026 in Belgrade: 1 to 22 Oct against all of Sep with the items (demo-data.md; AC1). */
const firstLogin = {
  categories: [
    {
      category: 'housing',
      total: usd(25_200),
      change: { percent: 17, direction: 'down' },
      recent: [line('Parking', 2_016, '2026-10-14'), line('House Rent', 23_184, '2026-10-01')],
    },
    {
      category: 'food',
      total: usd(51_004),
      change: { percent: 7, direction: 'up' },
      recent: [line('Pizza', 2_464, '2026-10-20'), line('Restaurant bill', 14_784, '2026-10-18')],
    },
    {
      category: 'transportation',
      total: usd(5_320),
      change: { percent: 32, direction: 'down' },
      recent: [line('Taxi fare', 1_064, '2026-10-19'), line('Taxi fare', 1_064, '2026-10-13')],
    },
    {
      category: 'entertainment',
      total: usd(28_224),
      change: { percent: 16, direction: 'up' },
      recent: [line('Movie ticket', 1_764, '2026-10-21'), line('GTR 5', 18_816, '2026-10-17')],
    },
    {
      category: 'shopping',
      total: usd(65_800),
      change: { percent: 14, direction: 'up' },
      recent: [line('Jeans', 26_600, '2026-10-22'), line('Shirt', 32_200, '2026-10-15')],
    },
    {
      category: 'others',
      total: usd(13_832),
      change: { percent: 31, direction: 'down' },
      recent: [line('Donation', 3_192, '2026-10-11'), line('Loan installment', 10_640, '2026-10-10')],
    },
  ],
};

/** The answer for a user with no transactions: six $0.00 with no change and no item. */
const allZero = {
  categories: categories.map((category) => ({ category, total: usd(0), change: null, recent: [] })),
};

/** A month of the chart as sent. */
const month = (key: string, lastYear: number, thisYear: number | null) => ({
  month: key,
  lastYear: usd(lastYear),
  thisYear: thisYear === null ? null : usd(thisYear),
});
const monthKey = (year: number, index: number) => `${year}-${String(index + 1).padStart(2, '0')}`;

/** A first login's chart: 2025 against 2026 to 22 Oct (task 024 References; AC3). */
const lastYear = [
  199_240, 165_261, 179_972, 174_445, 197_844, 247_912, 193_421, 191_231, 180_894, 198_295, 183_411, 234_036,
];
const thisYear = [206_616, 171_383, 186_636, 180_909, 204_616, 255_026, 200_588, 198_312, 187_595, 189_380];
const firstLoginChart = {
  months: lastYear.map((value, index) => month(monthKey(2026, index), value, thisYear[index] ?? null)),
  ticks: [0, 100_000, 200_000, 300_000, 400_000].map(usd),
};

/** A user with no transactions at the fixed clock: every value $0.00, no ticks. */
const allZeroChart = {
  months: lastYear.map((_, index) => month(monthKey(2026, index), 0, index < 10 ? 0 : null)),
  ticks: null,
};

describe('the expenses API', () => {
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

  // T6: AC1, AC6 of task 018, with task 024's items (T10, AC16; #11, #54, #74, #75, #96).
  describe('GET /api/expenses/breakdown', () => {
    it('answers 200 with the six categories in order, plain cents with USD, the changes, the items and only the contract’s keys', async () => {
      // Another user signed up first, so the user's IDs never equal positions.
      await newUser();
      const { token } = await newUser();

      const response = await get({ token, zone: BELGRADE });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(firstLogin);
      expect(expensesBreakdownResponseSchema.parse(response.body)).toEqual(firstLogin);
      const body = response.body as { categories: Record<string, Record<string, unknown>>[] };
      expect(Object.keys(body)).toEqual(['categories']);
      for (const each of body.categories) {
        expect(Object.keys(each)).toEqual(['category', 'total', 'change', 'recent']);
        expect(Object.keys(each.total!)).toEqual(['cents', 'currency']);
        expect(Object.keys(each.change!)).toEqual(['percent', 'direction']);
        for (const item of each.recent as unknown as Record<string, unknown>[]) {
          expect(Object.keys(item)).toEqual(['item', 'amount', 'occurredAt']);
          expect(Object.keys(item.amount!)).toEqual(['cents', 'currency']);
        }
      }
      // No transaction, account or user ID, no last-month total, and no shop, status or receipt anywhere; an item's
      // keys are exactly the three above, so it has no category or direction either.
      expect(JSON.stringify(response.body)).not.toMatch(
        /"(id|userId|accountId|lastMonth|transactions|transactionId|shopName|status|receipt)"/,
      );
    });

    it('answers six $0.00 with no change and no item before the dataset begins', async () => {
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

  // Task 024 T10: AC3, AC4, AC16, the chart's route (#11, #54, #55, #74, #75, #96).
  describe('GET /api/expenses/monthly-comparison', () => {
    it('answers 200 with 12 months of this year, plain cents with USD, null after October, the ticks and only the contract’s keys', async () => {
      await newUser();
      const { token } = await newUser();

      const response = await get({ token, zone: BELGRADE, path: monthlyPath });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(firstLoginChart);
      expect(monthlyComparisonResponseSchema.parse(response.body)).toEqual(firstLoginChart);
      const body = response.body as { months: Record<string, unknown>[]; ticks: Record<string, unknown>[] };
      expect(Object.keys(body)).toEqual(['months', 'ticks']);
      for (const each of body.months) {
        expect(Object.keys(each)).toEqual(['month', 'lastYear', 'thisYear']);
        expect(Object.keys(each.lastYear!)).toEqual(['cents', 'currency']);
      }
      for (const tick of body.ticks) expect(Object.keys(tick)).toEqual(['cents', 'currency']);
      expect(JSON.stringify(response.body)).not.toMatch(/"(id|userId|accountId|transactions|year|category)"/);
    });

    it('answers every value $0.00 and no ticks before the dataset begins', async () => {
      clock.set(new Date('2021-12-31T10:00:00Z'));
      const { token } = await newUser();

      const response = await get({ token, zone: BELGRADE, path: monthlyPath });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        months: lastYear.map((_, index) => month(monthKey(2021, index), 0, 0)),
        ticks: null,
      });
    });

    it('answers 401 without a session', async () => {
      const response = await get({ zone: BELGRADE, path: monthlyPath });

      expect(response.status).toBe(401);
      expect(errorResponseSchema.strict().parse(response.body).message).toBe('Authentication required');
    });

    it.each([
      ['missing', undefined],
      ['an offset, not a zone', '+01:00'],
    ])('answers 400 in the shared error shape when X-Time-Zone is %s', async (_case, zone) => {
      const { token } = await newUser();

      const response = await get({ token, zone, path: monthlyPath });

      expect(response.status).toBe(400);
      expect(errorResponseSchema.strict().parse(response.body).message).toMatch(/X-Time-Zone/);
    });

    it('is one of exactly two expenses routes, both the contract’s', () => {
      const expenses = registeredRoutes(app).filter((route) => /\/api\/expenses\b/.test(route));

      expect(expenses).toEqual(['GET /api/expenses/breakdown', 'GET /api/expenses/monthly-comparison']);
    });
  });

  // T7 of task 018, task 024 T11: AC17, each user reads only their own sums and items; nothing in a request names a
  // user, account, category, period or transaction (#39, #46).
  describe('user scoping', () => {
    it('answers each user from their own rows: one user’s change leaves the other’s answers as before', async () => {
      const first = await newUser();
      const second = await newUser();
      const firstBefore = (await get({ token: first.token, zone: BELGRADE })).body as object;
      const firstChartBefore = (await get({ token: first.token, zone: BELGRADE, path: monthlyPath })).body as object;

      await deleteTransactions(second.id);

      expect(firstBefore).toEqual(firstLogin);
      expect(firstChartBefore).toEqual(firstLoginChart);
      expect((await get({ token: first.token, zone: BELGRADE })).body).toEqual(firstBefore);
      expect((await get({ token: first.token, zone: BELGRADE, path: monthlyPath })).body).toEqual(firstChartBefore);
      expect((await get({ token: second.token, zone: BELGRADE })).body).toEqual(allZero);
      expect((await get({ token: second.token, zone: BELGRADE, path: monthlyPath })).body).toEqual(allZeroChart);
    });

    it('ignores a userId, an accountId, a category, a year or a month in the query: the session decides', async () => {
      const first = await newUser();
      const second = await newUser();
      await deleteTransactions(first.id);
      const [{ id: secondAccount }] = await db.query<[{ id: number }]>(
        'SELECT id FROM accounts WHERE user_id = ? ORDER BY id LIMIT 1',
        [second.id],
      );

      for (const [path, expected] of [
        [breakdownPath, allZero],
        [monthlyPath, allZeroChart],
      ] as const) {
        for (const query of [
          `userId=${second.id}`,
          `accountId=${secondAccount}`,
          'category=shopping',
          'year=2025',
          'month=2026-09',
        ]) {
          const response = await get({ token: first.token, zone: BELGRADE, path: `${path}?${query}` });

          expect({ path, query, status: response.status, body: response.body as unknown }).toEqual({
            path,
            query,
            status: 200,
            body: expected,
          });
        }
      }
    });

    it('has no route that takes a user, account, category, period or transaction ID, and no cards route', async () => {
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
        `${monthlyPath}/2025`,
        `${monthlyPath}/${accountId}`,
        `${monthlyPath}/${second.id}`,
        '/api/expenses/categories',
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

// T8 of task 018, task 024 T12, AC18: the paths exist once, in the contract (#74); the module reads through
// VisibleTransactions (#53, #77) and today through the Clock (#80).
describe('expenses sources', () => {
  const files = sourceFiles(srcDir).map((file) => relative(srcDir, file).replaceAll('\\', '/'));
  const declaresPath = /['"`]\/expenses\b|@(Controller|Get|Post|Put|Patch|Delete)\(\s*['"`]\/?expenses\b/;
  const read = (file: string) => readFileSync(join(srcDir, file), 'utf8');

  it('never declares an expenses path outside the contract', () => {
    const offenders = files.filter((file) => declaresPath.test(read(file)));

    expect(files).toContain('expenses/expenses.controller.ts');
    expect(offenders).toEqual([]);
  });

  it.each([
    "@Get('/expenses/breakdown')",
    "@Get('/expenses/monthly-comparison')",
    "@Get('expenses/monthly-comparison')",
    "@Controller('expenses')",
    "const path = '/expenses';",
  ])('flags %s', (code) => {
    expect(declaresPath.test(code)).toBe(true);
  });

  it.each(['@Get(expensesContract.breakdown.path)', '@Get(expensesContract.monthlyComparison.path)'])(
    'allows the contract’s path: %s',
    (code) => {
      expect(declaresPath.test(code)).toBe(false);
    },
  );

  it('routes each contract path once in the controller', () => {
    const controller = read('expenses/expenses.controller.ts');

    expect(controller.match(/@Get\(expensesContract\.\w+\.path\)/g)).toEqual([
      '@Get(expensesContract.breakdown.path)',
      '@Get(expensesContract.monthlyComparison.path)',
    ]);
  });

  it('reads transactions only through VisibleTransactions, never the provider, and today from the Clock', () => {
    const service = read('expenses/expenses.service.ts');
    const module = read('expenses/expenses.module.ts');

    expect(service).toMatch(/\bVisibleTransactions\b/);
    expect(service).toMatch(/@Inject\(CLOCK\)/);
    expect(service).not.toMatch(/\bBANK_DATA_PROVIDER\b|\bBankDataProvider\b|\bRepository\b|\bInjectRepository\b/);
    expect(service).not.toMatch(/\bnew Date\(\)|Date\.now\(\)/);
    expect(module).toMatch(/\bBankDataModule\b/);
    expect(module).not.toMatch(/\bTypeOrmModule\b/);
  });

  it('reads once per answer: one VisibleTransactions.list call in the service', () => {
    const service = read('expenses/expenses.service.ts');

    expect(service.match(/visibleTransactions\.list\(/g)).toHaveLength(1);
  });

  it('calculates the change in integer arithmetic: no float rounding or division of cents', () => {
    const change = read('expenses/percent-change.ts');

    expect(change).not.toMatch(/Math\.round|toFixed|parseFloat|\/\s*100\b/);
  });
});
