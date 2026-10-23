import { describe, expect, it } from 'vitest';

import { formatPercent } from '../src/index.js';

// T6: whole-number percentages from the backend, no leading zero (#61).
describe('formatPercent', () => {
  it.each([
    [8, '8%'],
    [15, '15%'],
    [120, '120%'],
    [0, '0%'],
  ])('formats %i as %s', (percent, expected) => {
    expect(formatPercent(percent)).toBe(expected);
  });

  it.each([8.5, Number.NaN])('rejects %s, which is not a whole number', (percent) => {
    expect(() => formatPercent(percent)).toThrow(RangeError);
  });
});
