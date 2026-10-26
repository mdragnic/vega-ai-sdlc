import { Body, Controller, Get, Put } from '@nestjs/common';
import { type SavingsGoalRequest, type SavingsGoalResponse, savingsGoalsContract } from '@finebank/shared';

import { CurrentUser } from '../auth/current-user.decorator.js';
import { TimeZone } from '../common/time-zone/time-zone.decorator.js';
import { SavingsGoalsService } from './savings-goals.service.js';

/**
 * `/api/savings-goals`: the signed-in user's goal for the current month in their zone (#18, #54, #58). Behind the
 * session guard and Nest's CSRF protection (#75); the user comes from the session only (#39, #46).
 */
@Controller()
export class SavingsGoalsController {
  constructor(private readonly goals: SavingsGoalsService) {}

  @Get(savingsGoalsContract.current.path)
  current(@CurrentUser() userId: number, @TimeZone() timeZone: string): Promise<SavingsGoalResponse> {
    return this.goals.current(userId, timeZone);
  }

  /** 200 with the saved goal; 400 with field errors from the shared rules (#31, #108 a); 409 for another month. */
  @Put(savingsGoalsContract.save.path)
  save(
    @CurrentUser() userId: number,
    @TimeZone() timeZone: string,
    @Body({ schema: savingsGoalsContract.save.request }) body: SavingsGoalRequest,
  ): Promise<SavingsGoalResponse> {
    return this.goals.save(userId, timeZone, body);
  }
}
