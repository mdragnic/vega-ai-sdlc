import type { Money } from '../contract/money.js';
import { assertCents } from '../format/cents.js';

/**
 * How far a goal is: Present / Target from 0 to 1, capped at 1 when Present exceeds Target (#18, #31).
 * A fraction for drawing the gauge, never shown as a number.
 */
export function goalProgress(present: Money, target: Money): number {
  assertCents(present.cents);
  assertCents(target.cents);
  if (target.cents <= 0) throw new RangeError(`A goal Target must be above $0, got ${target.cents} cents`);
  if (present.cents < 0) throw new RangeError(`A goal Present cannot be negative, got ${present.cents} cents`);
  return Math.min(present.cents / target.cents, 1);
}
