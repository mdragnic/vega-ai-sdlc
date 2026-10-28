import { describe, expect, it } from 'vitest';

import { statisticsContract, weeklyComparisonDaySchema, weeklyComparisonResponseSchema } from '../src/index.js';

const usd = (cents: number) => ({ cents, currency: 'USD' });

/** One day of the response: this week's date, last week's amount and this week's (null after today). */
const day = (date: string, lastWeek: number, thisWeek: number | null) => ({
  date,
  lastWeek: usd(lastWeek),
  thisWeek: thisWeek === null ? null : usd(thisWeek),
});

/** A first login's answer on Thu 22 Oct 2026 (demo-data.md, "What a first login shows"; task 017 References). */
const firstLogin = {
  days: [
    day('2026-10-19', 5_880, 1_064),
    day('2026-10-20', 1_064, 2_464),
    day('2026-10-21', 2_016, 1_764),
    day('2026-10-22', 32_200, 26_600),
    day('2026-10-23', 1_478, null),
    day('2026-10-24', 18_816, null),
    day('2026-10-25', 14_784, null),
  ],
  ticks: [0, 10_000, 20_000, 30_000, 40_000].map(usd),
};

/** Every value of both weeks 0: the empty state, no axis (#55). */
const allZero = {
  days: firstLogin.days.map(({ date, thisWeek }) => day(date, 0, thisWeek === null ? null : 0)),
  ticks: null,
};

const withDays = (days: unknown[]) => ({ ...firstLogin, days });
const replaceDay = (index: number, value: unknown) =>
  withDays(firstLogin.days.map((d, i) => (i === index ? value : d)));

// T1, AC9: one day as the backend sends it: a plain date, integer cents 0 or more with USD, `thisWeek` null after
// today (#11, #55, #96).
describe('weeklyComparisonDaySchema', () => {
  it.each([
    ['a day with both values', day('2026-10-22', 32_200, 26_600)],
    ['a day after today', day('2026-10-23', 1_478, null)],
    ['a day with no expense in either week', day('2026-10-20', 0, 0)],
  ])('accepts %s', (_case, value) => {
    expect(weeklyComparisonDaySchema.parse(value)).toEqual(value);
  });

  it.each<[string, unknown]>([
    ['a timestamp as the date', { ...day('2026-10-22', 1, 1), date: '2026-10-22T00:00:00Z' }],
    ['a date that does not exist', { ...day('2026-10-22', 1, 1), date: '2026-02-30' }],
    ['a label as the date', { ...day('2026-10-22', 1, 1), date: '22 Thu' }],
    ['a float amount', { ...day('2026-10-22', 1, 1), lastWeek: usd(322.5) }],
    ['negative cents last week', day('2026-10-22', -1, 1)],
    ['negative cents this week', day('2026-10-22', 1, -1)],
    ['another currency', { ...day('2026-10-22', 1, 1), thisWeek: { cents: 1, currency: 'EUR' } }],
    ['last week null', { ...day('2026-10-22', 1, 1), lastWeek: null }],
    ['no thisWeek', { date: '2026-10-22', lastWeek: usd(1) }],
  ])('rejects %s', (_case, value) => {
    expect(weeklyComparisonDaySchema.safeParse(value).success).toBe(false);
  });
});

// T1, AC5, AC9: 7 days from Monday, the nulls only after today, the 5 ticks from $0 or null exactly when all is 0
// (#20, #55, #91).
describe('weeklyComparisonResponseSchema', () => {
  it.each([
    ['a first login on Thursday', firstLogin],
    ['every value 0, with no ticks', allZero],
    [
      'Monday the only day with a value',
      withDays(firstLogin.days.map((d, i) => (i === 0 ? d : { ...d, thisWeek: null }))),
    ],
    ['a whole week with values, on Sunday', withDays(firstLogin.days.map((d) => ({ ...d, thisWeek: usd(100) })))],
    [
      'a week across the end of a month and a year',
      withDays([
        day('2026-12-28', 1, 1),
        day('2026-12-29', 1, 1),
        day('2026-12-30', 1, 1),
        day('2026-12-31', 1, 1),
        day('2027-01-01', 1, 1),
        day('2027-01-02', 1, null),
        day('2027-01-03', 1, null),
      ]),
    ],
    [
      'this week all 0 with last week’s values',
      withDays(firstLogin.days.map((d) => ({ ...d, thisWeek: d.thisWeek && usd(0) }))),
    ],
    ['a top tick equal to the highest value', { ...firstLogin, ticks: [0, 8_050, 16_100, 24_150, 32_200].map(usd) }],
  ])('accepts %s', (_case, body) => {
    expect(weeklyComparisonResponseSchema.parse(body)).toEqual(body);
  });

  it.each<[string, unknown]>([
    ['6 days', withDays(firstLogin.days.slice(0, 6))],
    ['8 days', withDays([...firstLogin.days, day('2026-10-26', 0, null)])],
    ['a Tuesday first', withDays([...firstLogin.days.slice(1), day('2026-10-26', 0, null)])],
    ['a gap in the dates', replaceDay(4, day('2026-10-24', 1_478, null))],
    ['the dates out of order', withDays([firstLogin.days[1], firstLogin.days[0], ...firstLogin.days.slice(2)])],
    ['a null before a value', replaceDay(2, day('2026-10-21', 2_016, null))],
    ['Monday null', replaceDay(0, day('2026-10-19', 5_880, null))],
    ['a float amount', replaceDay(3, day('2026-10-22', 32_200.5, 26_600))],
    ['negative cents', replaceDay(3, day('2026-10-22', -32_200, 26_600))],
    ['EUR', replaceDay(3, { ...day('2026-10-22', 32_200, 26_600), lastWeek: { cents: 32_200, currency: 'EUR' } })],
    ['4 ticks', { ...firstLogin, ticks: [0, 10_000, 20_000, 40_000].map(usd) }],
    ['6 ticks', { ...firstLogin, ticks: [0, 10_000, 20_000, 30_000, 40_000, 50_000].map(usd) }],
    ['ticks not from $0', { ...firstLogin, ticks: [10_000, 20_000, 30_000, 40_000, 50_000].map(usd) }],
    ['ticks in unequal steps', { ...firstLogin, ticks: [0, 10_000, 20_000, 35_000, 40_000].map(usd) }],
    ['ticks all $0', { ...firstLogin, ticks: [0, 0, 0, 0, 0].map(usd) }],
    ['a top below a value', { ...firstLogin, ticks: [0, 8_000, 16_000, 24_000, 32_000].map(usd) }],
    ['a float tick', { ...firstLogin, ticks: [0, 10_000.5, 20_001, 30_001.5, 40_002].map(usd) }],
    [
      'ticks in EUR',
      { ...firstLogin, ticks: [0, 10_000, 20_000, 30_000, 40_000].map((cents) => ({ cents, currency: 'EUR' })) },
    ],
    ['null ticks with a value above 0', { ...firstLogin, ticks: null }],
    [
      'null ticks with only a value last week',
      { ...allZero, days: allZero.days.map((d, i) => (i === 6 ? day(d.date, 1, null) : d)) },
    ],
    ['ticks with every value 0', { ...allZero, ticks: firstLogin.ticks }],
    ['no ticks key', { days: firstLogin.days }],
    ['no days key', { ticks: firstLogin.ticks }],
  ])('rejects %s', (_case, body) => {
    expect(weeklyComparisonResponseSchema.safeParse(body).success).toBe(false);
  });

  it('drops keys outside the contract: no user, account or transaction ID', () => {
    const parsed = weeklyComparisonResponseSchema.parse({
      ...firstLogin,
      id: 7,
      userId: 7,
      days: firstLogin.days.map((d) => ({ ...d, id: 11, transactionIds: [1, 2] })),
    });

    expect(parsed).toEqual(firstLogin);
    expect(Object.keys(parsed).toSorted()).toEqual(['days', 'ticks']);
    for (const parsedDay of parsed.days) {
      expect(Object.keys(parsedDay).toSorted()).toEqual(['date', 'lastWeek', 'thisWeek']);
    }
  });
});

describe('statisticsContract', () => {
  it('reads the weekly comparison with GET /statistics/weekly-comparison and no body', () => {
    expect(statisticsContract.weeklyComparison).toMatchObject({
      method: 'GET',
      path: '/statistics/weekly-comparison',
      request: undefined,
    });
    expect(statisticsContract.weeklyComparison.response).toBe(weeklyComparisonResponseSchema);
  });
});
