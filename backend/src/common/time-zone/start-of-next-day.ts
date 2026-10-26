import { wallClock } from './wall-clock.js';

const DAY_MS = 86_400_000;

/** The zone's offset from UTC at an instant, in milliseconds (Belgrade in summer: +2 hours). */
const offsetAt = (instant: number, timeZone: string): number =>
  wallClock(instant, timeZone) - Math.floor(instant / 1000) * 1000;

/**
 * The first instant of the day after `now`'s date in `timeZone`, the user's IANA zone (#54).
 * Tomorrow's midnight is tried with the zone's offset before and after it, so a DST change that day
 * is handled, also one that skips midnight (the day then starts at 01:00).
 */
export function startOfNextDay(now: Date, timeZone: string): Date {
  const today = wallClock(now.getTime(), timeZone);
  // Tomorrow 00:00 on the wall clock, written as if it were UTC.
  const midnight = Math.floor(today / DAY_MS) * DAY_MS + DAY_MS;
  const candidates = [offsetAt(midnight - DAY_MS, timeZone), offsetAt(midnight + DAY_MS, timeZone)]
    .map((offset) => midnight - offset)
    .toSorted((a, b) => a - b);
  // The earliest candidate whose wall-clock date is already tomorrow.
  const start = candidates.find((candidate) => wallClock(candidate, timeZone) >= midnight) ?? candidates.at(-1)!;
  return new Date(start);
}
