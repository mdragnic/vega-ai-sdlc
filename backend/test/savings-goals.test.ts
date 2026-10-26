import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { errorResponseSchema, goalMessages, savingsGoalResponseSchema, savingsGoalsContract } from '@finebank/shared';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { cookieFor, signUp } from './helpers/auth.js';
import { userIdOf } from './helpers/finance.js';
import { createTestApp } from './helpers/test-app.js';

// The paths come from the contract, so a route declared anywhere else would not answer them.
const currentPath = `/api${savingsGoalsContract.current.path}`;
const savePath = `/api${savingsGoalsContract.save.path}`;

const FIXED_NOW = '2026-10-22T10:00:00.000Z';
const BELGRADE = 'Europe/Belgrade';
const NEW_YORK = 'America/New_York';

const usd = (cents: number) => ({ cents, currency: 'USD' });

/** The demo goal of Oct 2026 (demo-data.md, "What a first login shows"). */
const demoGoal = { target: usd(2_000_000), present: usd(1_625_000), progress: 0.8125 };

/** A valid save of the current month. */
const validBody = { month: '2026-10', target: usd(2_500_050), present: usd(0) };

/** Bodies the form cannot send, with the field and the message they answer (#108 a). */
const invalidBodies: [string, Record<string, unknown>, string, string][] = [
  ['a Present below 0', { ...validBody, present: usd(-1) }, 'present', goalMessages.invalidAmount],
  ['a Target of 0', { ...validBody, target: usd(0) }, 'target', goalMessages.targetPositive],
  ['a Target below 0', { ...validBody, target: usd(-100) }, 'target', goalMessages.invalidAmount],
  ['a Target above the maximum', { ...validBody, target: usd(100_000_000_001) }, 'target', goalMessages.targetMax],
  ['a Present above the maximum', { ...validBody, present: usd(100_000_000_001) }, 'present', goalMessages.presentMax],
  ['cents that are not whole', { ...validBody, target: usd(1.5) }, 'target', goalMessages.invalidAmount],
  [
    'cents that are not a number',
    { ...validBody, target: { cents: '100', currency: 'USD' } },
    'target',
    goalMessages.invalidAmount,
  ],
  ['another currency', { ...validBody, present: { cents: 0, currency: 'EUR' } }, 'present', goalMessages.invalidAmount],
  ['no Target', { month: '2026-10', present: usd(0) }, 'target', goalMessages.invalidAmount],
  ['no Present', { month: '2026-10', target: usd(100) }, 'present', goalMessages.invalidAmount],
  ['no month', { target: usd(100), present: usd(0) }, 'month', goalMessages.invalidMonth],
  ['a month that does not exist', { ...validBody, month: '2026-13' }, 'month', goalMessages.invalidMonth],
];

describe('the savings goal API', () => {
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

  /** A new user signed up through the API, with the demo goals. */
  async function newUser() {
    const { user, token } = await signUp(app);
    return { token, id: (await userIdOf(db, user.email))! };
  }

  const get = (options: { token?: string; zone?: string; path?: string }) => {
    let req = request(app.getHttpServer()).get(options.path ?? currentPath);
    if (options.token !== undefined) req = req.set('Cookie', cookieFor(options.token));
    if (options.zone !== undefined) req = req.set('X-Time-Zone', options.zone);
    return req;
  };

  const put = (body: unknown, options: { token?: string; zone?: string; path?: string }) => {
    let req = request(app.getHttpServer()).put(options.path ?? savePath);
    if (options.token !== undefined) req = req.set('Cookie', cookieFor(options.token));
    if (options.zone !== undefined) req = req.set('X-Time-Zone', options.zone);
    return req.send(body as object);
  };

  /** Every savings goal row of a user, read with plain SQL. */
  const goalRows = (userId: number) =>
    db.query<Record<string, unknown>[]>('SELECT * FROM savings_goals WHERE user_id = ? ORDER BY id', [userId]);
  const monthRows = (userId: number, month: string) =>
    db.query<{ target_cents: number; present_cents: number }[]>(
      'SELECT target_cents, present_cents FROM savings_goals WHERE user_id = ? AND month = ?',
      [userId, month],
    );

  // T6: AC1, AC3 and AC11 (#11, #54, #58, #74, #75, #85, #96).
  describe('GET /api/savings-goals/current', () => {
    it('answers 200 with the month and the goal in integer cents with USD, and only the contract’s keys', async () => {
      const { token } = await newUser();

      const response = await get({ token, zone: BELGRADE });

      expect(response.status).toBe(200);
      expect(savingsGoalResponseSchema.parse(response.body)).toEqual({ month: '2026-10', goal: demoGoal });
      const body = response.body as { goal: Record<string, unknown> };
      expect(Object.keys(body).toSorted()).toEqual(['goal', 'month']);
      expect(Object.keys(body.goal).toSorted()).toEqual(['present', 'progress', 'target']);
      for (const money of [body.goal.target, body.goal.present]) {
        expect(Object.keys(money as object).toSorted()).toEqual(['cents', 'currency']);
      }
    });

    it.each([
      [BELGRADE, '2026-11', usd(1_700_000)],
      [NEW_YORK, '2026-10', usd(1_625_000)],
    ])('at 2026-10-31T23:30:00Z in %s answers %s', async (zone, month, present) => {
      const { token } = await newUser();
      clock.set(new Date('2026-10-31T23:30:00Z'));

      const body = savingsGoalResponseSchema.parse((await get({ token, zone })).body);

      expect(body).toEqual({ month, goal: { target: usd(2_000_000), present, progress: present.cents / 2_000_000 } });
    });

    it('answers goal: null for a month without a row', async () => {
      const { token, id } = await newUser();
      await db.query('DELETE FROM savings_goals WHERE user_id = ? AND month = ?', [id, '2026-10']);

      const response = await get({ token, zone: BELGRADE });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ month: '2026-10', goal: null });
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

  // T7: AC6, AC10 and AC12 (#11, #31, #58, #74, #85, #108).
  describe('PUT /api/savings-goals', () => {
    it('updates the month’s goal, still one row, and answers 200 with the saved goal', async () => {
      const { token, id } = await newUser();
      const before = (await goalRows(id)).length;

      const response = await put(validBody, { token, zone: BELGRADE });

      expect(response.status).toBe(200);
      expect(savingsGoalResponseSchema.strict().parse(response.body)).toEqual({
        month: '2026-10',
        goal: { target: usd(2_500_050), present: usd(0), progress: 0 },
      });
      expect(await monthRows(id, '2026-10')).toEqual([{ target_cents: 2_500_050, present_cents: 0 }]);
      expect(await goalRows(id)).toHaveLength(before);
      expect((await get({ token, zone: BELGRADE })).body).toEqual(response.body);
    });

    it('creates the month’s goal when there is none, from the request alone (#58)', async () => {
      const { token, id } = await newUser();
      await db.query('DELETE FROM savings_goals WHERE user_id = ? AND month = ?', [id, '2026-10']);

      const response = await put({ month: '2026-10', target: usd(50_000), present: usd(0) }, { token, zone: BELGRADE });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ month: '2026-10', goal: { target: usd(50_000), present: usd(0), progress: 0 } });
      expect(await monthRows(id, '2026-10')).toEqual([{ target_cents: 50_000, present_cents: 0 }]);
    });

    it('accepts the maximum Target and a Present above the Target (#31)', async () => {
      const { token } = await newUser();

      const response = await put(
        { month: '2026-10', target: usd(100_000_000_000), present: usd(100_000_000_000) },
        { token, zone: BELGRADE },
      );

      expect(response.status).toBe(200);
      expect(savingsGoalResponseSchema.parse(response.body).goal).toEqual({
        target: usd(100_000_000_000),
        present: usd(100_000_000_000),
        progress: 1,
      });
    });

    it.each(invalidBodies)(
      'answers 400 for %s, on its field, and stores nothing',
      async (_case, body, field, message) => {
        const { token, id } = await newUser();
        const before = await goalRows(id);

        const response = await put(body, { token, zone: BELGRADE });

        expect(response.status).toBe(400);
        const error = errorResponseSchema.strict().parse(response.body);
        expect(error.fieldErrors).toEqual({ [field]: message });
        expect(await goalRows(id)).toEqual(before);
      },
    );

    it('answers 409 with the #108 d text for another month and stores nothing', async () => {
      const { token, id } = await newUser();
      const before = await goalRows(id);
      // 00:30 on 1 Nov in Belgrade: the card showed October.
      clock.set(new Date('2026-10-31T23:30:00Z'));

      const response = await put(validBody, { token, zone: BELGRADE });

      expect(response.status).toBe(409);
      expect(errorResponseSchema.strict().parse(response.body)).toEqual({ message: goalMessages.monthEnded });
      expect(await goalRows(id)).toEqual(before);
    });

    it('saves October in New York at the same instant, where it is still 31 Oct', async () => {
      const { token, id } = await newUser();
      clock.set(new Date('2026-10-31T23:30:00Z'));

      const response = await put(validBody, { token, zone: NEW_YORK });

      expect(response.status).toBe(200);
      expect(await monthRows(id, '2026-10')).toEqual([{ target_cents: 2_500_050, present_cents: 0 }]);
    });

    it('answers 401 without a session and stores nothing', async () => {
      const { id } = await newUser();
      const before = await goalRows(id);

      const response = await put(validBody, { zone: BELGRADE });

      expect(response.status).toBe(401);
      expect(errorResponseSchema.strict().parse(response.body).message).toBe('Authentication required');
      expect(await goalRows(id)).toEqual(before);
    });

    it('answers 400 without a zone and stores nothing', async () => {
      const { token, id } = await newUser();
      const before = await goalRows(id);

      const response = await put(validBody, { token });

      expect(response.status).toBe(400);
      expect(errorResponseSchema.strict().parse(response.body).message).toMatch(/X-Time-Zone/);
      expect(await goalRows(id)).toEqual(before);
    });
  });

  // T9: AC13, each user changes only their own goal; nothing in a request names a user or a goal (#39, #46).
  describe('user scoping', () => {
    it('changes only the saving user’s row; the other user’s GET answers as before', async () => {
      const first = await newUser();
      const second = await newUser();
      const secondRowsBefore = await goalRows(second.id);
      const secondBefore = (await get({ token: second.token, zone: BELGRADE })).body as object;

      expect((await put(validBody, { token: first.token, zone: BELGRADE })).status).toBe(200);

      expect(await goalRows(second.id)).toEqual(secondRowsBefore);
      expect((await get({ token: second.token, zone: BELGRADE })).body).toEqual(secondBefore);
      expect(await monthRows(first.id, '2026-10')).toEqual([{ target_cents: 2_500_050, present_cents: 0 }]);
    });

    it('ignores a userId in the body and in the query: the session decides', async () => {
      const first = await newUser();
      const second = await newUser();
      const secondRowsBefore = await goalRows(second.id);

      const response = await put(
        { ...validBody, userId: second.id },
        { token: first.token, zone: BELGRADE, path: `${savePath}?userId=${second.id}` },
      );

      expect(response.status).toBe(200);
      expect(await goalRows(second.id)).toEqual(secondRowsBefore);
      expect(await monthRows(first.id, '2026-10')).toEqual([{ target_cents: 2_500_050, present_cents: 0 }]);
      const read = await get({ token: first.token, zone: BELGRADE, path: `${currentPath}?userId=${second.id}` });
      expect(savingsGoalResponseSchema.parse(read.body).goal?.target).toEqual(usd(2_500_050));
    });

    it('has no route that takes a user or a goal ID', async () => {
      const first = await newUser();
      const second = await newUser();
      const [secondGoal] = await goalRows(second.id);

      for (const path of [
        `${savePath}/${second.id}`,
        `${savePath}/${String(secondGoal!.id)}`,
        `${currentPath}/${second.id}`,
      ]) {
        expect((await get({ token: first.token, zone: BELGRADE, path })).status, `GET ${path}`).toBe(404);
        expect((await put(validBody, { token: first.token, zone: BELGRADE, path })).status, `PUT ${path}`).toBe(404);
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

// T10, AC14: the paths exist once, in the contract (#74).
describe('savings goal sources', () => {
  const declaresPath = /['"`]\/savings-goals\b|@(Controller|Get|Post|Put|Patch|Delete)\(\s*['"`]\/?savings-goals\b/;

  it('never declares a savings goal path outside the contract', () => {
    const files = sourceFiles(srcDir).map((file) => relative(srcDir, file).replaceAll('\\', '/'));
    const offenders = files.filter((file) => declaresPath.test(readFileSync(join(srcDir, file), 'utf8')));

    expect(files).toContain('goals/savings-goals.controller.ts');
    expect(offenders).toEqual([]);
  });

  it.each(["@Put('/savings-goals')", "@Controller('savings-goals')", "const path = '/savings-goals/current';"])(
    'flags %s',
    (code) => {
      expect(declaresPath.test(code)).toBe(true);
    },
  );

  it.each(["@Entity({ name: 'savings_goals' })", '@Put(savingsGoalsContract.save.path)'])('allows %s', (code) => {
    expect(declaresPath.test(code)).toBe(false);
  });
});
