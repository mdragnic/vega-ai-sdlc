import { Inject, Injectable } from '@nestjs/common';
import { axisTicks, type Money, type WeeklyComparisonResponse } from '@finebank/shared';

import { VisibleTransactions } from '../bank-data/visible-transactions.js';
import { CLOCK, type Clock } from '../common/clock/clock.js';
import { startOfDay } from '../common/time-zone/start-of-day.js';
import { todayIn } from '../common/time-zone/today-in.js';

const DAY_MS = 86_400_000;
const DAYS_PER_WEEK = 7;

/** A plain date `days` days after `date` (before, when negative). Plain dates have no zone, so this is exact. */
const addDays = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** The Monday on or before a plain date (#20: weeks run Monday to Sunday). */
const mondayOf = (date: string): string =>
  addDays(date, -((new Date(Date.parse(`${date}T00:00:00Z`)).getUTCDay() + 6) % DAYS_PER_WEEK));

const usd = (cents: number): Money => ({ cents, currency: 'USD' });

/**
 * The Overview Statistics numbers of the signed-in user only: the read is keyed on the user from the session (#39,
 * #46) and goes through `VisibleTransactions` (#53, #77). Today comes from the Clock (#80) in the user's zone (#54).
 */
@Injectable()
export class StatisticsService {
  constructor(
    private readonly visibleTransactions: VisibleTransactions,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Expenses per day, this week against last week, Monday to Sunday in the user's zone (#20): the sum of the Complete
   * expense transactions of each day in integer cents (#11, #57); null for this week's days after today, which are
   * never read (#53, #55). The ticks are `axisTicks` of the highest value of both weeks, or null when every value is
   * 0, the empty state (#55, #91).
   */
  async weeklyComparison(userId: number, timeZone: string): Promise<WeeklyComparisonResponse> {
    const today = todayIn(this.clock.now(), timeZone);
    const thisMonday = mondayOf(today);
    const lastMonday = addDays(thisMonday, -DAYS_PER_WEEK);
    // The week's edges are the first instants of its Mondays in the zone, so a week with a DST change has 167 or
    // 169 hours.
    const { transactions } = await this.visibleTransactions.list(userId, timeZone, {
      direction: 'expense',
      occurredFrom: startOfDay(lastMonday, timeZone),
      occurredBefore: startOfDay(addDays(thisMonday, DAYS_PER_WEEK), timeZone),
    });

    const totals = new Map<string, number>();
    for (const transaction of transactions) {
      if (transaction.status !== 'complete') continue;
      const day = todayIn(transaction.occurredAt, timeZone);
      totals.set(day, (totals.get(day) ?? 0) + transaction.amountCents);
    }
    const totalOn = (date: string) => usd(totals.get(date) ?? 0);

    const days = Array.from({ length: DAYS_PER_WEEK }, (_, index) => {
      const date = addDays(thisMonday, index);
      return {
        date,
        lastWeek: totalOn(addDays(lastMonday, index)),
        thisWeek: date > today ? null : totalOn(date),
      };
    });

    const highest = Math.max(...days.flatMap(({ lastWeek, thisWeek }) => [lastWeek.cents, thisWeek?.cents ?? 0]));
    return { days, ticks: highest > 0 ? axisTicks(usd(highest)) : null };
  }
}
