import { z } from 'zod';

/**
 * The 6 fixed expense categories, the same for every user, in the designed order (#56, #61).
 * Every expense has exactly one; income has none. There is no "bills" category (#56).
 */
export const expenseCategorySchema = z.enum([
  'housing',
  'food',
  'transportation',
  'entertainment',
  'shopping',
  'others',
]);

export type ExpenseCategory = z.infer<typeof expenseCategorySchema>;
