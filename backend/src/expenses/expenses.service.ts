import { Inject, Injectable } from '@nestjs/common';
import { expenseCategorySchema, type ExpenseCategory, type ExpensesBreakdownResponse } from '@finebank/shared';

import { VisibleTransactions } from '../bank-data/visible-transactions.js';
import { CLOCK, type Clock } from '../common/clock/clock.js';
import { startOfDay } from '../common/time-zone/start-of-day.js';
import { todayIn } from '../common/time-zone/today-in.js';
import { expenseChange } from './percent-change.js';

/** The `YYYY-MM` month `months` months after `month` (before, when negative): January's previous is December. */
const addMonths = (month: string, months: number): string => {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + months;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
};

/** The first instant of a month's first day in the zone: a month with a DST change has 743 or 745 hours. */
const startOfMonth = (month: string, timeZone: string): Date => startOfDay(`${month}-01`, timeZone);

/**
 * The Overview Expenses Breakdown numbers of the signed-in user only: the read is keyed on the user from the session
 * (#39, #46) and goes through `VisibleTransactions` (#53, #77). Today comes from the Clock (#80) in the user's zone
 * (#54).
 */
@Injectable()
export class ExpensesService {
  constructor(
    private readonly visibleTransactions: VisibleTransactions,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Per category, the sum of the Complete expense transactions of this month up to today and its change against all
   * of last month, the months and each row's date in the user's zone (#21, #54, #57; `demo-data.md`: "1 to 22 Oct vs
   * all of Sep"). Integer cents with USD (#11, #96); all six categories in the designed order, $0.00 where a month has
   * no expense (#56, #61).
   */
  async breakdown(userId: number, timeZone: string): Promise<ExpensesBreakdownResponse> {
    const thisMonth = todayIn(this.clock.now(), timeZone).slice(0, 7);
    const lastMonth = addMonths(thisMonth, -1);
    // VisibleTransactions ends the read at tomorrow's start, so nothing after today is read (#53).
    const { transactions } = await this.visibleTransactions.list(userId, timeZone, {
      direction: 'expense',
      occurredFrom: startOfMonth(lastMonth, timeZone),
      occurredBefore: startOfMonth(addMonths(thisMonth, 1), timeZone),
    });

    const totals = new Map<string, number>();
    for (const transaction of transactions) {
      if (transaction.status !== 'complete' || transaction.category === null) continue;
      const key = `${todayIn(transaction.occurredAt, timeZone).slice(0, 7)} ${transaction.category}`;
      totals.set(key, (totals.get(key) ?? 0) + transaction.amountCents);
    }
    const totalOf = (month: string, category: ExpenseCategory) => totals.get(`${month} ${category}`) ?? 0;

    return {
      categories: expenseCategorySchema.options.map((category) => {
        const total = totalOf(thisMonth, category);
        return {
          category,
          total: { cents: total, currency: 'USD' },
          change: expenseChange(total, totalOf(lastMonth, category)),
        };
      }),
    };
  }
}
