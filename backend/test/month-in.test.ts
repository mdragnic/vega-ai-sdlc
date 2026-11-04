import { describe, expect, it } from 'vitest';

import { monthIn } from '../src/common/time-zone/plain-date.js';

// Task 014 T4, AC3; task 025 T3, AC5, AC6 and AC18: the month of an instant in the user's zone, from today there (#54,
// #80). Task 014's `currentMonthIn`, moved to the plain-date module as `monthIn`, its cases kept.
describe('monthIn', () => {
  it.each([
    // 00:30 on 1 Nov in Belgrade (CET, UTC+1), 19:30 on 31 Oct in New York (EDT, UTC-4).
    ['2026-10-31T23:30:00Z', 'Europe/Belgrade', '2026-11'],
    ['2026-10-31T23:30:00Z', 'America/New_York', '2026-10'],
    // 00:30 on 1 Jan 2027 in Belgrade: a new year too.
    ['2026-12-31T23:30:00Z', 'Europe/Belgrade', '2027-01'],
    ['2026-10-22T10:00:00Z', 'Europe/Belgrade', '2026-10'],
    // Task 025: the row added before the demo data, 00:30 on 1 Jan 2022 in Belgrade, 18:30 on 31 Dec 2021 in New York.
    ['2021-12-31T23:30:00Z', 'Europe/Belgrade', '2022-01'],
    ['2021-12-31T23:30:00Z', 'America/New_York', '2021-12'],
  ])('at %s in %s is %s', (now, timeZone, month) => {
    expect(monthIn(new Date(now), timeZone)).toBe(month);
  });

  it.each([
    // Belgrade's midnight between 31 Oct and 1 Nov 2026 is 23:00 UTC.
    ['2026-10-31T22:59:59.999Z', '2026-10'],
    ['2026-10-31T23:00:00.000Z', '2026-11'],
  ])('changes exactly at local midnight: %s in Belgrade is %s', (now, month) => {
    expect(monthIn(new Date(now), 'Europe/Belgrade')).toBe(month);
  });
});
