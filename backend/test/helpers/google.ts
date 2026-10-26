import { createHash, randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import request, { type Response } from 'supertest';
import { expect } from 'vitest';

import { cookieFor, type SetCookie, setCookies } from './auth.js';

/** The sign-in cookie's name and content, as #75 and the task define them. */
export const SIGN_IN_COOKIE = 'finebank_google_signin';

export interface SignInContent {
  state: string;
  verifier: string;
  returnTo?: string;
}

/** A cookie value as the backend writes it: base64url JSON. */
export const encodeSignIn = (content: object): string => Buffer.from(JSON.stringify(content)).toString('base64url');

export const decodeSignIn = (value: string): SignInContent =>
  JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as SignInContent;

/** The PKCE S256 challenge of a verifier, computed here independently of the app. */
export const s256 = (verifier: string): string => createHash('sha256').update(verifier).digest('base64url');

/** An email no other test uses. */
export const uniqueEmail = (): string => `${randomUUID()}@example.com`;

/** The one sign-in cookie a response sets, or undefined. */
export function signInCookie(response: Response): SetCookie | undefined {
  const cookies = setCookies(response).filter((cookie) => cookie.name === SIGN_IN_COOKIE);
  expect(cookies.length).toBeLessThanOrEqual(1);
  return cookies[0];
}

/** The `Location` header of a redirect. */
export const locationOf = (response: Response): string | undefined => response.headers.location;

/** `GET /api/auth/google` with a raw query string, `''` or `?returnTo=…`. */
export function startSignIn(app: INestApplication, query = '') {
  return request(app.getHttpServer()).get(`/api/auth/google${query}`);
}

/** The fields of the fake Google page; each one as entered there. */
export interface FakeProfile {
  name?: string;
  email?: string;
  emailVerified?: boolean;
}

export type FakeAction = 'continue' | 'cancel' | 'fail';

/**
 * Submits the fake Google page of `authorizationUrl` as a browser would, with its prefilled profile changed by
 * `profile`, and returns the callback URL it redirects to.
 */
export async function decideOnFakeGoogle(
  app: INestApplication,
  authorizationUrl: string,
  profile: FakeProfile = {},
  action: FakeAction = 'continue',
): Promise<URL> {
  const url = new URL(authorizationUrl, 'http://localhost:5173');
  const fields: Record<string, string> = {
    state: url.searchParams.get('state') ?? '',
    code_challenge: url.searchParams.get('code_challenge') ?? '',
    name: profile.name ?? 'Google Tester',
    email: profile.email ?? 'google.tester@example.com',
    action,
  };
  if (profile.emailVerified ?? true) fields.email_verified = 'on';
  const response = await request(app.getHttpServer()).post(url.pathname).type('form').send(fields);
  expect(response.status).toBe(302);
  return new URL(locationOf(response)!);
}

/** `GET` of a callback URL with the Cookie header the browser would send. */
export function openCallback(app: INestApplication, callbackUrl: URL, cookies: string[] = []) {
  const req = request(app.getHttpServer()).get(`${callbackUrl.pathname}${callbackUrl.search}`);
  return cookies.length > 0 ? req.set('Cookie', cookies.join('; ')) : req;
}

/** The whole sign-in through the fake: start, the fake page, then the callback with the browser's cookies. */
export async function googleRoundTrip(
  app: INestApplication,
  options: { query?: string; profile?: FakeProfile; action?: FakeAction; sessionToken?: string } = {},
) {
  const start = await startSignIn(app, options.query ?? '');
  const signInValue = signInCookie(start)!.value;
  const callbackUrl = await decideOnFakeGoogle(app, locationOf(start)!, options.profile, options.action);
  const cookies = [`${SIGN_IN_COOKIE}=${signInValue}`];
  if (options.sessionToken !== undefined) cookies.push(cookieFor(options.sessionToken));
  const finish = await openCallback(app, callbackUrl, cookies);
  return { start, signInValue, signIn: decodeSignIn(signInValue), callbackUrl, finish };
}
