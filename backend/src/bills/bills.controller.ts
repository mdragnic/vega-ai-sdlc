import { Controller, Get } from '@nestjs/common';
import { billsContract, type UpcomingBillsResponse } from '@finebank/shared';

import { CurrentUser } from '../auth/current-user.decorator.js';
import { TimeZone } from '../common/time-zone/time-zone.decorator.js';
import { BillsService } from './bills.service.js';

/**
 * `/api/bills/upcoming`: the signed-in user's bills due today or later in their zone (#28, #41, #54). Behind the
 * session guard (#75); the user comes from the session only (#39, #46), and no route takes a bill (#28: no actions).
 */
@Controller()
export class BillsController {
  constructor(private readonly bills: BillsService) {}

  @Get(billsContract.upcoming.path)
  upcoming(@CurrentUser() userId: number, @TimeZone() timeZone: string): Promise<UpcomingBillsResponse> {
    return this.bills.upcoming(userId, timeZone);
  }
}
