import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { formatDayLabel } from '../src/index.js';

// T2, AC1, AC4: the Statistics x label: the two-digit day and the 3-letter en-US weekday (#84, Figma "17 Sun").
describe('formatDayLabel', () => {
  it.each([
    ['2026-10-19', '19 Mon'],
    ['2026-10-20', '20 Tue'],
    ['2026-10-21', '21 Wed'],
    ['2026-10-22', '22 Thu'],
    ['2026-10-23', '23 Fri'],
    ['2026-10-24', '24 Sat'],
    ['2026-10-25', '25 Sun'],
    ['2026-11-01', '01 Sun'],
    ['2026-10-05', '05 Mon'],
    ['2024-02-29', '29 Thu'],
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

    it('keeps the day and the weekday', () => {
      expect(formatDayLabel('2026-10-26')).toBe('26 Mon');
    });
  });

  it.each(['2026-02-30', '19 Oct', '2026-10-19T00:00:00Z', '2026-10-9', '19 Mon', ''])(
    'rejects %j, which is not a plain date',
    (value) => {
      expect(() => formatDayLabel(value)).toThrow(RangeError);
    },
  );
});
