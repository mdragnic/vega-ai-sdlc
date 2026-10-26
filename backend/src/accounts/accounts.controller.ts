import { Controller, Get } from '@nestjs/common';
import { accountsContract, type AccountsResponse } from '@finebank/shared';

import { CurrentUser } from '../auth/current-user.decorator.js';
import { TimeZone } from '../common/time-zone/time-zone.decorator.js';
import { AccountsService } from './accounts.service.js';

/** `/api/accounts`: the signed-in user's accounts and Total Balance (#17, #39, #75), today in their zone (#54). */
@Controller()
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get(accountsContract.list.path)
  list(@CurrentUser() userId: number, @TimeZone() timeZone: string): Promise<AccountsResponse> {
    return this.accounts.summary(userId, timeZone);
  }
}
