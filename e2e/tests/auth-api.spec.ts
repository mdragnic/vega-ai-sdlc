import { randomUUID } from 'node:crypto';

import { FRONTEND_URL } from '../constants';
import { expect, test } from '../fixtures';

const SESSION_COOKIE = 'finebank_session';
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

/** Sign up fields with an email no other test uses: the test database is shared by the run. */
function newUser() {
  return { fullName: 'Tanzir Rahman', email: `${randomUUID()}@example.com`, password: 'abcdef12' };
}

// T18: AC1, AC6, AC9, AC12, the session cookie works through the Vite proxy (#73).
test('signs up, reads me, logs out and logs in through the proxy', async ({ request }) => {
  const user = newUser();

  const signup = await request.post('/api/auth/signup', { data: user });
  expect(signup.status()).toBe(201);
  expect(await signup.json()).toMatchObject({ fullName: user.fullName, email: user.email });

  const me = await request.get('/api/auth/me');
  expect(me.status()).toBe(200);
  expect(await me.json()).toMatchObject({ email: user.email });

  expect((await request.post('/api/auth/logout')).status()).toBe(204);
  const afterLogout = await request.get('/api/auth/me');
  expect(afterLogout.status()).toBe(401);
  expect(await afterLogout.json()).toEqual({ message: 'Authentication required' });

  const loggedIn = await request.post('/api/auth/login', {
    data: { email: user.email.toUpperCase(), password: user.password, keepSignedIn: true },
  });
  expect(loggedIn.status()).toBe(200);
  expect((await request.get('/api/auth/me')).status()).toBe(200);
});

// T19: AC14, AC17, a page on the dev server uses the API like the app will.
test('stores an HttpOnly, SameSite=Lax session cookie for /api from a same-origin fetch', async ({ page }) => {
  const user = newUser();
  await page.goto('/');

  const signup = await page.evaluate(async (body) => {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: (await response.json()) as unknown };
  }, user);
  expect(signup.status).toBe(201);
  expect(signup.body).toMatchObject({ fullName: user.fullName, email: user.email });

  const cookies = await page.context().cookies(`${FRONTEND_URL}/api/auth/me`);
  const session = cookies.find((cookie) => cookie.name === SESSION_COOKIE);
  expect(session).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/api', domain: 'localhost', secure: false });
  // The browser counts Max-Age from the real time, not from the page's fixed clock.
  expect(Math.abs(session!.expires - (Date.now() / 1000 + THIRTY_DAYS_SECONDS))).toBeLessThan(120);

  // A document under /api can see cookies for /api, except HttpOnly ones.
  const meAsPage = await page.goto('/api/auth/me');
  expect(meAsPage?.status()).toBe(200);
  const visible = await page.evaluate(() => {
    document.cookie = 'probe=visible; path=/api';
    return document.cookie;
  });
  expect(visible).toContain('probe=visible');
  expect(visible).not.toContain(SESSION_COOKIE);

  const statuses = await page.evaluate(async () => {
    const me = await fetch('/api/auth/me');
    const logout = await fetch('/api/auth/logout', { method: 'POST' });
    const meAfter = await fetch('/api/auth/me');
    return {
      me: me.status,
      email: ((await me.json()) as { email: string }).email,
      logout: logout.status,
      meAfter: meAfter.status,
    };
  });
  expect(statuses).toEqual({ me: 200, email: user.email, logout: 204, meAfter: 401 });
  expect((await page.context().cookies(`${FRONTEND_URL}/api`)).map((cookie) => cookie.name)).not.toContain(
    SESSION_COOKIE,
  );
});

// T19: AC14, a POST from another site is rejected before it reaches the route.
test('rejects a cross-site POST through the proxy with 403', async ({ request }) => {
  const user = newUser();

  const crossSite: Record<string, string>[] = [{ Origin: 'http://evil.example' }, { 'Sec-Fetch-Site': 'cross-site' }];
  for (const headers of crossSite) {
    const response = await request.post('/api/auth/signup', { headers, data: user });
    expect(response.status()).toBe(403);
    expect(typeof ((await response.json()) as { message: unknown }).message).toBe('string');
  }
  expect((await request.post('/api/auth/login', { data: { ...user, keepSignedIn: true } })).status()).toBe(401);
});
