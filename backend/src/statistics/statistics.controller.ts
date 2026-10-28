import { Controller, Get } from '@nestjs/common';
import { statisticsContract, type WeeklyComparisonResponse } from '@finebank/shared';

import { CurrentUser } from '../auth/current-user.decorator.js';
import { TimeZone } from '../common/time-zone/time-zone.decorator.js';
import { StatisticsService } from './statistics.service.js';

/**
 * `/api/statistics/weekly-comparison`: the signed-in user's expenses per day, this week against last week, in their
 * zone (#20, #54). Behind the session guard (#75); the user comes from the session only (#39, #46), and no route takes
 * a user, an account or a transaction.
 */
@Controller()
export class StatisticsController {
  constructor(private readonly statistics: StatisticsService) {}

  @Get(statisticsContract.weeklyComparison.path)
  weeklyComparison(@CurrentUser() userId: number, @TimeZone() timeZone: string): Promise<WeeklyComparisonResponse> {
    return this.statistics.weeklyComparison(userId, timeZone);
  }
}
