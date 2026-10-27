import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { UpcomingBillsResponse } from '@finebank/shared';
import { MoreThanOrEqual, type Repository } from 'typeorm';

import { CLOCK, type Clock } from '../common/clock/clock.js';
import { todayIn } from '../common/time-zone/today-in.js';
import { Bill } from './bill.entity.js';

/**
 * The bills of the signed-in user only: every query is keyed on the user from the session (#39, #46). Bills are not
 * account or transaction data, so they are read here rather than through `BankDataProvider` (#77, task 008).
 */
@Injectable()
export class BillsService {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @InjectRepository(Bill) private readonly bills: Repository<Bill>,
  ) {}

  /**
   * Every bill due today or later in the user's zone, soonest first, the same day in the order stored (#28, #41,
   * #53). Today is bound as its `YYYY-MM-DD` string: a `Date` binds as `YYYY-MM-DD HH:MM:SS.SSS`, which sorts after
   * the stored plain date and would drop the bill due today (task 008 review).
   */
  async upcoming(userId: number, timeZone: string): Promise<UpcomingBillsResponse> {
    const today = todayIn(this.clock.now(), timeZone);
    const rows = await this.bills.find({
      where: { userId, dueDate: MoreThanOrEqual(today) },
      order: { dueDate: 'ASC', id: 'ASC' },
    });
    return {
      bills: rows.map(({ title, logo, dueDate, lastChargeDate, amountCents }) => ({
        title,
        logo,
        dueDate,
        lastChargeDate,
        amount: { cents: amountCents, currency: 'USD' },
      })),
    };
  }
}
