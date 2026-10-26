import { wallClock } from './wall-clock.js';

/** The date of `now` in `timeZone`, the user's IANA zone (#54), as a plain date `YYYY-MM-DD`. */
export function todayIn(now: Date, timeZone: string): string {
  return new Date(wallClock(now.getTime(), timeZone)).toISOString().slice(0, 10);
}
