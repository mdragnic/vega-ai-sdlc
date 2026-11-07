import { z } from 'zod';

import type { ContractEntry } from './entry.js';
import { nameSchema } from './name-rule.js';
import { currentUserSchema } from './user.js';

// Each field gives one message, its first failing rule (#95 a): every check but the last aborts.

/** A string field whose missing value counts as empty: `message` is its "required" text. */
const requiredString = (message: string) =>
  z.string({ error: (issue) => (issue.input === undefined ? message : undefined) });

/**
 * Full Name (#15, #33, #95) on the one name rule (#120 b, #126 a): trimmed at both ends; nothing visible left "Name is
 * required"; a control character "Name cannot contain tabs or line breaks"; more than 100 code points "Name must be at
 * most 100 characters". For requests only (sign up's, Settings', task 012's Google name made to pass it): no response
 * schema uses it, so a stored name that breaks it still shows (#126 a's condition).
 */
export const fullNameSchema = nameSchema({
  required: 'Name is required',
  control: 'Name cannot contain tabs or line breaks',
  max: 'Name must be at most 100 characters',
});

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

/**
 * A password the user already has, as login takes it: only required and the maximum, the sign up rules do not apply
 * (#14, #95). Login's password and the Security tab's Old Password (task 030, #129 b).
 */
export const currentPasswordSchema = requiredString('Password is required')
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
  password: currentPasswordSchema,
  keepSignedIn: z.boolean(),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** The Security tab's texts beyond the shared password ones (#34, #129 b). */
export const passwordMessages = {
  /** The server's answer to a current password that does not match (#34), under Old Password. */
  currentIncorrect: 'Current password is incorrect',
  /** A new password equal to the current one as typed (#34, #129 b), under New Password. */
  sameAsCurrent: 'New password must be different from the old password',
  /** Retype Password unlike New Password, also empty while New Password is not (#34, #129 b). */
  mismatch: 'Passwords do not match',
} as const;

/** The change's two passwords, each by its own rule: login's for the current one, sign up's for the new one (#15, #95). */
const passwordChangeFields = z.object({
  currentPassword: currentPasswordSchema,
  newPassword: newPasswordSchema,
});

/**
 * The new password differs from the current one, compared exactly as typed (#34, #95 c), its message under New Password.
 * It runs only when New Password passed its own rules, so each field keeps one message, its first failing rule (#95 a).
 * The refinement's input may still be anything when another key failed, so `when` checks its shape first.
 */
const isDifferentFromCurrent = ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
  newPassword !== currentPassword;

const differentFromCurrent = {
  error: passwordMessages.sameAsCurrent,
  path: ['newPassword'],
  when: ({ value }: { value: unknown }) =>
    typeof value === 'object' &&
    value !== null &&
    'currentPassword' in value &&
    'newPassword' in value &&
    typeof value.currentPassword === 'string' &&
    newPasswordSchema.safeParse(value.newPassword).success,
};

/**
 * `PUT /auth/password` (task 030, #34): the current password by login's rule, the new one by sign up's, then the new one
 * different from the current one. Passwords are never trimmed or changed (#95 c). Unknown keys are dropped, so nothing
 * in the body names a user or reaches the backend's logic: the user is the session's (#39).
 */
export const passwordChangeRequestSchema = passwordChangeFields.refine(isDifferentFromCurrent, differentFromCurrent);

export type PasswordChangeRequest = z.infer<typeof passwordChangeRequestSchema>;

/**
 * Retype Password equal to New Password as typed, "Passwords do not match", also when it is empty and New Password is not;
 * nothing when both are empty (#129 b). New Password is compared whatever its own rules say, so its message and this one
 * show together. Its own object: Zod skips an object's refinements once one of its fields stopped at an `abort`, as New
 * Password's rules do.
 */
const retypeMatches = z
  .object({ newPassword: z.unknown(), retypePassword: z.string() })
  .refine(({ newPassword, retypePassword }) => retypePassword === newPassword, {
    error: passwordMessages.mismatch,
    path: ['retypePassword'],
  });

/**
 * The Security tab's form (task 030): the request's rules and the retype's, each side checked on its own and every
 * message given, one per field (#95 a). The retype is the form's only rule of its own: it is never sent.
 */
export const passwordChangeFormSchema = z.intersection(
  passwordChangeFields.extend({ retypePassword: z.string() }).refine(isDifferentFromCurrent, differentFromCurrent),
  retypeMatches,
);

export type PasswordChangeForm = z.infer<typeof passwordChangeFormSchema>;

/** The texts the server sends, which the Login and Sign up screens show (#14, #15, #81). */
export const authMessages = {
  invalidCredentials: 'Email or password is incorrect',
  emailTaken: 'An account with this email already exists',
  googleFailed: 'Google sign-in failed. Please try again.',
} as const;

/**
 * Google sign-in (#75): the two browser routes, relative to `/api` like contract entries, and the Login marker of a
 * failed sign-in (#81). The routes are page navigations that answer with redirects, not JSON endpoints, so they are
 * not contract entries. `start` takes the `returnTo` query parameter (#3).
 */
export const googleSignIn = {
  start: '/auth/google',
  callback: '/auth/google/callback',
  /** Login opened with `googleSignIn=failed` shows `authMessages.googleFailed` (#81). */
  failureParam: 'googleSignIn',
  failureValue: 'failed',
} as const;

/**
 * Sign up (201), login (200), logout (204, no body), the signed-in user (200) and the password change (204, no body,
 * task 030). Sign up and login set the session cookie, logout clears it (#3, #14, #15, #75); the password change sets
 * none: the current session stays and the user's other sessions end (#34, #129 a). The change is the session user's own
 * (#39), so unlike the other writes here it is behind the session guard and its write guard (#119).
 */
export const authContract = {
  signUp: { method: 'POST', path: '/auth/signup', request: signUpRequestSchema, response: currentUserSchema },
  login: { method: 'POST', path: '/auth/login', request: loginRequestSchema, response: currentUserSchema },
  logout: { method: 'POST', path: '/auth/logout', request: undefined, response: z.undefined() },
  me: { method: 'GET', path: '/auth/me', request: undefined, response: currentUserSchema },
  changePassword: {
    method: 'PUT',
    path: '/auth/password',
    request: passwordChangeRequestSchema,
    response: z.undefined(),
  },
} as const satisfies Record<string, ContractEntry>;
