import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import {
  type AccountDetailsRequest,
  type AccountDetailsResponse,
  accountsContract,
  type AccountsResponse,
} from '@finebank/shared';

import { CurrentUser } from '../auth/current-user.decorator.js';
import { TimeZone } from '../common/time-zone/time-zone.decorator.js';
import { accountIdFrom, accountNotFound, emptyAccountIdPath } from './account-not-found.js';
import { AccountsService } from './accounts.service.js';

/**
 * `/api/accounts`: the signed-in user's accounts and Total Balance (#17, #39, #75), one of them for Account Details
 * (106), today in their zone (#54), and its Edit Details write (#26). The user comes from the session only; an account
 * ID from the path is checked against that user in the provider's own query.
 */
@Controller()
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get(accountsContract.list.path)
  list(@CurrentUser() userId: number, @TimeZone() timeZone: string): Promise<AccountsResponse> {
    return this.accounts.summary(userId, timeZone);
  }

  /**
   * 200 with the account's five fields; the one 404 when the ID does not parse or the account is not the user's (#39).
   * The order is fixed: 401 signed out (the guard), 400 for a missing or invalid zone, then the account.
   */
  @Get([accountsContract.details.path, emptyAccountIdPath(accountsContract.details.path)])
  async details(
    @CurrentUser() userId: number,
    @TimeZone() timeZone: string,
    @Param('accountId') rawAccountId: string | undefined,
  ): Promise<AccountDetailsResponse> {
    const details = await this.accounts.details(userId, timeZone, accountIdFrom(rawAccountId));
    if (details === null) throw accountNotFound();
    return details;
  }

  /**
   * Edit Details (#26): 200 with the account's five fields as stored, the names trimmed (#120 b); the one 404, as the
   * GET's, when the ID does not parse or the account is not the user's (#39). The order is fixed: CSRF's 403 (the
   * middleware), 401 signed out and the write guard's 400 or 409 (the session guard, #119), 400 for a missing or invalid
   * zone, 400 with field errors for a body that breaks the shared rule (the validation pipe, #74), then the account.
   */
  @Patch([accountsContract.updateDetails.path, emptyAccountIdPath(accountsContract.updateDetails.path)])
  async updateDetails(
    @CurrentUser() userId: number,
    @TimeZone() timeZone: string,
    @Param('accountId') rawAccountId: string | undefined,
    @Body({ schema: accountsContract.updateDetails.request }) body: AccountDetailsRequest,
  ): Promise<AccountDetailsResponse> {
    const details = await this.accounts.updateDetails(userId, timeZone, accountIdFrom(rawAccountId), body);
    if (details === null) throw accountNotFound();
    return details;
  }
}
