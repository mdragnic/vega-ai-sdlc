import { describe, expect, it } from 'vitest';

import { expenseChange } from '../src/expenses/percent-change.js';

// T2, AC3: the size of the change in whole percent, rounded half up in integer arithmetic; the arrow from the sign,
// none at 0%; no change when last month was $0.00 (#11, #21, #61, #115 a).
describe('expenseChange', () => {
  it.each([
    // The rounding cases of task 018 References: last month $200.00.
    ['$200.00 to $225.00, +12.5%', 22_500, 20_000, { percent: 13, direction: 'up' }],
    ['$200.00 to $175.00, -12.5%', 17_500, 20_000, { percent: 13, direction: 'down' }],
    ['$200.00 to $201.00, +0.5%', 20_100, 20_000, { percent: 1, direction: 'up' }],
    ['$200.00 to $199.00, -0.5%', 19_900, 20_000, { percent: 1, direction: 'down' }],
    ['$200.00 to $200.99, +0.495%', 20_099, 20_000, { percent: 0, direction: null }],
    ['$200.00 to $199.20, -0.4%', 19_920, 20_000, { percent: 0, direction: null }],
    ['$200.00 to $200.00', 20_000, 20_000, { percent: 0, direction: null }],
    ['$200.00 to $0.00', 0, 20_000, { percent: 100, direction: 'down' }],
    ['$50.00 to $0.00', 0, 5_000, { percent: 100, direction: 'down' }],
    // A first login on 22 Oct 2026: 1 to 22 Oct against all of Sep (demo-data.md).
    ['Housing $302.40 to $252.00, -16.67%', 25_200, 30_240, { percent: 17, direction: 'down' }],
    ['Food $474.55 to $510.04, +7.48%', 51_004, 47_455, { percent: 7, direction: 'up' }],
    ['Transportation $78.40 to $53.20, -32.14%', 5_320, 7_840, { percent: 32, direction: 'down' }],
    ['Entertainment $242.76 to $282.24, +16.26%', 28_224, 24_276, { percent: 16, direction: 'up' }],
    ['Shopping $576.24 to $658.00, +14.19%', 65_800, 57_624, { percent: 14, direction: 'up' }],
    ['Others $201.60 to $138.32, -31.39%', 13_832, 20_160, { percent: 31, direction: 'down' }],
    // Housing all of Oct against all of Sep: exactly -10%, then 1 Nov against all of Oct, -0.62%.
    ['Housing $302.40 to $272.16, -10%', 27_216, 30_240, { percent: 10, direction: 'down' }],
    ['Housing $272.16 to $270.48, -0.62%', 27_048, 27_216, { percent: 1, direction: 'down' }],
    // A last month of 1 cent.
    ['1 cent to 2 cents, +100%', 2, 1, { percent: 100, direction: 'up' }],
    ['1 cent to 1 cent', 1, 1, { percent: 0, direction: null }],
    ['1 cent to $0.00', 0, 1, { percent: 100, direction: 'down' }],
    // The largest amount, exact to the cent.
    ['1 cent to $1,000,000,000.00', 100_000_000_000, 1, { percent: 9_999_999_999_900, direction: 'up' }],
    ['$1,000,000,000.00 to $0.00', 0, 100_000_000_000, { percent: 100, direction: 'down' }],
    ['$999,999,999.99 to $1,000,000,000.00', 100_000_000_000, 99_999_999_999, { percent: 0, direction: null }],
  ] as const)('%s', (_case, thisMonth, lastMonth, change) => {
    expect(expenseChange(thisMonth, lastMonth)).toEqual(change);
  });

  it.each([
    ['$0.00 to $50.00', 5_000],
    ['$0.00 to $0.00', 0],
  ])('answers no change when last month was $0.00: %s', (_case, thisMonth) => {
    expect(expenseChange(thisMonth, 0)).toBeNull();
  });

  it.each([
    ['a float this month', 25_200.5, 30_240],
    ['a float last month', 25_200, 302.4],
    ['a negative this month', -1, 30_240],
    ['a negative last month', 25_200, -1],
    ['an unsafe integer this month', 2 ** 53, 30_240],
    ['an unsafe integer last month', 25_200, 2 ** 53],
    ['NaN', Number.NaN, 30_240],
  ])('throws a RangeError for %s', (_case, thisMonth, lastMonth) => {
    expect(() => expenseChange(thisMonth, lastMonth)).toThrow(RangeError);
  });
});
