import { z } from 'zod';

import type { ContractEntry } from './entry.js';
import { moneySchema } from './money.js';

/** Account Type, in the order of #26: the Edit Details select and the stored value. */
export const accountTypeSchema = z.enum(['credit-card', 'checking', 'savings', 'investment', 'loan']);

export type AccountType = z.infer<typeof accountTypeSchema>;

/** The card network whose logo a Balances card shows (#24). An account without one has none (null). */
export const cardNetworkSchema = z.enum(['mastercard', 'visa']);

export type CardNetwork = z.infer<typeof cardNetworkSchema>;

/** The one format of an account number outside the backend: the last 4 digits only (#25). */
export const maskedAccountNumberSchema = z.string().regex(/^\*{4} \*{4} \*{4} \d{4}$/);

/** The Bank Name: required, at most 100 characters (#26). Shown on a Balances card (#57), edited on Account Details. */
export const bankNameSchema = z.string().min(1).max(100);

/**
 * One account of the Total Balance carousel (#17) and of a Balances card (#24, #57): never the full number, the
 * opening balance or the Branch Name (#25). The balance is calculated in the backend (#11, #57).
 */
export const accountSummarySchema = z.object({
  id: z.number().int().positive(),
  accountType: accountTypeSchema,
  bankName: bankNameSchema,
  cardNetwork: cardNetworkSchema.nullable(),
  maskedNumber: maskedAccountNumberSchema,
  balance: moneySchema,
});

export type AccountSummary = z.infer<typeof accountSummarySchema>;

/** The sum of the balances, and the accounts oldest first (#17, #24). */
export const accountsResponseSchema = z.object({
  totalBalance: moneySchema,
  accounts: z.array(accountSummarySchema),
});

export type AccountsResponse = z.infer<typeof accountsResponseSchema>;

/**
 * An account ID in a URL path, parsed strictly (task 021, Marko's addition 2): only digits with no leading zero
 * (`^[1-9][0-9]*$`) whose number is a safe integer, parsed to that number. `01`, `1e3`, `-1`, `1.0`, ` 7`, `0x10`, the
 * empty string and a number past the safe range all fail, so the backend and the frontend route accept exactly the
 * same IDs and every other text is the one not-found case (#39).
 */
export const accountIdSchema = z
  .string()
  .regex(/^[1-9][0-9]*$/)
  .transform(Number)
  .refine(Number.isSafeInteger);

/** The parameters of an account's paths, `/accounts/:accountId` and below it. */
export const accountParamsSchema = z.object({ accountId: accountIdSchema });

export type AccountParams = z.input<typeof accountParamsSchema>;

/** The Branch Name: required, at most 100 characters (#26), as the Bank Name. Shown on Account Details. */
export const branchNameSchema = z.string().min(1).max(100);

/**
 * One account on Account Details (106, US-12 criterion 2): exactly its Bank Name, Account Type, Balance, Branch Name and
 * masked Account Number. Never the full number, the opening balance, the card network or an ID (#25). The balance is
 * calculated in the backend (#11, #57). Unknown keys are dropped.
 */
export const accountDetailsSchema = z.object({
  accountType: accountTypeSchema,
  bankName: bankNameSchema,
  branchName: branchNameSchema,
  maskedNumber: maskedAccountNumberSchema,
  balance: moneySchema,
});

export type AccountDetailsResponse = z.infer<typeof accountDetailsSchema>;

/**
 * The signed-in user's accounts (#39), in the user's time zone from `X-Time-Zone` (#53, #54): `list` all of them with
 * the Total Balance, `details` one of them by the ID in its path, not found (404) unless it is the user's (#39).
 */
export const accountsContract = {
  list: { method: 'GET', path: '/accounts', request: undefined, response: accountsResponseSchema },
  details: {
    method: 'GET',
    path: '/accounts/:accountId',
    params: accountParamsSchema,
    request: undefined,
    response: accountDetailsSchema,
  },
} as const satisfies Record<string, ContractEntry>;
