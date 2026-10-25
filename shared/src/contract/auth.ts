import { z } from 'zod';

import type { ContractEntry } from './entry.js';
import { currentUserSchema } from './user.js';

// Each field gives one message, its first failing rule (#95 a): every check but the last aborts.

/** A string field whose missing value counts as empty: `message` is its "required" text. */
const requiredString = (message: string) =>
  z.string({ error: (issue) => (issue.input === undefined ? message : undefined) });

/** Full Name: trimmed at both ends, then required and at most 100 characters (#15, #95). */
export const fullNameSchema = requiredString('Name is required')
  .trim()
  .min(1, { error: 'Name is required', abort: true })
  .max(100, { error: 'Name must be at most 100 characters' });

/** Email: trimmed at both ends, then required and a valid format, then lowercased (#14, #15, #95). */
export const emailSchema = requiredString('Email is required')
  .trim()
  .min(1, { error: 'Email is required', abort: true })
  .pipe(z.email({ error: 'Enter a valid email address' }).toLowerCase());

/**
 * A password that gets hashed is at most 128 characters, a guard against slow hashing (#95 a).
 * Passwords are never trimmed or changed.
 */
const passwordMax = { error: 'Password must be at most 128 characters', abort: true } as const;

/**
 * The sign up password (#15, #95): at least 8 characters, a letter (any Unicode letter) and a
 * digit `0` to `9`.
 */
export const newPasswordSchema = requiredString('Password is required')
  .min(1, { error: 'Password is required', abort: true })
  .min(8, { error: 'Password must be at least 8 characters', abort: true })
  .max(128, passwordMax)
  .regex(/^(?=.*\p{L})(?=.*[0-9])/su, { error: 'Password must contain at least one letter and one number' });

/** The login password: only required and the maximum, the sign up rules do not apply (#14, #95). */
const loginPasswordSchema = requiredString('Password is required')
  .min(1, { error: 'Password is required', abort: true })
  .max(128, passwordMax);

export const signUpRequestSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: newPasswordSchema,
});

export type SignUpRequest = z.infer<typeof signUpRequestSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
  keepSignedIn: z.boolean(),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** The texts the server sends, which the Login and Sign up screens show (#14, #15). */
export const authMessages = {
  invalidCredentials: 'Email or password is incorrect',
  emailTaken: 'An account with this email already exists',
} as const;

/**
 * Sign up (201), login (200), logout (204, no body) and the signed-in user (200). Sign up and
 * login set the session cookie, logout clears it (#3, #14, #15, #75).
 */
export const authContract = {
  signUp: { method: 'POST', path: '/auth/signup', request: signUpRequestSchema, response: currentUserSchema },
  login: { method: 'POST', path: '/auth/login', request: loginRequestSchema, response: currentUserSchema },
  logout: { method: 'POST', path: '/auth/logout', request: undefined, response: z.undefined() },
  me: { method: 'GET', path: '/auth/me', request: undefined, response: currentUserSchema },
} as const satisfies Record<string, ContractEntry>;
