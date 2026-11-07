import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import {
  authContract,
  currentPasswordSchema,
  loginRequestSchema,
  passwordChangeFormSchema,
  passwordChangeRequestSchema,
  passwordMessages,
} from '../src/index.js';

/** Field name to messages, as the backend's field errors show them (every message, so a second one would show). */
function fieldMessages(schema: z.ZodType, value: unknown): Record<string, string[]> {
  const result = schema.safeParse(value);
  const fields: Record<string, string[]> = {};
  for (const issue of result.success ? [] : result.error.issues) {
    (fields[issue.path.join('.')] ??= []).push(issue.message);
  }
  return fields;
}

const text = {
  required: 'Password is required',
  max: 'Password must be at most 128 characters',
  min: 'Password must be at least 8 characters',
  letterAndNumber: 'Password must contain at least one letter and one number',
  same: 'New password must be different from the old password',
  incorrect: 'Current password is incorrect',
  mismatch: 'Passwords do not match',
};

const current = 'old-pass1';
const valid = { currentPassword: current, newPassword: 'newpass12' };
const validForm = { ...valid, retypePassword: valid.newPassword };

/** 8 and 128 characters, a letter beyond ASCII, spaces around and inside: each valid and kept exactly as typed (#95 c). */
const validNewPasswords: [string, string][] = [
  ['exactly 8 characters', 'abcdefg1'],
  ['exactly 128 characters', `a1${'x'.repeat(126)}`],
  ['Šifra123', 'Šifra123'],
  ['spaces around and inside', '  my pass 1  '],
];

// T1: AC5, AC11: the rules of the change, one shared module (#74, #95, #129 b).
describe('passwordMessages', () => {
  it('names the change’s texts (#34, #129 b)', () => {
    expect(passwordMessages).toEqual({
      currentIncorrect: text.incorrect,
      sameAsCurrent: text.same,
      mismatch: text.mismatch,
    });
  });
});

describe('currentPasswordSchema', () => {
  it('is login’s password rule: login still uses it', () => {
    expect(loginRequestSchema.shape.password).toBe(currentPasswordSchema);
  });
});

describe('passwordChangeRequestSchema', () => {
  it.each(validNewPasswords)('accepts a new password of %s, unchanged', (_case, newPassword) => {
    expect(passwordChangeRequestSchema.parse({ currentPassword: current, newPassword })).toEqual({
      currentPassword: current,
      newPassword,
    });
  });

  it('keeps the current password exactly as typed, spaces included', () => {
    expect(passwordChangeRequestSchema.parse({ ...valid, currentPassword: '  a b  ' }).currentPassword).toBe('  a b  ');
  });

  it('accepts a current password of 128 characters and of one', () => {
    expect(passwordChangeRequestSchema.safeParse({ ...valid, currentPassword: 'x'.repeat(128) }).success).toBe(true);
    expect(passwordChangeRequestSchema.safeParse({ ...valid, currentPassword: 'x' }).success).toBe(true);
  });

  it.each([
    ['empty', '', text.required],
    ['missing', undefined, text.required],
    ['7 characters', 'abcdef1', text.min],
    ['129 characters', `a1${'x'.repeat(127)}`, text.max],
    ['no letter', '12345678', text.letterAndNumber],
    ['no number', 'abcdefgh', text.letterAndNumber],
    ['the current password exactly', current, text.same],
  ])('refuses a new password %s with only %j under newPassword', (_case, newPassword, message) => {
    expect(fieldMessages(passwordChangeRequestSchema, { currentPassword: current, newPassword })).toEqual({
      newPassword: [message],
    });
  });

  it('compares the new password with the current one exactly as typed: a space or a case differs', () => {
    expect(
      passwordChangeRequestSchema.safeParse({ currentPassword: 'abcdefg1', newPassword: 'abcdefg1 ' }).success,
    ).toBe(true);
    expect(
      passwordChangeRequestSchema.safeParse({ currentPassword: 'abcdefg1', newPassword: 'Abcdefg1' }).success,
    ).toBe(true);
  });

  it('gives the same-as-current message only when the new password passed its own rules', () => {
    // 129 characters typed in both: the length message only.
    const long = `a1${'x'.repeat(127)}`;

    expect(fieldMessages(passwordChangeRequestSchema, { currentPassword: long, newPassword: long })).toEqual({
      currentPassword: [text.max],
      newPassword: [text.max],
    });
    expect(fieldMessages(passwordChangeRequestSchema, { currentPassword: 'short', newPassword: 'short' })).toEqual({
      newPassword: [text.min],
    });
  });

  it.each([
    ['empty', '', text.required],
    ['missing', undefined, text.required],
    ['129 characters', 'x'.repeat(129), text.max],
  ])('refuses a current password %s with only %j under currentPassword', (_case, currentPassword, message) => {
    expect(fieldMessages(passwordChangeRequestSchema, { currentPassword, newPassword: 'newpass12' })).toEqual({
      currentPassword: [message],
    });
  });

  it('gives each failing field its one message at once', () => {
    expect(fieldMessages(passwordChangeRequestSchema, {})).toEqual({
      currentPassword: [text.required],
      newPassword: [text.required],
    });
  });

  it.each([
    ['a number', 12345678],
    ['an array', ['newpass12']],
    ['null', null],
  ])('refuses a new password that is %s under newPassword', (_case, newPassword) => {
    expect(Object.keys(fieldMessages(passwordChangeRequestSchema, { currentPassword: current, newPassword }))).toEqual([
      'newPassword',
    ]);
  });

  it('refuses a JSON array as the body', () => {
    expect(passwordChangeRequestSchema.safeParse([current, 'newpass12']).success).toBe(false);
  });

  it('drops every other key: the retype, a user ID, an email, a hash', () => {
    const parsed = passwordChangeRequestSchema.parse({
      ...valid,
      retypePassword: 'newpass12',
      userId: 1,
      email: 'someone@example.com',
      passwordHash: 'scrypt$1$1$1$a$b',
    });

    expect(parsed).toEqual(valid);
    expect(Object.keys(passwordChangeRequestSchema.shape)).toEqual(['currentPassword', 'newPassword']);
  });
});

describe('passwordChangeFormSchema', () => {
  it.each(validNewPasswords)('accepts a new password of %s retyped, unchanged', (_case, newPassword) => {
    expect(
      passwordChangeFormSchema.parse({ currentPassword: current, newPassword, retypePassword: newPassword }),
    ).toEqual({ currentPassword: current, newPassword, retypePassword: newPassword });
  });

  it.each([
    ['different', 'newpass13'],
    ['empty while New Password is not', ''],
    ['the new password with a space after it', 'newpass12 '],
  ])('refuses a retype %s with only "Passwords do not match" under retypePassword', (_case, retypePassword) => {
    expect(fieldMessages(passwordChangeFormSchema, { ...valid, retypePassword })).toEqual({
      retypePassword: [text.mismatch],
    });
  });

  it('gives nothing under Retype Password when it and New Password are both empty', () => {
    expect(
      fieldMessages(passwordChangeFormSchema, { currentPassword: current, newPassword: '', retypePassword: '' }),
    ).toEqual({ newPassword: [text.required] });
  });

  it('shows a mismatch beside New Password’s own message: each field its first failing rule', () => {
    expect(
      fieldMessages(passwordChangeFormSchema, { currentPassword: current, newPassword: 'abc', retypePassword: 'abd' }),
    ).toEqual({ newPassword: [text.min], retypePassword: [text.mismatch] });
  });

  it('applies the request’s rules: the same as the current one, under New Password', () => {
    expect(
      fieldMessages(passwordChangeFormSchema, {
        currentPassword: current,
        newPassword: current,
        retypePassword: current,
      }),
    ).toEqual({ newPassword: [text.same] });
  });

  it('gives every field its message at once: all three empty but New typed short and retyped otherwise', () => {
    expect(
      fieldMessages(passwordChangeFormSchema, { currentPassword: '', newPassword: 'abc', retypePassword: '' }),
    ).toEqual({
      currentPassword: [text.required],
      newPassword: [text.min],
      retypePassword: [text.mismatch],
    });
  });

  it('gives the request’s two keys and the retype, dropping any other', () => {
    expect(Object.keys(passwordChangeFormSchema.parse({ ...validForm, userId: 1 }))).toEqual([
      'currentPassword',
      'newPassword',
      'retypePassword',
    ]);
  });
});

describe('authContract.changePassword', () => {
  it('declares PUT /auth/password with the request schema and no body in the answer (204)', () => {
    expect(authContract.changePassword).toMatchObject({ method: 'PUT', path: '/auth/password' });
    expect(authContract.changePassword.request).toBe(passwordChangeRequestSchema);
    expect(authContract.changePassword.response.safeParse(undefined).success).toBe(true);
    expect(authContract.changePassword.response.safeParse({}).success).toBe(false);
    expect(authContract.changePassword).not.toHaveProperty('encoding');
    expect(authContract.changePassword).not.toHaveProperty('query');
    expect(authContract.changePassword).not.toHaveProperty('params');
  });
});
