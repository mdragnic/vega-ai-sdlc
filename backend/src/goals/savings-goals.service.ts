import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  goalMessages,
  goalProgress,
  type Money,
  type SavingsGoalRequest,
  type SavingsGoalResponse,
} from '@finebank/shared';
import type { Repository } from 'typeorm';

import { CLOCK, type Clock } from '../common/clock/clock.js';
import { currentMonthIn } from './current-month.js';
import { SavingsGoal } from './savings-goal.entity.js';

/** Integer cents in USD, the only currency (#11, #96). */
const usd = (cents: number): Money => ({ cents, currency: 'USD' });

/** The month and its goal as the contract sends them: no row ID or user ID; the progress from `goalProgress` (#18). */
function toResponse(month: string, row: SavingsGoal | null): SavingsGoalResponse {
  if (row === null) return { month, goal: null };
  const target = usd(row.targetCents);
  const present = usd(row.presentCents);
  return { month, goal: { target, present, progress: goalProgress(present, target) } };
}

/**
 * The savings goal of the current month in the user's zone (#54, #58), read and saved for the signed-in user only:
 * every query is keyed on the user from the session and the month (#39, #46).
 */
@Injectable()
export class SavingsGoalsService {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @InjectRepository(SavingsGoal) private readonly goals: Repository<SavingsGoal>,
  ) {}

  /** The current month and its goal, or `goal: null` when the month has no row (#58, #85). */
  async current(userId: number, timeZone: string): Promise<SavingsGoalResponse> {
    const month = currentMonthIn(this.clock.now(), timeZone);
    return toResponse(month, await this.goals.findOneBy({ userId, month }));
  }

  /**
   * Creates or updates the goal of the month the request names, which must be the current month in the zone:
   * another month, such as October saved after midnight on 31 Oct, is a 409 and nothing is stored (#108 d). One
   * statement, keyed on the table's unique user and month: it inserts the row, or on that conflict updates the
   * Target and the Present, so a month never gets a second row (#58). SQLite has one connection, so no transaction
   * stays open around it while other requests run.
   */
  async save(userId: number, timeZone: string, request: SavingsGoalRequest): Promise<SavingsGoalResponse> {
    const month = currentMonthIn(this.clock.now(), timeZone);
    if (request.month !== month) throw new ConflictException(goalMessages.monthEnded);

    await this.goals.upsert(
      { userId, month, targetCents: request.target.cents, presentCents: request.present.cents },
      { conflictPaths: ['userId', 'month'], skipUpdateIfNoValuesChanged: false },
    );
    return toResponse(month, await this.goals.findOneByOrFail({ userId, month }));
  }
}
