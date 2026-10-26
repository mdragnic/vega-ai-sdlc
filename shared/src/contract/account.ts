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

/**
 * One account of the Total Balance carousel (#17): never the full number, the opening balance or the Bank Name
 * (#25). The balance is calculated in the backend (#11, #57).
 */
export const accountSummarySchema = z.object({
  id: z.number().int().positive(),
  accountType: accountTypeSchema,
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

/** The signed-in user's accounts (#39), in the user's time zone from `X-Time-Zone` (#53, #54). */
export const accountsContract = {
  list: { method: 'GET', path: '/accounts', request: undefined, response: accountsResponseSchema },
} as const satisfies Record<string, ContractEntry>;
