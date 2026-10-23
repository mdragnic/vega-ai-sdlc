import { z } from 'zod';

/**
 * Money in JSON: integer cents with a currency, never a float (#11, #74).
 * The backend calculates, the frontend only formats. Zod 4's `int()` accepts safe integers only.
 */
export const moneySchema = z.object({
  cents: z.number().int(),
  currency: z.literal('USD'),
});

export type Money = z.infer<typeof moneySchema>;
