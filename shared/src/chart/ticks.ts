import type { Money } from '../contract/money.js';
import { assertCents } from '../format/cents.js';

/** The nice multiples of a power of 10 (#55, #91 amended), in tenths so 2.5 stays an integer. */
const NICE_TENTHS = [10, 20, 25, 40, 50, 60, 80] as const;

/** Ticks per axis: $0 and 4 equal steps (#55). */
const STEPS = 4;

/** The Saving Summary's y-axis: from axisTicks' 5 labels to at most 10 (#55, #68, #124 d2). */
export const SIGNED_AXIS_MIN_TICKS = STEPS + 1;
export const SIGNED_AXIS_MAX_TICKS = 10;

/**
 * The compact format (#11, #82) from its first amount in cents, with the resolution of its one decimal:
 * exact under $1,000, then k in steps of $100, then M in steps of $100,000.
 */
const COMPACT_RESOLUTION = [
  { from: 100_000_000, resolution: 10_000_000 },
  { from: 100_000, resolution: 10_000 },
] as const;

/** Whether `formatCompactMoney` shows this amount without rounding; a negative amount as its size (`-$1.2k`). */
function isExactCompact(cents: number): boolean {
  const size = Math.abs(cents);
  const unit = COMPACT_RESOLUTION.find(({ from }) => size >= from);
  return unit === undefined || size % unit.resolution === 0;
}

/** A top whose steps are whole cents (#91 a) and whose 5 labels are exact in the compact format (#91 b). */
function isAllowedTop(top: number): boolean {
  if (top % STEPS !== 0) return false;
  const step = top / STEPS;
  return Array.from({ length: STEPS + 1 }, (_, index) => index * step).every(isExactCompact);
}

/**
 * The nice values (1, 2, 2.5, 4, 5, 6 or 8 times a power of 10) at or above `from` cents that #91 allows as an axis
 * top, ascending, while they are safe integers: the one search every axis shares (#55, #91).
 */
function* allowedTops(from: number): Generator<number> {
  for (let power = 1; power <= Number.MAX_SAFE_INTEGER; power *= 10) {
    for (const tenths of NICE_TENTHS) {
      // 2.5 times a power of 10 is a whole number of cents only from 10 cents up.
      if ((tenths * power) % 10 !== 0) continue;
      const top = (tenths * power) / 10;
      if (!Number.isSafeInteger(top)) return;
      if (top >= from && isAllowedTop(top)) yield top;
    }
  }
}

/** Integer cents in USD, the only currency (#96); the $0 tick never -0. */
const usd = (cents: number): Money => ({ cents: cents === 0 ? 0 : cents, currency: 'USD' });

/**
 * The y-axis ticks of a bar chart (#55, #91): $0 and 4 equal steps up to the smallest nice value
 * (1, 2, 2.5, 4, 5, 6 or 8 times a power of 10) at or above `highest`, skipping any whose steps are not
 * whole cents or whose labels the compact format would round. All integer cents (#11). All zero is the
 * empty state, never an axis, so `highest` must be above $0.
 */
export function axisTicks(highest: Money): Money[] {
  assertCents(highest.cents);
  if (highest.cents <= 0) {
    throw new RangeError(`An axis needs a highest value above $0, got ${highest.cents} cents`);
  }
  const { value: top } = allowedTops(highest.cents).next();
  if (top === undefined) throw new RangeError(`No axis top in safe integer cents reaches ${highest.cents} cents`);
  const step = top / STEPS;
  return Array.from({ length: STEPS + 1 }, (_, index) => ({ cents: index * step, currency: highest.currency }));
}

/**
 * The Saving Summary's y-axis (#55, #59, #68, #72, #91, #124 d), ascending, in integer cents, from the lowest and the
 * highest drawn value. With a value above $0: `axisTicks`' top with $0 and 4 equal steps up, the same step continued
 * below $0 until a tick is at or below `lowest` (#68); a top is skipped when a label down there would not be exact in
 * the compact format (#124 d1) or when the labels would be more than 10 (#124 d2), and the next allowed top is taken.
 * With no value above $0 and one below: $0 at the top and 4 equal steps down to the smallest allowed nice value at or
 * above the lowest's size, the mirror of `axisTicks` (#72). Every value $0 is the empty state, never an axis.
 */
export function signedAxisTicks(lowest: Money, highest: Money): Money[] {
  assertCents(lowest.cents);
  assertCents(highest.cents);
  if (lowest.cents > highest.cents) {
    throw new RangeError(`The lowest value ${lowest.cents} is above the highest ${highest.cents}`);
  }
  if (highest.cents <= 0) {
    if (lowest.cents === 0) throw new RangeError('Every value $0 is the empty state, not an axis');
    return axisTicks(usd(-lowest.cents))
      .map((tick) => usd(0 - tick.cents))
      .toReversed();
  }

  for (const top of allowedTops(highest.cents)) {
    const step = top / STEPS;
    const below = lowest.cents < 0 ? Math.ceil(-lowest.cents / step) : 0;
    if (below + STEPS + 1 > SIGNED_AXIS_MAX_TICKS) continue;
    const ticks = Array.from({ length: below + STEPS + 1 }, (_, index) => (index - below) * step);
    if (ticks.every((tick) => Number.isSafeInteger(tick) && isExactCompact(tick))) return ticks.map(usd);
  }
  throw new RangeError(`No axis in safe integer cents spans ${lowest.cents} to ${highest.cents} cents`);
}
