import { describe, expect, it } from 'vitest';

import { formatCompactMoney, type Money, signedAxisTicks } from '../src/index.js';

const usd = (cents: number): Money => ({ cents, currency: 'USD' });
const dollars = (amount: number) => usd(amount * 100);
const tickCents = (lowest: Money, highest: Money) => signedAxisTicks(lowest, highest).map((tick) => tick.cents);
const labels = (lowest: Money, highest: Money) => signedAxisTicks(lowest, highest).map(formatCompactMoney);

// Task 026 T1, AC5 and AC10: the Saving Summary's y-axis, ascending, in integer cents (#55, #68, #72, #91, #124 d).
describe('signedAxisTicks', () => {
  it('gives axisTicks’ 5 ticks when no day is below $0 (#55)', () => {
    expect(labels(usd(0), usd(55_216))).toEqual(['$0', '$150', '$300', '$450', '$600']);
  });

  it('gives a lowest day above $0 the same 5 ticks from $0', () => {
    expect(tickCents(usd(1_000), usd(55_216))).toEqual([0, 15_000, 30_000, 45_000, 60_000]);
  });

  it('continues the step below $0 down to October’s lowest day (#68): -$300 to $600, 7 labels', () => {
    expect(labels(usd(-28_336), usd(55_216))).toEqual(['-$300', '-$150', '$0', '$150', '$300', '$450', '$600']);
  });

  it('gives June 2022 (-$574.20, $446.50) its 10 labels, -$625 to $500, at the cap and unchanged (#124 d2)', () => {
    expect(labels(usd(-57_420), usd(44_650))).toEqual([
      '-$625',
      '-$500',
      '-$375',
      '-$250',
      '-$125',
      '$0',
      '$125',
      '$250',
      '$375',
      '$500',
    ]);
  });

  it('gives December 2025 (-$310.50, $495.18) 8 labels, -$375 to $500', () => {
    expect(labels(usd(-31_050), usd(49_518))).toEqual([
      '-$375',
      '-$250',
      '-$125',
      '$0',
      '$125',
      '$250',
      '$375',
      '$500',
    ]);
  });

  it('stops at the first tick at or below the lowest: a lowest on a tick adds no step past it', () => {
    expect(tickCents(usd(-30_000), usd(55_216))).toEqual([-30_000, -15_000, 0, 15_000, 30_000, 45_000, 60_000]);
    expect(tickCents(usd(-30_001), usd(55_216))).toEqual([
      -45_000, -30_000, -15_000, 0, 15_000, 30_000, 45_000, 60_000,
    ]);
  });

  // #124 d1: a top whose labels down to the lowest would not be exact is skipped like one whose 5 labels are not.
  it('skips the $1,000 top for (-$1,100, $1,000), whose -$1,250 shows as -$1.2k: -$1,500 to $2,000, 8 labels', () => {
    expect(labels(dollars(-1_100), dollars(1_000))).toEqual([
      '-$1.5k',
      '-$1k',
      '-$500',
      '$0',
      '$500',
      '$1k',
      '$1.5k',
      '$2k',
    ]);
  });

  // #124 d2: the tops up to $600 need 11 labels or more, so $800 is taken.
  it('gives a $1 high with a -$900 low -$1,000 to $800 in steps of $200, 10 labels', () => {
    expect(tickCents(dollars(-900), dollars(1))).toEqual([
      -100_000, -80_000, -60_000, -40_000, -20_000, 0, 20_000, 40_000, 60_000, 80_000,
    ]);
  });

  // #72: no day above $0, one below: $0 at the top, 4 equal steps down sized from the lowest, the mirror of axisTicks.
  it.each([
    ['October’s lowest with no day above $0', usd(-28_336), [-40_000, -30_000, -20_000, -10_000, 0]],
    ['one cent below $0, the smallest top of axisTicks ($0.04, #91 amended)', usd(-1), [-4, -3, -2, -1, 0]],
    ['-$2,100, as axisTicks skips $2,500 for $1.2k', dollars(-2_100), [-400_000, -300_000, -200_000, -100_000, 0]],
  ])('mirrors axisTicks for %s', (_case, lowest, expected) => {
    expect(tickCents(lowest, usd(0))).toEqual(expected);
  });

  it('mirrors axisTicks when every day is below $0', () => {
    expect(tickCents(usd(-28_336), usd(-100))).toEqual([-40_000, -30_000, -20_000, -10_000, 0]);
  });

  it('never gives -0 for the $0 tick', () => {
    for (const [lowest, highest] of [
      [usd(-28_336), usd(0)],
      [usd(-28_336), usd(55_216)],
      [usd(0), usd(55_216)],
    ] as const) {
      const zero = signedAxisTicks(lowest, highest).find((tick) => tick.cents === 0)!;
      expect(Object.is(zero.cents, 0)).toBe(true);
    }
  });

  it('returns USD money', () => {
    expect(signedAxisTicks(usd(-28_336), usd(55_216)).every((tick) => tick.currency === 'USD')).toBe(true);
  });

  // Every rule at once, over many lowest and highest pairs: equal integer steps, $0 among them, 4 steps above $0 (or
  // $0 the top), the lowest tick at or below the lowest, at most 10, every label exact.
  const pairs: [number, number][] = [];
  for (const highest of [0, 1, 7, 99, 446_50, 552_16, 1_000_00, 2_100_00, 99_999_99]) {
    for (const lowest of [0, -1, -9, -45, -283_36, -574_20, -1_100_00, -9_999_99, -123_456_78]) {
      if (highest !== 0 || lowest !== 0) pairs.push([lowest, highest]);
    }
  }
  it.each(pairs)('keeps every rule for a lowest of %i and a highest of %i cents', (lowest, highest) => {
    const ticks = tickCents(usd(lowest), usd(highest));
    const step = ticks[1]! - ticks[0]!;
    const zeroAt = ticks.indexOf(0);

    expect(ticks.length).toBeGreaterThanOrEqual(5);
    expect(ticks.length).toBeLessThanOrEqual(10);
    expect(Number.isSafeInteger(step) && step > 0).toBe(true);
    expect(ticks).toEqual(ticks.map((_, index) => (index - zeroAt) * step));
    expect(ticks.length - 1 - zeroAt).toBe(highest > 0 ? 4 : 0);
    expect(ticks[0]!).toBeLessThanOrEqual(Math.min(0, lowest));
    expect(ticks.at(-1)!).toBeGreaterThanOrEqual(highest);
    // Below $0 from a positive top, no step past the first tick at or below the lowest (#68).
    expect(highest > 0 && lowest < 0 ? ticks[0]! + step > lowest : true).toBe(true);
    for (const tick of ticks) expect(parseCompact(formatCompactMoney(usd(tick)))).toBe(tick);
  });
});

describe('signedAxisTicks rejects', () => {
  it.each([
    ['every value $0, the empty state', usd(0), usd(0)],
    ['a fraction of a cent as the lowest', usd(-1.5), usd(100)],
    ['a fraction of a cent as the highest', usd(-100), usd(1.5)],
    ['not a number', usd(Number.NaN), usd(100)],
    ['a lowest above the highest', usd(200), usd(100)],
    ['a lowest with no safe top', usd(-Number.MAX_SAFE_INTEGER), usd(0)],
  ])('%s', (_case, lowest, highest) => {
    expect(() => signedAxisTicks(lowest, highest)).toThrow(RangeError);
  });
});

/** Reads a compact label back into cents: `-$1.5k`, `$62.50`, `$0`. */
function parseCompact(label: string): number {
  const match = /^(-?)\$([\d,]+)(?:\.(\d+))?([kM]?)$/.exec(label);
  if (!match) throw new Error(`Not a compact label: ${label}`);
  const [, minus = '', whole = '', decimals = '', unit = ''] = match;
  const digits = { '': 2, k: 5, M: 8 }[unit]!;
  const cents = Number(whole.replaceAll(',', '') + decimals.padEnd(digits, '0'));
  return minus ? -cents : cents;
}
