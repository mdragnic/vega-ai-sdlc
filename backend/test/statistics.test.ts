import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { errorResponseSchema, statisticsContract, weeklyComparisonResponseSchema } from '@finebank/shared';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { cookieFor, signUp } from './helpers/auth.js';
import { userIdOf } from './helpers/finance.js';
import { createTestApp } from './helpers/test-app.js';

// The path comes from the contract, so a route declared anywhere else would not answer it.
const weeklyPath = `/api${statisticsContract.weeklyComparison.path}`;

const FIXED_NOW = '2026-10-22T10:00:00.000Z';
const BELGRADE = 'Europe/Belgrade';

const usd = (cents: number) => ({ cents, currency: 'USD' });
const day = (date: string, lastWeek: number, thisWeek: number | null) => ({
  date,
  lastWeek: usd(lastWeek),
  thisWeek: thisWeek === null ? null : usd(thisWeek),
});

/** A first login on Thu 22 Oct 2026 in Belgrade (demo-data.md, "What a first login shows"; AC1). */
const firstLogin = {
  days: [
    day('2026-10-19', 5_880, 1_064),
    day('2026-10-20', 1_064, 2_464),
    day('2026-10-21', 2_016, 1_764),
    day('2026-10-22', 32_200, 26_600),
    day('2026-10-23', 1_478, null),
    day('2026-10-24', 18_816, null),
    day('2026-10-25', 14_784, null),
  ],
  ticks: [0, 10_000, 20_000, 30_000, 40_000].map(usd),
};

/** The same week with every value 0: the answer for a user with no transactions. */
const allZero = {
  days: firstLogin.days.map(({ date, thisWeek }) => day(date, 0, thisWeek === null ? null : 0)),
  ticks: null,
};

describe('the weekly comparison API', () => {
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
    let req = request(app.getHttpServer()).get(options.path ?? weeklyPath);
    if (options.token !== undefined) req = req.set('Cookie', cookieFor(options.token));
    if (options.zone !== undefined) req = req.set('X-Time-Zone', options.zone);
    return req;
  };

  // T7: AC1, AC6, AC9 (#11, #54, #55, #74, #75, #96).
  describe('GET /api/statistics/weekly-comparison', () => {
    it('answers 200 with 7 days from Monday, plain cents with USD, null after today, the ticks and only the contract’s keys', async () => {
      const { token } = await newUser();

      const response = await get({ token, zone: BELGRADE });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(firstLogin);
      expect(weeklyComparisonResponseSchema.parse(response.body)).toEqual(firstLogin);
      const body = response.body as { days: Record<string, unknown>[]; ticks: Record<string, unknown>[] };
      expect(Object.keys(body)).toEqual(['days', 'ticks']);
      for (const each of body.days) {
        expect(Object.keys(each)).toEqual(['date', 'lastWeek', 'thisWeek']);
      }
      const amounts = [...body.days.flatMap((each) => [each.lastWeek, each.thisWeek]), ...body.ticks];
      for (const money of amounts.filter((amount) => amount !== null)) {
        expect(Object.keys(money as object)).toEqual(['cents', 'currency']);
      }
    });

    it('answers every value 0 and null ticks before the dataset begins', async () => {
      // Signed up at the moved clock, so the session is valid then.
      clock.set(new Date('2021-12-31T10:00:00Z'));
      const { token } = await newUser();

      const response = await get({ token, zone: BELGRADE });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        days: [
          day('2021-12-27', 0, 0),
          day('2021-12-28', 0, 0),
          day('2021-12-29', 0, 0),
          day('2021-12-30', 0, 0),
          day('2021-12-31', 0, 0),
          day('2022-01-01', 0, null),
          day('2022-01-02', 0, null),
        ],
        ticks: null,
      });
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

  // T8: AC10, each user reads only their own sums; nothing in a request names a user, account or transaction (#39, #46).
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

    it('ignores a userId or an accountId in the query: the session decides', async () => {
      const first = await newUser();
      const second = await newUser();
      await deleteTransactions(first.id);
      const [{ id: secondAccount }] = await db.query<[{ id: number }]>(
        'SELECT id FROM accounts WHERE user_id = ? ORDER BY id LIMIT 1',
        [second.id],
      );

      for (const query of [`userId=${second.id}`, `accountId=${secondAccount}`]) {
        const response = await get({ token: first.token, zone: BELGRADE, path: `${weeklyPath}?${query}` });

        expect({ query, status: response.status, body: response.body as unknown }).toEqual({
          query,
          status: 200,
          body: allZero,
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
        `${weeklyPath}/${second.id}`,
        `${weeklyPath}/${accountId}`,
        `/api/statistics/${transactionId}`,
        `/api/statistics?userId=${second.id}`,
        `/api/accounts/${accountId}/statistics`,
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

// T9, AC9, AC11: the path exists once, in the contract (#74); the module reads through VisibleTransactions (#53, #77)
// and today through the Clock (#80).
describe('statistics sources', () => {
  const files = sourceFiles(srcDir).map((file) => relative(srcDir, file).replaceAll('\\', '/'));
  const declaresPath = /['"`]\/statistics\b|@(Controller|Get|Post|Put|Patch|Delete)\(\s*['"`]\/?statistics\b/;
  const read = (file: string) => readFileSync(join(srcDir, file), 'utf8');

  it('never declares a statistics path outside the contract', () => {
    const offenders = files.filter((file) => declaresPath.test(read(file)));

    expect(files).toContain('statistics/statistics.controller.ts');
    expect(offenders).toEqual([]);
  });

  it.each(["@Get('/statistics/weekly-comparison')", "@Controller('statistics')", "const path = '/statistics';"])(
    'flags %s',
    (code) => {
      expect(declaresPath.test(code)).toBe(true);
    },
  );

  it('allows the contract’s path', () => {
    expect(declaresPath.test('@Get(statisticsContract.weeklyComparison.path)')).toBe(false);
  });

  it('reads transactions only through VisibleTransactions, never the provider, and today from the Clock', () => {
    const service = read('statistics/statistics.service.ts');
    const module = read('statistics/statistics.module.ts');

    expect(service).toMatch(/\bVisibleTransactions\b/);
    expect(service).toMatch(/@Inject\(CLOCK\)/);
    expect(service).not.toMatch(/\bBANK_DATA_PROVIDER\b|\bBankDataProvider\b|\bRepository\b|\bInjectRepository\b/);
    expect(module).toMatch(/\bBankDataModule\b/);
    expect(module).not.toMatch(/\bTypeOrmModule\b/);
  });
});
