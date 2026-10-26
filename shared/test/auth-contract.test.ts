import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import {
  authContract,
  authMessages,
  currentUserSchema,
  emailSchema,
  fullNameSchema,
  googleSignIn,
  loginRequestSchema,
  newPasswordSchema,
  signUpRequestSchema,
} from '../src/index.js';

/** The messages a value fails with, one per issue; empty when it passes. */
function messages(schema: z.ZodType, value: unknown): string[] {
  const result = schema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

/** Field name to message, as the backend's field errors show them. */
function fieldMessages(schema: z.ZodType, value: unknown): Record<string, string[]> {
  const result = schema.safeParse(value);
  const fields: Record<string, string[]> = {};
  for (const issue of result.success ? [] : result.error.issues) {
    (fields[issue.path.join('.')] ??= []).push(issue.message);
  }
  return fields;
}

// T1: Name is trimmed, then required and at most 100 characters (#15, #95 a, c).
describe('fullNameSchema', () => {
  it.each([
    ['empty', '', 'Name is required'],
    ['only spaces', '   ', 'Name is required'],
    ['missing', undefined, 'Name is required'],
    ['101 characters after trimming', ` ${'a'.repeat(101)} `, 'Name must be at most 100 characters'],
  ])('rejects %s with only %j', (_case, value, message) => {
    expect(messages(fullNameSchema, value)).toEqual([message]);
  });

  it('accepts 100 characters after trimming the padding', () => {
    expect(fullNameSchema.parse(`  ${'a'.repeat(100)}  `)).toBe('a'.repeat(100));
  });

  it('trims both ends and keeps inner spaces as typed', () => {
    expect(fullNameSchema.parse('  Tanzir   Rahman \t')).toBe('Tanzir   Rahman');
  });
});

// T1: Email is trimmed, then required and a valid format, then lowercased (#14, #15, #95 a, c).
describe('emailSchema', () => {
  it.each([
    ['empty', '', 'Email is required'],
    ['only spaces', '   ', 'Email is required'],
    ['missing', undefined, 'Email is required'],
    ['without @', 'tanzir.example.com', 'Enter a valid email address'],
    ['without a domain', 'tanzir@', 'Enter a valid email address'],
    ['with a space inside', 'tan zir@example.com', 'Enter a valid email address'],
  ])('rejects %s with only %j', (_case, value, message) => {
    expect(messages(emailSchema, value)).toEqual([message]);
  });

  it('trims the padding and lowercases', () => {
    expect(emailSchema.parse('  Tanzir.Rahman@Example.COM  ')).toBe('tanzir.rahman@example.com');
  });

  it('accepts a local part of only a hyphen, as Zod email does', () => {
    expect(emailSchema.parse('-@example.com')).toBe('-@example.com');
  });
});

// T1: the sign up password, as typed: required, 8 to 128 characters, a letter and a digit (#15, #95 a, d).
describe('newPasswordSchema', () => {
  it.each([
    ['empty', '', 'Password is required'],
    ['missing', undefined, 'Password is required'],
    ['7 characters', 'abcdef1', 'Password must be at least 8 characters'],
    ['129 characters', `a1${'x'.repeat(127)}`, 'Password must be at most 128 characters'],
    ['no letter', '12345678', 'Password must contain at least one letter and one number'],
    ['no digit', 'abcdefgh', 'Password must contain at least one letter and one number'],
    ['an Arabic-Indic digit only', 'abcdefg١', 'Password must contain at least one letter and one number'],
    ['8 spaces', '        ', 'Password must contain at least one letter and one number'],
  ])('rejects %s with only %j', (_case, value, message) => {
    expect(messages(newPasswordSchema, value)).toEqual([message]);
  });

  it.each([
    ['8 characters', 'abcdefg1'],
    ['128 characters', `a1${'x'.repeat(126)}`],
    ['Unicode letters', 'ššššššš1'],
    ['a digit before the letter', '1ćććććććć'],
    ['a letter and a digit on different lines', 'abcdefg\n1'],
  ])('accepts %s', (_case, value) => {
    expect(newPasswordSchema.parse(value)).toBe(value);
  });

  it('keeps spaces around the password as typed', () => {
    expect(newPasswordSchema.parse('  abcdef1  ')).toBe('  abcdef1  ');
  });
});

// T1: sign up checks every field and gives one message per failing field (#95 a).
describe('signUpRequestSchema', () => {
  it('gives the first failing rule of each field', () => {
    expect(fieldMessages(signUpRequestSchema, { fullName: ' ', email: 'nope', password: 'short' })).toEqual({
      fullName: ['Name is required'],
      email: ['Enter a valid email address'],
      password: ['Password must be at least 8 characters'],
    });
  });

  it('gives the required messages for an empty body', () => {
    expect(fieldMessages(signUpRequestSchema, {})).toEqual({
      fullName: ['Name is required'],
      email: ['Email is required'],
      password: ['Password is required'],
    });
  });

  it('returns the trimmed name, the trimmed lowercase email and the password as typed', () => {
    expect(
      signUpRequestSchema.parse({ fullName: ' Tanzir Rahman ', email: ' Tanzir@Example.com ', password: ' abcdef12 ' }),
    ).toEqual({ fullName: 'Tanzir Rahman', email: 'tanzir@example.com', password: ' abcdef12 ' });
  });
});

// T1: login checks only that the password is there and at most 128 characters (#14, #95 a).
describe('loginRequestSchema', () => {
  const valid = { email: 'tanzir@example.com', password: 'abc', keepSignedIn: true };

  it('accepts a short password without a digit: the sign up rules do not apply', () => {
    expect(loginRequestSchema.parse(valid)).toEqual(valid);
  });

  it('accepts a password of 128 characters as typed', () => {
    const password = ` ${'x'.repeat(126)} `;

    expect(loginRequestSchema.parse({ ...valid, password }).password).toBe(password);
  });

  it.each([
    ['an empty password', { ...valid, password: '' }, { password: ['Password is required'] }],
    [
      'a password of 129 characters',
      { ...valid, password: 'x'.repeat(129) },
      { password: ['Password must be at most 128 characters'] },
    ],
    ['an empty email', { ...valid, email: '' }, { email: ['Email is required'] }],
    ['a malformed email', { ...valid, email: 'tanzir@' }, { email: ['Enter a valid email address'] }],
  ])('rejects %s', (_case, value, expected) => {
    expect(fieldMessages(loginRequestSchema, value)).toEqual(expected);
  });

  it('requires keepSignedIn as a boolean', () => {
    expect(Object.keys(fieldMessages(loginRequestSchema, { email: valid.email, password: 'abc' }))).toEqual([
      'keepSignedIn',
    ]);
    expect(Object.keys(fieldMessages(loginRequestSchema, { ...valid, keepSignedIn: 'yes' }))).toEqual(['keepSignedIn']);
  });

  it('trims and lowercases the email', () => {
    expect(loginRequestSchema.parse({ ...valid, email: ' Tanzir@Example.com ' }).email).toBe('tanzir@example.com');
  });
});

// T1: the four auth endpoints exist once in the contract (#74, AC15).
describe('authContract', () => {
  it('declares sign up, login, logout and me under /auth', () => {
    expect(authContract.signUp).toMatchObject({ method: 'POST', path: '/auth/signup' });
    expect(authContract.login).toMatchObject({ method: 'POST', path: '/auth/login' });
    expect(authContract.logout).toMatchObject({ method: 'POST', path: '/auth/logout', request: undefined });
    expect(authContract.me).toMatchObject({ method: 'GET', path: '/auth/me', request: undefined });
  });

  it('uses the shared schemas for requests and responses', () => {
    expect(authContract.signUp.request).toBe(signUpRequestSchema);
    expect(authContract.login.request).toBe(loginRequestSchema);
    expect(authContract.signUp.response).toBe(currentUserSchema);
    expect(authContract.login.response).toBe(currentUserSchema);
    expect(authContract.me.response).toBe(currentUserSchema);
  });

  it('expects no body from logout', () => {
    expect(authContract.logout.response.safeParse(undefined).success).toBe(true);
    expect(authContract.logout.response.safeParse({}).success).toBe(false);
  });

  it('exports the server messages, the Google failure one included (#81)', () => {
    expect(authMessages).toEqual({
      invalidCredentials: 'Email or password is incorrect',
      emailTaken: 'An account with this email already exists',
      googleFailed: 'Google sign-in failed. Please try again.',
    });
  });
});

// Task 012 T17: the Google browser routes and the Login marker of a failed sign-in exist once (#74, #75, #81).
describe('googleSignIn', () => {
  it('names the start and callback routes, relative to /api', () => {
    expect(googleSignIn.start).toBe('/auth/google');
    expect(googleSignIn.callback).toBe('/auth/google/callback');
  });

  it('marks a failed sign-in on Login with googleSignIn=failed', () => {
    expect(new URLSearchParams({ [googleSignIn.failureParam]: googleSignIn.failureValue }).toString()).toBe(
      'googleSignIn=failed',
    );
  });
});
