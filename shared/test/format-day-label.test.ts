import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { formatDayLabel } from '../src/index.js';

// T2, AC1, AC4 of task 017, as #122 a amends them (task 024 T3, AC25): the Statistics x label is the 3-letter en-US
// weekday only, the same for both bars, since the gray bar is last week's same weekday (#84, #122 a).
describe('formatDayLabel', () => {
  it.each([
    ['2026-10-19', 'Mon'],
    ['2026-10-20', 'Tue'],
    ['2026-10-21', 'Wed'],
    ['2026-10-22', 'Thu'],
    ['2026-10-23', 'Fri'],
    ['2026-10-24', 'Sat'],
    ['2026-10-25', 'Sun'],
    ['2026-11-01', 'Sun'],
    ['2026-10-05', 'Mon'],
    ['2024-02-29', 'Thu'],
  ])('shows %s as %s', (date, label) => {
    expect(formatDayLabel(date)).toBe(label);
  });

  // A plain date has no zone, so the process zone never moves it to another day.
  describe.each(['Pacific/Pago_Pago', 'Pacific/Kiritimati'])('with the process in %s', (processZone) => {
    const originalZone = process.env.TZ;
    beforeAll(() => {
      process.env.TZ = processZone;
    });
    afterAll(() => {
      process.env.TZ = originalZone;
    });

    it('keeps the weekday', () => {
      expect(formatDayLabel('2026-10-26')).toBe('Mon');
    });
  });

  it.each(['2026-02-30', '19 Oct', '2026-10-19T00:00:00Z', '2026-10-9', '19 Mon', 'Mon', ''])(
    'rejects %j, which is not a plain date',
    (value) => {
      expect(() => formatDayLabel(value)).toThrow(RangeError);
    },
  );
});
