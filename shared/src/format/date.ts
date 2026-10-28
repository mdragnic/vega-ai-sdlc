import { tz } from '@date-fns/tz';
import { format, isValid, parseISO } from 'date-fns';
import { z } from 'zod';

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
 * The Statistics chart's x labels: the two-digit day and the 3-letter weekday, `19 Mon`, `01 Sun` (#84). Plain dates
 * only, like the days the backend sends; display only, no zone and no arithmetic.
 */
export function formatDayLabel(value: string): string {
  if (!plainDateSchema.safeParse(value).success) {
    throw new RangeError(`Not a plain date: ${value}`);
  }
  return format(parseISO(value), 'dd EEE');
}

/** Month labels: `May, 2023` (#11). `month` runs from 1 (January) to 12. */
export function formatMonthLabel(year: number, month: number): string {
  const firstDay = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
  if (!plainDateSchema.safeParse(firstDay).success) {
    throw new RangeError(`Not a year and month: ${year}, ${month}`);
  }
  return format(parseISO(firstDay), 'MMM, yyyy');
}
