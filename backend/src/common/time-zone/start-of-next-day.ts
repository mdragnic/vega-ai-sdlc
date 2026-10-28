import { startOfDay } from './start-of-day.js';
import { wallClock } from './wall-clock.js';

const DAY_MS = 86_400_000;

/**
 * The first instant of the day after `now`'s date in `timeZone`, the user's IANA zone (#54), DST changes included
 * (`startOfDay`).
 */
export function startOfNextDay(now: Date, timeZone: string): Date {
  const today = wallClock(now.getTime(), timeZone);
  // Tomorrow 00:00 on the wall clock, written as if it were UTC.
  const tomorrow = Math.floor(today / DAY_MS) * DAY_MS + DAY_MS;
  return startOfDay(new Date(tomorrow).toISOString().slice(0, 10), timeZone);
}
