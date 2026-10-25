import { createHash } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { type CurrentUser, currentUserSchema } from '@finebank/shared';
import request, { type Response } from 'supertest';
import { expect } from 'vitest';

/** The session cookie's name, as #75 and the task define it. */
export const SESSION_COOKIE = 'finebank_session';

export interface SetCookie {
  name: string;
  value: string;
  /** Attribute names in lower case; flags such as HttpOnly are `true`. */
  attributes: Record<string, string | true>;
}

/** Every Set-Cookie header of a response, parsed. */
export function setCookies(response: Response): SetCookie[] {
  const header: unknown = response.headers['set-cookie'];
  const lines = Array.isArray(header) ? header.map(String) : typeof header === 'string' ? [header] : [];
  return lines.map((line) => {
    const [pair = '', ...rest] = line.split(';').map((part) => part.trim());
    const eq = pair.indexOf('=');
    const attributes: Record<string, string | true> = {};
    for (const attribute of rest) {
      const at = attribute.indexOf('=');
      if (at === -1) attributes[attribute.toLowerCase()] = true;
      else attributes[attribute.slice(0, at).toLowerCase()] = attribute.slice(at + 1);
    }
    return { name: pair.slice(0, eq), value: pair.slice(eq + 1), attributes };
  });
}

/** The one session cookie a response sets; fails the test when there is none or more than one. */
export function sessionCookie(response: Response): SetCookie {
  const cookies = setCookies(response).filter((cookie) => cookie.name === SESSION_COOKIE);
  expect(cookies).toHaveLength(1);
  return cookies[0]!;
}

/** The Cookie request header that presents a session token. */
export const cookieFor = (token: string): string => `${SESSION_COOKIE}=${token}`;

/** SHA-256 in hex, computed here independently of the app. */
export const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');

let userCount = 0;

/** Valid sign up fields with a unique email. */
export function newUser(overrides: Partial<Record<'fullName' | 'email' | 'password', string>> = {}) {
  userCount += 1;
  return { fullName: 'Tanzir Rahman', email: `user${userCount}@example.com`, password: 'abcdef12', ...overrides };
}

/** Signs up through the API and returns the user and the session token from the cookie. */
export async function signUp(
  app: INestApplication,
  fields: Partial<Record<'fullName' | 'email' | 'password', string>> = {},
): Promise<{ user: CurrentUser; token: string }> {
  const response = await request(app.getHttpServer()).post('/api/auth/signup').send(newUser(fields));
  expect(response.status).toBe(201);
  return { user: currentUserSchema.parse(response.body), token: sessionCookie(response).value };
}

/** Logs in through the API and returns the response. */
export function login(
  app: INestApplication,
  body: { email: string; password: string; keepSignedIn?: boolean },
  cookie?: string,
) {
  const req = request(app.getHttpServer()).post('/api/auth/login');
  return (cookie ? req.set('Cookie', cookie) : req).send({ keepSignedIn: true, ...body });
}

/** GET /api/auth/me with a session token, or without a cookie. */
export function me(app: INestApplication, token?: string) {
  const req = request(app.getHttpServer()).get('/api/auth/me');
  return token === undefined ? req : req.set('Cookie', cookieFor(token));
}
