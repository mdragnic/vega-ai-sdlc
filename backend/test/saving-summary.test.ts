import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import {
  errorResponseSchema,
  goalMessages,
  savingSummaryContract,
  savingSummaryResponseSchema,
} from '@finebank/shared';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { cookieFor, signUp } from './helpers/auth.js';
import { userIdOf } from './helpers/finance.js';
import { registeredRoutes } from './helpers/routes.js';
import { createTestApp } from './helpers/test-app.js';

// The path comes from the contract, so a route declared anywhere else would not answer it.
const summaryPath = `/api${savingSummaryContract.summary.path}`;
const pathFor = (query: string) => `${summaryPath}?${query}`;

const FIXED_NOW = '2026-10-22T10:00:00.000Z';
const BELGRADE = 'Europe/Belgrade';

const usd = (cents: number) => ({ cents, currency: 'USD' });

// Task 026 T9 and T10: AC1, AC11 (#39, #46, #74, #75, #96, #123 b).
describe('GET /api/saving-summary', () => {
  let app: INestApplication;
  let clock: FixedClock;
  let db: DataSource;

  beforeAll(async () => {
    app = await createTestApp({ config: { nodeEnv: 'test', testNow: FIXED_NOW } });
    clock = app.get(FixedClock);
    db = app.get(DataSource);
    // Another user first, so IDs never equal positions.
    await signUp(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    clock.set(new Date(FIXED_NOW));
  });

  async function newUser() {
    const { user, token } = await signUp(app);
    return { token, id: (await userIdOf(db, user.email))! };
  }

  const get = (path: string, options: { token?: string; zone?: string }) => {
    let req = request(app.getHttpServer()).get(path);
    if (options.token !== undefined) req = req.set('Cookie', cookieFor(options.token));
    if (options.zone !== undefined) req = req.set('X-Time-Zone', options.zone);
    return req;
  };

  it('answers 200 with October’s days and ticks, only the contract’s keys', async () => {
    const { token } = await newUser();

    const response = await get(pathFor('month=2026-10'), { token, zone: BELGRADE });

    expect(response.status).toBe(200);
    // The body as sent, before any schema parse.
    const body = response.body as { month: string; days: Record<string, unknown>[]; ticks: unknown[] };
    expect(Object.keys(body).toSorted()).toEqual(['days', 'month', 'ticks']);
    expect(body.month).toBe('2026-10');
    expect(body.days).toHaveLength(31);
    for (const day of body.days) expect(Object.keys(day).toSorted()).toEqual(['date', 'lastMonth', 'thisMonth']);
    expect(body.days[0]).toEqual({ date: '2026-10-01', thisMonth: usd(55_216), lastMonth: usd(52_640) });
    expect(body.days[3]).toEqual({ date: '2026-10-04', thisMonth: usd(-28_336), lastMonth: usd(-24_472) });
    expect(body.days[15]).toEqual({ date: '2026-10-16', thisMonth: usd(-1_478), lastMonth: usd(-1_277) });
    expect(body.days[21]).toEqual({ date: '2026-10-22', thisMonth: usd(-26_600), lastMonth: usd(-22_344) });
    expect(body.days[22]).toEqual({ date: '2026-10-23', thisMonth: null, lastMonth: usd(-1_277) });
    expect(body.days[30]).toEqual({ date: '2026-10-31', thisMonth: null, lastMonth: null });
    expect(body.ticks).toEqual([-30_000, -15_000, 0, 15_000, 30_000, 45_000, 60_000].map(usd));
    for (const money of [body.days[0]!.thisMonth, body.ticks[0]]) {
      expect(Object.keys(money as object).toSorted()).toEqual(['cents', 'currency']);
    }
    expect(savingSummaryResponseSchema.strict().parse(body)).toEqual(body);
  });

  it.each([
    ['no month', ''],
    ['a month without its zero', 'month=2026-1'],
    ['a month that does not exist', 'month=2026-13'],
    ['a date', 'month=2026-10-01'],
    ['a repeated month', 'month=2026-03&month=2026-04'],
  ])('answers 400 in the shared error shape for %s', async (_case, query) => {
    const { token } = await newUser();

    const response = await get(pathFor(query), { token, zone: BELGRADE });

    expect(response.status).toBe(400);
    const body = errorResponseSchema.strict().parse(response.body);
    expect(body.fieldErrors).toEqual({ month: expect.any(String) as unknown });
    expect(JSON.stringify(body)).not.toMatch(/SELECT|sqlite|stack|Error:/i);
  });

  it.each([
    ['the next month', '2026-11'],
    ['the month before the earliest', '2021-12'],
    ['a future month with demo rows', '2027-05'],
  ])('answers 409 with the #123 b message and no days for %s', async (_case, month) => {
    const { token } = await newUser();

    const response = await get(pathFor(`month=${month}`), { token, zone: BELGRADE });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: goalMessages.monthUnavailable });
  });

  it('answers 401 without a session', async () => {
    const response = await get(pathFor('month=2026-10'), { zone: BELGRADE });

    expect(response.status).toBe(401);
    expect(errorResponseSchema.strict().parse(response.body).message).toBe('Authentication required');
  });

  it.each([
    ['missing', undefined],
    ['an offset, not a zone', '+01:00'],
  ])('answers 400 in the shared error shape when X-Time-Zone is %s', async (_case, zone) => {
    const { token } = await newUser();

    const response = await get(pathFor('month=2026-10'), { token, zone });

    expect(response.status).toBe(400);
    expect(errorResponseSchema.strict().parse(response.body).message).toMatch(/X-Time-Zone/);
  });

  // AC11 (#39, #46): the session decides, whatever the query names.
  it('answers the session user’s days whatever userId the query names', async () => {
    const other = await newUser();
    const [account] = await db.query<{ id: number }[]>('SELECT id FROM accounts WHERE user_id = ? LIMIT 1', [other.id]);
    await db.query(
      `INSERT INTO transactions (account_id, occurred_at, direction, status, category, item, shop_name, receipt, amount_cents)
       VALUES (?, '2026-10-05 12:00:00.000', 'income', 'complete', NULL, 'Added row', 'Acme Ltd.', 'Ab3dE5gH9jK', 1000000)`,
      [account!.id],
    );
    const { token } = await newUser();
    const own = await get(pathFor('month=2026-10'), { token, zone: BELGRADE });

    const response = await get(pathFor(`month=2026-10&userId=${other.id}`), { token, zone: BELGRADE });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(own.body);
    expect((response.body as { days: { thisMonth: unknown }[] }).days[4]!.thisMonth).toEqual(usd(-1_478));
    const others = await get(pathFor('month=2026-10'), { token: other.token, zone: BELGRADE });
    expect((others.body as { days: { thisMonth: unknown }[] }).days[4]!.thisMonth).toEqual(usd(-1_478 + 1_000_000));
  });

  // T10: the one contract path; no path takes a month or a user.
  it('registers exactly the contract’s route and answers 404 for a month or a user in the path', async () => {
    const { token, id } = await newUser();

    expect(registeredRoutes(app).filter((route) => route.includes('/saving-summary'))).toEqual([
      'GET /api/saving-summary',
    ]);
    for (const path of [`${summaryPath}/2026-10`, `${summaryPath}/${id}`, `${summaryPath}/current`]) {
      expect((await get(path, { token, zone: BELGRADE })).status, `GET ${path}`).toBe(404);
    }
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

// T10, AC11: the path exists once, in the contract (#74).
describe('saving summary sources', () => {
  const declaresPath = /['"`]\/saving-summary\b|@(Controller|Get|Post|Put|Patch|Delete)\(\s*['"`]\/?saving-summary\b/;

  it('never declares the saving summary path outside the contract', () => {
    const files = sourceFiles(srcDir).map((file) => relative(srcDir, file).replaceAll('\\', '/'));
    const offenders = files.filter((file) => declaresPath.test(readFileSync(join(srcDir, file), 'utf8')));

    expect(files).toContain('goals/saving-summary.controller.ts');
    expect(offenders).toEqual([]);
  });

  it.each(["@Get('/saving-summary')", "@Controller('saving-summary')"])('flags %s', (code) => {
    expect(declaresPath.test(code)).toBe(true);
  });
});
