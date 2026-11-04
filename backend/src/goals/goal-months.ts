import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { goalMessages } from '@finebank/shared';
import type { Repository } from 'typeorm';

import { VisibleTransactions } from '../bank-data/visible-transactions.js';
import { CLOCK, type Clock } from '../common/clock/clock.js';
import { monthIn } from '../common/time-zone/plain-date.js';
import { SavingsGoal } from './savings-goal.entity.js';

/** The months a user can choose, `YYYY-MM`: `YYYY-MM` strings of four-digit years compare as their months do. */
export type MonthRange = { current: string; earliest: string };

/**
 * The months the signed-in user can choose on Goals (#60, #123), the one range both Goals selectors list and every
 * Goals read and write takes a month from: the savings goals (task 025) and the Saving Summary (task 026). Keyed on the
 * user from the session (#39, #46); the current month from the Clock in the user's zone (#54, #80).
 */
@Injectable()
export class GoalMonths {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @InjectRepository(SavingsGoal) private readonly goals: Repository<SavingsGoal>,
    private readonly visibleTransactions: VisibleTransactions,
  ) {}

  /**
   * The current month in the zone, and the earliest (#123 a): the earlier of the month of the user's earliest
   * transaction dated up to today (any status, direction or account, through `VisibleTransactions`, #53, #77) and the
   * user's lowest goal month not after the current one, each in the user's zone; the current month when neither exists.
   * Since a save never takes a month before it, a save never moves it earlier.
   */
  async range(userId: number, timeZone: string): Promise<MonthRange> {
    const current = monthIn(this.clock.now(), timeZone);
    const firstTransaction = await this.visibleTransactions.earliestOccurredAt(userId, timeZone);
    const firstGoal = await this.goals
      .createQueryBuilder('g')
      .select('MIN(g.month)', 'earliest')
      .where('g.userId = :userId', { userId })
      .andWhere('g.month <= :current', { current })
      .getRawOne<{ earliest: string | null }>();
    const candidates = [
      current,
      ...(firstTransaction === null ? [] : [monthIn(firstTransaction, timeZone)]),
      ...(firstGoal?.earliest ? [firstGoal.earliest] : []),
    ];
    return { current, earliest: candidates.toSorted()[0]! };
  }

  /** A month after the current one or before the earliest: 409 `monthUnavailable` (#123 b), before anything else. */
  async check(userId: number, timeZone: string, month: string): Promise<void> {
    const { current, earliest } = await this.range(userId, timeZone);
    if (month > current || month < earliest) throw new ConflictException(goalMessages.monthUnavailable);
  }
}
