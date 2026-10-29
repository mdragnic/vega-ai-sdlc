import type { ExpenseChange } from '@finebank/shared';

/** Throws for anything that is not a whole number of cents, 0 or more, that a JavaScript number holds exactly. */
function assertCents(cents: number, what: string): void {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new RangeError(`${what} must be whole cents, 0 or more, got ${cents}`);
  }
}

/**
 * The change of a category's expenses against last month (#21): the size of the change in whole percent, rounded
 * half up (#115 a: `floor((200 x |this - last| + last) / (2 x last))`), in integer arithmetic only, never a float
 * (#11); the direction from the sign of the change, none when the rounded percent is 0 (#61). `null` when last month
 * was $0.00, which shows no percentage and no arrow (#21).
 */
export function expenseChange(thisMonthCents: number, lastMonthCents: number): ExpenseChange | null {
  assertCents(thisMonthCents, 'This month');
  assertCents(lastMonthCents, 'Last month');
  if (lastMonthCents === 0) return null;

  // BigInt keeps 200 x the difference exact past 2^53; its division truncates, which is floor for these.
  const last = BigInt(lastMonthCents);
  const difference = BigInt(thisMonthCents) - last;
  const size = difference < 0n ? -difference : difference;
  const percent = Number((200n * size + last) / (2n * last));
  if (!Number.isSafeInteger(percent)) throw new RangeError(`The change of ${percent}% is too large`);

  return { percent, direction: percent === 0 ? null : difference > 0n ? 'up' : 'down' };
}
