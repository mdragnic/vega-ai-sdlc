import { Controller, Get, Query } from '@nestjs/common';
import { type SavingSummaryResponse, savingSummaryContract, type SavingsGoalMonthQuery } from '@finebank/shared';

import { CurrentUser } from '../auth/current-user.decorator.js';
import { TimeZone } from '../common/time-zone/time-zone.decorator.js';
import { SavingSummaryService } from './saving-summary.service.js';

/**
 * `/api/saving-summary?month=`: the signed-in user's savings per day for a month they can choose on Goals, against the
 * same days of the month before, in their zone (#42, #54, #59). Behind the session guard (#75); the user comes from the
 * session only (#39, #46), and no route takes a user. 400 for a month that is not `YYYY-MM` (unknown query keys are
 * dropped); 409 for one the user cannot choose (#123 b).
 */
@Controller()
export class SavingSummaryController {
  constructor(private readonly savingSummary: SavingSummaryService) {}

  @Get(savingSummaryContract.summary.path)
  summary(
    @CurrentUser() userId: number,
    @TimeZone() timeZone: string,
    @Query({ schema: savingSummaryContract.summary.query }) query: SavingsGoalMonthQuery,
  ): Promise<SavingSummaryResponse> {
    return this.savingSummary.summary(userId, timeZone, query.month);
  }
}
