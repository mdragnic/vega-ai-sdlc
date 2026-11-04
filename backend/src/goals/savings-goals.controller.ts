import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import {
  type SavingsGoalMonthQuery,
  type SavingsGoalMonthsResponse,
  type SavingsGoalRequest,
  type SavingsGoalResponse,
  savingsGoalsContract,
} from '@finebank/shared';

import { CurrentUser } from '../auth/current-user.decorator.js';
import { TimeZone } from '../common/time-zone/time-zone.decorator.js';
import { SavingsGoalsService } from './savings-goals.service.js';

/**
 * `/api/savings-goals`: the signed-in user's goals by month in their zone (#18, #54, #58, #60). Behind the session
 * guard, the write guard on the save (#119) and Nest's CSRF protection (#75); the user comes from the session only
 * (#39, #46).
 */
@Controller()
export class SavingsGoalsController {
  constructor(private readonly goals: SavingsGoalsService) {}

  @Get(savingsGoalsContract.current.path)
  current(@CurrentUser() userId: number, @TimeZone() timeZone: string): Promise<SavingsGoalResponse> {
    return this.goals.current(userId, timeZone);
  }

  /** The months the user can choose, newest first (#60, #123 a): both Goals selectors (task 026). */
  @Get(savingsGoalsContract.months.path)
  months(@CurrentUser() userId: number, @TimeZone() timeZone: string): Promise<SavingsGoalMonthsResponse> {
    return this.goals.months(userId, timeZone);
  }

  /** One month's goal: 400 for a month that is not `YYYY-MM`; 409 for one the user cannot choose (#123 b). */
  @Get(savingsGoalsContract.month.path)
  month(
    @CurrentUser() userId: number,
    @TimeZone() timeZone: string,
    @Query({ schema: savingsGoalsContract.month.query }) query: SavingsGoalMonthQuery,
  ): Promise<SavingsGoalResponse> {
    return this.goals.forMonth(userId, timeZone, query.month);
  }

  /**
   * 200 with the saved goal; 400 with field errors from the shared rules (#31, #108 a); 409 for a month the user cannot
   * choose (#123 b).
   */
  @Put(savingsGoalsContract.save.path)
  save(
    @CurrentUser() userId: number,
    @TimeZone() timeZone: string,
    @Body({ schema: savingsGoalsContract.save.request }) body: SavingsGoalRequest,
  ): Promise<SavingsGoalResponse> {
    return this.goals.save(userId, timeZone, body);
  }
}
