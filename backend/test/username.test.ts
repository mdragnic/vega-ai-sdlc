import { usernameSchema } from '@finebank/shared';
import { describe, expect, it } from 'vitest';

import { usernameBase, usernameCandidate } from '../src/users/username.js';

// T5: the username from the email (#62, #67, #95 b).
describe('usernameBase', () => {
  it.each([
    ['Marko@x.com', 'marko'],
    ['marko-d@x.com', 'markod'],
    ['first.last_1@x.com', 'first.last_1'],
    ['a+tag@x.com', 'atag'],
    ["o'neil@x.com", 'oneil'],
    ['jo@x.com', 'jo1'],
    ['j@x.com', 'j12'],
    ['-@example.com', '123'],
    ['+@example.com', '123'],
    ['j-@x.com', 'j12'],
    [`${'abcdefghij'.repeat(4)}@x.com`, 'abcdefghijabcdefghijabcdef'],
  ])('%s gives %s', (email, expected) => {
    expect(usernameBase(email)).toBe(expected);
    expect(usernameSchema.safeParse(expected).success).toBe(true);
  });
});

// T5: when a username is taken, the uniqueness number counts from 2 (#62, #67).
describe('usernameCandidate', () => {
  it.each([
    ['marko', 1, 'marko'],
    ['marko', 2, 'marko2'],
    ['marko', 3, 'marko3'],
    ['jo1', 2, 'jo12'],
    ['jo1', 3, 'jo13'],
    ['123', 2, '1232'],
  ])('%s with number %i gives %s', (base, n, expected) => {
    expect(usernameCandidate(base, n)).toBe(expected);
  });

  it('stays within 30 characters for a 26-character base', () => {
    const base = 'abcdefghij'.repeat(2) + 'abcdef';

    for (const n of [2, 99, 9999, 10_000, 123_456]) {
      const candidate = usernameCandidate(base, n);
      expect(candidate.endsWith(String(n))).toBe(true);
      expect(usernameSchema.safeParse(candidate).success).toBe(true);
    }
    expect(usernameCandidate(base, 9999)).toBe(`${base}9999`);
  });
});
