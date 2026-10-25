import type { CookieSerializeOptions } from '@nestjs/common';

export const SESSION_COOKIE = 'finebank_session';

/** A session lasts 30 days from its start, never extended (#14, #63, #75). */
export const SESSION_LIFETIME_SECONDS = 30 * 24 * 60 * 60;

/**
 * HttpOnly, SameSite=Lax (#75), only sent to the API, host-only (no Domain). No Secure: the app
 * runs over plain HTTP on localhost only (#73).
 */
const attributes: CookieSerializeOptions = { httpOnly: true, sameSite: 'lax', path: '/api' };

/**
 * Sign up and "Keep me signed in": a 30-day cookie. Otherwise no Max-Age or Expires, so the
 * browser drops it on close (#14, #63, #75).
 */
export function sessionCookieOptions(keepSignedIn: boolean): CookieSerializeOptions {
  return keepSignedIn ? { ...attributes, maxAge: SESSION_LIFETIME_SECONDS } : attributes;
}

/** Clearing must name the same path as setting. */
export const clearSessionCookieOptions = attributes;

/**
 * The session token in a Cookie header, read like `@Cookies()` reads it: the first pair with
 * the name wins, spaces and tabs around it removed. Tokens are base64url, so a value that would
 * need unquoting or decoding is no token of ours and finds no session.
 */
export function readSessionToken(header: string | undefined): string | undefined {
  for (const pair of (header ?? '').split(';')) {
    const eq = pair.indexOf('=');
    if (eq !== -1 && trimSpaces(pair.slice(0, eq)) === SESSION_COOKIE) {
      return trimSpaces(pair.slice(eq + 1));
    }
  }
  return undefined;
}

const trimSpaces = (text: string): string => text.replace(/^[ \t]+|[ \t]+$/g, '');
