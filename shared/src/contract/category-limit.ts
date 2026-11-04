import { z } from 'zod';

import { expenseCategorySchema } from './category.js';
import type { ContractEntry } from './entry.js';
import { moneySchema } from './money.js';
import { goalTargetSchema, goalTargetTextSchema } from './savings-goal.js';

/** The text of a category that is not one of the six (#56); no screen shows it, as "Enter a valid month". */
export const categoryLimitMessages = {
  invalidCategory: 'Enter a valid category',
} as const;

/** One of the six categories, anything else "Enter a valid category" (#56). */
const limitCategorySchema = z.enum(expenseCategorySchema.options, { error: categoryLimitMessages.invalidCategory });

/**
 * One category's spending limit, one value for every month (#32), `null` for a category without a row (#85, #125 a).
 * Unknown keys are dropped.
 */
export const categoryLimitSchema = z.object({
  category: expenseCategorySchema,
  limit: moneySchema.nullable(),
});

export type CategoryLimit = z.infer<typeof categoryLimitSchema>;

/** The user's limits: exactly the six categories once each, in the designed order (#56, #61). */
export const categoryLimitsResponseSchema = z
  .object({
    limits: z.array(categoryLimitSchema).length(expenseCategorySchema.options.length),
  })
  .superRefine(({ limits }, context) => {
    limits.forEach(({ category }, index) => {
      if (category !== expenseCategorySchema.options[index]) {
        context.addIssue({
          code: 'custom',
          message: 'The six categories in their designed order',
          path: ['limits', index, 'category'],
        });
      }
    });
  });

export type CategoryLimitsResponse = z.infer<typeof categoryLimitsResponseSchema>;

/**
 * `PUT /category-limits`: one category and its limit, the limit through the goal Target rule (#31: above $0, at most
 * $1,000,000,000.00, integer cents in USD; #108 a's texts). Unknown keys, such as a user, are dropped.
 */
export const categoryLimitRequestSchema = z.object({
  category: limitCategorySchema,
  limit: goalTargetSchema,
});

export type CategoryLimitRequest = z.infer<typeof categoryLimitRequestSchema>;

/** The saved category and its limit, never `null`. */
export const categoryLimitResponseSchema = z.object({
  category: expenseCategorySchema,
  limit: moneySchema,
});

export type CategoryLimitResponse = z.infer<typeof categoryLimitResponseSchema>;

/** Popup 110.2's Target Amounts text to the request amount, through the same rule as the API (#74, #84). */
export const categoryLimitFormSchema = z.object({
  limit: goalTargetTextSchema,
});

export type CategoryLimitForm = z.input<typeof categoryLimitFormSchema>;

/**
 * The signed-in user's spending limits, one per category for every month (#32): no month in either route, so neither
 * reads the clock or the zone. The list of the six, and the save of one, which creates or updates that category's
 * limit. The user comes from the session only (#39, #46).
 */
export const categoryLimitsContract = {
  list: { method: 'GET', path: '/category-limits', request: undefined, response: categoryLimitsResponseSchema },
  save: {
    method: 'PUT',
    path: '/category-limits',
    request: categoryLimitRequestSchema,
    response: categoryLimitResponseSchema,
  },
} as const satisfies Record<string, ContractEntry>;
