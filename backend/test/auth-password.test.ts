import type { INestApplication } from '@nestjs/common';
import { authContract, errorResponseSchema, writeGuardMessages } from '@finebank/shared';
import request, { type Response, type Test } from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { PasswordHasher } from '../src/auth/password.js';
import { cookieFor, login, me, sessionCookie, setCookies, sha256Hex, signUp } from './helpers/auth.js';
import { CapturingLogger } from './helpers/capturing-logger.js';
import { financeRows } from './helpers/finance.js';
import { createTestApp } from './helpers/test-app.js';

// The path comes from the contract, so a route declared anywhere else would not answer it.
const passwordPath = `/api${authContract.changePassword.path}`;

/** The test cost of scrypt (config.ts): a new hash is stored at it. */
const TEST_COST = 2 ** 14;

/** A stored hash at the test cost: `scrypt$N$r$p$salt$key`, a 16-byte salt and a 64-byte key in base64url. */
const storedFormat = new RegExp(`^scrypt\\$${TEST_COST}\\$8\\$1\\$[A-Za-z0-9_-]{22}\\$[A-Za-z0-9_-]{86}$`);

/** The wrong-password answer of Scope, as raw text. */
const wrongPasswordBody = JSON.stringify({
  message: 'Current password is incorrect',
  fieldErrors: { currentPassword: 'Current password is incorrect' },
});

/** Browser headers of a request from another site (task 014's four sets). */
const crossSite: [string, Record<string, string>][] = [
  ['Sec-Fetch-Site: cross-site', { 'Sec-Fetch-Site': 'cross-site' }],
  ['Sec-Fetch-Site: same-site', { 'Sec-Fetch-Site': 'same-site' }],
  ['a foreign Origin without Sec-Fetch-Site', { Origin: 'http://evil.example' }],
  [
    'Sec-Fetch-Site: cross-site and an Origin that matches Host',
    { 'Sec-Fetch-Site': 'cross-site', Host: 'localhost:5173', Origin: 'http://localhost:5173' },
  ],
];

/** The bound SQL of a statement: each `?` replaced by its parameter, so a test reads the values in the text. */
function bind(sql: string, parameters: unknown): string {
  const values: unknown[] = Array.isArray(parameters) ? parameters : [];
  let index = 0;
  return sql.replace(/\?/g, () => JSON.stringify(values[index++]));
}

/** The WHERE clause of a statement. */
const whereOf = (sql: string) => /\bWHERE\b(.*?)(\bORDER BY\b|\bLIMIT\b|\bRETURNING\b|$)/is.exec(sql)?.[1] ?? '';

/** What the app's hasher did, and what it does next: see `recordHasher`. */
interface HasherRecord {
  calls: string[];
  marks?: string[];
  race?: () => Promise<unknown>;
  forceVerify?: boolean;
}

/**
 * The app's own hasher (the test cost), with every call recorded: `verify` with the stored hash it was given (`null` for
 * a user without a password) and `hash`. `race`, when set, runs once after `verify` computed its answer and before it
 * resolves: a change between the check and the write. `forceVerify` replaces the answer. `marks` takes a line per call,
 * beside the recorded SQL.
 */
function recordHasher(hasher: PasswordHasher): HasherRecord {
  const record: HasherRecord = { calls: [] };
  const hash = hasher.hash.bind(hasher);
  const verify = hasher.verify.bind(hasher);
  vi.spyOn(hasher, 'hash').mockImplementation(async (password) => {
    record.calls.push('hash');
    record.marks?.push('scrypt hash');
    return hash(password);
  });
  vi.spyOn(hasher, 'verify').mockImplementation(async (password, stored) => {
    record.calls.push(stored === null ? 'verify null' : `verify ${stored}`);
    record.marks?.push('scrypt verify');
    const answer = await verify(password, stored);
    const race = record.race;
    record.race = undefined;
    if (race) await race();
    return record.forceVerify ?? answer;
  });
  return record;
}

interface UserRow {
  id: number;
  email: string;
  full_name: string;
  username: string;
  password_hash: string | null;
}

interface SessionRow {
  id: number;
  token_hash: string;
  user_id: number;
  expires_at: string;
}

/** The requester's sign-up password (`newUser`), and a valid new one. */
const OLD = 'abcdef12';
const NEW = 'newpass99';

describe('PUT /api/auth/password', () => {
  let app: INestApplication;
  let db: DataSource;
  let hasher: HasherRecord;
  /** The requester, signed up second, so its IDs are not positions. */
  let token: string;
  let email: string;
  let userId: number;
  let originalHash: string;
  /** The other user, signed up first, with their own password and two sessions. */
  let otherEmail: string;
  let otherId: number;
  let otherTokens: string[];

  const users = (): Promise<UserRow[]> =>
    db.query(
      'SELECT id, email, full_name, username, password_hash, phone_country_code, phone_number FROM users ORDER BY id',
    );
  const allUserColumns = () => db.query<Record<string, unknown>[]>('SELECT * FROM users ORDER BY id');
  const sessions = (): Promise<SessionRow[]> =>
    db.query('SELECT id, token_hash, user_id, expires_at FROM sessions ORDER BY id');
  const hashOf = async (id: number) => (await users()).find((row) => row.id === id)!.password_hash;
  const sessionsOf = async (id: number) => (await sessions()).filter((row) => row.user_id === id);

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
    hasher = recordHasher(app.get(PasswordHasher));
    const other = await signUp(app, { fullName: 'Other Person', password: 'other-pass1' });
    otherEmail = other.user.email;
    const otherLogin = await login(app, { email: otherEmail, password: 'other-pass1' });
    otherTokens = [other.token, sessionCookie(otherLogin).value];
    const requester = await signUp(app);
    token = requester.token;
    email = requester.user.email;
    const [otherRow, requesterRow] = (await users()).slice(-2) as [UserRow, UserRow];
    otherId = otherRow.id;
    userId = requesterRow.id;
    originalHash = requesterRow.password_hash!;
  });

  beforeEach(async () => {
    // Each test starts from the requester's sign-up password and one session, the current one.
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [originalHash, userId]);
    await db.query('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?', [userId, sha256Hex(token)]);
    hasher.calls = [];
    hasher.marks = undefined;
    hasher.race = undefined;
    hasher.forceVerify = undefined;
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());

  /** `PUT /api/auth/password` with a session, the requester's email in `X-Expected-User` and `body` as JSON. */
  function put(
    body: unknown,
    options: { session?: string | null; expectedUser?: string | null; headers?: Record<string, string> } = {},
  ): Test {
    let req = server().put(passwordPath);
    const session = options.session === undefined ? token : options.session;
    const expectedUser = options.expectedUser === undefined ? email : options.expectedUser;
    if (session !== null) req = req.set('Cookie', cookieFor(session));
    if (expectedUser !== null) req = req.set('X-Expected-User', expectedUser);
    if (options.headers) req = req.set(options.headers);
    return req.send(body as object);
  }

  /** Two more sessions of the requester, other browsers: their tokens. */
  async function otherBrowsers(): Promise<string[]> {
    const tokens: string[] = [];
    for (let i = 0; i < 2; i += 1) {
      tokens.push(sessionCookie(await login(app, { email, password: OLD })).value);
    }
    return tokens;
  }

  /** The SQL the data source runs while `run` runs, each statement bound, the hasher's calls among them. */
  async function recordSql(run: () => Promise<unknown>) {
    const statements: string[] = [];
    hasher.marks = statements;
    const logQuery = vi.spyOn(db.logger, 'logQuery').mockImplementation((sql, parameters) => {
      statements.push(bind(sql, parameters));
    });
    try {
      await run();
    } finally {
      logQuery.mockRestore();
      hasher.marks = undefined;
    }
    return statements;
  }

  /** Everything a change could touch but the requester's hash and other sessions. */
  async function untouched() {
    return {
      otherUser: (await allUserColumns()).filter((row) => row.id !== userId),
      requester: (await allUserColumns())
        .filter((row) => row.id === userId)
        .map((row) => Object.fromEntries(Object.entries(row).filter(([column]) => column !== 'password_hash'))),
      otherSessions: await sessionsOf(otherId),
      finance: [await financeRows(db, userId), await financeRows(db, otherId)],
    };
  }

  // T2: AC7, AC10, AC12, a valid change: only the hash, the current session kept, the others gone (#129 a).
  describe('a valid change', () => {
    it('answers 204 with no body, no cookie and no-store, and stores a new hash of the new password only', async () => {
      const others = await otherBrowsers();
      const before = await untouched();
      const current = (await sessionsOf(userId)).find((row) => row.token_hash === sha256Hex(token))!;

      const response = await put({ currentPassword: OLD, newPassword: NEW });

      expect(response.status).toBe(204);
      expect(response.text).toBe('');
      expect(setCookies(response)).toEqual([]);
      expect(response.headers['cache-control']).toBe('no-store');
      const stored = await hashOf(userId);
      expect(stored).toMatch(storedFormat);
      expect(stored).not.toBe(originalHash);
      expect(await untouched()).toEqual(before);
      // The current session's row is the same row, expiry included; the other two are gone.
      expect(await sessionsOf(userId)).toEqual([current]);
      expect((await me(app, token)).status).toBe(200);
      for (const other of others) expect((await me(app, other)).status).toBe(401);
      for (const other of otherTokens) expect((await me(app, other)).status).toBe(200);
    });

    it('lets the new password log in and refuses the old one with "Email or password is incorrect"', async () => {
      expect((await put({ currentPassword: OLD, newPassword: NEW })).status).toBe(204);

      const old = await login(app, { email, password: OLD });
      const fresh = await login(app, { email, password: NEW });

      expect(old.status).toBe(401);
      expect(old.body).toEqual({ message: 'Email or password is incorrect' });
      expect(fresh.status).toBe(200);
      expect((await login(app, { email: otherEmail, password: 'other-pass1' })).status).toBe(200);
    });

    it.each([
      ['exactly 8 characters', 'abcdefg1'],
      ['exactly 128 characters', `a1${'x'.repeat(126)}`],
      ['Šifra123', 'Šifra123'],
    ])('stores a new password of %s exactly as typed', async (_case, newPassword) => {
      expect((await put({ currentPassword: OLD, newPassword })).status).toBe(204);

      expect((await login(app, { email, password: newPassword })).status).toBe(200);
    });

    it('stores a new password with spaces around and inside untrimmed: only the spaced one logs in', async () => {
      expect((await put({ currentPassword: OLD, newPassword: '  my pass 1  ' })).status).toBe(204);

      expect((await login(app, { email, password: '  my pass 1  ' })).status).toBe(200);
      expect((await login(app, { email, password: 'my pass 1' })).status).toBe(401);
    });

    it('verifies the current password before hashing the new one', async () => {
      expect((await put({ currentPassword: OLD, newPassword: NEW })).status).toBe(204);

      expect(hasher.calls).toEqual([`verify ${originalHash}`, 'hash']);
    });

    it('drops extra keys: another user’s ID and email, a hash and the retype change nothing but the requester’s hash', async () => {
      const before = await untouched();

      const response = await put({
        currentPassword: OLD,
        newPassword: NEW,
        userId: otherId,
        email: otherEmail,
        passwordHash: 'scrypt$16384$8$1$AAAA$BBBB',
        retypePassword: 'something-else-1',
      });

      expect(response.status).toBe(204);
      expect(await untouched()).toEqual(before);
      expect(await hashOf(userId)).toMatch(storedFormat);
      expect((await login(app, { email, password: NEW })).status).toBe(200);
      expect((await login(app, { email: otherEmail, password: 'other-pass1' })).status).toBe(200);
    });
  });

  // T3: AC3, AC8, AC10, a wrong current password, and a Google-only user: one verification, nothing stored.
  describe('a current password that does not match', () => {
    it('answers the wrong-password 400 after one verify and no hash, storing nothing and ending no session', async () => {
      const others = await otherBrowsers();
      const before = { users: await allUserColumns(), sessions: await sessions() };
      // The two logins above verified passwords too.
      hasher.calls = [];

      const response = await put({ currentPassword: 'wrong-pass1', newPassword: NEW });

      expect(response.status).toBe(400);
      expect(response.text).toBe(wrongPasswordBody);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(setCookies(response)).toEqual([]);
      expect(hasher.calls).toEqual([`verify ${originalHash}`]);
      expect({ users: await allUserColumns(), sessions: await sessions() }).toEqual(before);
      for (const other of others) expect((await me(app, other)).status).toBe(200);
    });

    it('gives a Google-only user the same 400 after one verify against the dummy hash, storing nothing', async () => {
      await db.query('UPDATE users SET password_hash = NULL WHERE id = ?', [userId]);
      const before = { users: await allUserColumns(), sessions: await sessions() };

      const response = await put({ currentPassword: OLD, newPassword: NEW });

      expect(response.status).toBe(400);
      expect(response.text).toBe(wrongPasswordBody);
      expect(hasher.calls).toEqual(['verify null']);
      expect({ users: await allUserColumns(), sessions: await sessions() }).toEqual(before);
    });

    it('refuses a Google-only user even when the verification would say yes: no hash to compare and set', async () => {
      await db.query('UPDATE users SET password_hash = NULL WHERE id = ?', [userId]);
      hasher.forceVerify = true;
      const before = { users: await allUserColumns(), sessions: await sessions() };

      const response = await put({ currentPassword: OLD, newPassword: NEW });

      expect(response.status).toBe(400);
      expect(response.text).toBe(wrongPasswordBody);
      expect({ users: await allUserColumns(), sessions: await sessions() }).toEqual(before);
    });
  });

  // T4: AC8, AC10, the stored hash changes between the check and the write: compare and set; no transaction while scrypt
  // runs.
  describe('a change between the check and the write', () => {
    it('answers the wrong-password 400 and keeps the hash another change stored meanwhile', async () => {
      const others = await otherBrowsers();
      const elsewhere = await app.get(PasswordHasher).hash('changed-elsewhere1');
      hasher.race = () => db.query('UPDATE users SET password_hash = ? WHERE id = ?', [elsewhere, userId]);
      const sessionsBefore = await sessions();

      const response = await put({ currentPassword: OLD, newPassword: NEW });

      expect(response.status).toBe(400);
      expect(response.text).toBe(wrongPasswordBody);
      expect(await hashOf(userId)).toBe(elsewhere);
      expect(await sessions()).toEqual(sessionsBefore);
      for (const other of others) expect((await me(app, other)).status).toBe(200);
    });

    it('answers the wrong-password 400 to a Google takeover meanwhile (#104), leaving the user Google-only', async () => {
      const [kept] = await otherBrowsers();
      hasher.race = async () => {
        await db.query('UPDATE users SET password_hash = NULL WHERE id = ?', [userId]);
        await db.query('DELETE FROM sessions WHERE user_id = ? AND token_hash NOT IN (?, ?)', [
          userId,
          sha256Hex(token),
          sha256Hex(kept!),
        ]);
      };

      const response = await put({ currentPassword: OLD, newPassword: NEW });
      const sessionsAfterRace = await sessionsOf(userId);

      expect(response.status).toBe(400);
      expect(response.text).toBe(wrongPasswordBody);
      expect(await hashOf(userId)).toBeNull();
      expect(sessionsAfterRace.map((row) => row.token_hash).toSorted()).toEqual(
        [sha256Hex(token), sha256Hex(kept!)].toSorted(),
      );
    });

    it('runs both scrypt calls before the transaction, then one UPDATE on the ID and the verified hash and one DELETE of the other sessions', async () => {
      await otherBrowsers();

      const statements = await recordSql(async () => {
        expect((await put({ currentPassword: OLD, newPassword: NEW })).status).toBe(204);
      });

      const begin = statements.findIndex((sql) => /^BEGIN\b/i.test(sql));
      const commit = statements.findIndex((sql) => /^COMMIT\b/i.test(sql));
      expect(begin).toBeGreaterThan(statements.indexOf('scrypt verify'));
      expect(begin).toBeGreaterThan(statements.indexOf('scrypt hash'));
      expect(statements.indexOf('scrypt verify')).toBeLessThan(statements.indexOf('scrypt hash'));
      expect(statements.filter((sql) => /^BEGIN\b/i.test(sql))).toHaveLength(1);
      const updates = statements.filter((sql) => /^UPDATE\b/i.test(sql));
      expect(updates).toHaveLength(1);
      expect(updates[0]).toMatch(/^UPDATE "users" SET "password_hash" = "scrypt\$/);
      const where = whereOf(updates[0]!);
      expect(where).toContain(`"id" = ${userId}`);
      expect(where).toContain(`"password_hash" = ${JSON.stringify(originalHash)}`);
      const deletes = statements.filter((sql) => /^DELETE\b/i.test(sql));
      expect(deletes).toHaveLength(1);
      expect(deletes[0]).toMatch(/^DELETE FROM "sessions"/);
      expect(whereOf(deletes[0]!)).toContain(`"user_id" = ${userId}`);
      expect(whereOf(deletes[0]!)).toContain(JSON.stringify(sha256Hex(token)));
      const write = statements.indexOf(updates[0]!);
      const remove = statements.indexOf(deletes[0]!);
      expect(begin).toBeLessThan(write);
      expect(write).toBeLessThan(remove);
      expect(remove).toBeLessThan(commit);
    });
  });

  // T5: AC11, the rules over HTTP: 400 with each field's one message, nothing stored and no scrypt run.
  describe('a body that breaks a rule', () => {
    const text = {
      required: 'Password is required',
      max: 'Password must be at most 128 characters',
      min: 'Password must be at least 8 characters',
      letterAndNumber: 'Password must contain at least one letter and one number',
      same: 'New password must be different from the old password',
    };

    it.each<[string, unknown, Record<string, string>]>([
      ['a new password of 7 characters', { currentPassword: OLD, newPassword: 'abcdef1' }, { newPassword: text.min }],
      [
        'a new password without a number',
        { currentPassword: OLD, newPassword: 'abcdefgh' },
        { newPassword: text.letterAndNumber },
      ],
      [
        'a new password without a letter',
        { currentPassword: OLD, newPassword: '12345678' },
        { newPassword: text.letterAndNumber },
      ],
      [
        'a new password of 129 characters',
        { currentPassword: OLD, newPassword: `a1${'x'.repeat(127)}` },
        { newPassword: text.max },
      ],
      [
        'a new password equal to the current one',
        { currentPassword: OLD, newPassword: OLD },
        { newPassword: text.same },
      ],
      ['an empty new password', { currentPassword: OLD, newPassword: '' }, { newPassword: text.required }],
      ['an empty current password', { currentPassword: '', newPassword: NEW }, { currentPassword: text.required }],
      [
        'a current password of 129 characters',
        { currentPassword: 'x'.repeat(129), newPassword: NEW },
        { currentPassword: text.max },
      ],
      ['no current password', { newPassword: NEW }, { currentPassword: text.required }],
      ['no new password', { currentPassword: OLD }, { newPassword: text.required }],
      ['an empty body', {}, { currentPassword: text.required, newPassword: text.required }],
    ])('answers 400 to %s with its one message, before any scrypt run', async (_case, body, fieldErrors) => {
      const before = { users: await allUserColumns(), sessions: await sessions() };

      const response = await put(body);

      expect(response.status).toBe(400);
      expect(JSON.parse(response.text)).toEqual({ message: 'Validation failed', fieldErrors });
      expect(hasher.calls).toEqual([]);
      expect({ users: await allUserColumns(), sessions: await sessions() }).toEqual(before);
    });

    it.each([
      ['a number', 12345678],
      ['null', null],
      ['an array', [NEW]],
    ])('answers 400 under newPassword to a new password that is %s', async (_case, newPassword) => {
      const response = await put({ currentPassword: OLD, newPassword });

      expect(response.status).toBe(400);
      expect(Object.keys(errorResponseSchema.parse(response.body).fieldErrors ?? {})).toEqual(['newPassword']);
      expect(hasher.calls).toEqual([]);
      expect(await hashOf(userId)).toBe(originalHash);
    });

    it('answers 400 in the shared shape to a JSON array, before any scrypt run', async () => {
      const response = await put([OLD, NEW]);

      expect(response.status).toBe(400);
      expect(errorResponseSchema.strict().safeParse(response.body).success).toBe(true);
      expect(hasher.calls).toEqual([]);
      expect(await hashOf(userId)).toBe(originalHash);
    });
  });

  // T6: AC11, the order: CSRF 403, then 401, then the guard's 400 or 409, then the schema's 400, then the verification.
  describe('the checks before the change', () => {
    const valid = { currentPassword: OLD, newPassword: NEW };

    it('answers 401 without a session, with no scrypt run', async () => {
      const response = await put(valid, { session: null });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ message: 'Authentication required' });
      expect(hasher.calls).toEqual([]);
      expect(await hashOf(userId)).toBe(originalHash);
    });

    it.each(crossSite)('answers 403 to a request from another site (%s), changing nothing', async (_case, headers) => {
      const response = await put(valid, { headers });

      expect(response.status).toBe(403);
      expect(hasher.calls).toEqual([]);
      expect(await hashOf(userId)).toBe(originalHash);
    });

    it('answers 400 without X-Expected-User and with a value that is not an email', async () => {
      const missing = await put(valid, { expectedUser: null });
      const notEmail = await put(valid, { expectedUser: 'not-an-email' });

      for (const response of [missing, notEmail]) {
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: writeGuardMessages.expectedUserInvalid });
      }
      expect(hasher.calls).toEqual([]);
      expect(await hashOf(userId)).toBe(originalHash);
    });

    it('answers 409 with another user’s email, reading nothing of users but the guard’s email and running no scrypt', async () => {
      let response: Response | undefined;
      const statements = await recordSql(async () => {
        response = await put(valid, { expectedUser: otherEmail });
      });

      expect(response!.status).toBe(409);
      expect(response!.body).toEqual({ message: writeGuardMessages.otherUser });
      const onUsers = statements.filter((sql) => /"users"/.test(sql));
      expect(onUsers).toHaveLength(1);
      // The guard's read of the session user's email, and nothing else: not the hash.
      expect(onUsers[0]).toMatch(/^SELECT "User"\."email" AS "User_email", "User"\."id" AS "User_id" FROM "users"/);
      expect(onUsers[0]).not.toMatch(/password_hash/);
      expect(statements.filter((sql) => /^(UPDATE|DELETE|INSERT)\b/i.test(sql))).toEqual([]);
      expect(hasher.calls).toEqual([]);
    });

    it('answers 204 with the user’s own email in another case, with spaces', async () => {
      const response = await put(valid, { expectedUser: ` ${email.toUpperCase()} ` });

      expect(response.status).toBe(204);
    });

    it.each<[string, unknown, Parameters<typeof put>[1], number]>([
      ['no session and an invalid body', { newPassword: 'x' }, { session: null }, 401],
      ['another site and no session', valid, { session: null, headers: { 'Sec-Fetch-Site': 'cross-site' } }, 403],
      ['no X-Expected-User and an invalid body', { newPassword: 'x' }, { expectedUser: null }, 400],
      ['another user’s email and an invalid body', { newPassword: 'x' }, { expectedUser: 'x@example.com' }, 409],
      [
        'another user’s email and a wrong password',
        { currentPassword: 'wrong-pass1', newPassword: NEW },
        { expectedUser: 'x@example.com' },
        409,
      ],
    ])('answers %s with the earlier check’s status', async (_case, body, options, status) => {
      const response = await put(body, options);

      expect(response.status).toBe(status);
      expect(response.text).not.toContain('Validation failed');
      expect(hasher.calls).toEqual([]);
    });
  });

  // T8: AC13, repeated wrong attempts are not limited (#14).
  it('answers ten wrong current passwords with ten 400s and then the right one with 204', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      statuses.push((await put({ currentPassword: `wrong-pass${i}`, newPassword: NEW })).status);
    }

    const right = await put({ currentPassword: OLD, newPassword: NEW });

    expect(statuses).toEqual(Array.from({ length: 10 }, () => 400));
    expect(right.status).toBe(204);
  });
});

// T7: AC12, the passwords never reach a log line, a body or a header, a 500 included.
describe('PUT /api/auth/password and the passwords’ privacy', () => {
  const CURRENT = 'Distinct-Current-71';
  const NEXT = 'Distinct-Next-Secret-93';

  it('never puts either password in a log line, a response body or a header, a 500 forced in the UPDATE included', async () => {
    const logger = new CapturingLogger();
    const app = await createTestApp({ logger });
    try {
      const db = app.get(DataSource);
      await signUp(app, { password: 'other-pass1' });
      const { token, user } = await signUp(app, { password: CURRENT });
      const server = () => request(app.getHttpServer());
      const put = (body: unknown, headers: Record<string, string> = {}) =>
        server()
          .put(passwordPath)
          .set('Cookie', cookieFor(token))
          .set('X-Expected-User', user.email)
          .set(headers)
          .send(body as object);
      const responses: Response[] = [];

      responses.push(await put({ currentPassword: `${CURRENT}x`, newPassword: NEXT }));
      responses.push(await put({ currentPassword: CURRENT, newPassword: CURRENT }));
      responses.push(await put({ currentPassword: CURRENT, newPassword: `${NEXT}${'x'.repeat(128)}` }));
      responses.push(
        await put({ currentPassword: CURRENT, newPassword: NEXT }, { 'X-Expected-User': 'other@example.com' }),
      );
      responses.push(await put({ currentPassword: CURRENT, newPassword: NEXT }, { 'Sec-Fetch-Site': 'cross-site' }));
      responses.push(await server().put(passwordPath).send({ currentPassword: CURRENT, newPassword: NEXT }));
      await db.query(
        "CREATE TRIGGER fail_password BEFORE UPDATE OF password_hash ON users BEGIN SELECT RAISE(ABORT, 'disk on fire'); END",
      );
      const failed = await put({ currentPassword: CURRENT, newPassword: NEXT });
      responses.push(failed);
      await db.query('DROP TRIGGER fail_password');
      responses.push(await put({ currentPassword: CURRENT, newPassword: NEXT }));

      expect(responses.map((response) => response.status)).toEqual([400, 400, 400, 409, 403, 401, 500, 204]);
      expect(failed.body).toEqual({ message: 'Internal server error' });
      for (const response of responses) {
        expect(response.headers['cache-control']).toBe('no-store');
        expect(setCookies(response)).toEqual([]);
      }
      const output = [
        ...responses.map((response) => `${response.text}\n${JSON.stringify(response.headers)}`),
        ...logger.lines,
      ].join('\n');
      expect(logger.lines.join('\n')).toContain('disk on fire');
      expect(output).not.toContain(CURRENT);
      expect(output).not.toContain(NEXT);
      expect(output).not.toContain('Distinct');
    } finally {
      await app.close();
    }
  });
});
