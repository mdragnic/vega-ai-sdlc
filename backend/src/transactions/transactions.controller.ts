import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import {
  type RecentTransactionsResponse,
  type TransactionHistoryPage,
  type TransactionHistoryQuery,
  transactionsContract,
  type TransactionsPage,
  type TransactionsQuery,
} from '@finebank/shared';

import { accountIdFrom, accountNotFound, emptyAccountIdPath } from '../accounts/account-not-found.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { InvalidCursorError } from '../bank-data/bank-data-provider.js';
import { TimeZone } from '../common/time-zone/time-zone.decorator.js';
import { TransactionsService } from './transactions.service.js';

/** The provider's `InvalidCursorError` as a 400 in the shared error shape; anything else as it is. */
function cursorError(error: unknown): unknown {
  return error instanceof InvalidCursorError ? new BadRequestException('The cursor is not valid') : error;
}

/**
 * The signed-in user's transactions, dated up to today in their zone (#53, #54): `recent`, the latest 5 for each
 * Recent Transaction tab (#40), one Transactions page of a tab (#27, #74), and one page of an account's Transactions
 * History (106). Behind the session guard (#75); the user comes from the session only (#39, #46), an account ID from
 * the path is checked against that user in the provider's own query, and no route takes a user or a transaction (no
 * row action is designed).
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
      throw cursorError(error);
    }
  }

  /**
   * 200 with the account's page after the cursor; the one 404 of the account routes when the ID does not parse or the
   * account is not the user's (#39); 400 for a query outside the contract or a cursor the backend did not make. The
   * page size is the backend's.
   */
  @Get([transactionsContract.history.path, emptyAccountIdPath(transactionsContract.history.path)])
  async history(
    @CurrentUser() userId: number,
    @TimeZone() timeZone: string,
    @Param('accountId') rawAccountId: string | undefined,
    @Query({ schema: transactionsContract.history.query }) query: TransactionHistoryQuery,
  ): Promise<TransactionHistoryPage> {
    const accountId = accountIdFrom(rawAccountId);
    let page: TransactionHistoryPage | null;
    try {
      page = await this.transactions.history(userId, timeZone, accountId, query);
    } catch (error) {
      throw cursorError(error);
    }
    if (page === null) throw accountNotFound();
    return page;
  }
}
