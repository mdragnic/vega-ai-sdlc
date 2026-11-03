import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { formatMonthAxisLabel } from '../src/index.js';

// T3, AC3: the Expenses chart's x label, the 3-letter en-US month of a `YYYY-MM` month, the same for both bars
// (#55: `Jul`, never 109's "July").
describe('formatMonthAxisLabel', () => {
  it.each([
    ['2026-01', 'Jan'],
    ['2026-02', 'Feb'],
    ['2026-03', 'Mar'],
    ['2026-04', 'Apr'],
    ['2026-05', 'May'],
    ['2026-06', 'Jun'],
    ['2026-07', 'Jul'],
    ['2026-08', 'Aug'],
    ['2026-09', 'Sep'],
    ['2026-10', 'Oct'],
    ['2026-11', 'Nov'],
    ['2026-12', 'Dec'],
    ['2027-01', 'Jan'],
  ])('shows %s as %s', (month, label) => {
    expect(formatMonthAxisLabel(month)).toBe(label);
  });

  // A month has no zone, so the process zone never moves it to another month.
  describe.each(['Pacific/Pago_Pago', 'Pacific/Kiritimati'])('with the process in %s', (processZone) => {
    const originalZone = process.env.TZ;
    beforeAll(() => {
      process.env.TZ = processZone;
    });
    afterAll(() => {
      process.env.TZ = originalZone;
    });

    it('keeps the month', () => {
      expect(formatMonthAxisLabel('2026-12')).toBe('Dec');
      expect(formatMonthAxisLabel('2026-01')).toBe('Jan');
    });
  });

  it.each(['2026-13', '2026-00', '2026-1', '2026-07-01', 'July', 'Jul', '26-07', '2026/07', ' 2026-07', ''])(
    'rejects %j, which is not a YYYY-MM month',
    (value) => {
      expect(() => formatMonthAxisLabel(value)).toThrow(RangeError);
    },
  );
});
