import { z } from 'zod';

/**
 * Income (Revenue tab, Credit) or expense (Expenses tab, Debit) (#19, #27). An expense has one
 * category, income has none (#56).
 */
export const transactionDirectionSchema = z.enum(['income', 'expense']);

export type TransactionDirection = z.infer<typeof transactionDirectionSchema>;

/** Every status is listed; only Complete counts in balances, totals and charts (#27, #57). */
export const transactionStatusSchema = z.enum(['complete', 'pending', 'failed']);

export type TransactionStatus = z.infer<typeof transactionStatusSchema>;
