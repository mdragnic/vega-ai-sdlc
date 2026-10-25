import { describe, expect, it } from 'vitest';

import { startOfNextDay } from '../src/common/time-zone/start-of-next-day.js';

// T19: the first instant of tomorrow in the user's zone (#54), DST changes included.
describe('startOfNextDay', () => {
  it.each([
    ['UTC', '2026-10-22T10:00:00Z', '2026-10-23T00:00:00.000Z'],
    ['Europe/Belgrade', '2026-10-22T10:00:00Z', '2026-10-22T22:00:00.000Z'], // CEST, UTC+2
    ['America/New_York', '2026-10-22T10:00:00Z', '2026-10-23T04:00:00.000Z'], // EDT, UTC-4
    ['Asia/Kathmandu', '2026-10-22T10:00:00Z', '2026-10-22T18:15:00.000Z'], // UTC+5:45
    ['Etc/GMT+12', '2026-10-22T10:00:00Z', '2026-10-22T12:00:00.000Z'], // UTC-12, still 21 Oct there
    ['Pacific/Kiritimati', '2026-10-22T10:00:00Z', '2026-10-23T10:00:00.000Z'], // UTC+14, already 23 Oct there
    // Just after midnight in Belgrade, still the evening before in New York.
    ['Europe/Belgrade', '2026-10-22T22:15:00Z', '2026-10-23T22:00:00.000Z'],
    ['America/New_York', '2026-10-22T22:15:00Z', '2026-10-23T04:00:00.000Z'],
    // The last instant of a day still belongs to it.
    ['Europe/Belgrade', '2026-10-22T21:59:59.999Z', '2026-10-22T22:00:00.000Z'],
    ['Europe/Belgrade', '2026-10-22T22:00:00.000Z', '2026-10-23T22:00:00.000Z'],
  ])('in %s at %s is %s', (timeZone, now, expected) => {
    expect(startOfNextDay(new Date(now), timeZone).toISOString()).toBe(expected);
  });

  it.each([
    // Belgrade moves to CEST at 02:00 on 29 Mar 2026 and back to CET at 03:00 on 25 Oct 2026.
    ['the day clocks go forward', 'Europe/Belgrade', '2026-03-28T12:00:00Z', '2026-03-28T23:00:00.000Z'],
    ['the day after clocks go forward', 'Europe/Belgrade', '2026-03-29T12:00:00Z', '2026-03-29T22:00:00.000Z'],
    ['the day clocks go back', 'Europe/Belgrade', '2026-10-24T12:00:00Z', '2026-10-24T22:00:00.000Z'],
    ['the day after clocks go back', 'Europe/Belgrade', '2026-10-25T12:00:00Z', '2026-10-25T23:00:00.000Z'],
    // Santiago skips from 23:59:59 on 5 Sep 2026 to 01:00 on 6 Sep: that day starts at 01:00 (UTC-3).
    ['a day without a midnight', 'America/Santiago', '2026-09-05T15:00:00Z', '2026-09-06T04:00:00.000Z'],
    ['the day after one without a midnight', 'America/Santiago', '2026-09-06T15:00:00Z', '2026-09-07T03:00:00.000Z'],
    // Santiago and Cairo go back an hour at midnight: 23:00 to 23:59 repeats, the next day starts after it.
    ['a day after clocks go back at midnight', 'America/Santiago', '2026-04-04T15:00:00Z', '2026-04-05T04:00:00.000Z'],
    ['a day after clocks go back at midnight', 'Africa/Cairo', '2026-10-29T10:00:00Z', '2026-10-29T22:00:00.000Z'],
  ])('starts %s at its first instant (%s, %s)', (_case, timeZone, now, expected) => {
    expect(startOfNextDay(new Date(now), timeZone).toISOString()).toBe(expected);
  });
});
