import { describe, expect, it } from 'vitest';

import { formatCompactMoney, formatMoney, formatSignedMoney } from '../src/index.js';

const usd = (cents: number) => ({ cents, currency: 'USD' as const });

// T2: the display format for amounts, en-US with 2 decimals (#11).
describe('formatMoney', () => {
  it.each([
    [2505600, '$25,056.00'],
    [0, '$0.00'],
    [1, '$0.01'],
    [99, '$0.99'],
    [100, '$1.00'],
    [16000, '$160.00'],
    [99999, '$999.99'],
    [100000, '$1,000.00'],
    [100000000000, '$1,000,000,000.00'],
    [Number.MAX_SAFE_INTEGER, '$90,071,992,547,409.91'],
    [-123400, '-$1,234.00'],
    [-1, '-$0.01'],
  ])('formats %i cents as %s', (cents, expected) => {
    expect(formatMoney(usd(cents))).toBe(expected);
  });

  it.each([12.5, 2 ** 53, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s cents', (cents) => {
    expect(() => formatMoney(usd(cents))).toThrow(RangeError);
  });
});

// T3: listed transaction amounts carry their direction's sign (#19).
describe('formatSignedMoney', () => {
  it('shows income with a plus', () => {
    expect(formatSignedMoney(usd(16000), 'income')).toBe('+$160.00');
  });

  it('shows an expense with a minus', () => {
    expect(formatSignedMoney(usd(16000), 'expense')).toBe('-$160.00');
  });

  it('keeps separators and decimals', () => {
    expect(formatSignedMoney(usd(123456789), 'income')).toBe('+$1,234,567.89');
  });

  it('rejects negative cents, since the sign comes from the direction', () => {
    expect(() => formatSignedMoney(usd(-16000), 'income')).toThrow(RangeError);
  });

  it('rejects fractional cents', () => {
    expect(() => formatSignedMoney(usd(160.5), 'expense')).toThrow(RangeError);
  });
});

// T4: compact format for chart axes and goal gauges (#11).
describe('formatCompactMoney, thousands', () => {
  it.each([
    [1250000, '$12.5k'],
    [1258000, '$12.5k'],
    [2000000, '$20k'],
    [99900, '$999'],
    [100000, '$1k'],
    [0, '$0'],
    [109900, '$1k'],
    [100050, '$1k'],
    [99999999, '$999.9k'],
  ])('formats %i cents as %s', (cents, expected) => {
    expect(formatCompactMoney(usd(cents))).toBe(expected);
  });
});

// T5: the edges decided in #82.
describe('formatCompactMoney, #82 edges', () => {
  it.each([
    // (a) $1,000,000 and more: M, one decimal, rounded down, `.0` dropped
    [100000000, '$1M'],
    [200000000, '$2M'],
    [258000000, '$2.5M'],
    [259999999, '$2.5M'],
    [100000000000, '$1,000M'],
    [123456789000, '$1,234.5M'],
    // (b) under $1,000: whole dollars without decimals, otherwise two decimals
    [99950, '$999.50'],
    [99999, '$999.99'],
    [50, '$0.50'],
    [5, '$0.05'],
    [1000, '$10'],
    // (c) negatives: minus before the `$`, rounded toward zero
    [-50000, '-$500'],
    [-125000, '-$1.2k'],
    [-129999, '-$1.2k'],
    [-100000, '-$1k'],
    [-99950, '-$999.50'],
    [-258000000, '-$2.5M'],
  ])('formats %i cents as %s', (cents, expected) => {
    expect(formatCompactMoney(usd(cents))).toBe(expected);
  });

  it.each([0.5, 2 ** 53])('rejects %s cents', (cents) => {
    expect(() => formatCompactMoney(usd(cents))).toThrow(RangeError);
  });
});
