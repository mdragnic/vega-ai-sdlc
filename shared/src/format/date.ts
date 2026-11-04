import { tz } from '@date-fns/tz';
import { format, isValid, parseISO } from 'date-fns';
import { z } from 'zod';

import { goalMonthSchema } from '../contract/savings-goal.js';

/** The JSON date shapes (#74): plain dates `YYYY-MM-DD`, timestamps ISO in UTC. */
const plainDateSchema = z.iso.date();
const utcTimestampSchema = z.iso.datetime();

/**
 * Dates everywhere outside chart axes: `17 May, 2023`, `1 May, 2026` (#11, #84).
 * A plain date has no zone and shows as is. A UTC timestamp shows its date in `timeZone`,
 * the browser's IANA zone (#54).
 */
export function formatDate(value: string, timeZone?: string): string {
  if (plainDateSchema.safeParse(value).success) {
    return format(parseISO(value), 'd MMM, yyyy');
  }
  if (!utcTimestampSchema.safeParse(value).success) {
    throw new RangeError(`Not a plain date or a UTC timestamp: ${value}`);
  }
  if (timeZone === undefined) {
    throw new RangeError(`A timestamp needs the time zone it is read in: ${value}`);
  }
  const zoned = parseISO(value, { in: tz(timeZone) });
  if (!isValid(zoned)) {
    throw new RangeError(`Unknown time zone: ${timeZone}`);
  }
  return format(zoned, 'd MMM, yyyy');
}

/**
 * The gray date box (Upcoming Bill, Bills): the month over the day, `May` over `15`, `Sep` over `05`.
 * The month always has 3 letters and the day 2 digits (#88). Plain dates only, like due dates.
 */
export function formatDateBox(value: string): { month: string; day: string } {
  if (!plainDateSchema.safeParse(value).success) {
    throw new RangeError(`Not a plain date: ${value}`);
  }
  const date = parseISO(value);
  return { month: format(date, 'MMM'), day: format(date, 'dd') };
}

/**
 * The Statistics chart's x labels: the 3-letter weekday only, `Mon` to `Sun`, true of both bars, since the gray one is
 * last week's same weekday (#84, #122 a). Plain dates only, like the days the backend sends; display only, no zone and
 * no arithmetic.
 */
export function formatDayLabel(value: string): string {
  if (!plainDateSchema.safeParse(value).success) {
    throw new RangeError(`Not a plain date: ${value}`);
  }
  return format(parseISO(value), 'EEE');
}

/**
 * The Expenses chart's x labels: the 3-letter month of a `YYYY-MM` month, `Jan` to `Dec`, `Jul` never "July" (#55),
 * true of both bars, since the gray one is last year's same month. Display only, no zone and no arithmetic.
 */
export function formatMonthAxisLabel(month: string): string {
  // The `YYYY-MM` rule of a calendar month, written once (task 014's goal month, #74).
  if (!goalMonthSchema.safeParse(month).success) {
    throw new RangeError(`Not a YYYY-MM month: ${month}`);
  }
  return format(parseISO(`${month}-01`), 'MMM');
}

/**
 * Month labels: `May, 2023` (#11), of a `YYYY-MM` month checked with the one month rule, `goalMonthSchema`, so nothing
 * that shows a month splits it (task 025). Display only, no zone and no arithmetic.
 */
export function formatMonthLabel(month: string): string {
  if (!goalMonthSchema.safeParse(month).success) {
    throw new RangeError(`Not a YYYY-MM month: ${month}`);
  }
  return format(parseISO(`${month}-01`), 'MMM, yyyy');
}
