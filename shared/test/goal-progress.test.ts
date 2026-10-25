import { describe, expect, it } from 'vitest';

import { goalProgress, type Money } from '../src/index.js';

const usd = (cents: number): Money => ({ cents, currency: 'USD' });

// T4: Present / Target for drawing the gauge, capped at 1 (#18, #31).
describe('goalProgress', () => {
  it.each([
    ['$12,500 of $20,000', 1_250_000, 2_000_000, 0.625],
    ['$16,250 of $20,000', 1_625_000, 2_000_000, 0.8125],
    ['$0 of $20,000', 0, 2_000_000, 0],
    ['$20,000 of $20,000', 2_000_000, 2_000_000, 1],
    ['$25,000 of $20,000, over-achieved', 2_500_000, 2_000_000, 1],
  ])('gives %s as %d', (_, present, target, expected) => {
    expect(goalProgress(usd(present), usd(target))).toBe(expected);
  });

  it.each([
    ['a Target of 0', 0, 0],
    ['a negative Target', 100, -1],
    ['a negative Present', -1, 2_000_000],
    ['a Present that is not integer cents', 1.5, 2_000_000],
    ['a Target that is not integer cents', 100, 2_000_000.5],
    ['a Present that is not a number', Number.NaN, 2_000_000],
  ])('rejects %s', (_, present, target) => {
    expect(() => goalProgress(usd(present), usd(target))).toThrow(RangeError);
  });
});
