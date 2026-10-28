import { z } from 'zod';

import type { ContractEntry } from './entry.js';
import { moneySchema } from './money.js';

/** An expense total of a day: integer cents, never negative (#11, #96). */
const dayTotalSchema = moneySchema.refine((money) => money.cents >= 0, {
  error: 'A day’s expenses are never negative',
});

/**
 * One weekday of the Overview Statistics chart (#20): this week's plain date of that weekday, the user's Complete
 * expenses that day last week and this week, each day in the user's zone (#54, #57). `thisWeek` is null for a day
 * after today, which draws no bar (#55). Unknown keys are dropped.
 */
export const weeklyComparisonDaySchema = z.object({
  date: z.iso.date(),
  lastWeek: dayTotalSchema,
  thisWeek: dayTotalSchema.nullable(),
});

export type WeeklyComparisonDay = z.infer<typeof weeklyComparisonDaySchema>;

const DAYS_PER_WEEK = 7;
const TICK_COUNT = 5;

/** The UTC day number of a plain date: whole days, so it is exact (#11). */
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;

/**
 * The Statistics chart (#20, #55, #91): Monday to Sunday of this week in the user's zone, each with last week's same
 * weekday; days after today have no `thisWeek` (today always has one). `ticks` are the y-axis from $0 in 4 equal
 * steps, the top at or above every value, as `axisTicks` gives them; null exactly when every value is 0, the empty
 * state. Everything is calculated in the backend; the frontend draws it as sent (#11, #74).
 */
export const weeklyComparisonResponseSchema = z
  .object({
    days: z.array(weeklyComparisonDaySchema).length(DAYS_PER_WEEK),
    ticks: z.array(moneySchema).length(TICK_COUNT).nullable(),
  })
  .superRefine(({ days, ticks }, context) => {
    const first = days[0];
    // 1970-01-01 (day 0) was a Thursday, so Monday is 4 days on, modulo 7.
    if (first !== undefined && (((dayNumber(first.date) - 4) % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK !== 0) {
      context.addIssue({ code: 'custom', message: 'The week starts on a Monday', path: ['days', 0, 'date'] });
    }
    days.forEach((day, index) => {
      const previous = days[index - 1];
      if (previous === undefined) return;
      if (dayNumber(day.date) !== dayNumber(previous.date) + 1) {
        context.addIssue({ code: 'custom', message: 'The days follow each other', path: ['days', index, 'date'] });
      }
      if (day.thisWeek !== null && previous.thisWeek === null) {
        context.addIssue({
          code: 'custom',
          message: 'No value after a day to come',
          path: ['days', index, 'thisWeek'],
        });
      }
    });
    if (first?.thisWeek === null) {
      context.addIssue({ code: 'custom', message: 'Today has a value', path: ['days', 0, 'thisWeek'] });
    }

    const values = days.flatMap(({ lastWeek, thisWeek }) => (thisWeek === null ? [lastWeek] : [lastWeek, thisWeek]));
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
  });

export type WeeklyComparisonResponse = z.infer<typeof weeklyComparisonResponseSchema>;

/**
 * The signed-in user's expenses per day, this week and last week, today and the week from the backend's clock in the
 * zone sent as `X-Time-Zone` (#20, #39, #54, #80). Task 024 adds the Expenses page's monthly comparison.
 */
export const statisticsContract = {
  weeklyComparison: {
    method: 'GET',
    path: '/statistics/weekly-comparison',
    request: undefined,
    response: weeklyComparisonResponseSchema,
  },
} as const satisfies Record<string, ContractEntry>;
