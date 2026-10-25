import { z } from 'zod';

/** Account Type, in the order of #26: the Edit Details select and the stored value. */
export const accountTypeSchema = z.enum(['credit-card', 'checking', 'savings', 'investment', 'loan']);

export type AccountType = z.infer<typeof accountTypeSchema>;

/** The card network whose logo a Balances card shows (#24). An account without one has none (null). */
export const cardNetworkSchema = z.enum(['mastercard', 'visa']);

export type CardNetwork = z.infer<typeof cardNetworkSchema>;
