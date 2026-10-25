import type { INestApplication } from '@nestjs/common';
import { currentUserSchema, errorResponseSchema } from '@finebank/shared';
import { DataSource } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PasswordHasher } from '../src/auth/password.js';
import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { login, sessionCookie, setCookies, sha256Hex, signUp } from './helpers/auth.js';
import { createTestApp } from './helpers/test-app.js';

const email = 'tanzir@example.com';
const password = 'abcdef12';

describe('POST /api/auth/login', () => {
  let app: INestApplication;
  let db: DataSource;

  beforeEach(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
    await signUp(app, { fullName: 'Tanzir Rahman', email, password });
  });

  afterEach(async () => {
    await app.close();
  });

  const sessions = (): Promise<{ token_hash: string; expires_at: string }[]> =>
    db.query('SELECT token_hash, expires_at FROM sessions ORDER BY id');

  // T7: AC6.
  it.each([
    ['true', true, { 'max-age': '2592000', path: '/api', httponly: true, samesite: 'Lax' }],
    ['false', false, { path: '/api', httponly: true, samesite: 'Lax' }],
  ])(
    'logs in with the email in any case, keepSignedIn %s, and starts a 30-day session',
    async (_case, keepSignedIn, attributes) => {
      app.get(FixedClock).set(new Date('2026-10-23T08:30:00.000Z'));

      const response = await login(app, { email: 'Tanzir@EXAMPLE.com', password, keepSignedIn });

      expect(response.status).toBe(200);
      expect(currentUserSchema.strict().parse(response.body)).toEqual({
        fullName: 'Tanzir Rahman',
        email,
        username: 'tanzir',
      });
      const cookie = sessionCookie(response);
      expect(cookie.attributes).toEqual(attributes);
      expect((await sessions()).at(-1)).toEqual({
        token_hash: sha256Hex(cookie.value),
        expires_at: '2026-11-22 08:30:00.000',
      });
    },
  );

  // T8: AC7.
  it('gives the same 401 for a wrong password, an unknown email and a user without a password', async () => {
    await db.query(
      "INSERT INTO users (email, full_name, username, password_hash) VALUES ('google@example.com', 'G', 'google', NULL)",
    );
    const before = await sessions();

    const responses = [
      await login(app, { email, password: 'abcdef13' }),
      await login(app, { email: 'nobody@example.com', password }),
      await login(app, { email: 'google@example.com', password }),
    ];

    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ message: 'Email or password is incorrect' });
      expect(setCookies(response)).toEqual([]);
    }
    expect(await sessions()).toEqual(before);
  });

  // T8: AC7, the response time does not tell the three cases apart: each runs one verification.
  it('runs one password verification for a wrong password, an unknown email and a user without a password', async () => {
    await db.query(
      "INSERT INTO users (email, full_name, username, password_hash) VALUES ('google@example.com', 'G', 'google', NULL)",
    );
    const verify = vi.spyOn(app.get(PasswordHasher), 'verify');

    for (const body of [
      { email, password: 'abcdef13' },
      { email: 'nobody@example.com', password },
      { email: 'google@example.com', password },
    ]) {
      verify.mockClear();
      await login(app, body);
      expect(verify).toHaveBeenCalledTimes(1);
    }
  });

  // T8: AC7, no lockout (#14).
  it('still logs in with the right password after 20 failed attempts', async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect((await login(app, { email, password: `wrong${attempt}` })).status).toBe(401);
    }

    expect((await login(app, { email, password })).status).toBe(200);
  });

  // T9: AC8.
  it.each([
    ['an empty email', { email: '', password }, { email: 'Email is required' }],
    ['a malformed email', { email: 'tanzir@', password }, { email: 'Enter a valid email address' }],
    ['an empty password', { email, password: '' }, { password: 'Password is required' }],
  ])('rejects %s with 400', async (_case, body, fieldErrors) => {
    const response = await login(app, body);

    expect(response.status).toBe(400);
    expect(errorResponseSchema.strict().parse(response.body).fieldErrors).toEqual(fieldErrors);
    expect(setCookies(response)).toEqual([]);
  });

  // T9: AC8, the maximum is checked before any hashing (#95 a).
  it('rejects a password of 129 characters with 400 and never hashes it', async () => {
    const hasher = app.get(PasswordHasher);
    const verify = vi.spyOn(hasher, 'verify');
    const hash = vi.spyOn(hasher, 'hash');

    const response = await login(app, { email, password: 'x'.repeat(129) });

    expect(response.status).toBe(400);
    expect(errorResponseSchema.strict().parse(response.body).fieldErrors).toEqual({
      password: 'Password must be at most 128 characters',
    });
    expect(verify).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
  });

  // T9: AC8, the sign up rules do not apply to login.
  it('treats a short password without a digit as wrong credentials, not as a 400', async () => {
    const response = await login(app, { email, password: 'abc' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Email or password is incorrect' });
  });
});
