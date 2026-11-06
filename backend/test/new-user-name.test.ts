import { fullNameSchema } from '@finebank/shared';
import { describe, expect, it } from 'vitest';

import { newUserName } from '../src/auth/google/new-user-name.js';

const letters = (count: number) => 'abcdefghij'.repeat(Math.ceil(count / 10)).slice(0, count);

/** A letter beyond the BMP: one code point, two UTF-16 code units. */
const doubleStruck = '\u{1D538}';

// Task 012 T30: the name of a new Google user (#62, #103); task 028 T3: made to pass the Full name rule (#126 a).
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
    ['a long local part of the email, cut to 100', { name: undefined, email: `${letters(120)}@x.com` }, letters(100)],
    ['exactly 100 characters, unchanged', { name: letters(100), email: 'a@x.com' }, letters(100)],
    // Task 028 T3 (#126 a): control characters removed, code points counted, invisible-only as no name.
    ['a tab removed', { name: 'Tanzir\tRahman', email: 'a@x.com' }, 'TanzirRahman'],
    ['a line break removed', { name: 'Tanzir\nRahman', email: 'a@x.com' }, 'TanzirRahman'],
    ['the email before @ for only zero-width spaces', { name: '\u200B\u200B', email: 'jo@x.com' }, 'jo'],
    ['the email before @ for only control characters', { name: '\t\u0007', email: 'jo@x.com' }, 'jo'],
    [
      'the first 100 of 120 letters beyond the BMP (code points, 200 code units)',
      { name: doubleStruck.repeat(120), email: 'a@x.com' },
      doubleStruck.repeat(100),
    ],
    [
      'the first 99 letters and an emoji when the emoji is the 100th code point',
      { name: `${letters(99)}😀${letters(5)}`, email: 'a@x.com' },
      `${letters(99)}😀`,
    ],
    ['a name with spaces around and a tab inside', { name: '  Ana\tMarija  ', email: 'a@x.com' }, 'AnaMarija'],
  ])('gives %s', (_case, profile, expected) => {
    const name = newUserName(profile);

    expect(name).toBe(expected);
    expect(fullNameSchema.parse(name)).toBe(name);
  });

  it('cuts at 100 code points, never inside one', () => {
    const name = newUserName({ name: `${letters(98)}😀${letters(5)}`, email: 'a@x.com' });

    expect(name).toBe(`${letters(98)}😀${letters(1)}`);
    // The spread counts code points on purpose: the rule's unit (#126 a).
    // oxlint-disable-next-line typescript/no-misused-spread
    expect([...name]).toHaveLength(100);
  });
});
