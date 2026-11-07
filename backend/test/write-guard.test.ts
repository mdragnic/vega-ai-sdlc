import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import {
  authContract,
  categoryLimitsContract,
  type ContractEntry,
  profileContract,
  savingsGoalsContract,
  testClockContract,
  writeGuardMessages,
} from '@finebank/shared';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FAKE_GOOGLE_AUTHORIZE_PATH } from '../src/auth/google/fake-google-client.js';
import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { cookieFor, login as logIn, newUser, signUp } from './helpers/auth.js';
import { CapturingLogger } from './helpers/capturing-logger.js';
import { financeRows, userIdOf } from './helpers/finance.js';
import { png } from './helpers/images.js';
import { contractEntries, registeredRoutes } from './helpers/routes.js';
import { createTestApp } from './helpers/test-app.js';

const FIXED_NOW = '2026-10-22T10:00:00.000Z';
const BELGRADE = 'Europe/Belgrade';

const usd = (cents: number) => ({ cents, currency: 'USD' });

/** The public writes: no session user to compare (#119 b). */
const publicWrites = [
  'POST /api/auth/signup',
  'POST /api/auth/login',
  'POST /api/auth/logout',
  `POST /api${FAKE_GOOGLE_AUTHORIZE_PATH}`,
  'PUT /api/test/clock',
];

/** Changed by task 030: the password change is the session user's write, so it is guarded; the other auth entries are not. */
const publicEntries: ContractEntry[] = [
  ...Object.values(authContract).filter((entry) => entry !== authContract.changePassword),
  ...Object.values(testClockContract),
];

/** The contract's writes behind the session guard: every entry that is not a GET, outside auth and the test clock. */
const guardedEntries = contractEntries.filter((entry) => entry.method !== 'GET' && !publicEntries.includes(entry));

const keyOf = (entry: ContractEntry) => `${entry.method} ${entry.path}`;

/** A distinctive header value, to find in the logs if it were ever written there. */
const LOG_PROBE = 'log.probe.never.written@example.com';

describe('the write guard (#119)', () => {
  let app: INestApplication;
  let db: DataSource;
  let logger: CapturingLogger;
  /** The requester, signed up second, so its IDs are not positions. */
  let token: string;
  let email: string;
  let checkingId: number;
  let userId: number;
  /** The requester's hash as signed up: each test starts from it, so the password change knows the current one. */
  let signUpHash: string;
  /** The other user, signed up first. */
  let otherEmail: string;

  beforeAll(async () => {
    logger = new CapturingLogger();
    app = await createTestApp({ config: { nodeEnv: 'test', testNow: FIXED_NOW }, logger });
    db = app.get(DataSource);
    otherEmail = (await signUp(app)).user.email;
    const signedUp = await signUp(app);
    token = signedUp.token;
    email = signedUp.user.email;
    userId = (await userIdOf(db, email))!;
    checkingId = Number((await financeRows(db, userId)).accounts[1]!.id);
    [{ password_hash: signUpHash }] = await db.query<[{ password_hash: string }]>(
      'SELECT password_hash FROM users WHERE id = ?',
      [userId],
    );
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());

  beforeEach(async () => {
    app.get(FixedClock).set(new Date(FIXED_NOW));
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [signUpHash, userId]);
  });

  /**
   * A valid request of each guarded write, with its own path parameters (`marker` makes its stored value its own), and
   * what it stores, read in SQL.
   */
  const writes: Record<
    string,
    {
      send: (marker: number) => { path: string; body: Record<string, unknown> };
      stored: () => Promise<unknown>;
      /** The status of an accepted write: 200 unless given. */
      accepted?: number;
      /** Whether the write of `marker` is stored: the marker in `stored()` unless given. */
      holds?: (marker: number) => Promise<boolean>;
    }
  > = {
    [keyOf(savingsGoalsContract.save)]: {
      send: (marker) => ({
        path: `/api${savingsGoalsContract.save.path}`,
        body: { month: '2026-10', target: usd(marker), present: usd(0) },
      }),
      stored: () => db.query('SELECT user_id, month, target_cents, present_cents FROM savings_goals ORDER BY id'),
    },
    // Task 027: the limit save.
    [keyOf(categoryLimitsContract.save)]: {
      send: (marker) => ({
        path: `/api${categoryLimitsContract.save.path}`,
        body: { category: 'food', limit: usd(marker) },
      }),
      stored: () => db.query('SELECT user_id, category, limit_cents FROM category_limits ORDER BY id'),
    },
    'PATCH /accounts/:accountId': {
      send: (marker) => ({
        path: `/api/accounts/${checkingId}`,
        body: { bankName: `Guarded ${marker}`, branchName: 'Branch', accountType: 'savings' },
      }),
      stored: () => db.query('SELECT id, bank_name, branch_name, account_type FROM accounts ORDER BY id'),
    },
    // Task 030: the password change, JSON, 204; the new password holds when it logs in.
    [keyOf(authContract.changePassword)]: {
      send: (marker) => ({
        path: `/api${authContract.changePassword.path}`,
        body: { currentPassword: 'abcdef12', newPassword: `newpass${marker}` },
      }),
      stored: () => db.query('SELECT id, password_hash FROM users ORDER BY id'),
      accepted: 204,
      holds: async (marker) => (await logIn(app, { email, password: `newpass${marker}` })).status === 200,
    },
    // Task 028: the profile write, multipart (#76). Task 029 T12: with a photo, its file part.
    [keyOf(profileContract.update)]: {
      send: (marker) => ({
        path: `/api${profileContract.update.path}`,
        body: {
          fullName: `Guarded ${marker}`,
          username: 'guarded.user',
          phoneCountryCode: '+1',
          phoneNumber: `${marker}`,
          photo: png(),
        },
      }),
      stored: () =>
        db.query(
          `SELECT id, email, full_name, username, phone_country_code, phone_number, photo_path, photo_mime_type,
           photo_updated_at FROM users ORDER BY id`,
        ),
    },
  };

  /** Every row a guarded write could change. */
  const everything = async () => Promise.all(Object.values(writes).map((write) => write.stored()));

  /**
   * A guarded write in its entry's encoding: JSON, or each body key a text part (task 028, `encoding: 'multipart'`), the
   * entry's file part a file (task 029).
   */
  const send = (key: string, marker: number, expectedUser: string | null) => {
    const { path, body } = writes[key]!.send(marker);
    const method = key.split(' ')[0]!.toLowerCase() as 'put' | 'patch';
    let req = request(app.getHttpServer())[method](path).set('Cookie', cookieFor(token)).set('X-Time-Zone', BELGRADE);
    if (expectedUser !== null) req = req.set('X-Expected-User', expectedUser);
    const entry = guardedEntries.find((candidate) => keyOf(candidate) === key);
    if (entry?.encoding !== 'multipart') return req.send(body);
    for (const [name, value] of Object.entries(body)) {
      req = Buffer.isBuffer(value) ? req.attach(name, value, 'photo') : req.field(name, String(value));
    }
    return req;
  };

  // T7: AC11, one guard in the session guard covers every write behind it, with nothing per route.
  it('guards exactly the contract’s writes outside auth and the test clock: every non-GET route but the public ones', () => {
    const guarded = registeredRoutes(app).filter((route) => !route.startsWith('GET ') && !publicWrites.includes(route));
    const expected = [
      ...guardedEntries.map((entry) => `${entry.method} /api${entry.path}`),
      ...guardedEntries
        .filter((entry) => entry.path.includes(':accountId'))
        .map((entry) => `${entry.method} /api${entry.path.replace(':accountId', '{:accountId}')}`),
    ].toSorted();

    expect(guarded).toEqual(expected);
    expect(guarded).toEqual(
      expect.arrayContaining([
        'PUT /api/savings-goals',
        'PATCH /api/accounts/:accountId',
        'PUT /api/category-limits',
        'PATCH /api/profile',
        // Task 030.
        'PUT /api/auth/password',
      ]),
    );
    // A new write needs a valid request below, so it is checked like these.
    expect(Object.keys(writes).toSorted()).toEqual(guardedEntries.map(keyOf).toSorted());
  });

  describe.each(guardedEntries.map(keyOf))('%s', (key) => {
    it('answers 409 with another user’s email and stores nothing', async () => {
      const before = await everything();

      const response = await send(key, 111_111, otherEmail);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: writeGuardMessages.otherUser });
      expect(await everything()).toEqual(before);
    });

    it.each<[string, string | null]>([
      ['without the header', null],
      ['with a value that is not an email', LOG_PROBE.replace('@', ' at ')],
    ])('answers 400 %s and stores nothing', async (_case, expectedUser) => {
      const before = await everything();

      const response = await send(key, 222_222, expectedUser);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: writeGuardMessages.expectedUserInvalid });
      expect(await everything()).toEqual(before);
    });

    it.each([
      ['the session user’s email', (value: string) => value],
      ['the session user’s email in another case, with spaces', (value: string) => ` ${value.toUpperCase()} `],
    ])('answers its success with %s and stores the write', async (_case, header) => {
      const before = await everything();
      const marker = 300_000 + Math.floor(Math.random() * 1000);
      const write = writes[key]!;
      const holds =
        write.holds ?? (async (stored: number) => JSON.stringify(await write.stored()).includes(String(stored)));

      const response = await send(key, marker, header(email));

      expect(response.status).toBe(write.accepted ?? 200);
      expect(await everything()).not.toEqual(before);
      expect(await holds(marker)).toBe(true);
    });
  });

  it('answers 409 to a value that is a valid email of nobody, and never logs it', async () => {
    const response = await send(keyOf(savingsGoalsContract.save), 444_444, LOG_PROBE);

    expect(response.status).toBe(409);
  });

  // T7: AC11, the public writes answer as before without the header.
  it('answers the public writes as before without the header', async () => {
    const user = newUser();

    expect((await server().post('/api/auth/signup').send(user)).status).toBe(201);
    const login = await server()
      .post('/api/auth/login')
      .send({ ...user, keepSignedIn: false });
    expect(login.status).toBe(200);
    const cookie = String(login.headers['set-cookie']).split(';')[0]!;
    expect((await server().post('/api/auth/logout').set('Cookie', cookie)).status).toBe(204);
    expect((await server().put('/api/test/clock').send({ now: FIXED_NOW })).status).toBe(200);
    const decision = await server()
      .post(`/api${FAKE_GOOGLE_AUTHORIZE_PATH}`)
      .type('form')
      .send({ state: 'state-1', code_challenge: 'challenge-1', action: 'cancel' });
    expect(decision.status).toBe(302);
  });

  // T7: AC11, the header's value is never logged; the last test of the run, so it sees every request above.
  it('never logs a header value it was sent', () => {
    const output = logger.lines.join('\n');

    expect(output).not.toContain(LOG_PROBE);
    expect(output).not.toContain(LOG_PROBE.replace('@', ' at '));
    expect(output).not.toContain(otherEmail);
  });
});

// T8: AC11 and AC12, the stale tab in the backend: A's tab writes after another tab logged A out and signed up B.
describe('the stale tab (#110, #119)', () => {
  let app: INestApplication;
  let db: DataSource;

  beforeAll(async () => {
    app = await createTestApp({ config: { nodeEnv: 'test', testNow: FIXED_NOW } });
    db = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuses the goal PUT, the account PATCH, the limit PUT, the profile PATCH and the password PUT sent with B’s cookie and A’s email, storing nothing', async () => {
    const a = await signUp(app);
    const aId = (await userIdOf(db, a.user.email))!;
    const aChecking = Number((await financeRows(db, aId)).accounts[1]!.id);
    // Another tab of the same browser logs A out and signs up B: the browser now holds B's cookie.
    expect((await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', cookieFor(a.token))).status).toBe(
      204,
    );
    const b = await signUp(app);
    const bId = (await userIdOf(db, b.user.email))!;
    const usersRows = () => db.query('SELECT * FROM users ORDER BY id');
    const sessionRows = () => db.query('SELECT * FROM sessions ORDER BY id');
    const before = {
      a: await financeRows(db, aId),
      b: await financeRows(db, bId),
      users: await usersRows(),
      sessions: await sessionRows(),
    };
    const agent = request(app.getHttpServer());
    const fromStaleTab = (method: 'put' | 'patch', path: string) =>
      agent[method](path)
        .set('Cookie', cookieFor(b.token))
        .set('X-Time-Zone', BELGRADE)
        .set('X-Expected-User', a.user.email);

    const goal = await fromStaleTab('put', '/api/savings-goals').send({
      month: '2026-10',
      target: usd(9_999_900),
      present: usd(100),
    });
    const account = await fromStaleTab('patch', `/api/accounts/${aChecking}`).send({
      bankName: 'Stale Bank',
      branchName: 'Stale Branch',
      accountType: 'loan',
    });

    // Task 027: the limit save.
    const limit = await fromStaleTab('put', '/api/category-limits').send({ category: 'food', limit: usd(9_999_900) });
    // Task 028 T11: the profile write, multipart. Task 029 T12: with a photo, refused before its body is read.
    const profile = await fromStaleTab('patch', '/api/profile')
      .field('fullName', 'Stale Name')
      .field('username', 'stale.name')
      .field('phoneCountryCode', '+44')
      .field('phoneNumber', '123')
      .attach('photo', png(), 'photo');

    expect(goal.status).toBe(409);
    expect(account.status).toBe(409);
    expect(limit.status).toBe(409);
    expect(goal.body).toEqual({ message: 'Another user is signed in. Nothing was saved.' });
    expect(account.body).toEqual({ message: 'Another user is signed in. Nothing was saved.' });
    expect(limit.body).toEqual({ message: 'Another user is signed in. Nothing was saved.' });
    // Task 030 (AC17): the password change, refused before the body is read: no hash changed, no session deleted.
    const password = await fromStaleTab('put', '/api/auth/password').send({
      currentPassword: 'abcdef12',
      newPassword: 'stale-pass1',
    });

    expect(profile.status).toBe(409);
    expect(profile.body).toEqual({ message: 'Another user is signed in. Nothing was saved.' });
    expect(password.status).toBe(409);
    expect(password.body).toEqual({ message: 'Another user is signed in. Nothing was saved.' });
    expect({
      a: await financeRows(db, aId),
      b: await financeRows(db, bId),
      users: await usersRows(),
      sessions: await sessionRows(),
    }).toEqual(before);
    expect((await logIn(app, { email: a.user.email, password: 'abcdef12' })).status).toBe(200);
    expect((await logIn(app, { email: b.user.email, password: 'abcdef12' })).status).toBe(200);
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

// T9: AC20, the expected-user check is in one place, the session guard.
describe('the write guard in backend/src', () => {
  const guardNames = /\bEXPECTED_USER_HEADER\b|x-expected-user|\bwriteGuardMessages\b/i;

  it('is only in auth/session.guard.ts', () => {
    const files = sourceFiles(srcDir).map((file) => relative(srcDir, file).replaceAll('\\', '/'));
    const users = files.filter((file) => guardNames.test(readFileSync(join(srcDir, file), 'utf8')));

    expect(files).toContain('auth/session.guard.ts');
    expect(users).toEqual(['auth/session.guard.ts']);
  });
});
