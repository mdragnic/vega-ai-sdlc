/**
 * Integer cents helpers for the formatters (#11). They work on the digits of the number,
 * so cents are never divided into a float. Internal, not exported from the package root.
 */

/** Throws unless `cents` is a safe integer: a formatter never guesses at malformed money. */
export function assertCents(cents: number): void {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`Money must be integer cents, got ${cents}`);
  }
}

/** Splits non-negative integer cents into the whole dollar digits and the 2 cent digits. */
export function splitCents(cents: number): { dollars: string; fraction: string } {
  const digits = String(cents).padStart(3, '0');
  return { dollars: digits.slice(0, -2), fraction: digits.slice(-2) };
}

/** Adds en-US thousands separators to a string of digits. */
export function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
