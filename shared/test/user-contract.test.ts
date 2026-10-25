import { describe, expect, it } from 'vitest';

import { currentUserSchema, usernameSchema } from '../src/index.js';

// T1: the username rule of #62 with the character classes of #95 (d).
describe('usernameSchema', () => {
  it.each(['abc', 'a'.repeat(30), 'tanzir.rahman', 'first.last_1', '123', '._.'])('accepts %j', (username) => {
    expect(usernameSchema.safeParse(username).success).toBe(true);
  });

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
});
