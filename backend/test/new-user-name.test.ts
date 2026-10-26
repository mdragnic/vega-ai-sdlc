import { fullNameSchema } from '@finebank/shared';
import { describe, expect, it } from 'vitest';

import { newUserName } from '../src/auth/google/new-user-name.js';

const letters = (count: number) => 'abcdefghij'.repeat(Math.ceil(count / 10)).slice(0, count);

// Task 012 T30: the name of a new Google user (#62, #103).
describe('newUserName', () => {
  it.each([
    ['the profile name, trimmed', { name: '  Tanzir Rahman ', email: 'tanzir@x.com' }, 'Tanzir Rahman'],
    [
      'the email before @, as Google gives it, with no name',
      { name: undefined, email: 'Marko.D@gmail.com' },
      'Marko.D',
    ],
    ['the email before @ for a name of only spaces', { name: '   ', email: 'jo@x.com' }, 'jo'],
    ['an empty name as no name', { name: '', email: 'jo@x.com' }, 'jo'],
    ['the first 100 of 150 letters', { name: letters(150), email: 'a@x.com' }, letters(100)],
    [
      'the first 99 when the 100th is a space (cut, then trimmed)',
      { name: `${letters(99)} ${letters(20)}`, email: 'a@x.com' },
      letters(99),
    ],
    [
      'the first 99 when a surrogate pair sits at 100 and 101',
      { name: `${letters(99)}😀${letters(5)}`, email: 'a@x.com' },
      letters(99),
    ],
    ['a long local part of the email, cut to 100', { name: undefined, email: `${letters(120)}@x.com` }, letters(100)],
    ['exactly 100 characters, unchanged', { name: letters(100), email: 'a@x.com' }, letters(100)],
  ])('gives %s', (_case, profile, expected) => {
    const name = newUserName(profile);

    expect(name).toBe(expected);
    expect(fullNameSchema.parse(name)).toBe(name);
  });

  it('keeps a pair that ends at the 100th character whole', () => {
    const name = newUserName({ name: `${letters(98)}😀${letters(5)}`, email: 'a@x.com' });

    expect(name).toBe(`${letters(98)}😀`);
    expect(name).toHaveLength(100);
  });
});
