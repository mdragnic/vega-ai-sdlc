import { Controller, Get } from '@nestjs/common';
import { expensesContract, type ExpensesBreakdownResponse, type MonthlyComparisonResponse } from '@finebank/shared';

import { CurrentUser } from '../auth/current-user.decorator.js';
import { TimeZone } from '../common/time-zone/time-zone.decorator.js';
import { ExpensesService } from './expenses.service.js';

/**
 * The signed-in user's expenses in their zone (#54): `/api/expenses/breakdown`, per category this month so far against
 * all of last month with each category's 2 most recent items, the one answer of Overview's Expenses Breakdown and the
 * Expenses cards (#21, #61); `/api/expenses/monthly-comparison`, the Expenses chart's months of this year against last
 * year (#29). Behind the session guard (#75); the user comes from the session only (#39, #46), and no route takes a
 * user, an account, a category, a period or a transaction.
 */
@Controller()
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get(expensesContract.breakdown.path)
  breakdown(@CurrentUser() userId: number, @TimeZone() timeZone: string): Promise<ExpensesBreakdownResponse> {
    return this.expenses.breakdown(userId, timeZone);
  }

  @Get(expensesContract.monthlyComparison.path)
  monthlyComparison(@CurrentUser() userId: number, @TimeZone() timeZone: string): Promise<MonthlyComparisonResponse> {
    return this.expenses.monthlyComparison(userId, timeZone);
  }
}
