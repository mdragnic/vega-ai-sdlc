import { Injectable } from '@nestjs/common';
import {
  RECENT_TRANSACTIONS_PER_TAB,
  type RecentTransactionsResponse,
  type TransactionDirection,
} from '@finebank/shared';

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

/**
 * The transactions of the signed-in user only: every read is keyed on the user from the session (#39, #46) and goes
 * through `VisibleTransactions` (#53, #77), which hides entries dated after today in the user's zone, today from the
 * Clock (#54, #80).
 */
@Injectable()
export class TransactionsService {
  constructor(private readonly visibleTransactions: VisibleTransactions) {}

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
}
