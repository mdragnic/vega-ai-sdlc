import { Controller, Get } from '@nestjs/common';
import { expensesContract, type ExpensesBreakdownResponse } from '@finebank/shared';

import { CurrentUser } from '../auth/current-user.decorator.js';
import { TimeZone } from '../common/time-zone/time-zone.decorator.js';
import { ExpensesService } from './expenses.service.js';

/**
 * `/api/expenses/breakdown`: the signed-in user's expenses per category, this month so far against all of last month,
 * in their zone (#21, #54). Behind the session guard (#75); the user comes from the session only (#39, #46), and no
 * route takes a user, an account, a category or a transaction.
 */
@Controller()
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get(expensesContract.breakdown.path)
  breakdown(@CurrentUser() userId: number, @TimeZone() timeZone: string): Promise<ExpensesBreakdownResponse> {
    return this.expenses.breakdown(userId, timeZone);
  }
}
