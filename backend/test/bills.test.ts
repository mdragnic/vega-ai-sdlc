import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { billsContract, errorResponseSchema, upcomingBillsResponseSchema } from '@finebank/shared';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { cookieFor, signUp } from './helpers/auth.js';
import { userIdOf } from './helpers/finance.js';
import { createTestApp } from './helpers/test-app.js';

// The path comes from the contract, so a route declared anywhere else would not answer it.
const upcomingPath = `/api${billsContract.upcoming.path}`;

const FIXED_NOW = '2026-10-22T10:00:00.000Z';
const BELGRADE = 'Europe/Belgrade';
const NEW_YORK = 'America/New_York';

const usd = (cents: number) => ({ cents, currency: 'USD' });

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

describe('the upcoming bills API', () => {
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

  /** A new user signed up through the API, with the demo bills. */
  async function newUser() {
    const { user, token } = await signUp(app);
    return { token, id: (await userIdOf(db, user.email))! };
  }

  const get = (options: { token?: string; zone?: string; path?: string }) => {
    let req = request(app.getHttpServer()).get(options.path ?? upcomingPath);
    if (options.token !== undefined) req = req.set('Cookie', cookieFor(options.token));
    if (options.zone !== undefined) req = req.set('X-Time-Zone', options.zone);
    return req;
  };

  /** Every bill row of a user, read with plain SQL. */
  const billRows = (userId: number) =>
    db.query<Record<string, unknown>[]>('SELECT * FROM bills WHERE user_id = ? ORDER BY id', [userId]);

  // T4: AC1, AC2, AC4, AC5 and AC7 (#11, #28, #41, #54, #74, #75, #96).
  describe('GET /api/bills/upcoming', () => {
    it('answers 200 with every upcoming bill soonest first, in integer cents with USD, and only the contract’s keys', async () => {
      const { token } = await newUser();

      const response = await get({ token, zone: BELGRADE });

      expect(response.status).toBe(200);
      expect(upcomingBillsResponseSchema.parse(response.body)).toEqual({
        bills: [figma(2027), adobe(2027), figma(2028), adobe(2028)],
      });
      const body = response.body as { bills: Record<string, unknown>[] };
      expect(Object.keys(body)).toEqual(['bills']);
      for (const bill of body.bills) {
        expect(Object.keys(bill).toSorted()).toEqual(['amount', 'dueDate', 'lastChargeDate', 'logo', 'title']);
        expect(Object.keys(bill.amount as object).toSorted()).toEqual(['cents', 'currency']);
      }
    });

    it.each([
      [BELGRADE, [adobe(2027), figma(2028), adobe(2028)]],
      [NEW_YORK, [figma(2027), adobe(2027), figma(2028), adobe(2028)]],
    ])('at 2027-05-15T22:30:00Z in %s answers the bills from today in that zone', async (zone, bills) => {
      // Signed up at the moved clock, so the session is valid then.
      clock.set(new Date('2027-05-15T22:30:00Z'));
      const { token } = await newUser();

      const response = await get({ token, zone });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ bills });
    });

    it.each([
      ['2028-06-01T10:00:00Z', [adobe(2028)]],
      ['2028-06-17T10:00:00Z', []],
    ])('at %s answers the bills still upcoming', async (now, bills) => {
      clock.set(new Date(now));
      const { token } = await newUser();

      expect((await get({ token, zone: BELGRADE })).body).toEqual({ bills });
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

  // T5: AC8, each user reads only their own bills; nothing in a request names a user or a bill (#39, #46).
  describe('user scoping', () => {
    it('answers each user from their own rows: one user’s change leaves the other’s answer as before', async () => {
      const first = await newUser();
      const second = await newUser();
      const firstBefore = (await get({ token: first.token, zone: BELGRADE })).body as object;

      await db.query('DELETE FROM bills WHERE user_id = ?', [second.id]);

      expect((await get({ token: first.token, zone: BELGRADE })).body).toEqual(firstBefore);
      expect((await get({ token: second.token, zone: BELGRADE })).body).toEqual({ bills: [] });
    });

    it('ignores a userId in the query: the session decides', async () => {
      const first = await newUser();
      const second = await newUser();
      await db.query('DELETE FROM bills WHERE user_id = ?', [first.id]);

      const response = await get({ token: first.token, zone: BELGRADE, path: `${upcomingPath}?userId=${second.id}` });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ bills: [] });
    });

    it('has no route that takes a user or a bill ID', async () => {
      const first = await newUser();
      const second = await newUser();
      const [secondBill] = await billRows(second.id);

      for (const path of [
        `${upcomingPath}/${second.id}`,
        `${upcomingPath}/${String(secondBill!.id)}`,
        `/api/bills/${String(secondBill!.id)}`,
        `/api/bills?userId=${second.id}`,
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

// T6, AC7: the path exists once, in the contract (#74).
describe('bill sources', () => {
  const declaresPath = /['"`]\/bills\b|@(Controller|Get|Post|Put|Patch|Delete)\(\s*['"`]\/?bills\b/;

  it('never declares a bills path outside the contract', () => {
    const files = sourceFiles(srcDir).map((file) => relative(srcDir, file).replaceAll('\\', '/'));
    const offenders = files.filter((file) => declaresPath.test(readFileSync(join(srcDir, file), 'utf8')));

    expect(files).toContain('bills/bills.controller.ts');
    expect(offenders).toEqual([]);
  });

  it.each(["@Get('/bills/upcoming')", "@Controller('bills')", "const path = '/bills/upcoming';"])(
    'flags %s',
    (code) => {
      expect(declaresPath.test(code)).toBe(true);
    },
  );

  it.each(["@Entity({ name: 'bills' })", '@Get(billsContract.upcoming.path)'])('allows %s', (code) => {
    expect(declaresPath.test(code)).toBe(false);
  });
});
