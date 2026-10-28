import { describe, expect, it } from 'vitest';

import { startOfDay } from '../src/common/time-zone/start-of-day.js';

// T3: the first instant of a plain date in the user's zone (#54), the edges of a week (#20), DST changes included.
describe('startOfDay', () => {
  it.each([
    // Belgrade leaves summer time on Sun 25 Oct 2026 at 01:00 UTC: Monday 26 Oct starts at 00:00 CET (UTC+1).
    ['2026-10-26', 'Europe/Belgrade', '2026-10-25T23:00:00.000Z'],
    // Monday 19 Oct starts at 00:00 CEST (UTC+2).
    ['2026-10-19', 'Europe/Belgrade', '2026-10-18T22:00:00.000Z'],
    // New York leaves summer time on 1 Nov: both Mondays at 00:00 EDT (UTC-4).
    ['2026-10-26', 'America/New_York', '2026-10-26T04:00:00.000Z'],
    ['2026-10-19', 'America/New_York', '2026-10-19T04:00:00.000Z'],
    ['2026-11-02', 'America/New_York', '2026-11-02T05:00:00.000Z'],
    ['2026-10-22', 'UTC', '2026-10-22T00:00:00.000Z'],
    ['2026-10-22', 'Asia/Kathmandu', '2026-10-21T18:15:00.000Z'],
    ['2026-10-22', 'Pacific/Kiritimati', '2026-10-21T10:00:00.000Z'],
    // The day clocks go back (25 Oct) and forward (29 Mar) in Belgrade both start at 00:00 before the change.
    ['2026-10-25', 'Europe/Belgrade', '2026-10-24T22:00:00.000Z'],
    ['2026-03-29', 'Europe/Belgrade', '2026-03-28T23:00:00.000Z'],
  ])('starts %s in %s at %s', (date, timeZone, expected) => {
    expect(startOfDay(date, timeZone).toISOString()).toBe(expected);
  });

  it.each([
    // Santiago skips from 23:59:59 on 5 Sep 2026 to 01:00 on 6 Sep: that day starts at 01:00 (UTC-3).
    ['a day without a midnight', '2026-09-06', 'America/Santiago', '2026-09-06T04:00:00.000Z'],
    // Santiago goes back an hour at midnight on 5 Apr 2026: 23:00 to 23:59 of 4 Apr repeats, 5 Apr starts after it.
    ['a day after clocks go back at midnight', '2026-04-05', 'America/Santiago', '2026-04-05T04:00:00.000Z'],
    ['a day after clocks go back at midnight', '2026-10-30', 'Africa/Cairo', '2026-10-29T22:00:00.000Z'],
  ])('starts %s at its first instant (%s, %s)', (_case, date, timeZone, expected) => {
    expect(startOfDay(date, timeZone).toISOString()).toBe(expected);
  });

  it.each(['2026-02-30', '2026-10-22T00:00:00Z', '22 Oct, 2026', ''])(
    'rejects %j, which is not a plain date',
    (date) => {
      expect(() => startOfDay(date, 'Europe/Belgrade')).toThrow(RangeError);
    },
  );
});
