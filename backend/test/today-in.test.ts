import { describe, expect, it } from 'vitest';

import { todayIn } from '../src/common/time-zone/today-in.js';

// T1, AC5: the date of an instant in the user's zone (#54), the header date (#100).
describe('todayIn', () => {
  it.each([
    ['Europe/Belgrade', '2026-10-23'], // 00:30 on 23 Oct (CEST, UTC+2)
    ['America/New_York', '2026-10-22'], // 18:30 on 22 Oct (EDT, UTC-4)
    ['UTC', '2026-10-22'],
    ['Pacific/Kiritimati', '2026-10-23'], // 12:30 on 23 Oct (UTC+14)
  ])('at 2026-10-22T22:30:00Z in %s is %s', (timeZone, expected) => {
    expect(todayIn(new Date('2026-10-22T22:30:00Z'), timeZone)).toBe(expected);
  });

  it.each([
    // Belgrade's midnight between 22 and 23 Oct 2026 is 22:00 UTC.
    ['2026-10-22T21:59:59.999Z', '2026-10-22'],
    ['2026-10-22T22:00:00.000Z', '2026-10-23'],
  ])('changes exactly at local midnight: %s in Belgrade is %s', (now, expected) => {
    expect(todayIn(new Date(now), 'Europe/Belgrade')).toBe(expected);
  });

  it.each([
    // Belgrade moves to CEST at 02:00 on 29 Mar 2026: midnight is 23:00 UTC the day before, 01:00 to 03:00 local skips.
    ['2026-03-28T22:59:59.999Z', '2026-03-28'],
    ['2026-03-28T23:00:00.000Z', '2026-03-29'],
    ['2026-03-29T00:30:00.000Z', '2026-03-29'], // 01:30 CET, just before the jump
    ['2026-03-29T21:59:59.999Z', '2026-03-29'], // 23:59:59 CEST
    ['2026-03-29T22:00:00.000Z', '2026-03-30'],
    // Back to CET at 03:00 on 25 Oct 2026: 02:00 to 03:00 local repeats, midnight is 22:00 UTC the day before.
    ['2026-10-24T22:00:00.000Z', '2026-10-25'],
    ['2026-10-25T00:30:00.000Z', '2026-10-25'], // 02:30 CEST, the first pass
    ['2026-10-25T01:30:00.000Z', '2026-10-25'], // 02:30 CET, the second pass
    ['2026-10-25T22:59:59.999Z', '2026-10-25'], // 23:59:59 CET
    ['2026-10-25T23:00:00.000Z', '2026-10-26'],
  ])('is right on a DST change day: %s in Belgrade is %s', (now, expected) => {
    expect(todayIn(new Date(now), 'Europe/Belgrade')).toBe(expected);
  });

  it('pads the month and the day', () => {
    expect(todayIn(new Date('2026-01-05T12:00:00Z'), 'UTC')).toBe('2026-01-05');
  });
});
