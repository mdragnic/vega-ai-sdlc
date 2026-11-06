import { z } from 'zod';

import type { ContractEntry } from './entry.js';
import { moneySchema } from './money.js';
import { nameSchema } from './name-rule.js';

/** Account Type, in the order of #26: the Edit Details select and the stored value. */
export const accountTypeSchema = z.enum(['credit-card', 'checking', 'savings', 'investment', 'loan']);

export type AccountType = z.infer<typeof accountTypeSchema>;

/** The card network whose logo a Balances card shows (#24). An account without one has none (null). */
export const cardNetworkSchema = z.enum(['mastercard', 'visa']);

export type CardNetwork = z.infer<typeof cardNetworkSchema>;

/** The one format of an account number outside the backend: the last 4 digits only (#25). */
export const maskedAccountNumberSchema = z.string().regex(/^\*{4} \*{4} \*{4} \d{4}$/);

/** The texts of the Edit Details rules (#120 b4): one message per field, its first failing rule (#95 a). */
export const accountMessages = {
  bankNameRequired: 'Bank Name is required',
  bankNameControl: 'Bank Name cannot contain tabs or line breaks',
  bankNameMax: 'Bank Name must be at most 100 characters',
  branchNameRequired: 'Branch Name is required',
  branchNameControl: 'Branch Name cannot contain tabs or line breaks',
  branchNameMax: 'Branch Name must be at most 100 characters',
  accountTypeInvalid: 'Choose an Account Type',
} as const;

/** The Bank Name (#26, #120 b), for the form, the API and the responses (#74). Shown on a Balances card (#57). */
export const bankNameSchema = nameSchema({
  required: accountMessages.bankNameRequired,
  control: accountMessages.bankNameControl,
  max: accountMessages.bankNameMax,
});

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

/** The Branch Name, by the Bank Name's rule (#26, #120 b). Shown on Account Details. */
export const branchNameSchema = nameSchema({
  required: accountMessages.branchNameRequired,
  control: accountMessages.branchNameControl,
  max: accountMessages.branchNameMax,
});

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
 * `PATCH /accounts/:accountId`, Edit Details (#26): exactly the three editable fields, all required (the form always
 * sends all three), the names by the one rule and trimmed (#120 b), the type one of the five. Unknown keys are dropped,
 * so an ID, a user, the number, the card network, the opening balance or a balance never reaches the backend's logic.
 * The form uses it as is, so the form and the API apply one rule (#74).
 */
export const accountDetailsRequestSchema = z.object({
  bankName: bankNameSchema,
  branchName: branchNameSchema,
  accountType: z.enum(accountTypeSchema.options, { error: accountMessages.accountTypeInvalid }),
});

export type AccountDetailsRequest = z.infer<typeof accountDetailsRequestSchema>;

/**
 * The signed-in user's accounts (#39), in the user's time zone from `X-Time-Zone` (#53, #54): `list` all of them with
 * the Total Balance, `details` one of them by the ID in its path, not found (404) unless it is the user's (#39), and
 * `updateDetails` its three editable fields (#26), answering its details as `details` does.
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
  updateDetails: {
    method: 'PATCH',
    path: '/accounts/:accountId',
    params: accountParamsSchema,
    request: accountDetailsRequestSchema,
    response: accountDetailsSchema,
  },
} as const satisfies Record<string, ContractEntry>;
