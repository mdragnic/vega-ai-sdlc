import { Controller, Get } from '@nestjs/common';
import { type RecentTransactionsResponse, transactionsContract } from '@finebank/shared';

import { CurrentUser } from '../auth/current-user.decorator.js';
import { TimeZone } from '../common/time-zone/time-zone.decorator.js';
import { TransactionsService } from './transactions.service.js';

/**
 * `/api/transactions/recent`: the signed-in user's latest 5 transactions for each Recent Transaction tab, dated up to
 * today in their zone (#40, #53, #54). Behind the session guard (#75); the user comes from the session only (#39,
 * #46), and no route takes a user, an account or a transaction (no row action is designed).
 */
@Controller()
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get(transactionsContract.recent.path)
  recent(@CurrentUser() userId: number, @TimeZone() timeZone: string): Promise<RecentTransactionsResponse> {
    return this.transactions.recent(userId, timeZone);
  }
}
