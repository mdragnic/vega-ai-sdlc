import { Inject, Injectable } from '@nestjs/common';
import {
  axisTicks,
  EXPENSE_LINE_ITEMS_PER_CATEGORY,
  expenseCategorySchema,
  type ExpenseCategory,
  type ExpenseLineItem,
  type ExpensesBreakdownResponse,
  type Money,
  type MonthlyComparisonResponse,
} from '@finebank/shared';

import type { BankTransaction } from '../bank-data/bank-data-provider.js';
import { VisibleTransactions } from '../bank-data/visible-transactions.js';
import { CLOCK, type Clock } from '../common/clock/clock.js';
import { addMonths, startOfMonth } from '../common/time-zone/plain-date.js';
import { todayIn } from '../common/time-zone/today-in.js';
import { expenseChange } from './percent-change.js';

const MONTHS_PER_YEAR = 12;

const usd = (cents: number): Money => ({ cents, currency: 'USD' });

/** A Complete expense of the read with its month in the user's zone. */
type ExpenseRow = { month: string; category: ExpenseCategory; transaction: BankTransaction };

/** The one calculation behind every expense figure: the rows of the months read, and their sums. */
type Expenses = {
  /** The Complete expenses of the months read, newest first as the provider gives them (`occurredAt`, then ID). */
  rows: ExpenseRow[];
  /** The sum of a category's Complete expenses in a month, in integer cents (#11). */
  totalOf: (month: string, category: ExpenseCategory) => number;
};

/**
 * Every expense number of the signed-in user only: the read is keyed on the user from the session (#39, #46) and goes
 * through `VisibleTransactions` (#53, #77). Today, the month and the year come from the Clock (#80) in the user's
 * zone (#54). One private calculation serves the breakdown (Overview's Expenses Breakdown and the Expenses cards) and
 * the Expenses chart, so they agree (task 024).
 */
@Injectable()
export class ExpensesService {
  constructor(
    private readonly visibleTransactions: VisibleTransactions,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** This month, `YYYY-MM`, from the Clock in the zone (#54, #80). */
  private thisMonth(timeZone: string): string {
    return todayIn(this.clock.now(), timeZone).slice(0, 7);
  }

  /**
   * The Complete expense transactions of the months from `firstMonth` to `lastMonth`, both included, each row's month
   * its date in the user's zone (#54, #57), in one read (no limit); the months' edges are the first instants of their
   * first days in the zone, so a month with a DST change is read whole. `VisibleTransactions` ends the read at
   * tomorrow's start, so nothing after today is read or counted (#53).
   */
  private async expenses(userId: number, timeZone: string, firstMonth: string, lastMonth: string): Promise<Expenses> {
    const { transactions } = await this.visibleTransactions.list(userId, timeZone, {
      direction: 'expense',
      occurredFrom: startOfMonth(firstMonth, timeZone),
      occurredBefore: startOfMonth(addMonths(lastMonth, 1), timeZone),
    });

    const rows: ExpenseRow[] = [];
    const totals = new Map<string, number>();
    for (const transaction of transactions) {
      const { category } = transaction;
      if (transaction.status !== 'complete' || category === null) continue;
      const month = todayIn(transaction.occurredAt, timeZone).slice(0, 7);
      rows.push({ month, category, transaction });
      const key = `${month} ${category}`;
      totals.set(key, (totals.get(key) ?? 0) + transaction.amountCents);
    }
    return { rows, totalOf: (month, category) => totals.get(`${month} ${category}`) ?? 0 };
  }

  /**
   * Per category, the sum of the Complete expense transactions of this month up to today and its change against all
   * of last month, the months and each row's date in the user's zone (#21, #54, #57; `demo-data.md`: "1 to 22 Oct vs
   * all of Sep"), and its 2 most recent Complete expenses of this month, newest first (#61), from the same read.
   * Integer cents with USD (#11, #96); all six categories in the designed order, $0.00 where a month has no expense
   * (#56, #61).
   */
  async breakdown(userId: number, timeZone: string): Promise<ExpensesBreakdownResponse> {
    const thisMonth = this.thisMonth(timeZone);
    const lastMonth = addMonths(thisMonth, -1);
    const { rows, totalOf } = await this.expenses(userId, timeZone, lastMonth, thisMonth);

    return {
      categories: expenseCategorySchema.options.map((category) => {
        const total = totalOf(thisMonth, category);
        const recent = rows
          .filter((row) => row.month === thisMonth && row.category === category)
          .slice(0, EXPENSE_LINE_ITEMS_PER_CATEGORY)
          .map(({ transaction }): ExpenseLineItem => ({
            item: transaction.item,
            amount: usd(transaction.amountCents),
            occurredAt: transaction.occurredAt.toISOString(),
          }));
        return { category, total: usd(total), change: expenseChange(total, totalOf(lastMonth, category)), recent };
      }),
    };
  }

  /**
   * The Expenses chart (#29): per month of this year, January to December, the sum of the six categories' Complete
   * expenses that month last year and this year, in integer cents with USD (#11, #96). This year is today's year in
   * the user's zone (#54); `thisYear` is null after the current month, which counts up to today (#53, #55). The ticks
   * are `axisTicks` of the highest value of both years, or null when every value is 0, the empty state (#55, #91).
   */
  async monthlyComparison(userId: number, timeZone: string): Promise<MonthlyComparisonResponse> {
    const thisMonth = this.thisMonth(timeZone);
    const january = `${thisMonth.slice(0, 4)}-01`;
    const { totalOf } = await this.expenses(
      userId,
      timeZone,
      addMonths(january, -MONTHS_PER_YEAR),
      addMonths(january, 11),
    );
    const monthTotal = (month: string) =>
      expenseCategorySchema.options.reduce((sum, category) => sum + totalOf(month, category), 0);

    const months = Array.from({ length: MONTHS_PER_YEAR }, (_, index) => {
      const month = addMonths(january, index);
      return {
        month,
        lastYear: usd(monthTotal(addMonths(month, -MONTHS_PER_YEAR))),
        thisYear: month > thisMonth ? null : usd(monthTotal(month)),
      };
    });

    const highest = Math.max(...months.flatMap(({ lastYear, thisYear }) => [lastYear.cents, thisYear?.cents ?? 0]));
    return { months, ticks: highest > 0 ? axisTicks(usd(highest)) : null };
  }
}
