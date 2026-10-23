import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { formatDateBox } from '../src/index.js';

// T2: the gray date box shows the month over the day: 3-letter month, two-digit day (#88).
describe('formatDateBox', () => {
  it.each([
    ['2023-05-15', 'May', '15'],
    ['2023-06-16', 'Jun', '16'],
    ['2023-09-05', 'Sep', '05'],
    ['2026-01-01', 'Jan', '01'],
    ['2024-02-29', 'Feb', '29'],
    ['2026-12-31', 'Dec', '31'],
  ])('shows %s as %s over %s', (date, month, day) => {
    expect(formatDateBox(date)).toEqual({ month, day });
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
      expect(formatDateBox('2023-09-05')).toEqual({ month: 'Sep', day: '05' });
    });
  });

  it.each(['2023-5-15', '2023-02-30', '2023-13-01', '2026-10-21T22:30:00Z', '15 May, 2023', ''])(
    'rejects %j, which is not a plain date',
    (value) => {
      expect(() => formatDateBox(value)).toThrow(RangeError);
    },
  );
});
