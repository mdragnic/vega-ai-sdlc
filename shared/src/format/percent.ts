/** A whole-number percentage calculated by the backend: `8%`, `120%`, never `08%` (#61). */
export function formatPercent(percent: number): string {
  if (!Number.isSafeInteger(percent)) {
    throw new RangeError(`A percentage must be a whole number, got ${percent}`);
  }
  return `${percent}%`;
}
