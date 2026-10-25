import type { Money } from '../contract/money.js';
import { assertCents } from '../format/cents.js';

/** The nice multiples of a power of 10 (#55, #91 amended), in tenths so 2.5 stays an integer. */
const NICE_TENTHS = [10, 20, 25, 40, 50, 60, 80] as const;

/** Ticks per axis: $0 and 4 equal steps (#55). */
const STEPS = 4;

/**
 * The compact format (#11, #82) from its first amount in cents, with the resolution of its one decimal:
 * exact under $1,000, then k in steps of $100, then M in steps of $100,000.
 */
const COMPACT_RESOLUTION = [
  { from: 100_000_000, resolution: 10_000_000 },
  { from: 100_000, resolution: 10_000 },
] as const;

/** Whether `formatCompactMoney` shows this amount without rounding. */
function isExactCompact(cents: number): boolean {
  const unit = COMPACT_RESOLUTION.find(({ from }) => cents >= from);
  return unit === undefined || cents % unit.resolution === 0;
}

/** A top whose steps are whole cents (#91 a) and whose 5 labels are exact in the compact format (#91 b). */
function isAllowedTop(top: number): boolean {
  if (top % STEPS !== 0) return false;
  const step = top / STEPS;
  return Array.from({ length: STEPS + 1 }, (_, index) => index * step).every(isExactCompact);
}

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

  for (let power = 1; power <= Number.MAX_SAFE_INTEGER; power *= 10) {
    for (const tenths of NICE_TENTHS) {
      // 2.5 times a power of 10 is a whole number of cents only from 10 cents up.
      if ((tenths * power) % 10 !== 0) continue;
      const top = (tenths * power) / 10;
      if (!Number.isSafeInteger(top)) break;
      if (top >= highest.cents && isAllowedTop(top)) {
        const step = top / STEPS;
        return Array.from({ length: STEPS + 1 }, (_, index) => ({ cents: index * step, currency: highest.currency }));
      }
    }
  }
  throw new RangeError(`No axis top in safe integer cents reaches ${highest.cents} cents`);
}
