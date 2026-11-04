import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { formatChartDayLabel } from '../src/index.js';

// Task 026 T3, AC12: the Saving Summary's x labels, a two-digit day and the 3-letter month, `01 Oct` (#42, #84).
describe('formatChartDayLabel', () => {
  it.each([
    ['2026-10-01', '01 Oct'],
    ['2026-10-05', '05 Oct'],
    ['2026-10-30', '30 Oct'],
    ['2026-02-28', '28 Feb'],
    ['2024-02-29', '29 Feb'],
    ['2022-06-17', '17 Jun'],
  ])('shows %s as %s', (date, label) => {
    expect(formatChartDayLabel(date)).toBe(label);
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

    it('keeps the day', () => {
      expect(formatChartDayLabel('2026-11-01')).toBe('01 Nov');
    });
  });

  it.each(['2026-10', '2026-13-01', '2026-02-30', '', '2026-10-01T00:00:00Z', '01 Oct', '2026-10-1'])(
    'rejects %j, which is not a plain date',
    (value) => {
      expect(() => formatChartDayLabel(value)).toThrow(RangeError);
    },
  );
});
