import { describe, expect, it } from 'vitest';

import { countryCallingCodes } from '../src/index.js';

/** The non-geographic codes of E.164 (global services, networks, trials): never an option (#126 d). */
const nonGeographic = ['+800', '+808', '+870', '+878', '+881', '+882', '+883', '+888', '+979', '+991', '+388'];

const digitsOf = (code: string) => Number(code.slice(1));

// Task 028 T2: the country code list (#43, #126 d): the geographic E.164 codes, each once, in numeric order, +1 first.
describe('countryCallingCodes', () => {
  it('holds only `+` and 1 to 3 digits with no leading zero', () => {
    for (const code of countryCallingCodes) expect(code).toMatch(/^\+[1-9][0-9]{0,2}$/);
  });

  it('lists each code once', () => {
    expect(new Set(countryCallingCodes).size).toBe(countryCallingCodes.length);
  });

  it('is in numeric order, +1 first', () => {
    const numbers = countryCallingCodes.map(digitsOf);

    expect(numbers).toEqual(numbers.toSorted((a, b) => a - b));
    expect(countryCallingCodes[0]).toBe('+1');
    expect(countryCallingCodes.slice(0, 4)).toEqual(['+1', '+7', '+20', '+27']);
    expect(countryCallingCodes.at(-1)).toBe('+998');
  });

  it.each(['+1', '+7', '+44', '+381', '+880', '+383', '+211'])('offers %s', (code) => {
    expect(countryCallingCodes).toContain(code);
  });

  it('offers none of the non-geographic codes', () => {
    expect(countryCallingCodes.filter((code) => nonGeographic.includes(code))).toEqual([]);
  });

  it('offers no spare code, nor the North American area codes as their own options', () => {
    for (const code of ['+0', '+210', '+259', '+280', '+384', '+422', '+671', '+684', '+969', '+990', '+997', '+999']) {
      expect(countryCallingCodes).not.toContain(code);
    }
    expect(countryCallingCodes.filter((code) => code.startsWith('+1'))).toEqual(['+1']);
  });

  // The count of the list's source, noted in country-calling-codes.ts: 2 one-digit, 44 two-digit, 160 three-digit.
  it('holds the 206 codes of its source', () => {
    expect(countryCallingCodes).toHaveLength(206);
    expect(countryCallingCodes.filter((code) => code.length === 2)).toHaveLength(2);
    expect(countryCallingCodes.filter((code) => code.length === 3)).toHaveLength(44);
    expect(countryCallingCodes.filter((code) => code.length === 4)).toHaveLength(160);
  });
});
