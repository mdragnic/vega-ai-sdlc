import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  goalProgress,
  type Money,
  type SavingsGoalMonthsResponse,
  type SavingsGoalRequest,
  type SavingsGoalResponse,
} from '@finebank/shared';
import type { Repository } from 'typeorm';

import { CLOCK, type Clock } from '../common/clock/clock.js';
import { addMonths, monthIn } from '../common/time-zone/plain-date.js';
import { GoalMonths } from './goal-months.js';
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
 * The savings goals of the signed-in user only, read and saved by month: every query is keyed on the user from the
 * session (#39, #46). The current month comes from the Clock in the user's zone (#54, #80); the months the user can
 * choose run from it back to the earliest (#60, #123 a), and the one-month read and the save take only those (#123 b):
 * `GoalMonths`, the range the Saving Summary shares.
 */
@Injectable()
export class SavingsGoalsService {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @InjectRepository(SavingsGoal) private readonly goals: Repository<SavingsGoal>,
    private readonly goalMonths: GoalMonths,
  ) {}

  /** The current month and its goal, or `goal: null` when the month has no row (#58, #85). Overview's card. */
  async current(userId: number, timeZone: string): Promise<SavingsGoalResponse> {
    const month = monthIn(this.clock.now(), timeZone);
    return toResponse(month, await this.goals.findOneBy({ userId, month }));
  }

  /** The months the user can choose, from the current one back to the earliest, newest first (#60, #123 a). */
  async months(userId: number, timeZone: string): Promise<SavingsGoalMonthsResponse> {
    const { current, earliest } = await this.goalMonths.range(userId, timeZone);
    const months: string[] = [];
    for (let month = current; month >= earliest; month = addMonths(month, -1)) months.push(month);
    return { months };
  }

  /** One month's goal, or `goal: null` without a row; a month outside the range is a 409 (#58, #85, #123 b). */
  async forMonth(userId: number, timeZone: string, month: string): Promise<SavingsGoalResponse> {
    await this.goalMonths.check(userId, timeZone, month);
    return toResponse(month, await this.goals.findOneBy({ userId, month }));
  }

  /**
   * Creates or updates the goal of the month the request names, any month from the earliest the user can choose to
   * the current one in the zone (#58 d); another month is a 409 and nothing is stored (#123 b). One statement, keyed
   * on the table's unique user and month: it inserts the row, or on that conflict updates the Target and the Present,
   * so a month never gets a second row (#58). SQLite has one connection, so no transaction stays open around it while
   * other requests run.
   */
  async save(userId: number, timeZone: string, request: SavingsGoalRequest): Promise<SavingsGoalResponse> {
    const { month } = request;
    await this.goalMonths.check(userId, timeZone, month);

    await this.goals.upsert(
      { userId, month, targetCents: request.target.cents, presentCents: request.present.cents },
      { conflictPaths: ['userId', 'month'], skipUpdateIfNoValuesChanged: false },
    );
    return toResponse(month, await this.goals.findOneByOrFail({ userId, month }));
  }
}
