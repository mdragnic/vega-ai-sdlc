import { describe, expect, it } from 'vitest';

import { firstName, initials } from '../src/index.js';

// T9: the greeting's first name and the avatar initials come from Full Name (#62).
describe('firstName and initials', () => {
  it.each([
    ['Tanzir Rahman', 'Tanzir', 'TR'],
    ['Marko', 'Marko', 'M'],
    ['  marko   van   dragnic ', 'marko', 'MD'],
    ['Tanzir\tRahman', 'Tanzir', 'TR'],
    ['Šime Đurić', 'Šime', 'ŠĐ'],
    ['élodie dupont', 'élodie', 'ÉD'],
  ])('%j gives %j and %j', (fullName, expectedFirstName, expectedInitials) => {
    expect(firstName(fullName)).toBe(expectedFirstName);
    expect(initials(fullName)).toBe(expectedInitials);
  });

  it('keeps a letter typed with a combining mark', () => {
    expect(initials('Šime Čavic')).toBe('ŠČ');
  });

  it('gives empty text for a blank name', () => {
    expect(firstName('   ')).toBe('');
    expect(initials('   ')).toBe('');
  });
});
