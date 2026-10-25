import { describe, expect, it } from 'vitest';

import { axisTicks, formatCompactMoney, type Money } from '../src/index.js';

const usd = (cents: number): Money => ({ cents, currency: 'USD' });
const dollars = (amount: number) => usd(amount * 100);
const tickCents = (highest: Money) => axisTicks(highest).map((tick) => tick.cents);
const top = (highest: Money) => tickCents(highest).at(-1);

/** Reads a compact label back into cents: `$12.5k`, `$1,000M`, `$62.50`, `$0`. */
function parseCompact(label: string): number {
  const match = /^\$([\d,]+)(?:\.(\d+))?([kM]?)$/.exec(label);
  if (!match) throw new Error(`Not a compact label: ${label}`);
  const [, whole = '', decimals = '', unit = ''] = match;
  const digits = { '': 2, k: 5, M: 8 }[unit]!;
  return Number(whole.replaceAll(',', '') + decimals.padEnd(digits, '0'));
}

// The allowed tops listed in task 006 Scope (#55, #91 amended), in cents, up to $8,000M.
function allowedTops(): number[] {
  const tops = [4, 8, 20, 40, 60, 80];
  for (let power = 100; power <= 100_000_000_000; power *= 10) {
    for (const multiple of [1, 2, 4, 6, 8]) tops.push(multiple * power);
    if (power !== 100_000 && power !== 100_000_000) tops.push(5 * power);
  }
  tops.push(2_500, 25_000, 25_000_000, 25_000_000_000, 250_000_000_000);
  return tops.filter((cents) => cents <= 800_000_000_000).toSorted((a, b) => a - b);
}

// T1: the five ticks of the examples in AC1 (#55, #91 amended).
describe('axisTicks', () => {
  it.each([
    ['$322.00', 32_200, [0, 10_000, 20_000, 30_000, 40_000]],
    ['$500.00', 50_000, [0, 12_500, 25_000, 37_500, 50_000]],
    ['$1.00', 100, [0, 25, 50, 75, 100]],
    ['$5,500', 550_000, [0, 150_000, 300_000, 450_000, 600_000]],
  ])('gives the ticks for a highest of %s', (_, cents, expected) => {
    expect(tickCents(usd(cents))).toEqual(expected);
  });

  it.each([
    ['$500.01', 50_001, 60_000],
    ['$7,000', 700_000, 800_000],
    ['$20,000.00', 2_000_000, 2_000_000],
  ])('gives a highest of %s its top', (_, cents, expected) => {
    expect(top(usd(cents))).toBe(expected);
  });

  it('labels $5,500 from $1.5k to $6k', () => {
    expect(axisTicks(dollars(5_500)).map(formatCompactMoney)).toEqual(['$0', '$1.5k', '$3k', '$4.5k', '$6k']);
  });

  it('returns USD money', () => {
    expect(axisTicks(usd(32_200)).every((tick) => tick.currency === 'USD')).toBe(true);
  });

  // T1: every allowed top is the smallest one at or above the highest value.
  const tops = allowedTops();
  it.each(tops.slice(0, -1).map((cents, index) => [cents, tops[index + 1]!] as const))(
    'gives a highest of %i cents that top, and one cent more the next one',
    (allowed, next) => {
      expect(top(usd(allowed))).toBe(allowed);
      expect(top(usd(allowed + 1))).toBe(next);
    },
  );

  it('gives the smallest top, $0.04, to a highest of one cent', () => {
    expect(tickCents(usd(1))).toEqual([0, 1, 2, 3, 4]);
  });
});

// T2: skipped nice values (#91 a and b).
describe('axisTicks skips', () => {
  it.each([
    ['$2.30, $2.50 has steps of 62.5 cents', 230, [0, 100, 200, 300, 400]],
    ['$0.45, $0.50 has steps of 12.5 cents', 45, [0, 15, 30, 45, 60]],
    ['$0.01, $0.01 and $0.02 have steps under a cent', 1, [0, 1, 2, 3, 4]],
    ['$2,100, $2,500 shows $1.2k', 210_000, [0, 100_000, 200_000, 300_000, 400_000]],
    ['$22,000, $25,000 shows $6.2k', 2_200_000, [0, 1_000_000, 2_000_000, 3_000_000, 4_000_000]],
  ])('%s', (_, cents, expected) => {
    expect(tickCents(usd(cents))).toEqual(expected);
  });

  it.each([
    ['$0.09: $0.10 has steps of 2.5 cents', 9, 20],
    ['$0.05: $0.05 and $0.06 have steps under a whole cent', 5, 8],
    ['$4,500: $5,000 shows $1.2k', 450_000, 600_000],
    ['$25,000: $25,000 shows $6.2k', 2_500_000, 4_000_000],
    ['$2,000,000.01: $2,500,000 shows $1.2M', 200_000_001, 400_000_000],
  ])('%s', (_, cents, expected) => {
    expect(top(usd(cents))).toBe(expected);
  });

  it('labels $2,100 from $1k to $4k and $22,000 from $10k to $40k', () => {
    expect(axisTicks(dollars(2_100)).map(formatCompactMoney)).toEqual(['$0', '$1k', '$2k', '$3k', '$4k']);
    expect(axisTicks(dollars(22_000)).map(formatCompactMoney)).toEqual(['$0', '$10k', '$20k', '$30k', '$40k']);
  });

  // Every case above and every allowed top: five ticks from $0 in equal integer steps, each label exact.
  it.each([1, 5, 9, 45, 230, 210_000, 450_000, 2_200_000, 2_500_000, 200_000_001, ...allowedTops()])(
    'gives a highest of %i cents five exact integer ticks',
    (cents) => {
      const ticks = tickCents(usd(cents));
      const step = ticks[1]!;

      expect(ticks).toHaveLength(5);
      expect(ticks).toEqual([0, step, 2 * step, 3 * step, 4 * step]);
      expect(ticks.every(Number.isSafeInteger)).toBe(true);
      expect(ticks.map((tick) => parseCompact(formatCompactMoney(usd(tick))))).toEqual(ticks);
    },
  );
});

// T3: all zero is the empty state, never an axis; money is integer cents (#11, #55).
describe('axisTicks rejects', () => {
  it.each([
    ['a highest of 0', 0],
    ['a negative highest', -1],
    ['a fraction of a cent', 1.5],
    ['not a number', Number.NaN],
    ['a highest with no safe top', Number.MAX_SAFE_INTEGER],
  ])('%s', (_, cents) => {
    expect(() => axisTicks(usd(cents))).toThrow(RangeError);
  });
});
