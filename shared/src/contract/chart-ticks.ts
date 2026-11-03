import type { z } from 'zod';

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
