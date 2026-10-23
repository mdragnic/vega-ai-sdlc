import { assertCents, splitCents } from '../format/cents.js';

/**
 * Amount fields (#31, #64): digits with an optional decimal point and at most 2 decimals.
 * No `$`, commas or spaces: the input shows the `$` itself. A lone `.` may stand while
 * typing `.5`, and counts as empty (#84).
 */
const AMOUNT_INPUT = /^(\d*)(?:\.(\d{0,2}))?$/;

/** Whether a value being typed into an amount field may stand. */
export function isAllowedAmountInput(text: string): boolean {
  return AMOUNT_INPUT.test(text);
}

/**
 * Allowed text as integer cents, or `null` for an empty field. Built from the digits, never
 * through a float. Text too long for exact cents gives a value past the safe integer range,
 * which every money schema rejects.
 */
export function parseAmountInput(text: string): number | null {
  const match = AMOUNT_INPUT.exec(text);
  if (match === null) {
    throw new RangeError(`Not an allowed amount: ${text}`);
  }
  const [, whole = '', decimals = ''] = match;
  if (whole === '' && decimals === '') {
    return null;
  }
  return Number(`${whole}${decimals.padEnd(2, '0')}`);
}

/** The prefill text for an amount field: `500000`, `1250.50`, decimals only when not zero (#64). */
export function formatAmountInput(cents: number): string {
  assertCents(cents);
  if (cents < 0) {
    throw new RangeError(`An amount field takes no negative amounts, got ${cents}`);
  }
  const { dollars, fraction } = splitCents(cents);
  return fraction === '00' ? dollars : `${dollars}.${fraction}`;
}
