import type { INestApplication } from '@nestjs/common';
import { currentUserSchema } from '@finebank/shared';
import type { Response } from 'supertest';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FAKE_GOOGLE_CLIENT_ID } from '../src/auth/google/fake-google-client.js';
import { GoogleAuthLibraryClient } from '../src/auth/google/google-auth-library-client.js';
import { GOOGLE_CLIENT, type GoogleClient, type GoogleProfile } from '../src/auth/google/google-client.js';
import { login, me, SESSION_COOKIE, sessionCookie, setCookies, sha256Hex, signUp } from './helpers/auth.js';
import { CapturingLogger } from './helpers/capturing-logger.js';
import { financeRows, tableCounts, userIdOf } from './helpers/finance.js';
import {
  decideOnFakeGoogle,
  decodeSignIn,
  encodeSignIn,
  type FakeAction,
  type FakeProfile,
  googleRoundTrip,
  locationOf,
  openCallback,
  s256,
  SIGN_IN_COOKIE,
  signInCookie,
  startSignIn,
  uniqueEmail,
} from './helpers/google.js';
import { createTestApp } from './helpers/test-app.js';

const REDIRECT_URI = 'http://localhost:5173/api/auth/google/callback';
const base64url43 = /^[A-Za-z0-9_-]{43}$/;
const failedToLogin = '/login?googleSignIn=failed';
const failedToLoginWithBills = '/login?returnTo=%2Fbills&googleSignIn=failed';

interface UserRow {
  id: number;
  email: string;
  full_name: string;
  username: string;
  password_hash: string | null;
}

const failureLines = (logger: CapturingLogger) => logger.lines.filter((line) => line.includes('Google sign-in failed'));

/** The response set no session cookie. */
function expectNoSession(response: Response) {
  expect(setCookies(response).filter((cookie) => cookie.name === SESSION_COOKIE)).toEqual([]);
}

/** The response clears the sign-in cookie on its own path. */
function expectSignInCleared(response: Response) {
  const cookie = signInCookie(response);
  expect(cookie?.value).toBe('');
  expect(cookie?.attributes).toMatchObject({ 'max-age': '0', path: '/api/auth/google', httponly: true });
}

/** The Location of a redirect of ours: `302`, `no-store`, no body, and a relative path that names no other host. */
function redirectOf(response: Response): string | undefined {
  const location = locationOf(response);
  expect(response.status).toBe(302);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.text ?? '').toBe('');
  expect(location).toMatch(/^\/(?![/\\])/);
  expect(new URL(location!, 'http://finebank.invalid').origin).toBe('http://finebank.invalid');
  return location;
}

/** A started sign-in that the fake Google page answered: the callback URL and the browser's cookie. */
async function answered(app: INestApplication, profile: FakeProfile = {}, action: FakeAction = 'continue') {
  const start = await startSignIn(app, '?returnTo=/bills');
  const signInValue = signInCookie(start)!.value;
  const callbackUrl = await decideOnFakeGoogle(app, locationOf(start)!, { email: uniqueEmail(), ...profile }, action);
  return { signInValue, content: decodeSignIn(signInValue), callbackUrl };
}

/** Someone who signed up with victim@example.com and a password of their own, then logged in: their two tokens. */
async function attackerWithTwoSessions(app: INestApplication): Promise<string[]> {
  const credentials = { email: 'victim@example.com', password: 'attacker-pass1' };
  const { token: signUpToken } = await signUp(app, { fullName: 'Attacker', ...credentials });
  const loginToken = sessionCookie(await login(app, credentials)).value;
  return [signUpToken, loginToken];
}

/** A copy of `url` with its query changed. */
function withParams(url: URL, change: (params: URLSearchParams) => void): URL {
  const changed = new URL(url);
  change(changed.searchParams);
  return changed;
}

describe('Google sign-in through the fake Google client', () => {
  let app: INestApplication;
  let db: DataSource;
  let logger: CapturingLogger;

  beforeEach(async () => {
    logger = new CapturingLogger();
    app = await createTestApp({ logger });
    db = app.get(DataSource);
  });

  afterEach(async () => {
    await app.close();
  });

  const users = (): Promise<UserRow[]> => db.query('SELECT * FROM users ORDER BY id');

  // T1: AC1.
  describe('GET /api/auth/google', () => {
    it('redirects to the authorization page with the code flow, the state and the S256 challenge of the cookie verifier', async () => {
      const response = await startSignIn(app, '?returnTo=/bills');

      expect(response.status).toBe(302);
      expect(response.headers['cache-control']).toBe('no-store');
      const url = new URL(locationOf(response)!, 'http://localhost:5173');
      expect(url.pathname).toBe('/api/test/google/authorize');
      const params = Object.fromEntries(url.searchParams);
      expect(params).toEqual({
        client_id: FAKE_GOOGLE_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'openid email profile',
        state: expect.stringMatching(base64url43) as string,
        code_challenge: expect.stringMatching(base64url43) as string,
        code_challenge_method: 'S256',
      });

      const cookie = signInCookie(response)!;
      expect(cookie.attributes).toEqual({
        'max-age': '600',
        path: '/api/auth/google',
        httponly: true,
        samesite: 'Lax',
      });
      const content = decodeSignIn(cookie.value);
      expect(content).toEqual({
        state: params.state,
        verifier: expect.stringMatching(base64url43) as string,
        returnTo: '/bills',
      });
      expect(s256(content.verifier)).toBe(params.code_challenge);
      expect(response.text ?? '').toBe('');
    });

    it('keeps no returnTo in the cookie when none is given', async () => {
      const response = await startSignIn(app);

      expect(Object.keys(decodeSignIn(signInCookie(response)!.value)).toSorted()).toEqual(['state', 'verifier']);
    });

    it('starts each sign-in with a new state and verifier', async () => {
      const first = decodeSignIn(signInCookie(await startSignIn(app))!.value);
      const second = decodeSignIn(signInCookie(await startSignIn(app))!.value);

      expect(second.state).not.toBe(first.state);
      expect(second.verifier).not.toBe(first.verifier);
    });
  });

  // T2: AC2.
  it('creates a new verified user with the demo dataset and a 30-day session, and opens Overview', async () => {
    const { finish } = await googleRoundTrip(app, {
      profile: { name: '  New Person ', email: 'New.Person@Example.com ' },
    });

    expect(redirectOf(finish)).toBe('/overview');
    expectSignInCleared(finish);
    const cookie = sessionCookie(finish);
    expect(cookie.attributes).toEqual({ 'max-age': '2592000', path: '/api', httponly: true, samesite: 'Lax' });

    const meResponse = await me(app, cookie.value);
    expect(meResponse.status).toBe(200);
    expect(currentUserSchema.strict().parse(meResponse.body)).toEqual({
      fullName: 'New Person',
      email: 'new.person@example.com',
      username: 'new.person',
    });
    const [user, ...others] = await users();
    expect(others).toEqual([]);
    expect(user!.password_hash).toBeNull();
    // TEST_NOW is 2026-10-22T10:00:00Z; the session ends 30 days later (#63).
    expect(await db.query('SELECT token_hash, user_id, expires_at FROM sessions')).toEqual([
      { token_hash: sha256Hex(cookie.value), user_id: user!.id, expires_at: '2026-11-21 10:00:00.000' },
    ]);
    const rows = await financeRows(db, user!.id);
    expect({
      accounts: rows.accounts.length,
      transactions: rows.transactions.length,
      bills: rows.bills.length,
      savingsGoals: rows.savingsGoals.length,
      categoryLimits: rows.categoryLimits.length,
    }).toEqual({ accounts: 5, transactions: 3411, bills: 14, savingsGoals: 84, categoryLimits: 6 });
    expect(failureLines(logger)).toEqual([]);
  });

  // T3: AC2 (#62, #67).
  it('generates usernames from the Google emails', async () => {
    for (const email of ['marko-d@x.com', 'marko-d@y.com', 'jo@x.com']) {
      expect((await googleRoundTrip(app, { profile: { email } })).finish.status).toBe(302);
    }

    expect((await users()).map((user) => user.username)).toEqual(['markod', 'markod2', 'jo1']);
  });

  // T4: AC3 (#104).
  it('signs in the user who has the email, in any case, keeps their name and removes their password', async () => {
    const { user } = await signUp(app, {
      fullName: 'Tanzir Rahman',
      email: 'tanzir@example.com',
      password: 'abcdef12',
    });
    const [before] = await users();
    const countsBefore = await tableCounts(db);

    const { finish } = await googleRoundTrip(app, { profile: { name: 'Someone Else', email: 'TANZIR@Example.COM' } });

    expect(redirectOf(finish)).toBe('/overview');
    const token = sessionCookie(finish).value;
    expect((await me(app, token)).body).toEqual(user);
    expect(await users()).toEqual([{ ...before, password_hash: null }]);
    // The sign-up session is gone; only the Google one is left. Nothing else changed.
    expect(await tableCounts(db)).toEqual(countsBefore);
    expect(await db.query('SELECT token_hash FROM sessions')).toEqual([{ token_hash: sha256Hex(token) }]);
  });

  // T32: AC3 (#104). Someone signs up first with the victim's email; the victim's Google sign-in takes it back.
  describe('a password set by someone else', () => {
    it('stops working, and every session of the attacker ends, when the victim signs in with Google', async () => {
      const attackerTokens = await attackerWithTwoSessions(app);

      const { finish } = await googleRoundTrip(app, { profile: { name: 'Victim', email: 'Victim@Example.com' } });

      const victimToken = sessionCookie(finish).value;
      expect((await me(app, victimToken)).status).toBe(200);
      const attackerLogin = await login(app, { email: 'victim@example.com', password: 'attacker-pass1' });
      expect(attackerLogin.status).toBe(401);
      expect(attackerLogin.body).toEqual({ message: 'Email or password is incorrect' });
      for (const token of attackerTokens) expect((await me(app, token)).status).toBe(401);
      expect(failureLines(logger)).toEqual([]);
    });

    it('stays when saving the sign-in fails: the password and sessions are changed in one transaction', async () => {
      const attackerTokens = await attackerWithTwoSessions(app);
      const [before] = await users();
      await db.query(
        "CREATE TRIGGER fail_session BEFORE INSERT ON sessions BEGIN SELECT RAISE(ABORT, 'disk on fire'); END",
      );

      const { finish } = await googleRoundTrip(app, { profile: { email: 'victim@example.com' } });

      expect(redirectOf(finish)).toBe(failedToLogin);
      expect(await users()).toEqual([before]);
      for (const token of attackerTokens) expect((await me(app, token)).status).toBe(200);
    });

    it('is not touched for a Google-only user: their other sessions stay', async () => {
      const email = uniqueEmail();
      const first = sessionCookie((await googleRoundTrip(app, { profile: { email } })).finish).value;

      const second = sessionCookie((await googleRoundTrip(app, { profile: { email } })).finish).value;

      expect((await me(app, first)).status).toBe(200);
      expect((await me(app, second)).status).toBe(200);
    });
  });

  // T31: AC2, AC3 (#103).
  describe('the name of a new Google user', () => {
    it.each([
      ['no name', '', 'Marko.D@Example.com', 'Marko.D'],
      ['only spaces', '   ', 'Jo.Name@x.com', 'Jo.Name'],
      ['150 characters', 'n'.repeat(150), 'long@x.com', 'n'.repeat(100)],
    ])('with %s is %j', async (_case, name, email, expected) => {
      const { finish } = await googleRoundTrip(app, { profile: { name, email } });

      const meResponse = await me(app, sessionCookie(finish).value);
      expect(currentUserSchema.parse(meResponse.body).fullName).toBe(expected);
    });

    it('never changes on a later Google sign-in with another name', async () => {
      const email = uniqueEmail();
      await googleRoundTrip(app, { profile: { name: 'n'.repeat(150), email } });

      const { finish } = await googleRoundTrip(app, { profile: { name: 'Another Name', email } });

      expect(currentUserSchema.parse((await me(app, sessionCookie(finish).value)).body).fullName).toBe('n'.repeat(100));
    });
  });

  // T5: AC4.
  describe('the page opened after the sign-in', () => {
    it('opens the returnTo given at the start, with its query and hash', async () => {
      const { finish } = await googleRoundTrip(app, {
        query: `?returnTo=${encodeURIComponent('/bills?x=1#y')}`,
        profile: { email: uniqueEmail() },
      });

      expect(redirectOf(finish)).toBe('/bills?x=1#y');
    });

    const unsafe = [
      ['an absolute URL', 'https://evil.example/bills'],
      ['an absolute URL on the app origin', 'http://localhost:5173/bills'],
      ['a protocol-relative URL', '//evil.example'],
      ['a backslash after the slash', '/\\evil.example'],
      ['a tab trick', '/\t/evil.example'],
      ['a newline trick', '/\n/evil.example'],
      ['an encoded tab trick', '/%09/evil.example'],
      ['an encoded slash trick', '/%2F%2Fevil.example'],
      ['an encoded backslash trick', '/%5Cevil.example'],
      ['a javascript: URL', 'javascript:alert(1)'],
      ['a path without the leading slash', 'bills'],
      ['Login', '/login'],
      ['Sign up', '/sign-up'],
      ['Forgot Password', '/forgot-password'],
    ] as const;

    it.each(unsafe)('opens Overview for %s given at the start, and keeps none in the cookie', async (_case, value) => {
      const { finish, signIn } = await googleRoundTrip(app, {
        query: `?returnTo=${encodeURIComponent(value)}`,
        profile: { email: uniqueEmail() },
      });

      expect(signIn.returnTo).toBeUndefined();
      expect(redirectOf(finish)).toBe('/overview');
    });

    it('opens Overview for a repeated returnTo', async () => {
      const { finish, signIn } = await googleRoundTrip(app, {
        query: '?returnTo=%2Fbills&returnTo=%2Fgoals',
        profile: { email: uniqueEmail() },
      });

      expect(signIn.returnTo).toBeUndefined();
      expect(redirectOf(finish)).toBe('/overview');
    });

    it.each(unsafe)('opens Overview for %s written into the cookie by hand', async (_case, value) => {
      const start = await startSignIn(app);
      const content = decodeSignIn(signInCookie(start)!.value);
      const callbackUrl = await decideOnFakeGoogle(app, locationOf(start)!, { email: uniqueEmail() });

      const finish = await openCallback(app, callbackUrl, [
        `${SIGN_IN_COOKIE}=${encodeSignIn({ ...content, returnTo: value })}`,
      ]);

      expect(redirectOf(finish)).toBe('/overview');
      expect(sessionCookie(finish).value).toMatch(base64url43);
    });
  });

  // T6: AC5.
  describe('cancel on Google', () => {
    it('opens Login with the returnTo started with and no message, and signs no one in', async () => {
      const countsBefore = await tableCounts(db);

      const { finish, callbackUrl } = await googleRoundTrip(app, { query: '?returnTo=/bills', action: 'cancel' });

      expect(callbackUrl.searchParams.get('error')).toBe('access_denied');
      expect(redirectOf(finish)).toBe('/login?returnTo=%2Fbills');
      expectSignInCleared(finish);
      expectNoSession(finish);
      expect(await tableCounts(db)).toEqual(countsBefore);
    });

    it('opens Login with no returnTo when the browser has no sign-in cookie', async () => {
      const start = await startSignIn(app, '?returnTo=/bills');
      const callbackUrl = await decideOnFakeGoogle(app, locationOf(start)!, {}, 'cancel');

      const finish = await openCallback(app, callbackUrl);

      expect(redirectOf(finish)).toBe('/login');
      expectSignInCleared(finish);
      expectNoSession(finish);
      expect(await users()).toEqual([]);
    });
  });

  // T7: AC6. Each case starts at Login with returnTo=/bills, then breaks one thing.
  describe('a failed sign-in', () => {
    const cases: [string, () => Promise<Response>, string][] = [
      [
        'another error from Google',
        async () => {
          const { signInValue, callbackUrl } = await answered(app, {}, 'fail');
          return openCallback(app, callbackUrl, [`${SIGN_IN_COOKIE}=${signInValue}`]);
        },
        failedToLoginWithBills,
      ],
      ['no sign-in cookie', async () => openCallback(app, (await answered(app)).callbackUrl), failedToLogin],
      [
        'a cookie that is not base64url JSON',
        async () => openCallback(app, (await answered(app)).callbackUrl, [`${SIGN_IN_COOKIE}=not*json`]),
        failedToLogin,
      ],
      [
        'a cookie of another shape',
        async () => {
          const { content, callbackUrl } = await answered(app);
          return openCallback(app, callbackUrl, [`${SIGN_IN_COOKIE}=${encodeSignIn({ state: content.state })}`]);
        },
        failedToLogin,
      ],
      [
        'no state',
        async () => {
          const { signInValue, callbackUrl } = await answered(app);
          return openCallback(
            app,
            withParams(callbackUrl, (p) => p.delete('state')),
            [`${SIGN_IN_COOKIE}=${signInValue}`],
          );
        },
        failedToLoginWithBills,
      ],
      [
        'another state',
        async () => {
          const { signInValue, callbackUrl } = await answered(app);
          return openCallback(
            app,
            withParams(callbackUrl, (p) => p.set('state', 'A'.repeat(43))),
            [`${SIGN_IN_COOKIE}=${signInValue}`],
          );
        },
        failedToLoginWithBills,
      ],
      [
        'a repeated state',
        async () => {
          const { signInValue, content, callbackUrl } = await answered(app);
          return openCallback(
            app,
            withParams(callbackUrl, (p) => p.append('state', content.state)),
            [`${SIGN_IN_COOKIE}=${signInValue}`],
          );
        },
        failedToLoginWithBills,
      ],
      [
        'no code',
        async () => {
          const { signInValue, callbackUrl } = await answered(app);
          return openCallback(
            app,
            withParams(callbackUrl, (p) => p.delete('code')),
            [`${SIGN_IN_COOKIE}=${signInValue}`],
          );
        },
        failedToLoginWithBills,
      ],
      [
        'an unknown code',
        async () => {
          const { signInValue, callbackUrl } = await answered(app);
          return openCallback(
            app,
            withParams(callbackUrl, (p) => p.set('code', 'unknown-code')),
            [`${SIGN_IN_COOKIE}=${signInValue}`],
          );
        },
        failedToLoginWithBills,
      ],
      [
        'a wrong PKCE verifier in the cookie',
        async () => {
          const { content, callbackUrl } = await answered(app);
          return openCallback(app, callbackUrl, [
            `${SIGN_IN_COOKIE}=${encodeSignIn({ ...content, verifier: 'W'.repeat(43) })}`,
          ]);
        },
        failedToLoginWithBills,
      ],
      [
        'email_verified false',
        async () => {
          const { signInValue, callbackUrl } = await answered(app, { emailVerified: false });
          return openCallback(app, callbackUrl, [`${SIGN_IN_COOKIE}=${signInValue}`]);
        },
        failedToLoginWithBills,
      ],
      [
        'no email',
        async () => {
          const { signInValue, callbackUrl } = await answered(app, { email: '' });
          return openCallback(app, callbackUrl, [`${SIGN_IN_COOKIE}=${signInValue}`]);
        },
        failedToLoginWithBills,
      ],
      [
        'an invalid email',
        async () => {
          const { signInValue, callbackUrl } = await answered(app, { email: 'not-an-email' });
          return openCallback(app, callbackUrl, [`${SIGN_IN_COOKIE}=${signInValue}`]);
        },
        failedToLoginWithBills,
      ],
      [
        'an insert that fails',
        async () => {
          await db.query(
            "CREATE TRIGGER fail_user BEFORE INSERT ON users BEGIN SELECT RAISE(ABORT, 'disk on fire'); END",
          );
          const { signInValue, callbackUrl } = await answered(app);
          return openCallback(app, callbackUrl, [`${SIGN_IN_COOKIE}=${signInValue}`]);
        },
        failedToLoginWithBills,
      ],
      [
        'seeding that fails, after the user insert',
        async () => {
          await db.query(
            "CREATE TRIGGER fail_bill BEFORE INSERT ON bills BEGIN SELECT RAISE(ABORT, 'disk on fire'); END",
          );
          const { signInValue, callbackUrl } = await answered(app);
          return openCallback(app, callbackUrl, [`${SIGN_IN_COOKIE}=${signInValue}`]);
        },
        failedToLoginWithBills,
      ],
    ];

    it.each(cases)('with %s opens Login with the message and keeps nothing', async (_case, run, expected) => {
      const countsBefore = await tableCounts(db);

      const finish = await run();

      expect(redirectOf(finish)).toBe(expected);
      expectSignInCleared(finish);
      expectNoSession(finish);
      expect(await tableCounts(db)).toEqual(countsBefore);
      // One line with the reason: no email, no name, no state, verifier or code (each 20 or more base64url characters).
      const [line, ...more] = failureLines(logger);
      expect(more).toEqual([]);
      expect(line).toMatch(/^Google sign-in failed: \S/);
      expect(line).not.toMatch(/@|Google Tester|[A-Za-z0-9_-]{20,}/);
    });

    it('names the kind of error, without its message, when saving fails', async () => {
      await db.query("CREATE TRIGGER fail_user BEFORE INSERT ON users BEGIN SELECT RAISE(ABORT, 'disk on fire'); END");
      const { signInValue, callbackUrl } = await answered(app);

      await openCallback(app, callbackUrl, [`${SIGN_IN_COOKIE}=${signInValue}`]);

      expect(failureLines(logger)).toEqual([expect.stringContaining('(QueryFailedError)')]);
      expect(logger.lines.join('\n')).not.toContain('disk on fire');
    });

    it('with a code used twice', async () => {
      const first = await googleRoundTrip(app, { query: '?returnTo=/bills', profile: { email: uniqueEmail() } });
      expect(locationOf(first.finish)).toBe('/bills');
      const countsBefore = await tableCounts(db);

      const again = await openCallback(app, first.callbackUrl, [`${SIGN_IN_COOKIE}=${first.signInValue}`]);

      expect(redirectOf(again)).toBe(failedToLoginWithBills);
      expectNoSession(again);
      expect(await tableCounts(db)).toEqual(countsBefore);
    });
  });

  // T10: AC10.
  it('replaces the session the browser presented', async () => {
    const { user } = await signUp(app, { email: 'first@example.com' });
    const tokenA = sessionCookie(await login(app, { email: user.email, password: 'abcdef12' })).value;

    const { finish } = await googleRoundTrip(app, { profile: { email: uniqueEmail() }, sessionToken: tokenA });

    const tokenB = sessionCookie(finish).value;
    expect(await db.query('SELECT token_hash FROM sessions WHERE token_hash = ?', [sha256Hex(tokenA)])).toEqual([]);
    expect((await me(app, tokenA)).status).toBe(401);
    expect((await me(app, tokenB)).status).toBe(200);
  });

  // T13: AC12.
  it('gives a Google-created user no password: a login with their email fails as usual', async () => {
    const email = uniqueEmail();
    await googleRoundTrip(app, { profile: { email } });

    const response = await login(app, { email, password: 'abcdef12' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Email or password is incorrect' });
    expect(setCookies(response)).toEqual([]);
  });

  // T14: AC13 (test half).
  it('serves the fake Google page with the prefilled profile', async () => {
    const start = await startSignIn(app);

    const page = await request(app.getHttpServer()).get(locationOf(start)!);

    expect(page.status).toBe(200);
    expect(page.headers['content-type']).toMatch(/^text\/html/);
    expect(page.text).toContain('<title>Fake Google</title>');
    expect(page.text).toMatch(/name="name"[^>]*value="Google Tester"/);
    expect(page.text).toMatch(/name="email"[^>]*value="google\.tester@example\.com"/);
    expect(page.text).toMatch(/name="email_verified"[^>]*checked/);
    for (const action of ['continue', 'cancel', 'fail']) expect(page.text).toContain(`value="${action}"`);
  });

  it('answers 400 to an authorization request that is not ours', async () => {
    const start = await startSignIn(app);
    const url = new URL(locationOf(start)!, 'http://localhost:5173');
    url.searchParams.set('redirect_uri', 'https://evil.example/callback');

    const page = await request(app.getHttpServer()).get(`${url.pathname}${url.search}`);

    expect(page.status).toBe(400);
  });

  it('redirects from the fake page only to the configured redirect URI', async () => {
    const start = await startSignIn(app);

    const callbackUrl = await decideOnFakeGoogle(app, locationOf(start)!);

    expect(`${callbackUrl.origin}${callbackUrl.pathname}`).toBe(REDIRECT_URI);
  });
});

/** A `GoogleClient` stub: a fixed authorization URL, and `profile` as given. */
function stubClient(profile: GoogleClient['profile']): GoogleClient {
  return { authorizationUrl: () => 'https://accounts.google.example/auth', profile };
}

const verifiedProfile = (email: string): GoogleProfile => ({ email, emailVerified: true, name: 'Stub Person' });

/** Starts a sign-in: the browser's sign-in cookie and its state. */
async function startedSignIn(app: INestApplication, query = '') {
  const signInValue = signInCookie(await startSignIn(app, query))!.value;
  return { signInValue, state: decodeSignIn(signInValue).state };
}

/** Starts a sign-in and opens the callback with a code and the right state and cookie. */
async function callbackWithCookie(app: INestApplication, query = '') {
  const { signInValue, state } = await startedSignIn(app, query);
  const finish = await openCallback(app, new URL(`${REDIRECT_URI}?code=stub-code&state=${state}`), [
    `${SIGN_IN_COOKIE}=${signInValue}`,
  ]);
  return { finish, signInValue, state };
}

describe('Google sign-in with other clients', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  // T1: AC1 with the real client, nothing fetched.
  it('redirects to Google with the AC1 parameters through google-auth-library', async () => {
    const config = {
      clientId: 'client-id.apps.googleusercontent.com',
      clientSecret: 'GOCSPX-secret',
      redirectUri: REDIRECT_URI,
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    app = await createTestApp({
      overrides: [{ provide: GOOGLE_CLIENT, useValue: new GoogleAuthLibraryClient(config) }],
    });

    const response = await startSignIn(app, '?returnTo=/bills');

    expect(response.status).toBe(302);
    const url = new URL(locationOf(response)!);
    expect(`${url.origin}${url.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: config.clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      code_challenge_method: 'S256',
    });
    const content = decodeSignIn(signInCookie(response)!.value);
    expect(url.searchParams.get('state')).toBe(content.state);
    expect(url.searchParams.get('code_challenge')).toBe(s256(content.verifier));
    expect(locationOf(response)).not.toContain(config.clientSecret);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  // T8: AC8 (#102).
  describe('without a Google client outside tests', () => {
    beforeEach(async () => {
      app = await createTestApp({ config: { nodeEnv: 'development', google: null } });
    });

    it('sends the start to Login with the message and the returnTo, sets no cookie and never names Google', async () => {
      const response = await startSignIn(app!, '?returnTo=/bills');

      expect(redirectOf(response)).toBe(failedToLoginWithBills);
      expect(setCookies(response)).toEqual([]);
    });

    it('sends the start without returnTo to Login with the message', async () => {
      expect(redirectOf(await startSignIn(app!))).toBe(failedToLogin);
    });

    it('fails a callback with a code', async () => {
      const response = await openCallback(app!, new URL(`${REDIRECT_URI}?code=some-code&state=some-state`));

      expect(redirectOf(response)).toBe(failedToLogin);
      expectNoSession(response);
    });

    // T14: AC13 (development half).
    it('has no fake Google page', async () => {
      expect((await request(app!.getHttpServer()).get('/api/test/google/authorize')).status).toBe(404);
    });
  });

  // T9: AC8. Outside tests a configured client is the real one; with NODE_ENV=test the fake, whatever the variables.
  it.each([
    ['development', 'https://accounts.google.com/o/oauth2/v2/auth'],
    ['test', 'http://localhost:5173/api/test/google/authorize'],
  ] as const)('uses for NODE_ENV=%s with both variables set %s', async (nodeEnv, authorizationPage) => {
    app = await createTestApp({
      config: {
        nodeEnv,
        google: { clientId: 'id.apps.googleusercontent.com', clientSecret: 'secret', redirectUri: REDIRECT_URI },
      },
    });

    const url = new URL(locationOf(await startSignIn(app))!, 'http://localhost:5173');

    expect(`${url.origin}${url.pathname}`).toBe(authorizationPage);
  });

  it('fails when the client throws, and keeps nothing', async () => {
    app = await createTestApp({
      overrides: [{ provide: GOOGLE_CLIENT, useValue: stubClient(() => Promise.reject(new Error('Google is down'))) }],
    });
    const countsBefore = await tableCounts(app.get(DataSource));

    const { finish } = await callbackWithCookie(app, '?returnTo=/bills');

    expect(redirectOf(finish)).toBe(failedToLoginWithBills);
    expectNoSession(finish);
    expect(await tableCounts(app.get(DataSource))).toEqual(countsBefore);
  });

  // T10: AC9 (#78).
  it('finishes the Google calls before the sign-up transaction opens', async () => {
    const events: string[] = [];
    const client = stubClient(async () => {
      events.push('profile called');
      await new Promise((resolve) => setTimeout(resolve, 5));
      events.push('profile resolved');
      return verifiedProfile('order@example.com');
    });
    app = await createTestApp({ overrides: [{ provide: GOOGLE_CLIENT, useValue: client }] });
    const dataSource = app.get(DataSource);
    const transaction = dataSource.transaction.bind(dataSource);
    vi.spyOn(dataSource, 'transaction').mockImplementation((...args: Parameters<DataSource['transaction']>) => {
      events.push('transaction opened');
      return (transaction as (...a: unknown[]) => Promise<unknown>)(...args).finally(() =>
        events.push('transaction closed'),
      );
    });

    const { finish } = await callbackWithCookie(app);

    expect(locationOf(finish)).toBe('/overview');
    expect(events).toEqual(['profile called', 'profile resolved', 'transaction opened', 'transaction closed']);
    expect(await userIdOf(dataSource, 'order@example.com')).toBeDefined();
  });

  // T12: AC11.
  it('never puts the code, state, verifier, tokens or secret in a body, our Location or a log line', async () => {
    const secret = 'GOCSPX-known-client-secret';
    const idToken = 'eyJknown.id.token';
    const logger = new CapturingLogger();
    let throwing = false;
    const client = stubClient(({ code, codeVerifier }) =>
      throwing
        ? Promise.reject(
            Object.assign(new Error(`invalid_grant client_secret=${secret} code=${code} verifier=${codeVerifier}`), {
              config: { data: `client_secret=${secret}&id_token=${idToken}` },
            }),
          )
        : Promise.resolve(verifiedProfile('secret.person@example.com')),
    );
    app = await createTestApp({ logger, overrides: [{ provide: GOOGLE_CLIENT, useValue: client }] });
    const server = app.getHttpServer();

    const success = await callbackWithCookie(app, '?returnTo=/bills');
    throwing = true;
    const failure = await callbackWithCookie(app, '?returnTo=/bills');
    const cancel = await startedSignIn(app);
    const cancelled = await request(server)
      .get(`/api/auth/google/callback?error=access_denied&state=${cancel.state}`)
      .set('Cookie', `${SIGN_IN_COOKIE}=${cancel.signInValue}`);
    const mismatch = await request(server)
      .get(`/api/auth/google/callback?code=stub-code&state=${'B'.repeat(43)}`)
      .set('Cookie', `${SIGN_IN_COOKIE}=${success.signInValue}`);

    const finishes = [success.finish, failure.finish, cancelled, mismatch];
    const secrets = [secret, idToken, 'stub-code'];
    for (const run of [success, failure, cancel]) {
      secrets.push(run.state, decodeSignIn(run.signInValue).verifier);
    }
    const output = [
      ...finishes.map((response) => `${response.text ?? ''}\n${locationOf(response) ?? ''}`),
      ...logger.lines,
    ].join('\n');
    for (const value of secrets) expect(output).not.toContain(value);
    const failures = failureLines(logger);
    expect(failures).toHaveLength(2);
    for (const line of failures) {
      expect(line).toMatch(/^Google sign-in failed: \S/);
      for (const personal of ['secret.person', 'Stub Person']) expect(line).not.toContain(personal);
    }
  });

  // T12: AC11, a failure with a profile: the log line names no email or name.
  it('logs an unverified email failure without the email or name', async () => {
    const logger = new CapturingLogger();
    const client = stubClient(() =>
      Promise.resolve({ email: 'unverified.person@example.com', emailVerified: false, name: 'Unverified Person' }),
    );
    app = await createTestApp({ logger, overrides: [{ provide: GOOGLE_CLIENT, useValue: client }] });

    await callbackWithCookie(app);

    const failures = failureLines(logger);
    expect(failures).toHaveLength(1);
    expect(failures[0]).not.toContain('unverified.person');
    expect(failures[0]).not.toContain('Unverified Person');
  });
});
