import { z } from 'zod';

import { expenseCategorySchema } from './category.js';
import type { ContractEntry } from './entry.js';
import { moneySchema } from './money.js';

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

/**
 * One category of the Overview Expenses Breakdown (#21, #56): its total of this month up to today in integer cents
 * with USD (#11, #96), and its change against all of last month, or `null` when last month was $0.00 (no percentage,
 * no arrow). A $0.00 total after a month with expenses is 100% down (#61). Unknown keys are dropped.
 */
export const expensesBreakdownCategorySchema = z
  .object({
    category: expenseCategorySchema,
    total: moneySchema.refine((money) => money.cents >= 0, { error: 'Expenses are never negative' }),
    change: expenseChangeSchema.nullable(),
  })
  .refine(
    ({ total, change }) =>
      total.cents > 0 || change === null || (change.percent === 100 && change.direction === 'down'),
    { error: 'No expenses this month is 100% down', path: ['change'] },
  );

export type ExpensesBreakdownCategory = z.infer<typeof expensesBreakdownCategorySchema>;

/**
 * The Overview Expenses Breakdown (#21, #61): the six categories, always all six, once each, in the designed order of
 * `expenseCategorySchema` (#56). Everything is calculated in the backend; the frontend shows it as sent (#11, #74).
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

/**
 * The signed-in user's expenses per category, this month up to today against all of last month, the month from the
 * backend's clock in the zone sent as `X-Time-Zone` (#21, #39, #54, #80). Task 024 adds the Expenses page's endpoints
 * and reuses this one for its category totals and changes.
 */
export const expensesContract = {
  breakdown: {
    method: 'GET',
    path: '/expenses/breakdown',
    request: undefined,
    response: expensesBreakdownResponseSchema,
  },
} as const satisfies Record<string, ContractEntry>;
