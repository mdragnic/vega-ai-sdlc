import { randomBytes } from 'node:crypto';

import { Controller, Get, type INestApplication } from '@nestjs/common';
import { currentUserSchema, errorResponseSchema } from '@finebank/shared';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CurrentUser } from '../src/auth/current-user.decorator.js';
import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { cookieFor, login, me, sessionCookie, setCookies, sha256Hex, signUp } from './helpers/auth.js';
import { createTestApp } from './helpers/test-app.js';

const DAY = 24 * 60 * 60 * 1000;
const TEST_NOW = Date.parse('2026-10-22T10:00:00.000Z');

/** A route that is not marked public, to test the guard on something other than `me`. */
@Controller('probe')
class GuardedController {
  @Get('mine')
  mine(@CurrentUser() userId: number): { userId: number } {
    return { userId };
  }
}

const authenticationRequired = { message: 'Authentication required' };

describe('sessions', () => {
  let app: INestApplication;
  let db: DataSource;
  let clock: FixedClock;

  beforeEach(async () => {
    app = await createTestApp({ controllers: [GuardedController] });
    db = app.get(DataSource);
    clock = app.get(FixedClock);
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();
  const sessionHashes = async (): Promise<string[]> =>
    (await db.query<{ token_hash: string }[]>('SELECT token_hash FROM sessions ORDER BY id')).map(
      (row) => row.token_hash,
    );

  // T10: AC9, AC15.
  describe('GET /api/auth/me', () => {
    it('returns only the signed-in user', async () => {
      const first = await signUp(app, { fullName: 'Tanzir Rahman', email: 'tanzir@example.com' });
      const second = await signUp(app, { fullName: 'Marko Dragnić', email: 'marko@example.com' });

      const firstMe = await me(app, first.token);
      const secondMe = await me(app, second.token);

      expect(firstMe.status).toBe(200);
      expect(currentUserSchema.strict().parse(firstMe.body)).toEqual({
        fullName: 'Tanzir Rahman',
        email: 'tanzir@example.com',
        username: 'tanzir',
      });
      expect(secondMe.status).toBe(200);
      expect(currentUserSchema.strict().parse(secondMe.body)).toEqual({
        fullName: 'Marko Dragnić',
        email: 'marko@example.com',
        username: 'marko',
      });
    });
  });

  // T11: AC10.
  describe('guard', () => {
    it('gives the signed-in user ID to a guarded route', async () => {
      const { token } = await signUp(app);
      const [{ id }] = await db.query<[{ id: number }]>('SELECT id FROM users');

      const response = await request(server()).get('/api/probe/mine').set('Cookie', cookieFor(token));

      expect(response.body).toEqual({ userId: id });
    });

    it.each(['/api/auth/me', '/api/probe/mine'])('rejects %s without a cookie', async (path) => {
      const response = await request(server()).get(path);

      expect(response.status).toBe(401);
      expect(response.body).toEqual(authenticationRequired);
    });

    it.each(['/api/auth/me', '/api/probe/mine'])('rejects %s with an unknown token', async (path) => {
      await signUp(app);

      const response = await request(server())
        .get(path)
        .set('Cookie', cookieFor(randomBytes(32).toString('base64url')));

      expect(response.status).toBe(401);
      expect(response.body).toEqual(authenticationRequired);
    });

    it('rejects the token of a deleted session', async () => {
      const { token } = await signUp(app);
      await db.query('DELETE FROM sessions');

      const response = await me(app, token);

      expect(response.status).toBe(401);
      expect(response.body).toEqual(authenticationRequired);
    });

    it('rejects a cookie with another name holding a valid token', async () => {
      const { token } = await signUp(app);

      const response = await request(server()).get('/api/auth/me').set('Cookie', `session=${token}`);

      expect(response.status).toBe(401);
    });

    it('reads the session cookie among other cookies', async () => {
      const { token } = await signUp(app);

      const response = await request(server())
        .get('/api/auth/me')
        .set('Cookie', `theme=dark; ${cookieFor(token)}; lang=en`);

      expect(response.status).toBe(200);
    });

    it('lets the public routes run without a session', async () => {
      const signup = await request(server())
        .post('/api/auth/signup')
        .send({ fullName: 'A', email: 'a@example.com', password: 'abcdef12' });
      const badLogin = await login(app, { email: 'a@example.com', password: 'wrong' });
      const logout = await request(server()).post('/api/auth/logout');
      const clockRead = await request(server()).get('/api/test/clock');

      expect(signup.status).toBe(201);
      expect(badLogin.body).toEqual({ message: 'Email or password is incorrect' });
      expect(logout.status).toBe(204);
      expect(clockRead.status).toBe(200);
    });

    it('keeps 404 for an unknown /api route', async () => {
      const response = await request(server()).get('/api/does-not-exist');

      expect(response.status).toBe(404);
      expect(errorResponseSchema.strict().parse(response.body).message).toBeTruthy();
    });
  });

  /** `me` with a session started at TEST_NOW: on each of days 1 to 29, 1 ms before 30 days, and at 30 days. */
  async function useOverLifetime(token: string) {
    const daily: number[] = [];
    for (let day = 1; day < 30; day += 1) {
      clock.set(new Date(TEST_NOW + day * DAY));
      daily.push((await me(app, token)).status);
    }
    clock.set(new Date(TEST_NOW + 30 * DAY - 1));
    const lastMillisecond = (await me(app, token)).status;
    clock.set(new Date(TEST_NOW + 30 * DAY));
    const atCap = await me(app, token);
    return { daily, lastMillisecond, atCap: { status: atCap.status, body: atCap.body as unknown } };
  }

  const usedUntilExpiry = {
    daily: Array.from({ length: 29 }, () => 200),
    lastMillisecond: 200,
    atCap: { status: 401, body: authenticationRequired },
  };

  // T12: AC11, the expiry is fixed at 30 days from the Clock's now, never extended by use.
  describe('expiry', () => {
    it('ends a sign up session at 30 days even when it is used every day', async () => {
      const { token } = await signUp(app);

      expect(await useOverLifetime(token)).toEqual(usedUntilExpiry);
      expect(await sessionHashes()).not.toContain(sha256Hex(token));
    });

    it('gives a keepSignedIn false session the same 30-day cap on the server', async () => {
      await signUp(app, { email: 'tanzir@example.com', password: 'abcdef12' });
      await db.query('DELETE FROM sessions');
      const response = await login(app, { email: 'tanzir@example.com', password: 'abcdef12', keepSignedIn: false });
      const token = sessionCookie(response).value;

      expect(await useOverLifetime(token)).toEqual(usedUntilExpiry);
      expect(await sessionHashes()).not.toContain(sha256Hex(token));
    });

    it('deletes only the expired session row', async () => {
      const old = await signUp(app);
      clock.set(new Date(TEST_NOW + 10 * DAY));
      const fresh = await signUp(app);

      clock.set(new Date(TEST_NOW + 30 * DAY));
      expect((await me(app, old.token)).status).toBe(401);

      expect(await sessionHashes()).toEqual([sha256Hex(fresh.token)]);
      expect((await me(app, fresh.token)).status).toBe(200);
    });
  });

  // T13: AC12.
  describe('POST /api/auth/logout', () => {
    it('deletes the session, clears the cookie and makes the old token fail', async () => {
      const { token } = await signUp(app);

      const response = await request(server()).post('/api/auth/logout').set('Cookie', cookieFor(token));

      expect(response.status).toBe(204);
      expect(response.text).toBe('');
      expectClearedCookie(response);
      expect(await sessionHashes()).toEqual([]);
      expect((await me(app, token)).status).toBe(401);
    });

    it('returns 204 and clears the cookie without a session', async () => {
      const response = await request(server()).post('/api/auth/logout');

      expect(response.status).toBe(204);
      expectClearedCookie(response);
    });

    it('returns 204 with an unknown token and leaves other sessions alone', async () => {
      const { token } = await signUp(app);

      const response = await request(server())
        .post('/api/auth/logout')
        .set('Cookie', cookieFor(randomBytes(32).toString('base64url')));

      expect(response.status).toBe(204);
      expect((await me(app, token)).status).toBe(200);
    });
  });

  // T14: AC13.
  describe('replacing a session', () => {
    it('deletes the presented session on login', async () => {
      const { token: old } = await signUp(app, { email: 'tanzir@example.com', password: 'abcdef12' });

      const response = await login(app, { email: 'tanzir@example.com', password: 'abcdef12' }, cookieFor(old));
      const fresh = sessionCookie(response).value;

      expect(response.status).toBe(200);
      expect(await sessionHashes()).toEqual([sha256Hex(fresh)]);
      expect((await me(app, old)).status).toBe(401);
      expect((await me(app, fresh)).status).toBe(200);
    });

    it('deletes the presented session on sign up', async () => {
      const { token: old } = await signUp(app);

      const response = await request(server())
        .post('/api/auth/signup')
        .set('Cookie', cookieFor(old))
        .send({ fullName: 'B', email: 'b@example.com', password: 'abcdef12' });
      const fresh = sessionCookie(response).value;

      expect(response.status).toBe(201);
      expect(await sessionHashes()).toEqual([sha256Hex(fresh)]);
      expect((await me(app, old)).status).toBe(401);
      expect((await me(app, fresh)).body).toMatchObject({ email: 'b@example.com' });
    });

    it('keeps the presented session when the login fails', async () => {
      const { token } = await signUp(app, { email: 'tanzir@example.com' });

      await login(app, { email: 'tanzir@example.com', password: 'wrong-password1' }, cookieFor(token));

      expect((await me(app, token)).status).toBe(200);
    });
  });
});

function expectClearedCookie(response: request.Response): void {
  const cookie = sessionCookie(response);
  expect(cookie.value).toBe('');
  expect(cookie.attributes).toMatchObject({ path: '/api', 'max-age': '0' });
  expect(Date.parse(String(cookie.attributes.expires))).toBe(0);
  expect(setCookies(response)).toHaveLength(1);
}
