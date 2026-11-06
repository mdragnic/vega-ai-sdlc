import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import { currentUserSchema, profileMessages, usernameSchema } from '../src/index.js';

/** The messages a value fails with, one per issue; empty when it passes. */
function messages(schema: z.ZodType, value: unknown): string[] {
  const result = schema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

// T1: the username rule of #62 with the character classes of #95 (d).
describe('usernameSchema', () => {
  it.each(['abc', 'a'.repeat(30), 'tanzir.rahman', 'first.last_1', '123', '._.', 'a_b.c1'])(
    'accepts %j',
    (username) => {
      expect(usernameSchema.parse(username)).toBe(username);
    },
  );

  it.each([
    ['2 characters', 'ab'],
    ['31 characters', 'a'.repeat(31)],
    ['empty', ''],
    ['upper case', 'Marko'],
    ['a hyphen', 'marko-d'],
    ['a letter outside a to z', 'šime'],
    ['a space', 'marko d'],
    ['a plus', 'a+tag'],
  ])('rejects %s', (_case, username) => {
    expect(usernameSchema.safeParse(username).success).toBe(false);
  });

  // Task 028 T1 (#126 b): trimmed at both ends, nothing else changed.
  it('trims the spaces around a username', () => {
    expect(usernameSchema.parse(' marko ')).toBe('marko');
  });

  // Task 028 T1 (#126 b): one message, the first failing rule (#95 a); lengths in code points.
  it.each([
    ['empty', '', 'Username is required'],
    ['only spaces', '   ', 'Username is required'],
    ['missing', undefined, 'Username is required'],
    ['2 characters', 'ab', 'Username must be at least 3 characters'],
    ['2 emoji (2 code points, 4 UTF-16 code units)', '\u{1F600}\u{1F600}', 'Username must be at least 3 characters'],
    ['31 characters', 'a'.repeat(31), 'Username must be at most 30 characters'],
    ['a hyphen', 'marko-d', 'Username can only contain lowercase letters, numbers, dots and underscores'],
    ['an uppercase letter', 'Marko', 'Username can only contain lowercase letters, numbers, dots and underscores'],
    ['a space inside', 'mar ko', 'Username can only contain lowercase letters, numbers, dots and underscores'],
    ['an emoji', 'marko\u{1F600}', 'Username can only contain lowercase letters, numbers, dots and underscores'],
  ])('rejects %s with only its first failing message', (_case, value, message) => {
    expect(messages(usernameSchema, value)).toEqual([message]);
  });

  it('names the taken username’s text (#62)', () => {
    expect(profileMessages.usernameTaken).toBe('This username is already taken');
  });
});

// T1: the signed-in user as the API returns it (#74).
describe('currentUserSchema', () => {
  it('accepts the full name, email and username', () => {
    const user = { fullName: 'Tanzir Rahman', email: 'tanzir@example.com', username: 'tanzir' };

    expect(currentUserSchema.parse(user)).toEqual(user);
  });

  it.each([
    ['no username', { fullName: 'Tanzir Rahman', email: 'tanzir@example.com' }],
    ['a username that breaks the rule', { fullName: 'Tanzir Rahman', email: 'tanzir@example.com', username: 'Tz' }],
    ['no email', { fullName: 'Tanzir Rahman', username: 'tanzir' }],
    ['no full name', { email: 'tanzir@example.com', username: 'tanzir' }],
  ])('rejects %s', (_case, user) => {
    expect(currentUserSchema.safeParse(user).success).toBe(false);
  });

  // Task 028 T1 (#126 a's condition): the stricter name rule is for requests only; a response shows any stored name.
  it.each([
    ['a tab', 'A\tB'],
    ['only a zero-width space', '\u200B'],
    ['101 letters', 'a'.repeat(101)],
  ])('accepts a stored Full name with %s, unchanged', (_case, fullName) => {
    const user = { fullName, email: 'tanzir@example.com', username: 'tanzir' };

    expect(currentUserSchema.parse(user)).toEqual(user);
  });
});

// Task 029 T2: the photo's update time, present only when a photo is stored (#76): an ISO instant in UTC (#74).
describe('currentUserSchema photoUpdatedAt', () => {
  const user = { fullName: 'Tanzir Rahman', email: 'tanzir@example.com', username: 'tanzir' };

  it('accepts a user without a photo, with no such key', () => {
    expect(currentUserSchema.parse(user)).toEqual(user);
  });

  it.each(['2026-10-22T10:00:00.000Z', '2026-10-22T10:00:00Z'])('accepts %j unchanged', (photoUpdatedAt) => {
    expect(currentUserSchema.parse({ ...user, photoUpdatedAt })).toEqual({ ...user, photoUpdatedAt });
  });

  it.each([
    ['local time', '2026-10-22T10:00:00'],
    ['an offset', '2026-10-22T12:00:00+02:00'],
    ['a date only', '2026-10-22'],
    ['a number', 1_792_921_656_294],
    ['null', null],
  ])('rejects %s', (_case, photoUpdatedAt) => {
    expect(currentUserSchema.safeParse({ ...user, photoUpdatedAt }).success).toBe(false);
  });
});
