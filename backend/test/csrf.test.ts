import type { INestApplication } from '@nestjs/common';
import { errorResponseSchema } from '@finebank/shared';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { cookieFor, me, newUser, setCookies, signUp } from './helpers/auth.js';
import { createTestApp } from './helpers/test-app.js';

/** Browser headers of a request from another site, as Fetch Metadata or the Origin fallback shows it. */
const crossSite: [string, Record<string, string>][] = [
  ['Sec-Fetch-Site: cross-site', { 'Sec-Fetch-Site': 'cross-site' }],
  ['Sec-Fetch-Site: same-site', { 'Sec-Fetch-Site': 'same-site' }],
  ['a foreign Origin without Sec-Fetch-Site', { Origin: 'http://evil.example' }],
  [
    'Sec-Fetch-Site: cross-site and an Origin that matches Host',
    { 'Sec-Fetch-Site': 'cross-site', Host: 'localhost:5173', Origin: 'http://localhost:5173' },
  ],
];

/** 403 in the shared error shape, with no cookie set. */
function expectForbidden(response: request.Response): void {
  expect(response.status).toBe(403);
  expect(errorResponseSchema.strict().parse(response.body).message).toBeTruthy();
  expect(setCookies(response)).toEqual([]);
}

// T15: AC14, Nest's built-in CSRF protection on every request that changes data (#75).
describe('CSRF protection', () => {
  let app: INestApplication;
  let db: DataSource;

  beforeEach(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
  });

  afterEach(async () => {
    await app.close();
  });

  const count = async (table: string): Promise<number> =>
    (await db.query<{ count: number }[]>(`SELECT COUNT(*) AS count FROM ${table}`))[0]!.count;

  const post = (path: string, headers: Record<string, string>) => request(app.getHttpServer()).post(path).set(headers);

  it.each(crossSite)('rejects a sign up with %s and stores nothing', async (_case, headers) => {
    const response = await post('/api/auth/signup', headers).send(newUser());

    expectForbidden(response);
    expect(await count('users')).toBe(0);
    expect(await count('sessions')).toBe(0);
  });

  it.each(crossSite)('rejects a login with %s and starts no session', async (_case, headers) => {
    const user = newUser();
    await signUp(app, user);

    const response = await post('/api/auth/login', headers).send({ ...user, keepSignedIn: true });

    expectForbidden(response);
    expect(await count('sessions')).toBe(1);
  });

  it.each(crossSite)('rejects a logout with %s and keeps the session', async (_case, headers) => {
    const { token } = await signUp(app);

    const response = await post('/api/auth/logout', { ...headers, Cookie: cookieFor(token) });

    expectForbidden(response);
    expect((await me(app, token)).status).toBe(200);
  });

  it('lets a same-origin request through', async () => {
    const response = await post('/api/auth/signup', { 'Sec-Fetch-Site': 'same-origin' }).send(newUser());

    expect(response.status).toBe(201);
  });

  it('lets a request through whose Origin matches its Host', async () => {
    const response = await post('/api/auth/signup', { Host: 'localhost:5173', Origin: 'http://localhost:5173' }).send(
      newUser(),
    );

    expect(response.status).toBe(201);
  });

  it('lets a request without browser headers through', async () => {
    expect((await post('/api/auth/signup', {}).send(newUser())).status).toBe(201);
  });

  it('lets a cross-site GET through to the guard', async () => {
    const { token } = await signUp(app);

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set({ 'Sec-Fetch-Site': 'cross-site', Origin: 'http://evil.example', Cookie: cookieFor(token) });

    expect(response.status).toBe(200);
  });
});
