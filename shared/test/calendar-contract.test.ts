import { describe, expect, it } from 'vitest';

import { calendarContract, todayResponseSchema } from '../src/index.js';

// T2, AC22: today in the user's zone is a plain date `YYYY-MM-DD` (#54, #74).
describe('todayResponseSchema', () => {
  it.each(['2026-10-23', '2028-02-29'])('accepts %j', (today) => {
    expect(todayResponseSchema.parse({ today })).toEqual({ today });
  });

  it.each([
    ['a timestamp', '2026-10-23T00:00:00Z'],
    ['the display format', '23 Oct, 2026'],
    ['a day that does not exist', '2026-02-30'],
    ['a month that does not exist', '2026-13-01'],
    ['no leading zeros', '2026-1-5'],
    ['empty', ''],
    ['a number', 20261023],
  ])('rejects %s', (_case, today) => {
    expect(todayResponseSchema.safeParse({ today }).success).toBe(false);
  });

  it('rejects a response without today', () => {
    expect(todayResponseSchema.safeParse({}).success).toBe(false);
  });
});

describe('calendarContract', () => {
  it('reads today with GET /calendar/today and no body', () => {
    expect(calendarContract.today).toMatchObject({ method: 'GET', path: '/calendar/today', request: undefined });
    expect(calendarContract.today.response).toBe(todayResponseSchema);
  });
});
