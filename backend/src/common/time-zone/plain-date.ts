import { startOfDay } from './start-of-day.js';
import { todayIn } from './today-in.js';

const DAY_MS = 86_400_000;
const DAYS_PER_WEEK = 7;
const MONTHS_PER_YEAR = 12;

/** A plain date `days` days after `date` (before, when negative). Plain dates have no zone, so this is exact. */
export const addDays = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** The Monday on or before a plain date (#20: weeks run Monday to Sunday). */
export const mondayOf = (date: string): string =>
  addDays(date, -((new Date(Date.parse(`${date}T00:00:00Z`)).getUTCDay() + 6) % DAYS_PER_WEEK));

/** The `YYYY-MM` month `months` months after `month` (before, when negative): January's previous is December. */
export const addMonths = (month: string, months: number): string => {
  const index = Number(month.slice(0, 4)) * MONTHS_PER_YEAR + Number(month.slice(5, 7)) - 1 + months;
  return `${String(Math.floor(index / MONTHS_PER_YEAR)).padStart(4, '0')}-${String((index % MONTHS_PER_YEAR) + 1).padStart(2, '0')}`;
};

/**
 * The month `YYYY-MM` of an instant in `timeZone`, the user's IANA zone (#54, #80): the month of its date there. The
 * one way the backend reads the month of an instant: the current month (the Clock's now), a transaction's month.
 */
export const monthIn = (instant: Date, timeZone: string): string => todayIn(instant, timeZone).slice(0, 7);

/** The first instant of a month's first day in the zone (#54): a month with a DST change has 743 or 745 hours. */
export const startOfMonth = (month: string, timeZone: string): Date => startOfDay(`${month}-01`, timeZone);
