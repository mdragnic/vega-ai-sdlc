import { z } from 'zod';

import { isAllowedAmountInput, parseAmountInput } from '../amount-input/index.js';
import type { ContractEntry } from './entry.js';
import { type Money, moneySchema } from './money.js';

/** The texts of the goal amount rules (#108 a) and of a month outside the months the user can choose (#123 b). */
export const goalMessages = {
  targetRequired: 'Target Amount is required',
  targetPositive: 'Target Amount must be greater than $0.00',
  targetMax: 'Target Amount must be at most $1,000,000,000.00',
  presentMax: 'Present Amount must be at most $1,000,000,000.00',
  /** A request the form cannot send: a negative amount, cents that are not whole, another currency, none. */
  invalidAmount: 'Enter a valid amount',
  invalidMonth: 'Enter a valid month',
  /** The 409 for a month after the current one or before the earliest, on the save and the one-month read (#123 b). */
  monthUnavailable: 'This month is not available. Reload the page to see the months you can choose.',
} as const;

/** The largest goal amount, $1,000,000,000.00, in cents (#31). */
const MAX_GOAL_CENTS = 100_000_000_000;

/** A calendar month `YYYY-MM`: the month of a savings goal (#58). */
export const goalMonthSchema = z.string({ error: goalMessages.invalidMonth }).regex(/^\d{4}-(0[1-9]|1[0-2])$/, {
  error: goalMessages.invalidMonth,
});

/**
 * Money of a goal amount, its issues on the field itself rather than on `cents` (#108 a): anything that is not
 * integer cents in USD is "Enter a valid amount", and so is a negative amount. Each field gives one message, its
 * first failing rule (as #95): every check but the last aborts.
 */
const goalMoney = z
  .custom<Money>((value) => moneySchema.safeParse(value).success, { error: goalMessages.invalidAmount, abort: true })
  .refine((money) => money.cents >= 0, { error: goalMessages.invalidAmount, abort: true });

/** Only the money's own keys. */
const ownKeys = ({ cents, currency }: Money): Money => ({ cents, currency });

/** The Target of a goal: above $0 and at most $1,000,000,000.00 (#31). */
export const goalTargetSchema = goalMoney
  .refine((money) => money.cents > 0, { error: goalMessages.targetPositive, abort: true })
  .refine((money) => money.cents <= MAX_GOAL_CENTS, { error: goalMessages.targetMax })
  .transform(ownKeys);

/** The Present of a goal: $0 or more, at most $1,000,000,000.00; it may exceed the Target (#31). */
export const goalPresentSchema = goalMoney
  .refine((money) => money.cents <= MAX_GOAL_CENTS, { error: goalMessages.presentMax })
  .transform(ownKeys);

/**
 * `PUT /savings-goals`: the month the popup opened with and its amounts. The month is any one from the earliest the
 * user can choose to the current one in their zone (#58 d, #123 b). Unknown keys, such as a user, are dropped.
 */
export const savingsGoalRequestSchema = z.object({
  month: goalMonthSchema,
  target: goalTargetSchema,
  present: goalPresentSchema,
});

export type SavingsGoalRequest = z.infer<typeof savingsGoalRequestSchema>;

/**
 * An amount field's text as money (#64, #84). An empty field, or a lone `.`, is `emptyCents`, or with `null` the
 * Target's "required". Text too long for exact cents is far above the maximum, so it is read as the largest safe
 * integer and fails the maximum rule.
 */
const amountText = (emptyCents: number | null) =>
  z.string().transform((text, ctx) => {
    if (!isAllowedAmountInput(text)) {
      ctx.issues.push({ code: 'custom', message: goalMessages.invalidAmount, input: text });
      return z.NEVER;
    }
    const cents = parseAmountInput(text) ?? emptyCents;
    if (cents === null) {
      ctx.issues.push({ code: 'custom', message: goalMessages.targetRequired, input: text });
      return z.NEVER;
    }
    return { cents: Number.isSafeInteger(cents) ? cents : Number.MAX_SAFE_INTEGER, currency: 'USD' as const };
  });

/**
 * A popup's Target text to the request amount, through the Target rule of the API (#31, #74, #84, #108 a): an empty
 * field, or a lone `.`, is required. Shared by the goal popup and the category limit popup (task 027).
 */
export const goalTargetTextSchema = amountText(null).pipe(goalTargetSchema);

/**
 * The goal popup's two text fields to the request amounts, through the same rules as the API (#74): an empty
 * Target is required, an empty Present is $0 (#84 b).
 */
export const savingsGoalFormSchema = z.object({
  target: goalTargetTextSchema,
  present: amountText(0).pipe(goalPresentSchema),
});

export type SavingsGoalForm = z.input<typeof savingsGoalFormSchema>;

/** A month's goal: Target, Present and the progress Present / Target from 0 to 1, from `goalProgress` (#18, #31). */
export const savingsGoalSchema = z.object({
  target: moneySchema,
  present: moneySchema,
  progress: z.number().min(0).max(1),
});

export type SavingsGoal = z.infer<typeof savingsGoalSchema>;

/** The month in the user's zone and its goal, `null` when the month has none (#58, #85). */
export const savingsGoalResponseSchema = z.object({
  month: goalMonthSchema,
  goal: savingsGoalSchema.nullable(),
});

export type SavingsGoalResponse = z.infer<typeof savingsGoalResponseSchema>;

/**
 * The months the user can choose (#60, #123 a): from the current month in their zone back to the earliest, at least
 * one, strictly newest first. `YYYY-MM` strings of four-digit years sort as their months do. Unknown keys are dropped.
 */
export const savingsGoalMonthsResponseSchema = z.object({
  months: z
    .array(goalMonthSchema)
    .min(1)
    .refine((months) => months.every((month, index) => index === 0 || month < months[index - 1]!), {
      error: 'The months are strictly newest first',
    }),
});

export type SavingsGoalMonthsResponse = z.infer<typeof savingsGoalMonthsResponseSchema>;

/** The query of `GET /savings-goals?month=`: the month, required. Nothing names a user (#39); unknown keys are dropped. */
export const savingsGoalMonthQuerySchema = z.object({ month: goalMonthSchema });

export type SavingsGoalMonthQuery = z.infer<typeof savingsGoalMonthQuerySchema>;

/**
 * The signed-in user's savings goals in the zone sent as `X-Time-Zone` (#39, #54, #58): the current month's (Overview);
 * the months the user can choose, which both Goals selectors list (#60; the Saving Summary's in task 026); one of those
 * months' goal (Goals); and the save, which creates or updates the goal of any of those months. A month after the
 * current one or before the earliest answers 409 `goalMessages.monthUnavailable` on the one-month read and the save
 * (#123 b), so no future goal is ever sent.
 */
export const savingsGoalsContract = {
  current: { method: 'GET', path: '/savings-goals/current', request: undefined, response: savingsGoalResponseSchema },
  months: {
    method: 'GET',
    path: '/savings-goals/months',
    request: undefined,
    response: savingsGoalMonthsResponseSchema,
  },
  month: {
    method: 'GET',
    path: '/savings-goals',
    request: undefined,
    query: savingsGoalMonthQuerySchema,
    response: savingsGoalResponseSchema,
  },
  save: {
    method: 'PUT',
    path: '/savings-goals',
    request: savingsGoalRequestSchema,
    response: savingsGoalResponseSchema,
  },
} as const satisfies Record<string, ContractEntry>;
