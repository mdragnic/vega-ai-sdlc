import type { INestApplication } from '@nestjs/common';
import { currentUserSchema, errorResponseSchema } from '@finebank/shared';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { login, newUser, sessionCookie, setCookies, sha256Hex, signUp } from './helpers/auth.js';
import { createTestApp } from './helpers/test-app.js';

interface UserRow {
  id: number;
  email: string;
  full_name: string;
  username: string;
  password_hash: string | null;
}

describe('POST /api/auth/signup', () => {
  let app: INestApplication;
  let db: DataSource;

  beforeEach(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
  });

  afterEach(async () => {
    await app.close();
  });

  const post = (body: unknown) =>
    request(app.getHttpServer())
      .post('/api/auth/signup')
      .send(body as object);
  const users = (): Promise<UserRow[]> => db.query('SELECT * FROM users ORDER BY id');
  const sessionCount = async (): Promise<number> =>
    (await db.query<{ count: number }[]>('SELECT COUNT(*) AS count FROM sessions'))[0]!.count;

  // T2: AC1, AC15.
  it('creates the user and a 30-day session, and sets the session cookie', async () => {
    const response = await post({
      fullName: 'Tanzir Rahman',
      email: 'Tanzir.Rahman@Example.com',
      password: 'abcdef12',
    });

    expect(response.status).toBe(201);
    expect(currentUserSchema.strict().parse(response.body)).toEqual({
      fullName: 'Tanzir Rahman',
      email: 'tanzir.rahman@example.com',
      username: 'tanzir.rahman',
    });

    const [user, ...others] = await users();
    expect(others).toEqual([]);
    expect(user).toMatchObject({ email: 'tanzir.rahman@example.com', full_name: 'Tanzir Rahman' });
    expect(user!.password_hash).toMatch(/^scrypt\$/);
    expect(user!.password_hash).not.toContain('abcdef12');

    const cookie = sessionCookie(response);
    expect(cookie.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(cookie.attributes).toEqual({ 'max-age': '2592000', path: '/api', httponly: true, samesite: 'Lax' });

    // TEST_NOW is 2026-10-22T10:00:00Z; the expiry is 30 days later, in UTC.
    expect(await db.query('SELECT token_hash, user_id, expires_at FROM sessions')).toEqual([
      { token_hash: sha256Hex(cookie.value), user_id: user!.id, expires_at: '2026-11-21 10:00:00.000' },
    ]);
  });

  // T3: AC2.
  it.each([
    ['an empty name', { fullName: '' }, { fullName: 'Name is required' }],
    ['a name of only spaces', { fullName: '    ' }, { fullName: 'Name is required' }],
    ['a name of 101 characters', { fullName: 'a'.repeat(101) }, { fullName: 'Name must be at most 100 characters' }],
    ['an empty email', { email: '' }, { email: 'Email is required' }],
    ['a malformed email', { email: 'tanzir@example' }, { email: 'Enter a valid email address' }],
    ['an empty password', { password: '' }, { password: 'Password is required' }],
    ['a password of 7 characters', { password: 'abcdef1' }, { password: 'Password must be at least 8 characters' }],
    [
      'a password of 129 characters',
      { password: `a1${'x'.repeat(127)}` },
      { password: 'Password must be at most 128 characters' },
    ],
    [
      'a password without a letter',
      { password: '12345678' },
      { password: 'Password must contain at least one letter and one number' },
    ],
    [
      'a password without a digit',
      { password: 'abcdefgh' },
      { password: 'Password must contain at least one letter and one number' },
    ],
    [
      'a password with an Arabic-Indic digit only',
      { password: 'abcdefg١' },
      { password: 'Password must contain at least one letter and one number' },
    ],
    [
      'all three fields wrong',
      { fullName: ' ', email: 'nope', password: 'abc' },
      {
        fullName: 'Name is required',
        email: 'Enter a valid email address',
        password: 'Password must be at least 8 characters',
      },
    ],
  ])('rejects %s with 400 and stores nothing', async (_case, fields, fieldErrors) => {
    const response = await post(newUser(fields));

    expect(response.status).toBe(400);
    expect(errorResponseSchema.strict().parse(response.body).fieldErrors).toEqual(fieldErrors);
    expect(setCookies(response)).toEqual([]);
    expect(await users()).toEqual([]);
    expect(await sessionCount()).toBe(0);
  });

  it('accepts a password of Unicode letters and a digit', async () => {
    expect((await post(newUser({ password: 'ššššššš1' }))).status).toBe(201);
  });

  // AC2: name and email are stored trimmed, the email in lowercase; the password as typed.
  it('stores the trimmed name and email and the password as typed', async () => {
    const response = await post({
      fullName: '  Tanzir  Rahman ',
      email: '  TANZIR@example.com ',
      password: ' abcdef12 ',
    });

    expect(response.status).toBe(201);
    expect(await users()).toEqual([
      expect.objectContaining({ email: 'tanzir@example.com', full_name: 'Tanzir  Rahman' }),
    ]);
    expect((await login(app, { email: 'tanzir@example.com', password: ' abcdef12 ' })).status).toBe(200);
    expect((await login(app, { email: 'tanzir@example.com', password: 'abcdef12' })).status).toBe(401);
  });

  // T4: AC3.
  it('rejects an email already registered, in any case, with 409', async () => {
    await signUp(app, { email: 'tanzir@example.com' });

    const response = await post(newUser({ email: 'TANZIR@Example.COM' }));

    expect(response.status).toBe(409);
    expect(errorResponseSchema.strict().parse(response.body)).toEqual({
      message: 'An account with this email already exists',
      fieldErrors: { email: 'An account with this email already exists' },
    });
    expect(setCookies(response)).toEqual([]);
    expect((await users()).map((user) => user.email)).toEqual(['tanzir@example.com']);
    expect(await sessionCount()).toBe(1);
  });

  // AC4: the generated username, with the uniqueness number when it is taken.
  it('generates the username from the email and numbers taken ones from 2', async () => {
    const usernames: string[] = [];
    for (const email of ['Marko@x.com', 'marko@y.com', 'MARKO@z.com', 'jo@x.com', 'jo1@x.com', 'j@x.com', '-@x.com']) {
      usernames.push((await signUp(app, { email })).user.username);
    }

    expect(usernames).toEqual(['marko', 'marko2', 'marko3', 'jo1', 'jo12', 'j12', '123']);
  });

  // A trigger plays the other request: it inserts a clashing row just before the sign up's insert.
  it('takes the next number when another insert wins the race for the username', async () => {
    await db.query(`CREATE TRIGGER race BEFORE INSERT ON users WHEN NEW.username = 'marko' BEGIN
      INSERT INTO users (email, full_name, username) VALUES ('other@example.com', 'Other', 'marko'); END`);

    const response = await post(newUser({ email: 'marko@example.com' }));

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ username: 'marko2' });
  });

  it('gives 409 when another insert wins the race for the email', async () => {
    await db.query(`CREATE TRIGGER race BEFORE INSERT ON users WHEN NEW.full_name = 'Racer' BEGIN
      INSERT INTO users (email, full_name, username) VALUES (NEW.email, 'Other', 'other'); END`);

    const response = await post(newUser({ fullName: 'Racer' }));

    expect(response.status).toBe(409);
    expect(errorResponseSchema.strict().parse(response.body).fieldErrors).toEqual({
      email: 'An account with this email already exists',
    });
    expect(setCookies(response)).toEqual([]);
    expect(await sessionCount()).toBe(0);
  });
});
