import type { z } from 'zod';

import { SIGNED_AXIS_MAX_TICKS, SIGNED_AXIS_MIN_TICKS } from '../chart/ticks.js';
import { moneySchema, type Money } from './money.js';

const TICK_COUNT = 5;

/** A comparison chart's y-axis (#55, #91): 5 amounts, or null for the empty state. */
export const chartTicksSchema = moneySchema.array().length(TICK_COUNT).nullable();

/**
 * The tick rule every comparison chart's response shares (#55, #91; weekly in task 017, monthly in task 024): `ticks`
 * null exactly when every value is 0, the empty state; otherwise $0 and 4 equal steps above $0, as `axisTicks` gives
 * them, the top at or above every value. `values` are the chart's drawn values, a period still to come left out.
 */
export function checkChartTicks(
  values: Money[],
  ticks: Money[] | null,
  context: Pick<z.RefinementCtx, 'addIssue'>,
): void {
  const highest = Math.max(0, ...values.map((value) => value.cents));
  if (ticks === null) {
    if (highest > 0) context.addIssue({ code: 'custom', message: 'A value above $0 needs an axis', path: ['ticks'] });
    return;
  }
  const step = ticks[1]?.cents ?? 0;
  if (highest === 0 || step <= 0 || ticks.some((tick, index) => tick.cents !== index * step)) {
    context.addIssue({
      code: 'custom',
      message: 'Ticks run from $0 in equal steps, null when all is 0',
      path: ['ticks'],
    });
    return;
  }
  if (ticks.at(-1)!.cents < highest) {
    context.addIssue({ code: 'custom', message: 'The top tick is at or above every value', path: ['ticks'] });
  }
}

/** The Saving Summary's y-axis (#68, #124 d2): 5 to 10 amounts through $0, or null for the empty state. */
export const signedChartTicksSchema = moneySchema
  .array()
  .min(SIGNED_AXIS_MIN_TICKS)
  .max(SIGNED_AXIS_MAX_TICKS)
  .nullable();

/**
 * The Saving Summary's tick rule as `signedAxisTicks` gives it (#55, #68, #72, #124 d): `ticks` null exactly when every
 * value is 0, the empty state; otherwise equal steps through $0, ascending. With a value above $0, exactly 4 steps from
 * $0 up, the top at or above the highest, and below $0 the first tick at or below the lowest value and no further (no
 * tick below $0 when no value is). With none above $0, $0 the top and 4 steps down to a tick at or below the lowest
 * value (#72: the steps sized from the lowest's nice value, so they may reach further). `values` are the chart's drawn
 * values: a day still to come and a day the month before lacks are left out.
 */
export function checkSignedChartTicks(
  values: Money[],
  ticks: Money[] | null,
  context: Pick<z.RefinementCtx, 'addIssue'>,
): void {
  const fail = (message: string) => context.addIssue({ code: 'custom', message, path: ['ticks'] });
  const highest = Math.max(0, ...values.map((value) => value.cents));
  const lowest = Math.min(0, ...values.map((value) => value.cents));
  if (ticks === null) {
    if (highest !== 0 || lowest !== 0) fail('A value other than $0 needs an axis');
    return;
  }
  if (highest === 0 && lowest === 0) {
    fail('Every value $0 is the empty state, with no axis');
    return;
  }

  const zeroAt = ticks.findIndex((tick) => tick.cents === 0);
  const step = (ticks[1]?.cents ?? 0) - (ticks[0]?.cents ?? 0);
  if (zeroAt < 0 || step <= 0 || ticks.some((tick, index) => tick.cents !== (index - zeroAt) * step)) {
    fail('Ticks run in equal steps through $0, ascending');
    return;
  }
  const first = ticks[0]!.cents;
  if (highest > 0) {
    if (ticks.length - 1 - zeroAt !== 4) fail('$0 and 4 equal steps up');
    else if (ticks.at(-1)!.cents < highest) fail('The top tick is at or above every value');
    const lowestFits = lowest < 0 ? first <= lowest && lowest < first + step : zeroAt === 0;
    if (!lowestFits) fail('Below $0, the first tick at or below the lowest value and no further');
    return;
  }
  if (ticks.length !== SIGNED_AXIS_MIN_TICKS || zeroAt !== SIGNED_AXIS_MIN_TICKS - 1)
    fail('$0 the top and 4 equal steps down');
  else if (first > lowest) fail('The lowest tick is at or below every value');
}
