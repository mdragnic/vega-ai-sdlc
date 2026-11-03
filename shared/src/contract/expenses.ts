import { z } from 'zod';

import { expenseCategorySchema } from './category.js';
import { chartTicksSchema, checkChartTicks } from './chart-ticks.js';
import type { ContractEntry } from './entry.js';
import { moneySchema } from './money.js';
import { goalMonthSchema } from './savings-goal.js';
import { listedTransactionFields } from './transaction.js';

/** An expense figure: integer cents, never negative (#11, #96). */
const expenseTotalSchema = moneySchema.refine((money) => money.cents >= 0, { error: 'Expenses are never negative' });

/**
 * The change of a category's expenses against last month (#21): `percent` the size of the change in whole percent,
 * rounded half up by the backend (#115 a); `direction` `up` for an increase (the red arrow), `down` for a decrease
 * (the green arrow), and `null` exactly when the percent is 0, which shows `0%` with no arrow (#61).
 */
export const expenseChangeSchema = z
  .object({
    percent: z.int().min(0),
    direction: z.enum(['up', 'down']).nullable(),
  })
  .refine(({ percent, direction }) => (percent === 0) === (direction === null), {
    error: 'An arrow exactly when the change is not 0%',
    path: ['direction'],
  });

export type ExpenseChange = z.infer<typeof expenseChangeSchema>;

/** The most line items an Expenses card lists (#29, #61): the backend sends this many at most, the schema caps it. */
export const EXPENSE_LINE_ITEMS_PER_CATEGORY = 2;

/**
 * One line item of an Expenses card (109, US-15 criterion 5): the item name, its amount in integer cents 0 or more
 * with USD, shown with no sign (#122 b), and its time in UTC, shown as its date in the browser's zone (#11, #54). The
 * rules of every listed transaction (#19, #74). No ID, account, shop, category or status: no route takes a
 * transaction (#29: cards and items are not clickable). Unknown keys are dropped.
 */
export const expenseLineItemSchema = listedTransactionFields.pick({ item: true, amount: true, occurredAt: true });

export type ExpenseLineItem = z.infer<typeof expenseLineItemSchema>;

/**
 * One category of the expenses breakdown (#21, #56): its total of this month up to today in integer cents with USD
 * (#11, #96), and its change against all of last month, or `null` when last month was $0.00 (no percentage, no
 * arrow). A $0.00 total after a month with expenses is 100% down (#61). `recent` holds the category's 2 most recent
 * Complete expenses of this month, newest first (#61; the Expenses cards, task 024); Overview's card never shows
 * them. Unknown keys are dropped.
 */
export const expensesBreakdownCategorySchema = z
  .object({
    category: expenseCategorySchema,
    total: expenseTotalSchema,
    change: expenseChangeSchema.nullable(),
    recent: z
      .array(expenseLineItemSchema)
      .max(EXPENSE_LINE_ITEMS_PER_CATEGORY)
      .refine(
        (items) =>
          items.every(
            (each, index) => index === 0 || Date.parse(items[index - 1]!.occurredAt) >= Date.parse(each.occurredAt),
          ),
        { error: 'The items are newest first' },
      ),
  })
  .refine(
    ({ total, change }) =>
      total.cents > 0 || change === null || (change.percent === 100 && change.direction === 'down'),
    { error: 'No expenses this month is 100% down', path: ['change'] },
  );

export type ExpensesBreakdownCategory = z.infer<typeof expensesBreakdownCategorySchema>;

/**
 * The expenses breakdown (#21, #61): the six categories, always all six, once each, in the designed order of
 * `expenseCategorySchema` (#56). One answer for Overview's Expenses Breakdown and the Expenses cards, so the two agree
 * by construction (task 024). Everything is calculated in the backend; the frontend shows it as sent (#11, #74).
 */
export const expensesBreakdownResponseSchema = z
  .object({
    categories: z.array(expensesBreakdownCategorySchema).length(expenseCategorySchema.options.length),
  })
  .superRefine(({ categories }, context) => {
    categories.forEach(({ category }, index) => {
      if (category !== expenseCategorySchema.options[index]) {
        context.addIssue({
          code: 'custom',
          message: 'The six categories in their designed order',
          path: ['categories', index, 'category'],
        });
      }
    });
  });

export type ExpensesBreakdownResponse = z.infer<typeof expensesBreakdownResponseSchema>;

const MONTHS_PER_YEAR = 12;

/** A `YYYY-MM` calendar month: the rule of a goal's month (task 014), written once (#74). */
const yearMonthSchema = goalMonthSchema;

/**
 * One month of the Expenses chart (#29): this year's `YYYY-MM` month, the user's Complete expenses in the same month
 * last year and this year, each row's month in the user's zone (#54, #57). `thisYear` is null for a month after the
 * current one, which draws no bar (#55); the current month counts up to today. Unknown keys are dropped.
 */
export const monthlyComparisonMonthSchema = z.object({
  month: yearMonthSchema,
  lastYear: expenseTotalSchema,
  thisYear: expenseTotalSchema.nullable(),
});

export type MonthlyComparisonMonth = z.infer<typeof monthlyComparisonMonthSchema>;

/**
 * The Expenses chart (#29, #55, #91): January to December of this year in the user's zone, each with last year's same
 * month; the months after the current one have no `thisYear` (the current month always has one, so January does).
 * `ticks` follow the weekly comparison's rule: the y-axis from $0 in 4 equal steps, the top at or above every value,
 * as `axisTicks` gives them; null exactly when every value of both years is 0, the empty state. Everything is
 * calculated in the backend; the frontend draws it as sent (#11, #74).
 */
export const monthlyComparisonResponseSchema = z
  .object({
    months: z.array(monthlyComparisonMonthSchema).length(MONTHS_PER_YEAR),
    ticks: chartTicksSchema,
  })
  .superRefine(({ months, ticks }, context) => {
    const year = months[0]?.month.slice(0, 4);
    months.forEach((each, index) => {
      if (each.month !== `${year}-${String(index + 1).padStart(2, '0')}`) {
        context.addIssue({
          code: 'custom',
          message: 'January to December of one year, in order',
          path: ['months', index, 'month'],
        });
      }
      const previous = months[index - 1];
      if (previous !== undefined && each.thisYear !== null && previous.thisYear === null) {
        context.addIssue({
          code: 'custom',
          message: 'No value after a month to come',
          path: ['months', index, 'thisYear'],
        });
      }
    });
    if (months[0]?.thisYear === null) {
      context.addIssue({ code: 'custom', message: 'January has a value', path: ['months', 0, 'thisYear'] });
    }

    const values = months.flatMap(({ lastYear, thisYear }) => (thisYear === null ? [lastYear] : [lastYear, thisYear]));
    checkChartTicks(values, ticks, context);
  });

export type MonthlyComparisonResponse = z.infer<typeof monthlyComparisonResponseSchema>;

/**
 * The signed-in user's expenses, the months and the year from the backend's clock in the zone sent as `X-Time-Zone`
 * (#39, #54, #80): `breakdown` per category, this month so far against all of last month, with each category's 2
 * most recent items (#21, #61), the one answer of Overview's Expenses Breakdown and the Expenses cards; and
 * `monthlyComparison`, the Expenses chart's months of this year against last year (#29). The Overview Statistics
 * chart is in `statisticsContract`.
 */
export const expensesContract = {
  breakdown: {
    method: 'GET',
    path: '/expenses/breakdown',
    request: undefined,
    response: expensesBreakdownResponseSchema,
  },
  monthlyComparison: {
    method: 'GET',
    path: '/expenses/monthly-comparison',
    request: undefined,
    response: monthlyComparisonResponseSchema,
  },
} as const satisfies Record<string, ContractEntry>;
