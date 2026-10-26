import { describe, expect, it } from 'vitest';

import { maskAccountNumber } from '../src/accounts/mask-account-number.js';

// T1, AC8: the one format an account number leaves the backend in, the last 4 digits only (#25).
describe('maskAccountNumber', () => {
  it.each([
    ['3388455688602598', '**** **** **** 2598'],
    ['6934566990127310', '**** **** **** 7310'],
    ['1334568868014421', '**** **** **** 4421'],
    ['6984568662016652', '**** **** **** 6652'],
    ['3634568966019083', '**** **** **** 9083'],
    // As demo-data.md writes them, grouped by spaces.
    ['3388 4556 8860 2598', '**** **** **** 2598'],
  ])('masks %s as %s', (accountNumber, masked) => {
    expect(maskAccountNumber({ accountNumber })).toBe(masked);
  });

  it.each(['3388455688602598', '3388 4556 8860 2598', '12345678'])(
    'never keeps more than the last 4 digits of %s',
    (accountNumber) => {
      const digits = maskAccountNumber({ accountNumber }).replace(/\D/g, '');

      expect(digits).toHaveLength(4);
      expect(accountNumber.replace(/\D/g, '').endsWith(digits)).toBe(true);
    },
  );

  // A stored number that is not one: an error (a 500), never a mask that shows something else.
  it.each(['', '259', '25 9', 'abcd'])('rejects %j, which has fewer than 4 digits', (accountNumber) => {
    expect(() => maskAccountNumber({ accountNumber })).toThrow(RangeError);
  });
});
