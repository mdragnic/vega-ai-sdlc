import type { CookieSerializeOptions } from '@nestjs/common';
import { googleSignIn } from '@finebank/shared';
import { z } from 'zod';

/** Holds a started Google sign-in until Google returns to the callback (#75). */
export const GOOGLE_SIGN_IN_COOKIE = 'finebank_google_signin';

/** Ten minutes to finish the sign-in on Google (#75). */
const SIGN_IN_LIFETIME_SECONDS = 10 * 60;

/**
 * HttpOnly, SameSite=Lax (Google's redirect back is a top-level GET, which carries it), sent only to the Google
 * routes, host-only. No Secure: plain HTTP on localhost, as the session cookie (#73).
 */
const attributes: CookieSerializeOptions = { httpOnly: true, sameSite: 'lax', path: `/api${googleSignIn.start}` };

export const signInCookieOptions: CookieSerializeOptions = { ...attributes, maxAge: SIGN_IN_LIFETIME_SECONDS };

/** Clearing must name the same path as setting. */
export const clearSignInCookieOptions = attributes;

const randomToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/** The OAuth state, the PKCE verifier, and the page to open after the sign-in when one was asked for (#3). */
const startedSignInSchema = z.strictObject({
  state: randomToken,
  verifier: randomToken,
  returnTo: z.string().optional(),
});

export type StartedSignIn = z.infer<typeof startedSignInSchema>;

/** The cookie value: base64url JSON. */
export const encodeSignIn = (started: StartedSignIn): string =>
  Buffer.from(JSON.stringify(started)).toString('base64url');

/** The started sign-in a cookie holds, or undefined when it is missing, unreadable or of another shape. */
export function decodeSignIn(value: string | undefined): StartedSignIn | undefined {
  if (value === undefined || !/^[A-Za-z0-9_-]+$/.test(value)) return undefined;
  try {
    const parsed = startedSignInSchema.safeParse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
