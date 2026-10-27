import { z } from 'zod';

import { expenseCategorySchema } from './category.js';
import type { ContractEntry } from './entry.js';
import { moneySchema } from './money.js';

/**
 * Income (Revenue tab, Credit) or expense (Expenses tab, Debit) (#19, #27). An expense has one
 * category, income has none (#56).
 */
export const transactionDirectionSchema = z.enum(['income', 'expense']);

export type TransactionDirection = z.infer<typeof transactionDirectionSchema>;

/** Every status is listed; only Complete counts in balances, totals and charts (#27, #57). */
export const transactionStatusSchema = z.enum(['complete', 'pending', 'failed']);

export type TransactionStatus = z.infer<typeof transactionStatusSchema>;

/** The most rows a Recent Transaction tab lists (#40): the backend asks for this many, the schema caps each list. */
export const RECENT_TRANSACTIONS_PER_TAB = 5;

/**
 * One row of the Overview Recent Transaction card (#19, #40): the time in UTC (#11), shown in the browser's zone
 * (#54); the amount in integer cents, never negative, since the direction gives the sign (#11, #19, #96). An expense
 * has its category and income has none (#56). No ID, account, receipt or status: no route takes a transaction (no
 * row action is designed), and the Transactions page has its own endpoint (task 020). Unknown keys are dropped.
 */
export const recentTransactionSchema = z
  .object({
    item: z.string(),
    shopName: z.string(),
    category: expenseCategorySchema.nullable(),
    direction: transactionDirectionSchema,
    occurredAt: z.iso.datetime(),
    amount: moneySchema.refine((money) => money.cents >= 0, { error: 'A transaction amount is never negative' }),
  })
  .refine((transaction) => (transaction.direction === 'income') === (transaction.category === null), {
    error: 'An expense has a category and income has none',
    path: ['category'],
  });

/** One row of a Recent Transaction list, as the contract parses it. */
export type RecentTransactionRow = z.infer<typeof recentTransactionSchema>;

const recentList = z.array(recentTransactionSchema).max(RECENT_TRANSACTIONS_PER_TAB);

/**
 * One list per tab, each the user's latest 5 of that kind dated up to today in their zone, newest first (#19, #40,
 * #53): All any direction, Revenue income, Expenses expense. The keys are the tab values.
 */
export const recentTransactionsResponseSchema = z.object({
  all: recentList,
  revenue: recentList,
  expenses: recentList,
});

export type RecentTransactionsResponse = z.infer<typeof recentTransactionsResponseSchema>;

/**
 * The signed-in user's recent transactions for every Recent Transaction tab, today in the zone sent as `X-Time-Zone`
 * (#39, #54, #80). Task 020 adds the Transactions page's entry.
 */
export const transactionsContract = {
  recent: {
    method: 'GET',
    path: '/transactions/recent',
    request: undefined,
    response: recentTransactionsResponseSchema,
  },
} as const satisfies Record<string, ContractEntry>;
