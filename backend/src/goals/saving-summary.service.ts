import { Inject, Injectable } from '@nestjs/common';
import { type Money, type SavingSummaryResponse, signedAxisTicks } from '@finebank/shared';

import { VisibleTransactions } from '../bank-data/visible-transactions.js';
import { CLOCK, type Clock } from '../common/clock/clock.js';
import { addDays, addMonths, daysInMonth, startOfMonth } from '../common/time-zone/plain-date.js';
import { todayIn } from '../common/time-zone/today-in.js';
import { GoalMonths } from './goal-months.js';

const usd = (cents: number): Money => ({ cents, currency: 'USD' });

/**
 * The Saving Summary numbers of the signed-in user only (#39, #46): the month is checked against the Goals months first
 * (`GoalMonths`, #123 b), then the user's transactions are read once through `VisibleTransactions` (#53, #77). Today
 * comes from the Clock (#80) in the user's zone (#54). A day's saving is not a savings goal and is not linked to one
 * (#59).
 */
@Injectable()
export class SavingSummaryService {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly goalMonths: GoalMonths,
    private readonly visibleTransactions: VisibleTransactions,
  ) {}

  /**
   * Each day of `month` and the same day of the month before (#42): the user's Complete income less their Complete
   * expenses that day in their zone, in integer cents, negative allowed (#11, #57, #59); `thisMonth` null for a day
   * after today, which is never read (#53, #55); `lastMonth` null on a day the month before does not have (#124 a). The
   * ticks are `signedAxisTicks` of the lowest and the highest value drawn, or null when every one is 0, the empty state
   * (#55, #68, #72, #124 d). A month the user cannot choose is a 409 and nothing is read (#123 b).
   */
  async summary(userId: number, timeZone: string, month: string): Promise<SavingSummaryResponse> {
    await this.goalMonths.check(userId, timeZone, month);

    const today = todayIn(this.clock.now(), timeZone);
    const before = addMonths(month, -1);
    // The edges are the first instants of the months in the zone, so a month with a DST change has 743 or 745 hours.
    const { transactions } = await this.visibleTransactions.list(userId, timeZone, {
      occurredFrom: startOfMonth(before, timeZone),
      occurredBefore: startOfMonth(addMonths(month, 1), timeZone),
    });

    const savings = new Map<string, number>();
    for (const transaction of transactions) {
      if (transaction.status !== 'complete') continue;
      const day = todayIn(transaction.occurredAt, timeZone);
      const signed = transaction.direction === 'income' ? transaction.amountCents : -transaction.amountCents;
      savings.set(day, (savings.get(day) ?? 0) + signed);
    }
    const savingOn = (date: string) => usd(savings.get(date) ?? 0);

    const daysBefore = daysInMonth(before);
    const days = Array.from({ length: daysInMonth(month) }, (_, index) => {
      const date = addDays(`${month}-01`, index);
      return {
        date,
        thisMonth: date > today ? null : savingOn(date),
        lastMonth: index < daysBefore ? savingOn(addDays(`${before}-01`, index)) : null,
      };
    });

    const drawn = days.flatMap(({ thisMonth, lastMonth }) =>
      [thisMonth, lastMonth].flatMap((value) => (value === null ? [] : [value.cents])),
    );
    const lowest = Math.min(...drawn);
    const highest = Math.max(...drawn);
    const ticks = lowest === 0 && highest === 0 ? null : signedAxisTicks(usd(lowest), usd(highest));
    return { month, days, ticks };
  }
}
