import { z } from 'zod';

import { accountTypeSchema } from './account.js';
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
 * The keys of a listed transaction (#19): the time in UTC (#11), shown in the browser's zone (#54); the amount in
 * integer cents, never negative, since the direction gives the sign (#11, #19, #96).
 */
const listedTransactionFields = z.object({
  item: z.string(),
  shopName: z.string(),
  category: expenseCategorySchema.nullable(),
  direction: transactionDirectionSchema,
  occurredAt: z.iso.datetime(),
  amount: moneySchema.refine((money) => money.cents >= 0, { error: 'A transaction amount is never negative' }),
});

/** An expense has its category and income has none (#56). */
const categoryMatchesDirection = (transaction: z.infer<typeof listedTransactionFields>) =>
  (transaction.direction === 'income') === (transaction.category === null);
const categoryRule = { error: 'An expense has a category and income has none', path: ['category'] };

/**
 * One row of the Overview Recent Transaction card (#19, #40), with the rules of every listed transaction. No ID,
 * account, receipt or status: no route takes a transaction (no row action is designed), and the Transactions page has
 * its own endpoint (task 020). Unknown keys are dropped.
 */
export const recentTransactionSchema = listedTransactionFields.refine(categoryMatchesDirection, categoryRule);

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

/** The rows of a Transactions page (#27, #74): the backend asks the provider for this many, the schema caps a page at it. */
export const TRANSACTIONS_PAGE_SIZE = 10;

/** The Transactions tabs All, Revenue and Expenses (#19), the values of the Recent Transaction response's keys. */
export const transactionsTabSchema = z.enum(['all', 'revenue', 'expenses']);

export type TransactionsTab = z.infer<typeof transactionsTabSchema>;

/** A cursor as the provider makes it (at most 55 characters), or the client sends it back. */
const cursorSchema = z.string().min(1).max(64);

/**
 * The Transactions page's query (#74): the tab, and the `nextCursor` of the page before for every page but the first.
 * Nothing names a user, an account or a page size: the session and the backend decide them (#39). Unknown keys are
 * dropped.
 */
export const transactionsQuerySchema = z.object({
  tab: transactionsTabSchema,
  cursor: cursorSchema.optional(),
});

export type TransactionsQuery = z.infer<typeof transactionsQuerySchema>;

/**
 * One row of the Transactions table (107): a listed transaction with the rules of Recent Transaction's rows, and its
 * Payment Method, the type of its account (#57). No ID, account, number, receipt or status: no route takes a
 * transaction (no row action is designed). Unknown keys are dropped.
 */
export const transactionRowSchema = listedTransactionFields
  .extend({ paymentMethod: accountTypeSchema })
  .refine(categoryMatchesDirection, categoryRule);

export type TransactionRow = z.infer<typeof transactionRowSchema>;

/** One page: at most 10 rows, newest first, and the cursor of the next page, or null on the last (#27, #74). */
export const transactionsPageSchema = z.object({
  transactions: z.array(transactionRowSchema).max(TRANSACTIONS_PAGE_SIZE),
  nextCursor: cursorSchema.nullable(),
});

export type TransactionsPage = z.infer<typeof transactionsPageSchema>;

/**
 * The signed-in user's transactions, today in the zone sent as `X-Time-Zone` (#39, #54, #80): `recent` for every
 * Recent Transaction tab, `list` one Transactions page of a tab.
 */
export const transactionsContract = {
  recent: {
    method: 'GET',
    path: '/transactions/recent',
    request: undefined,
    response: recentTransactionsResponseSchema,
  },
  list: {
    method: 'GET',
    path: '/transactions',
    query: transactionsQuerySchema,
    request: undefined,
    response: transactionsPageSchema,
  },
} as const satisfies Record<string, ContractEntry>;
