import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import {
  type RecentTransactionsResponse,
  transactionsContract,
  type TransactionsPage,
  type TransactionsQuery,
} from '@finebank/shared';

import { CurrentUser } from '../auth/current-user.decorator.js';
import { InvalidCursorError } from '../bank-data/bank-data-provider.js';
import { TimeZone } from '../common/time-zone/time-zone.decorator.js';
import { TransactionsService } from './transactions.service.js';

/**
 * `/api/transactions`: the signed-in user's transactions, dated up to today in their zone (#53, #54): `recent`, the
 * latest 5 for each Recent Transaction tab (#40), and one Transactions page of a tab (#27, #74). Behind the session
 * guard (#75); the user comes from the session only (#39, #46), and no route takes a user, an account or a
 * transaction (no row action is designed).
 */
@Controller()
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get(transactionsContract.recent.path)
  recent(@CurrentUser() userId: number, @TimeZone() timeZone: string): Promise<RecentTransactionsResponse> {
    return this.transactions.recent(userId, timeZone);
  }

  /**
   * 200 with the tab's page after the cursor; 400 in the shared error shape for a query outside the contract (the
   * global validation pipe) or a cursor the backend did not make. The page size is the backend's.
   */
  @Get(transactionsContract.list.path)
  async list(
    @CurrentUser() userId: number,
    @TimeZone() timeZone: string,
    @Query({ schema: transactionsContract.list.query }) query: TransactionsQuery,
  ): Promise<TransactionsPage> {
    try {
      return await this.transactions.list(userId, timeZone, query);
    } catch (error) {
      if (error instanceof InvalidCursorError) throw new BadRequestException('The cursor is not valid');
      throw error;
    }
  }
}
