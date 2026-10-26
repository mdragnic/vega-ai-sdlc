import { todayIn } from '../common/time-zone/today-in.js';

/** The month of `now` in `timeZone`, the user's IANA zone (#54, #80), as `YYYY-MM`: the month of today there. */
export function currentMonthIn(now: Date, timeZone: string): string {
  return todayIn(now, timeZone).slice(0, 7);
}
