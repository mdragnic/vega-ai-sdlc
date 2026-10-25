import { Inject, Injectable } from '@nestjs/common';

import { CLOCK, type Clock } from '../common/clock/clock.js';
import { startOfNextDay } from '../common/time-zone/start-of-next-day.js';
import {
  BANK_DATA_PROVIDER,
  type BankDataProvider,
  type TransactionFilter,
  type TransactionPage,
} from './bank-data-provider.js';

/**
 * The one way app code reads transactions: entries dated after today are never shown or counted
 * (#53). "Today" is the Clock's now (#80) in the user's time zone from X-Time-Zone (#54). A source
 * test keeps listTransactions out of code outside bank-data/ and demo/.
 */
@Injectable()
export class VisibleTransactions {
  constructor(
    @Inject(BANK_DATA_PROVIDER) private readonly bankData: BankDataProvider,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * The user's transactions matching the filter and dated up to today in `timeZone` (an IANA name,
   * as `@TimeZone()` gives it). A filter's own `occurredBefore` is kept when it is earlier; an invalid
   * one is passed on, so the provider rejects it instead of it silently becoming tomorrow.
   */
  list(userId: number, timeZone: string, filter: TransactionFilter = {}): Promise<TransactionPage> {
    const startOfTomorrow = startOfNextDay(this.clock.now(), timeZone);
    const occurredBefore =
      filter.occurredBefore === undefined || filter.occurredBefore > startOfTomorrow
        ? startOfTomorrow
        : filter.occurredBefore;
    return this.bankData.listTransactions(userId, { ...filter, occurredBefore });
  }
}
