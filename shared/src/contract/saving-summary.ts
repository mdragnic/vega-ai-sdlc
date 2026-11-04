import { z } from 'zod';

import { checkSignedChartTicks, signedChartTicksSchema } from './chart-ticks.js';
import type { ContractEntry } from './entry.js';
import { moneySchema } from './money.js';
import { goalMonthSchema, savingsGoalMonthQuerySchema } from './savings-goal.js';

const plainDateSchema = z.iso.date();

/** Whether `YYYY-MM-DD` is a day that exists: `2026-02-29` does not. */
const isPlainDate = (date: string) => plainDateSchema.safeParse(date).success;

/** The day of the month, two digits, of the day at `index` from the 1st. */
const dayOfMonth = (index: number) => String(index + 1).padStart(2, '0');

/** The `YYYY-MM` month before a `YYYY-MM` month: January's is December of the year before. */
function monthBefore(month: string): string {
  const year = Number(month.slice(0, 4));
  const number = Number(month.slice(5, 7));
  return number === 1
    ? `${String(year - 1).padStart(4, '0')}-12`
    : `${month.slice(0, 4)}-${String(number - 1).padStart(2, '0')}`;
}

/**
 * One day of the Saving Summary chart (#42, #59): a plain date of the selected month; `thisMonth` the user's Complete
 * income less their Complete expenses that day in their zone, in integer cents with USD, negative allowed (#11, #57,
 * #96), null for a day after today, which draws no point (#55); `lastMonth` the same day of the month before, null when
 * that month has no such day (#124 a). Unknown keys are dropped.
 */
export const savingSummaryDaySchema = z.object({
  date: plainDateSchema,
  thisMonth: moneySchema.nullable(),
  lastMonth: moneySchema.nullable(),
});

export type SavingSummaryDay = z.infer<typeof savingSummaryDaySchema>;

/**
 * The Saving Summary chart (#42, #55, #59, #68, #72, #124): every day of the selected month in order from the 1st, with
 * the same days of the month before for the dashed line. `thisMonth` is null only on the days after the last one with a
 * value, never on the 1st; `lastMonth` null exactly on the days the month before does not have. `ticks` are the y-axis
 * by `signedAxisTicks`' rule over the values drawn, null exactly when every one is 0, the empty state. Everything is
 * calculated in the backend; the frontend draws it as sent (#11, #74).
 */
export const savingSummaryResponseSchema = z
  .object({
    month: goalMonthSchema,
    days: z.array(savingSummaryDaySchema).min(28).max(31),
    ticks: signedChartTicksSchema,
  })
  .superRefine(({ month, days, ticks }, context) => {
    const before = monthBefore(month);
    days.forEach((each, index) => {
      if (each.date !== `${month}-${dayOfMonth(index)}`) {
        context.addIssue({
          code: 'custom',
          message: 'The days of the month in order from the 1st',
          path: ['days', index, 'date'],
        });
      }
      const previous = days[index - 1];
      if (previous !== undefined && each.thisMonth !== null && previous.thisMonth === null) {
        context.addIssue({
          code: 'custom',
          message: 'No value after a day to come',
          path: ['days', index, 'thisMonth'],
        });
      }
      if ((each.lastMonth !== null) !== isPlainDate(`${before}-${dayOfMonth(index)}`)) {
        context.addIssue({
          code: 'custom',
          message: 'A value exactly on the days the month before has',
          path: ['days', index, 'lastMonth'],
        });
      }
    });
    if (isPlainDate(`${month}-${dayOfMonth(days.length)}`)) {
      context.addIssue({ code: 'custom', message: 'Every day of the month', path: ['days'] });
    }
    if (days[0]?.thisMonth === null) {
      context.addIssue({ code: 'custom', message: 'The 1st has a value', path: ['days', 0, 'thisMonth'] });
    }

    const values = days.flatMap(({ thisMonth, lastMonth }) => [thisMonth, lastMonth].filter((value) => value !== null));
    checkSignedChartTicks(values, ticks, context);
  });

export type SavingSummaryResponse = z.infer<typeof savingSummaryResponseSchema>;

/**
 * The signed-in user's savings per day (#42, #59): `GET /saving-summary?month=YYYY-MM`, the selected month against the
 * same days of the month before, today and the days from the backend's clock in the zone sent as `X-Time-Zone` (#54,
 * #80). Not a savings goal and not linked to one (#59). The month is one of the months both Goals selectors list,
 * `savingsGoalsContract.months` (#60, one list), by the goal month query; a month after the current one or before the
 * earliest answers 409 `goalMessages.monthUnavailable` and reads nothing (#123 b).
 */
export const savingSummaryContract = {
  summary: {
    method: 'GET',
    path: '/saving-summary',
    request: undefined,
    query: savingsGoalMonthQuerySchema,
    response: savingSummaryResponseSchema,
  },
} as const satisfies Record<string, ContractEntry>;
