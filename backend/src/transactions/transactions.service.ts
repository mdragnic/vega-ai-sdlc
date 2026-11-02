import { Injectable } from '@nestjs/common';
import {
  type AccountType,
  RECENT_TRANSACTIONS_PER_TAB,
  type RecentTransactionsResponse,
  type TransactionDirection,
  type TransactionHistoryPage,
  type TransactionHistoryQuery,
  TRANSACTIONS_PAGE_SIZE,
  type TransactionsPage,
  type TransactionsQuery,
  type TransactionsTab,
} from '@finebank/shared';

import { AccountsService } from '../accounts/accounts.service.js';
import type { BankTransaction } from '../bank-data/bank-data-provider.js';
import { VisibleTransactions } from '../bank-data/visible-transactions.js';

/** A provider row as the contract sends it: only its keys, the amount in integer cents with USD (#11, #96). */
const toRecent = ({ item, shopName, category, direction, occurredAt, amountCents }: BankTransaction) => ({
  item,
  shopName,
  category,
  direction,
  occurredAt: occurredAt.toISOString(),
  amount: { cents: amountCents, currency: 'USD' as const },
});

/** The direction each Transactions tab lists: All any (#19). */
const tabDirection: Record<TransactionsTab, TransactionDirection | undefined> = {
  all: undefined,
  revenue: 'income',
  expenses: 'expense',
};

/**
 * The transactions of the signed-in user only: every read is keyed on the user from the session (#39, #46) and goes
 * through `VisibleTransactions` (#53, #77), which hides entries dated after today in the user's zone, today from the
 * Clock (#54, #80).
 */
@Injectable()
export class TransactionsService {
  constructor(
    private readonly visibleTransactions: VisibleTransactions,
    private readonly accounts: AccountsService,
  ) {}

  /**
   * Each Recent Transaction tab's latest 5, newest first, the same instant with the later stored first (the
   * provider's order, #27, #40): All any direction, Revenue income, Expenses expense, every status (#57).
   */
  async recent(userId: number, timeZone: string): Promise<RecentTransactionsResponse> {
    const latest = async (direction?: TransactionDirection) => {
      const limit = RECENT_TRANSACTIONS_PER_TAB;
      const filter = direction === undefined ? { limit } : { direction, limit };
      const { transactions } = await this.visibleTransactions.list(userId, timeZone, filter);
      return transactions.map(toRecent);
    };
    const [all, revenue, expenses] = await Promise.all([latest(), latest('income'), latest('expense')]);
    return { all, revenue, expenses };
  }

  /**
   * One Transactions page of a tab (#27, #74): the next 10 of its kind after the cursor's row, in the provider's order
   * (newest first, the same instant with the later stored first), every status (#57), each with its Payment Method, the
   * type of its account (#57). The cursor names a position, so rows added or removed before it change nothing after
   * it. Throws the provider's `InvalidCursorError` for a cursor it did not make.
   */
  async list(userId: number, timeZone: string, { tab, cursor }: TransactionsQuery): Promise<TransactionsPage> {
    const direction = tabDirection[tab];
    const [page, accountTypes] = await Promise.all([
      this.visibleTransactions.list(userId, timeZone, {
        ...(direction && { direction }),
        ...(cursor !== undefined && { cursor }),
        limit: TRANSACTIONS_PAGE_SIZE,
      }),
      this.accounts.accountTypes(userId),
    ]);
    return {
      transactions: page.transactions.map((transaction) => ({
        ...toRecent(transaction),
        paymentMethod: paymentMethodOf(transaction, accountTypes),
      })),
      nextCursor: page.nextCursor,
    };
  }

  /**
   * One page of an account's Transactions History (106): the account's next 10 after the cursor's row, in the
   * provider's order (newest first, the same instant with the later stored first), every status (#57), with the cursor
   * rules of `list` (#27, #74). Null, reading no transaction, when the account is not the user's (`hasAccount`, the
   * provider's one query, #39). Every page's read also filters by the session user and the account in the provider's
   * one query, never by the account ID alone, so another user's account gives no rows even without that check. Throws
   * the provider's `InvalidCursorError` for a cursor it did not make.
   */
  async history(
    userId: number,
    timeZone: string,
    accountId: number,
    { cursor }: TransactionHistoryQuery,
  ): Promise<TransactionHistoryPage | null> {
    if (!(await this.accounts.hasAccount(userId, accountId))) return null;
    const page = await this.visibleTransactions.list(userId, timeZone, {
      accountId,
      ...(cursor !== undefined && { cursor }),
      limit: TRANSACTIONS_PAGE_SIZE,
    });
    return { transactions: page.transactions.map(toHistoryRow), nextCursor: page.nextCursor };
  }
}

/** A provider row as a history row: only the contract's keys, the amount in integer cents with USD (#11, #96). */
const toHistoryRow = ({ occurredAt, status, direction, receipt, amountCents }: BankTransaction) => ({
  occurredAt: occurredAt.toISOString(),
  status,
  direction,
  receipt,
  amount: { cents: amountCents, currency: 'USD' as const },
});

/** The type of the transaction's account, which is always one of the user's (#57); anything else is an error. */
function paymentMethodOf({ accountId }: BankTransaction, accountTypes: Map<number, AccountType>): AccountType {
  const type = accountTypes.get(accountId);
  if (type === undefined) throw new Error('A transaction’s account is not one of the user’s accounts');
  return type;
}
