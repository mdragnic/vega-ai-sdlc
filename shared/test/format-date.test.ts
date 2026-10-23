import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { formatDate, formatMonthLabel } from '../src/index.js';

// T7: dates show as `17 May, 2023` (#11), with no leading zero on the day (#84). A plain date has
// no zone; a UTC timestamp is read in the browser's zone (#54).
describe('formatDate', () => {
  it.each([undefined, 'UTC', 'Europe/Belgrade', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'])(
    'shows a plain date as the same day in zone %s',
    (timeZone) => {
      expect(formatDate('2023-05-17', timeZone)).toBe('17 May, 2023');
    },
  );

  // The frontend runs in the user's zone, so the process zone must not move a date either.
  describe.each(['Pacific/Pago_Pago', 'Pacific/Kiritimati'])('with the process in %s', (processZone) => {
    const originalZone = process.env.TZ;
    beforeAll(() => {
      process.env.TZ = processZone;
    });
    afterAll(() => {
      process.env.TZ = originalZone;
    });

    it('keeps a plain date', () => {
      expect(formatDate('2023-05-17')).toBe('17 May, 2023');
    });

    it('reads a timestamp in the zone it is given', () => {
      expect(formatDate('2026-10-21T22:30:00Z', 'UTC')).toBe('21 Oct, 2026');
    });

    it('keeps a month label', () => {
      expect(formatMonthLabel(2023, 5)).toBe('May, 2023');
    });
  });

  it('shows a day under 10 without a leading zero', () => {
    expect(formatDate('2026-05-01')).toBe('1 May, 2026');
  });

  it('shows a leap day', () => {
    expect(formatDate('2024-02-29')).toBe('29 Feb, 2024');
  });

  it.each([
    ['2026-10-21T22:30:00Z', 'Europe/Belgrade', '22 Oct, 2026'],
    ['2026-10-21T22:30:00Z', 'UTC', '21 Oct, 2026'],
    ['2026-10-21T22:30:00Z', 'Pacific/Kiritimati', '22 Oct, 2026'],
    ['2026-10-21T09:59:59Z', 'Pacific/Kiritimati', '21 Oct, 2026'],
    ['2026-10-21T10:00:00Z', 'Pacific/Kiritimati', '22 Oct, 2026'],
    ['2026-10-01T05:00:00.000Z', 'America/New_York', '1 Oct, 2026'],
    ['2026-10-01T03:59:59Z', 'America/New_York', '30 Sep, 2026'],
  ])('shows %s as its local date in %s', (value, timeZone, expected) => {
    expect(formatDate(value, timeZone)).toBe(expected);
  });

  it('rejects a timestamp without a time zone', () => {
    expect(() => formatDate('2026-10-21T22:30:00Z')).toThrow(RangeError);
  });

  it('rejects an unknown time zone', () => {
    expect(() => formatDate('2026-10-21T22:30:00Z', 'Mars/Olympus_Mons')).toThrow(RangeError);
  });

  it.each(['2023-02-30', '2023-13-01', '17 May 2023', '2026-10-21T22:30:00', '2026-10-21T22:30:00+02:00', ''])(
    'rejects %j, which is neither a plain date nor a UTC timestamp',
    (value) => {
      expect(() => formatDate(value, 'UTC')).toThrow(RangeError);
    },
  );
});

// T8: month labels show as `May, 2023` (#11). Months are numbered 1 to 12.
describe('formatMonthLabel', () => {
  it.each([
    [2023, 5, 'May, 2023'],
    [2026, 5, 'May, 2026'],
    [2026, 10, 'Oct, 2026'],
    [2022, 1, 'Jan, 2022'],
    [2025, 12, 'Dec, 2025'],
  ])('formats %i and month %i as %s', (year, month, expected) => {
    expect(formatMonthLabel(year, month)).toBe(expected);
  });

  it.each([
    [2023, 0],
    [2023, 13],
    [2023, 5.5],
    [2023.5, 5],
  ])('rejects year %s and month %s', (year, month) => {
    expect(() => formatMonthLabel(year, month)).toThrow(RangeError);
  });
});
