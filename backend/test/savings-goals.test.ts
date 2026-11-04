import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import {
  errorResponseSchema,
  goalMessages,
  savingsGoalMonthsResponseSchema,
  savingsGoalResponseSchema,
  savingsGoalsContract,
  writeGuardMessages,
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
const currentPath = `/api${savingsGoalsContract.current.path}`;
const savePath = `/api${savingsGoalsContract.save.path}`;
const monthsPath = `/api${savingsGoalsContract.months.path}`;

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

/** The 12 months of a year, newest first. */
const yearDown = (year: number) =>
  ['12', '11', '10', '09', '08', '07', '06', '05', '04', '03', '02', '01'].map((month) => `${year}-${month}`);

/** The 58 months at the fixed clock, written out: `2026-10` down to `2022-01` (#123 a, demo-data.md). */
const demoMonths = [
  ...yearDown(2026).slice(2),
  ...yearDown(2025),
  ...yearDown(2024),
  ...yearDown(2023),
  ...yearDown(2022),
];

/** A one-month read's path with its query. */
const monthPath = (query: string) => `${savePath}?${query}`;

/** A save of a month with the amounts AC11 sends. */
const saveOf = (month: string) => ({ month, target: usd(2_500_050), present: usd(1_200_000) });

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

  /** Each signed-up session's email, which every write sends as `X-Expected-User` (task 022, #119). */
  const emails = new Map<string, string>();

  /** A new user signed up through the API, with the demo goals. */
  async function newUser() {
    const { user, token } = await signUp(app);
    emails.set(token, user.email);
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
    if (options.token !== undefined) {
      req = req.set('Cookie', cookieFor(options.token)).set('X-Expected-User', emails.get(options.token)!);
    }
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

    // Task 025 (#123 b, which updates #108 d): October is a past month at 00:30 on 1 Nov in Belgrade, so it is saved.
    it('saves October at 00:30 on 1 Nov in Belgrade, the month the popup opened with, and nothing else', async () => {
      const { token, id } = await newUser();
      const before = await goalRows(id);
      clock.set(new Date('2026-10-31T23:30:00Z'));

      const response = await put(validBody, { token, zone: BELGRADE });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        month: '2026-10',
        goal: { target: usd(2_500_050), present: usd(0), progress: 0 },
      });
      expect(await goalRows(id)).toEqual(
        before.map((row) => (row.month === '2026-10' ? { ...row, target_cents: 2_500_050, present_cents: 0 } : row)),
      );
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

  /** Adds an expense to the user's first account at an instant, with plain SQL. */
  async function addTransaction(userId: number, instant: string) {
    const [first] = await db.query<{ id: number }[]>('SELECT id FROM accounts WHERE user_id = ? ORDER BY id LIMIT 1', [
      userId,
    ]);
    await db.query(
      `INSERT INTO transactions (account_id, occurred_at, direction, status, category, item, shop_name, receipt, amount_cents)
       VALUES (?, ?, 'expense', 'complete', 'food', 'Added row', 'Pizza Hit', 'Ab3dE5gH9jK', 1000)`,
      [first!.id, new Date(instant).toISOString().replace('T', ' ').replace('Z', '')],
    );
  }

  // Task 025 T8: AC3, AC5 and AC14 (#54, #60, #74, #75, #123 a).
  describe('GET /api/savings-goals/months', () => {
    it('answers 200 with the 58 months from 2026-10 to 2022-01, newest first, and only the contract’s keys', async () => {
      const { token } = await newUser();

      const response = await get({ token, zone: BELGRADE, path: monthsPath });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ months: demoMonths });
      expect(Object.keys(response.body as object)).toEqual(['months']);
      expect(savingsGoalMonthsResponseSchema.parse(response.body).months).toHaveLength(58);
    });

    it.each([
      [BELGRADE, ['2026-11', ...demoMonths]],
      [NEW_YORK, demoMonths],
    ])('at 2026-10-31T23:30:00Z in %s starts at the current month there', async (zone, months) => {
      const { token } = await newUser();
      clock.set(new Date('2026-10-31T23:30:00Z'));

      expect((await get({ token, zone, path: monthsPath })).body).toEqual({ months });
    });

    it('ends at 2021-12 in New York and at 2022-01 in Belgrade with a row at 2021-12-31T23:30:00Z', async () => {
      const { token, id } = await newUser();
      await addTransaction(id, '2021-12-31T23:30:00Z');

      expect((await get({ token, zone: NEW_YORK, path: monthsPath })).body).toEqual({
        months: [...demoMonths, '2021-12'],
      });
      expect((await get({ token, zone: BELGRADE, path: monthsPath })).body).toEqual({ months: demoMonths });
    });

    it('answers 401 without a session', async () => {
      const response = await get({ zone: BELGRADE, path: monthsPath });

      expect(response.status).toBe(401);
      expect(errorResponseSchema.strict().parse(response.body).message).toBe('Authentication required');
    });

    it.each([
      ['missing', undefined],
      ['an offset, not a zone', '+01:00'],
    ])('answers 400 in the shared error shape when X-Time-Zone is %s', async (_case, zone) => {
      const { token } = await newUser();

      const response = await get({ token, zone, path: monthsPath });

      expect(response.status).toBe(400);
      expect(errorResponseSchema.strict().parse(response.body).message).toMatch(/X-Time-Zone/);
    });
  });

  // Task 025 T9: AC4 and AC15 (#39, #74, #85, #123 b).
  describe('GET /api/savings-goals?month=', () => {
    it.each([
      ['2026-03', usd(1_100_000), 0.55],
      ['2025-12', usd(2_100_000), 1],
      ['2026-10', usd(1_625_000), 0.8125],
    ])(
      'answers 200 with the demo goal of %s, as `current` answers, only the contract’s keys',
      async (month, present, progress) => {
        const { token } = await newUser();

        const response = await get({ token, zone: BELGRADE, path: monthPath(`month=${month}`) });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ month, goal: { target: usd(2_000_000), present, progress } });
        expect(savingsGoalResponseSchema.strict().parse(response.body)).toEqual(response.body);
      },
    );

    it('answers goal: null for a month in the list without a row', async () => {
      const { token, id } = await newUser();
      await db.query('DELETE FROM savings_goals WHERE user_id = ? AND month = ?', [id, '2026-03']);

      const response = await get({ token, zone: BELGRADE, path: monthPath('month=2026-03') });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ month: '2026-03', goal: null });
    });

    it.each([
      ['no month', ''],
      ['a month without its zero', 'month=2026-1'],
      ['a month that does not exist', 'month=2026-13'],
      ['a repeated month', 'month=2026-03&month=2026-04'],
    ])('answers 400 in the shared error shape for %s', async (_case, query) => {
      const { token } = await newUser();

      const response = await get({ token, zone: BELGRADE, path: monthPath(query) });

      expect(response.status).toBe(400);
      const body = errorResponseSchema.strict().parse(response.body);
      expect(body.fieldErrors).toEqual({ month: expect.any(String) as unknown });
      expect(JSON.stringify(body)).not.toMatch(/SELECT|sqlite|stack|Error:/i);
    });

    it.each([
      ['a future month with a demo goal', '2027-05'],
      ['the next month', '2026-11'],
      ['the month before the earliest', '2021-12'],
    ])('answers 409 with the #123 b message and no goal for %s', async (_case, month) => {
      const { token } = await newUser();

      const response = await get({ token, zone: BELGRADE, path: monthPath(`month=${month}`) });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: goalMessages.monthUnavailable });
    });

    it('answers the session user’s goal whatever userId the query names', async () => {
      const other = await newUser();
      await db.query('UPDATE savings_goals SET present_cents = 7 WHERE user_id = ? AND month = ?', [
        other.id,
        '2026-03',
      ]);
      const { token } = await newUser();

      const response = await get({ token, zone: BELGRADE, path: monthPath(`month=2026-03&userId=${other.id}`) });

      expect(response.status).toBe(200);
      expect(savingsGoalResponseSchema.parse(response.body).goal?.present).toEqual(usd(1_100_000));
    });

    it('answers 401 without a session', async () => {
      const response = await get({ zone: BELGRADE, path: monthPath('month=2026-03') });

      expect(response.status).toBe(401);
      expect(errorResponseSchema.strict().parse(response.body).message).toBe('Authentication required');
    });
  });

  // Task 025 T10: AC11, AC12 and AC16, the save's month rule (#58 d, #119, #123 b).
  describe('PUT /api/savings-goals for any month the user can choose', () => {
    it('saves a past month, 2026-09: only its row changes and `current` still answers October', async () => {
      const { token, id } = await newUser();
      const before = await goalRows(id);
      const currentBefore = (await get({ token, zone: BELGRADE })).body as object;

      const response = await put(saveOf('2026-09'), { token, zone: BELGRADE });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        month: '2026-09',
        goal: { target: usd(2_500_050), present: usd(1_200_000), progress: 1_200_000 / 2_500_050 },
      });
      expect(await goalRows(id)).toEqual(
        before.map((row) =>
          row.month === '2026-09' ? { ...row, target_cents: 2_500_050, present_cents: 1_200_000 } : row,
        ),
      );
      expect((await get({ token, zone: BELGRADE })).body).toEqual(currentBefore);
      expect(currentBefore).toEqual({ month: '2026-10', goal: demoGoal });
      expect((await get({ token, zone: BELGRADE, path: `${savePath}?month=2026-09` })).body).toEqual(response.body);
    });

    it.each([
      ['a future month whose demo row stays as it was', '2026-11'],
      ['the month before the earliest, which gets no row', '2021-12'],
    ])('answers 409 with the #123 b message for %s and stores nothing', async (_case, month) => {
      const { token, id } = await newUser();
      const before = await goalRows(id);

      const response = await put(saveOf(month), { token, zone: BELGRADE });

      expect(response.status).toBe(409);
      expect(errorResponseSchema.strict().parse(response.body)).toEqual({ message: goalMessages.monthUnavailable });
      expect(await goalRows(id)).toEqual(before);
    });

    it('saves 2021-12 in New York with a row dated then there', async () => {
      const { token, id } = await newUser();
      await addTransaction(id, '2021-12-31T23:30:00Z');

      expect((await put(saveOf('2021-12'), { token, zone: BELGRADE })).status).toBe(409);
      const response = await put(saveOf('2021-12'), { token, zone: NEW_YORK });

      expect(response.status).toBe(200);
      expect(await monthRows(id, '2021-12')).toEqual([{ target_cents: 2_500_050, present_cents: 1_200_000 }]);
    });

    it.each([
      ['a past month', '2026-09'],
      ['a refused month', '2021-12'],
    ])('runs the write guard first on %s: 400 without X-Expected-User, 409 for another user', async (_case, month) => {
      const { token, id } = await newUser();
      const before = await goalRows(id);
      const send = (expectedUser?: string) => {
        let req = request(app.getHttpServer())
          .put(savePath)
          .set('Cookie', cookieFor(token))
          .set('X-Time-Zone', BELGRADE);
        if (expectedUser !== undefined) req = req.set('X-Expected-User', expectedUser);
        return req.send(saveOf(month));
      };

      const missing = await send();
      const other = await send('someone.else@example.com');

      expect([missing.status, missing.body]).toEqual([400, { message: writeGuardMessages.expectedUserInvalid }]);
      expect([other.status, other.body]).toEqual([409, { message: writeGuardMessages.otherUser }]);
      expect(await goalRows(id)).toEqual(before);
    });
  });

  // Task 025 T11, AC6 and AC16: another user's data never moves a user's months or goals (#39, #46).
  it('leaves the second user’s months and goals as they were when the first saves with the second’s userId', async () => {
    const first = await newUser();
    const second = await newUser();
    await addTransaction(first.id, '2020-02-01T12:00:00Z');
    const secondRows = await goalRows(second.id);
    const secondMonths = (await get({ token: second.token, zone: BELGRADE, path: monthsPath })).body as object;

    const response = await put({ ...saveOf('2026-09'), userId: second.id }, { token: first.token, zone: BELGRADE });

    expect(response.status).toBe(200);
    expect(await goalRows(second.id)).toEqual(secondRows);
    expect(secondMonths).toEqual({ months: demoMonths });
    expect((await get({ token: second.token, zone: BELGRADE, path: monthsPath })).body).toEqual(secondMonths);
    expect((await get({ token: second.token, zone: BELGRADE, path: `${savePath}?month=2026-09` })).body).toEqual({
      month: '2026-09',
      goal: { target: usd(2_000_000), present: usd(1_550_000), progress: 0.775 },
    });
    expect((await get({ token: first.token, zone: BELGRADE, path: monthsPath })).body).toMatchObject({
      months: expect.arrayContaining(['2020-02']) as unknown,
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
        // Task 025: the month only in the query; no path takes a month.
        `${savePath}/2026-10`,
        `${monthsPath}/2026`,
      ]) {
        expect((await get({ token: first.token, zone: BELGRADE, path })).status, `GET ${path}`).toBe(404);
        expect((await put(validBody, { token: first.token, zone: BELGRADE, path })).status, `PUT ${path}`).toBe(404);
      }
    });

    // Task 025 T12, AC14 and AC15: the four contract paths are the only savings goal routes (#74).
    it('registers exactly the contract’s four savings goal routes', () => {
      expect(registeredRoutes(app).filter((route) => route.includes('/savings-goals'))).toEqual([
        'GET /api/savings-goals',
        'GET /api/savings-goals/current',
        'GET /api/savings-goals/months',
        'PUT /api/savings-goals',
      ]);
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
