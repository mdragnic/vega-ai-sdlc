import { wallClock } from './wall-clock.js';

const DAY_MS = 86_400_000;
const plainDate = /^\d{4}-\d{2}-\d{2}$/;

/** The zone's offset from UTC at an instant, in milliseconds (Belgrade in summer: +2 hours). */
const offsetAt = (instant: number, timeZone: string): number =>
  wallClock(instant, timeZone) - Math.floor(instant / 1000) * 1000;

/**
 * The first instant of the plain date `YYYY-MM-DD` in `timeZone`, the user's IANA zone (#54). Its midnight is tried
 * with the zone's offset a day before and a day after, so a DST change that day is handled, also one that skips
 * midnight (the day then starts at 01:00). Throws a RangeError for anything that is not a plain date.
 */
export function startOfDay(date: string, timeZone: string): Date {
  // The date's 00:00 on the wall clock, written as if it were UTC.
  const midnight = plainDate.test(date) ? Date.parse(`${date}T00:00:00Z`) : Number.NaN;
  if (Number.isNaN(midnight) || new Date(midnight).toISOString().slice(0, 10) !== date) {
    throw new RangeError(`Not a plain date: ${date}`);
  }
  const candidates = [offsetAt(midnight - DAY_MS, timeZone), offsetAt(midnight + DAY_MS, timeZone)]
    .map((offset) => midnight - offset)
    .toSorted((a, b) => a - b);
  // The earliest candidate whose wall-clock date is already that date.
  const start = candidates.find((candidate) => wallClock(candidate, timeZone) >= midnight) ?? candidates.at(-1)!;
  return new Date(start);
}
