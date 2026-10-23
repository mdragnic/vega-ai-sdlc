import { describe, expect, it } from 'vitest';

import { formatAmountInput, isAllowedAmountInput, parseAmountInput } from '../src/index.js';

// T10: what may stand in an amount field while typing (#31, #64). A lone point may stand, so
// `.5` can be typed (#84).
describe('isAllowedAmountInput', () => {
  it.each(['', '0', '12', '12.', '.5', '12.5', '12.50', '500000', '.', '007'])('allows %j', (text) => {
    expect(isAllowedAmountInput(text)).toBe(true);
  });

  it.each(['12.505', '1,250', '$12', '12a', '1.2.3', '-5', ' 12', '12 ', '+5', '1e5', '١٢', '12\n'])(
    'rejects %j',
    (text) => {
      expect(isAllowedAmountInput(text)).toBe(false);
    },
  );
});

// T11: allowed text to integer cents, by digits, never through a float.
describe('parseAmountInput', () => {
  it.each([
    ['', null],
    ['.', null],
    ['0', 0],
    ['1250.5', 125050],
    ['0.29', 29],
    ['.5', 50],
    ['12.', 1200],
    ['0.05', 5],
    ['1.10', 110],
    ['007', 700],
    ['999999999.99', 99999999999],
    ['1000000000', 100000000000],
    ['90071992547409.91', Number.MAX_SAFE_INTEGER],
  ])('parses %j as %s', (text, expected) => {
    expect(parseAmountInput(text)).toBe(expected);
  });

  it('gives a value past the safe range for text too long for exact cents, so money schemas reject it', () => {
    expect(Number.isSafeInteger(parseAmountInput('99999999999999999'))).toBe(false);
  });

  it.each(['1,250', '12.505', 'abc', '-5'])('rejects %j, which the field does not allow', (text) => {
    expect(() => parseAmountInput(text)).toThrow(RangeError);
  });
});

// T12: the prefill text shows decimals only when they are not zero (#64).
describe('formatAmountInput', () => {
  it.each([
    [50000000, '500000'],
    [125050, '1250.50'],
    [0, '0'],
    [5, '0.05'],
    [110, '1.10'],
    [100000000000, '1000000000'],
  ])('formats %i cents as %j', (cents, expected) => {
    expect(formatAmountInput(cents)).toBe(expected);
  });

  it.each([0, 5, 125050, 50000000, 100000000000])('round-trips %i cents through the field', (cents) => {
    expect(parseAmountInput(formatAmountInput(cents))).toBe(cents);
  });

  it.each([-500, 12.5, 2 ** 53])('rejects %s cents, which the field cannot show', (cents) => {
    expect(() => formatAmountInput(cents)).toThrow(RangeError);
  });
});
