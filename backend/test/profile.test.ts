import { existsSync, readdirSync } from 'node:fs';

import type { INestApplication } from '@nestjs/common';
import { errorResponseSchema, profileContract, profileMessages, writeGuardMessages } from '@finebank/shared';
import request, { type Response, type Test } from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { User } from '../src/users/user.entity.js';
import { cookieFor, login, me, signUp } from './helpers/auth.js';
import { registeredRoutes } from './helpers/routes.js';
import { createTestApp, uploadsFolderOf } from './helpers/test-app.js';

// The path comes from the contract, so a route declared anywhere else would not answer it.
const profilePath = `/api${profileContract.get.path}`;

/** A letter beyond the BMP: one code point, two UTF-16 code units. */
const doubleStruck = '\u{1D538}';

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

/** The shared error shape with no field errors, as multer's, the 415's and the guard's answers are. */
const plainError = (response: Response) => errorResponseSchema.strict().parse(response.body);

/**
 * The files under the app's uploads folder, so a test sees that nothing was written there. Changed by task 029 (#128 c):
 * each test app has a folder of its own (`createTestApp`), no longer the shared `backend/data/uploads`.
 */
function uploadedFiles(app: INestApplication): string[] {
  const folder = uploadsFolderOf(app);
  return existsSync(folder) ? readdirSync(folder, { recursive: true }).map(String).toSorted() : [];
}

interface UserRow {
  id: number;
  email: string;
  full_name: string;
  username: string;
  password_hash: string | null;
  phone_country_code: string;
  phone_number: string;
}

/** A valid body of four text parts. */
const validParts = {
  fullName: 'Ana Marija Petrović',
  username: 'ana.petrovic',
  phoneCountryCode: '+381',
  phoneNumber: '641234567',
};

describe('the profile API', () => {
  let app: INestApplication;
  let db: DataSource;
  /** The requester, signed up second, so its IDs are not positions. */
  let token: string;
  let email: string;
  let userId: number;
  let username: string;
  /** The other user, signed up first, whose profile differs from the requester's. */
  let otherToken: string;
  let otherEmail: string;
  let otherId: number;

  const users = (): Promise<UserRow[]> => db.query('SELECT * FROM users ORDER BY id');
  const sessions = () => db.query<Record<string, unknown>[]>('SELECT * FROM sessions ORDER BY id');
  const rowOf = async (id: number) => (await users()).find((row) => row.id === id)!;

  beforeAll(async () => {
    app = await createTestApp({ config: { nodeEnv: 'test' } });
    db = app.get(DataSource);
    const other = await signUp(app, { fullName: 'Other Person' });
    otherToken = other.token;
    otherEmail = other.user.email;
    const requester = await signUp(app);
    token = requester.token;
    email = requester.user.email;
    username = requester.user.username;
    const [otherRow, requesterRow] = (await users()).slice(-2) as [UserRow, UserRow];
    otherId = otherRow.id;
    userId = requesterRow.id;
  });

  beforeEach(async () => {
    // Each test starts from the same two profiles: the requester's as signed up, the other's changed, so they differ.
    await db.query(
      'UPDATE users SET full_name = ?, username = ?, phone_country_code = ?, phone_number = ? WHERE id = ?',
      ['Tanzir Rahman', username, '+1', '', userId],
    );
    await db.query(
      'UPDATE users SET full_name = ?, username = ?, phone_country_code = ?, phone_number = ? WHERE id = ?',
      ['Other Person', 'other.person', '+44', '2071234567', otherId],
    );
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());

  /** `PATCH /api/profile` with a session, the requester's email in `X-Expected-User` and `parts` as text parts. */
  function patch(
    parts: Record<string, string | string[]>,
    options: { session?: string | null; expectedUser?: string | null; headers?: Record<string, string> } = {},
  ): Test {
    let req = server().patch(profilePath);
    const session = options.session === undefined ? token : options.session;
    const expectedUser = options.expectedUser === undefined ? email : options.expectedUser;
    if (session !== null) req = req.set('Cookie', cookieFor(session));
    if (expectedUser !== null) req = req.set('X-Expected-User', expectedUser);
    if (options.headers) req = req.set(options.headers);
    for (const [name, value] of Object.entries(parts)) {
      for (const one of Array.isArray(value) ? value : [value]) req = req.field(name, one);
    }
    return req;
  }

  /** The SQL the data source runs while `run` runs, each statement bound with its parameters. */
  async function recordSql(run: () => Promise<unknown>) {
    const statements: string[] = [];
    const logQuery = vi.spyOn(db.logger, 'logQuery').mockImplementation((sql, parameters) => {
      statements.push(bind(sql, parameters));
    });
    try {
      await run();
    } finally {
      logQuery.mockRestore();
    }
    return statements;
  }

  // T4: AC3, AC11, the read: exactly the five keys of the session user, a new user with +1 and no number.
  describe('GET /api/profile', () => {
    // Changed by task 029 (#128 c): exactly the five keys for a user without a photo (`photoUpdatedAt` only with one).
    // Task 030 (T10): and `hasPassword`, true for a user who signed up with a password (#2).
    it('answers the session user’s five fields and hasPassword, as signed up: +1 and no number', async () => {
      const response = await server().get(profilePath).set('Cookie', cookieFor(token));

      expect(response.status).toBe(200);
      expect(JSON.parse(response.text)).toEqual({
        fullName: 'Tanzir Rahman',
        email,
        username,
        phoneCountryCode: '+1',
        phoneNumber: '',
        hasPassword: true,
      });
      expect(Object.keys(JSON.parse(response.text) as object).toSorted()).toEqual([
        'email',
        'fullName',
        'hasPassword',
        'phoneCountryCode',
        'phoneNumber',
        'username',
      ]);
    });

    it('answers the other user only their own profile', async () => {
      const response = await server().get(profilePath).set('Cookie', cookieFor(otherToken));

      expect(JSON.parse(response.text)).toEqual({
        fullName: 'Other Person',
        email: otherEmail,
        username: 'other.person',
        phoneCountryCode: '+44',
        phoneNumber: '2071234567',
        hasPassword: true,
      });
    });

    // Task 030 T10: a Google-only user (#2, #104) has no password: `hasPassword` false, the other keys as before.
    it('answers hasPassword false for a user without a password, and true again once one is stored', async () => {
      const [{ password_hash: stored }] = await db.query<[{ password_hash: string }]>(
        'SELECT password_hash FROM users WHERE id = ?',
        [userId],
      );
      await db.query('UPDATE users SET password_hash = NULL WHERE id = ?', [userId]);
      try {
        const googleOnly = await server().get(profilePath).set('Cookie', cookieFor(token));
        const saved = await patch(validParts);

        expect(JSON.parse(googleOnly.text)).toEqual({
          fullName: 'Tanzir Rahman',
          email,
          username,
          phoneCountryCode: '+1',
          phoneNumber: '',
          hasPassword: false,
        });
        expect(saved.status).toBe(200);
        expect(JSON.parse(saved.text)).toEqual({ ...validParts, email, hasPassword: false });
      } finally {
        await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [stored, userId]);
      }
      const withPassword = await server().get(profilePath).set('Cookie', cookieFor(token));
      expect(JSON.parse(withPassword.text)).toMatchObject({ hasPassword: true });
    });

    it('answers 401 without a session', async () => {
      const response = await server().get(profilePath);

      expect(response.status).toBe(401);
      expect(response.text).not.toContain('Tanzir');
    });

    // Task 029: the photo's read added to the list (an addition, as the route lists elsewhere).
    it('registers exactly the read and the write of /api/profile, and the photo’s read', () => {
      expect(registeredRoutes(app).filter((route) => route.includes('/profile'))).toEqual([
        'GET /api/profile',
        'GET /api/profile/photo',
        'PATCH /api/profile',
      ]);
    });
  });

  // T5: AC11, the write: only the session user's four columns change; extra parts change nothing.
  describe('PATCH /api/profile with a valid body', () => {
    it('answers the stored, trimmed profile and writes only the four columns of the session user', async () => {
      const usersBefore = await users();
      const sessionsBefore = await sessions();

      const response = await patch({
        fullName: '  New Name  ',
        username: ' new.name ',
        phoneCountryCode: '+880',
        phoneNumber: ' 51547-58868 ',
        email: otherEmail,
        password: 'Changed-Password-1',
        passwordHash: 'not-a-hash',
        id: String(otherId),
        userId: String(otherId),
        photoUrl: '/evil.png',
      });

      expect(response.status).toBe(200);
      expect(JSON.parse(response.text)).toEqual({
        fullName: 'New Name',
        email,
        username: 'new.name',
        phoneCountryCode: '+880',
        phoneNumber: '5154758868',
        hasPassword: true,
      });
      const before = usersBefore.find((row) => row.id === userId)!;
      expect(await rowOf(userId)).toEqual({
        ...before,
        full_name: 'New Name',
        username: 'new.name',
        phone_country_code: '+880',
        phone_number: '5154758868',
      });
      expect((await users()).filter((row) => row.id !== userId)).toEqual(
        usersBefore.filter((row) => row.id !== userId),
      );
      expect(await sessions()).toEqual(sessionsBefore);
    });

    it('answers the new values on GET /api/profile and GET /api/auth/me afterwards', async () => {
      expect((await patch({ ...validParts, phoneNumber: '64 123-4567' })).status).toBe(200);

      const profile = await server().get(profilePath).set('Cookie', cookieFor(token));
      const session = await me(app, token);

      expect(profile.body).toEqual({ ...validParts, email, hasPassword: true });
      expect(session.body).toEqual({ fullName: validParts.fullName, email, username: validParts.username });
    });

    it('saves the same values again with the user’s own current username', async () => {
      const response = await patch({ ...validParts, username });

      expect(response.status).toBe(200);
      expect((await rowOf(userId)).username).toBe(username);
    });

    it('stores a name of 100 letters beyond the BMP: SQLite counts 100', async () => {
      const response = await patch({ ...validParts, fullName: doubleStruck.repeat(100) });

      expect(response.status).toBe(200);
      const [{ length }] = await db.query<[{ length: number }]>(
        'SELECT length(full_name) AS length FROM users WHERE id = ?',
        [userId],
      );
      expect(length).toBe(100);
    });
  });

  // T6: AC6, AC12, the shared rules over HTTP: 400 with each failing field's one message, nothing stored.
  describe('PATCH /api/profile with a body that breaks a rule', () => {
    const name = {
      required: 'Name is required',
      control: 'Name cannot contain tabs or line breaks',
      max: 'Name must be at most 100 characters',
    };
    const cases: [string, Partial<typeof validParts>, Record<string, string>][] = [
      ['an empty name', { fullName: '' }, { fullName: name.required }],
      ['a name of spaces', { fullName: '   ' }, { fullName: name.required }],
      ['a name of a zero-width space', { fullName: '\u200B' }, { fullName: name.required }],
      ['a name with a tab', { fullName: 'A\tB' }, { fullName: name.control }],
      ['a name with a line break', { fullName: 'A\nB' }, { fullName: name.control }],
      ['a name of 101 letters', { fullName: 'a'.repeat(101) }, { fullName: name.max }],
      ['a name of 101 letters beyond the BMP', { fullName: doubleStruck.repeat(101) }, { fullName: name.max }],
      ['an empty username', { username: '' }, { username: profileMessages.usernameRequired }],
      ['a username of 2', { username: 'ab' }, { username: profileMessages.usernameMin }],
      ['a username of 31', { username: 'a'.repeat(31) }, { username: profileMessages.usernameMax }],
      ['a username with a hyphen', { username: 'marko-d' }, { username: profileMessages.usernameCharacters }],
      ['a username in uppercase', { username: 'Marko' }, { username: profileMessages.usernameCharacters }],
      ['a username with a space inside', { username: 'mar ko' }, { username: profileMessages.usernameCharacters }],
      ['a number with a letter', { phoneNumber: '12a' }, { phoneNumber: profileMessages.phoneDigits }],
      ['a number with a plus', { phoneNumber: '+381' }, { phoneNumber: profileMessages.phoneDigits }],
      ['a number with a no-break space', { phoneNumber: '064\u00A0123' }, { phoneNumber: profileMessages.phoneDigits }],
      ['a number of 16 digits', { phoneNumber: '1234-5678-9012-3456' }, { phoneNumber: profileMessages.phoneMax }],
      ...['+0', '880', '+1234', '+880 '].map((code): [string, Partial<typeof validParts>, Record<string, string>] => [
        `the country code ${JSON.stringify(code)}`,
        { phoneCountryCode: code },
        { phoneCountryCode: profileMessages.countryCodeInvalid },
      ]),
    ];

    it.each(cases)('answers 400 for %s and stores nothing', async (_case, change, fieldErrors) => {
      const before = await users();

      const response = await patch({ ...validParts, ...change });

      expect(response.status).toBe(400);
      expect(errorResponseSchema.parse(response.body).fieldErrors).toEqual(fieldErrors);
      expect(await users()).toEqual(before);
    });

    it('answers every failing field’s message at once', async () => {
      const response = await patch({ fullName: ' ', username: 'Ab', phoneCountryCode: '+0', phoneNumber: 'x' });

      expect(response.status).toBe(400);
      expect(response.body.fieldErrors).toEqual({
        fullName: name.required,
        username: profileMessages.usernameMin,
        phoneCountryCode: profileMessages.countryCodeInvalid,
        phoneNumber: profileMessages.phoneDigits,
      });
    });

    it.each(['fullName', 'username', 'phoneCountryCode', 'phoneNumber'] as const)(
      'answers 400 under %s when that part is missing, and stores nothing',
      async (part) => {
        const before = await users();
        const { [part]: _left, ...rest } = validParts;

        const response = await patch(rest);

        expect(response.status).toBe(400);
        expect(Object.keys(errorResponseSchema.parse(response.body).fieldErrors ?? {})).toEqual([part]);
        expect(await users()).toEqual(before);
      },
    );

    it('answers 400 under username for a username part sent twice, and stores nothing', async () => {
      const before = await users();

      const response = await patch({ ...validParts, username: ['first.one', 'second.one'] });

      expect(response.status).toBe(400);
      expect(Object.keys(errorResponseSchema.parse(response.body).fieldErrors ?? {})).toEqual(['username']);
      expect(await users()).toEqual(before);
    });

    it('answers 400 for a field name in brackets (an object), and stores nothing', async () => {
      const before = await users();
      const { fullName: _name, ...rest } = validParts;

      const response = await patch({ ...rest, 'fullName[first]': 'Ana' });

      expect(response.status).toBe(400);
      expect(await users()).toEqual(before);
    });
  });

  // T7: AC12, the encoding and multer's limits: 400 or 415 in the shared shape, nothing stored or written.
  describe('PATCH /api/profile with another body', () => {
    const boundary = 'finebank-boundary';
    const multipart = (body: string) =>
      server()
        .patch(profilePath)
        .set('Cookie', cookieFor(token))
        .set('X-Expected-User', email)
        .set('Content-Type', `multipart/form-data; boundary=${boundary}`)
        .send(body);
    const textPart = (name: string, value: string) =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;

    // Changed by task 029 (#128 c): "a photo file part" left this list; a photo is now accepted or refused under `photo`
    // (profile-photo.test.ts).
    const cases: [string, () => Test][] = [
      ['a file part named x', () => patch(validParts).attach('x', Buffer.from('hello'), 'x.txt')],
      ['11 parts', () => patch({ ...validParts, a: '1', b: '2', c: '3', d: '4', e: '5', f: '6', g: '7' })],
      ['a field value of 2 KB', () => patch({ ...validParts, fullName: 'a'.repeat(2048) })],
      ['a field name of 101 bytes', () => patch({ ...validParts, ['n'.repeat(101)]: 'x' })],
      ['a body with no closing boundary', () => multipart(textPart('fullName', 'Ana').slice(0, -2))],
      [
        'multipart/form-data with no boundary',
        () => multipart(textPart('fullName', 'Ana')).set('Content-Type', 'multipart/form-data'),
      ],
    ];

    it.each(cases)('answers 400 in the shared shape to %s, storing and writing nothing', async (_case, send) => {
      const before = await users();
      const files = uploadedFiles(app);

      const response = await send();

      expect(response.status).toBe(400);
      expect(plainError(response).message).toBeTruthy();
      expect(await users()).toEqual(before);
      expect(uploadedFiles(app)).toEqual(files);
    });

    it.each<[string, (req: Test) => Test]>([
      ['JSON', (req) => req.send(validParts)],
      ['x-www-form-urlencoded', (req) => req.type('form').send(validParts)],
      ['text/plain', (req) => req.set('Content-Type', 'text/plain').send(JSON.stringify(validParts))],
      ['no body', (req) => req],
    ])('answers 415 to a %s body with valid values, storing nothing', async (_case, send) => {
      const before = await users();

      const response = await send(
        server().patch(profilePath).set('Cookie', cookieFor(token)).set('X-Expected-User', email),
      );

      expect(response.status).toBe(415);
      expect(plainError(response).message).toBeTruthy();
      expect(await users()).toEqual(before);
    });
  });

  // T8: AC10, AC19, the username's uniqueness by the unique index, with no read before the write.
  describe('a taken username', () => {
    const taken = { message: profileMessages.usernameTaken, fieldErrors: { username: profileMessages.usernameTaken } };

    it('answers 409 with the field error for the other user’s username, and changes neither user', async () => {
      const before = await users();

      const response = await patch({ ...validParts, username: 'other.person' });

      expect(response.status).toBe(409);
      expect(response.body).toEqual(taken);
      expect(await users()).toEqual(before);
    });

    it('frees a username the other user has just left', async () => {
      const left = await patch(
        { fullName: 'Other Person', username: 'other.renamed', phoneCountryCode: '+44', phoneNumber: '' },
        { session: otherToken, expectedUser: otherEmail },
      );
      expect(left.status).toBe(200);

      const response = await patch({ ...validParts, username: 'other.person' });

      expect(response.status).toBe(200);
      expect((await rowOf(userId)).username).toBe('other.person');
    });

    it('gives one 200 and one 409 to two users saving the same new username at once', async () => {
      const [mine, theirs] = await Promise.all([
        patch({ ...validParts, username: 'same.name' }),
        patch(
          { fullName: 'Other Person', username: 'same.name', phoneCountryCode: '+44', phoneNumber: '' },
          { session: otherToken, expectedUser: otherEmail },
        ),
      ]);

      expect([mine.status, theirs.status].toSorted((a, b) => a - b)).toEqual([200, 409]);
      expect((await users()).filter((row) => row.username === 'same.name')).toHaveLength(1);
    });

    it('runs one UPDATE on users whose WHERE is the session user’s ID, with no read of a username before it', async () => {
      const statements = await recordSql(() => patch(validParts));

      const updates = statements.filter((sql) => /^UPDATE\b.*\busers\b/is.test(sql));
      expect(updates).toHaveLength(1);
      expect(whereOf(updates[0]!).trim()).toMatch(new RegExp(`^"id"\\s*=\\s*${userId}$`));
      expect(updates[0]).toMatch(/"full_name"/);
      expect(updates[0]).not.toMatch(/"email"|"password_hash"/);
      const before = statements.slice(0, statements.indexOf(updates[0]!));
      expect(before.filter((sql) => /\busername\b/i.test(sql))).toEqual([]);
      expect(statements.filter((sql) => /^(INSERT|DELETE)\b/i.test(sql))).toEqual([]);
    });
  });

  // T9: AC13, the order and the protection of the write: nothing is parsed before the guards.
  describe('the checks before the write', () => {
    it('answers 401 without a session', async () => {
      const response = await patch(validParts, { session: null });

      expect(response.status).toBe(401);
    });

    it.each(crossSite)('answers 403 to %s, changing nothing', async (_case, headers) => {
      const before = await users();

      const response = await patch(validParts, { headers });

      expect(response.status).toBe(403);
      expect(plainError(response).message).toBeTruthy();
      expect(await users()).toEqual(before);
    });

    it('answers 403 to a cross-site HTML form post with a multipart body, changing nothing', async () => {
      const before = await users();

      const response = await patch(validParts, {
        expectedUser: null,
        headers: { Origin: 'http://evil.example', 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate' },
      });

      expect(response.status).toBe(403);
      expect(await users()).toEqual(before);
    });

    it.each<[string, string | null]>([
      ['without X-Expected-User', null],
      ['with a value that is not an email', 'not-an-email'],
    ])('answers 400 %s, changing nothing', async (_case, expectedUser) => {
      const before = await users();

      const response = await patch(validParts, { expectedUser });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: writeGuardMessages.expectedUserInvalid });
      expect(await users()).toEqual(before);
    });

    it('answers 409 with another user’s email, reading nothing of users but the guard’s email', async () => {
      const before = await users();
      let response: Response | undefined;

      const statements = await recordSql(async () => {
        response = await patch(validParts, { expectedUser: otherEmail });
      });

      expect(response!.status).toBe(409);
      expect(response!.body).toEqual({ message: writeGuardMessages.otherUser });
      const onUsers = statements.filter((sql) => /\busers\b/i.test(sql));
      expect(onUsers).toHaveLength(1);
      expect(onUsers[0]).toMatch(/^SELECT\b/i);
      expect(onUsers[0]).not.toMatch(/full_name|username|phone/);
      expect(await users()).toEqual(before);
    });

    it('answers 200 with the user’s own email in another case', async () => {
      const response = await patch(validParts, { expectedUser: ` ${email.toUpperCase()} ` });

      expect(response.status).toBe(200);
      expect((await rowOf(userId)).full_name).toBe(validParts.fullName);
    });

    it.each<[string, () => Test, number, string]>([
      [
        'no session and a file part: 401',
        () => patch(validParts, { session: null }).attach('photo', Buffer.from('x'), 'x.png'),
        401,
        'Authentication required',
      ],
      [
        'another user’s email and a file part: 409',
        () => patch(validParts, { expectedUser: otherEmail }).attach('photo', Buffer.from('x'), 'x.png'),
        409,
        writeGuardMessages.otherUser,
      ],
      [
        'another user’s email and a JSON body: 409',
        () =>
          server()
            .patch(profilePath)
            .set('Cookie', cookieFor(token))
            .set('X-Expected-User', otherEmail)
            .send(validParts),
        409,
        writeGuardMessages.otherUser,
      ],
      [
        'a JSON body without X-Expected-User: 400',
        () => server().patch(profilePath).set('Cookie', cookieFor(token)).send(validParts),
        400,
        writeGuardMessages.expectedUserInvalid,
      ],
    ])('answers a request failing two checks with the earlier one: %s', async (_case, send, status, message) => {
      const before = await users();

      const response = await send();

      expect(response.status).toBe(status);
      expect(response.body).toEqual({ message });
      expect(await users()).toEqual(before);
    });

    // Changed by task 029 (#128 c): the file part named `x`, as `photo` is now the one file part the stage accepts.
    it('answers a file part with an invalid field with multer’s 400, before the schema', async () => {
      const response = await patch({ ...validParts, fullName: '' }).attach('x', Buffer.from('x'), 'x.png');

      expect(response.status).toBe(400);
      expect(plainError(response).fieldErrors).toBeUndefined();
    });
  });

  // T32: AC18, #126 a's condition: the rule is for requests only, so a stored name that breaks it still shows.
  describe('a stored Full name that breaks the rule', () => {
    it.each([
      ['a tab inside', 'A\tB', 'Name cannot contain tabs or line breaks'],
      ['only a zero-width space', '\u200B', 'Name is required'],
      ['101 letters', 'a'.repeat(101), 'Name must be at most 100 characters'],
    ])('with %s is answered as stored, and refused on save', async (_case, fullName, message) => {
      await db.getRepository(User).update({ id: userId }, { fullName });

      const session = await me(app, token);
      const loggedIn = await login(app, { email, password: 'abcdef12' });
      const profile = await server().get(profilePath).set('Cookie', cookieFor(token));

      for (const response of [session, loggedIn, profile]) {
        expect(response.status).toBe(200);
        expect((JSON.parse(response.text) as { fullName: string }).fullName).toBe(fullName);
      }
      const before = await users();
      const save = await patch({ ...validParts, fullName });
      expect(save.status).toBe(400);
      expect(save.body.fieldErrors).toEqual({ fullName: message });
      expect(await users()).toEqual(before);
    });
  });
});
