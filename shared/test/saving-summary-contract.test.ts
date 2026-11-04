import { describe, expect, it } from 'vitest';

import {
  goalMonthSchema,
  savingsGoalMonthQuerySchema,
  savingSummaryContract,
  savingSummaryDaySchema,
  savingSummaryResponseSchema,
} from '../src/index.js';

const usd = (cents: number) => ({ cents, currency: 'USD' });

/** One day as the backend sends it: the date, this month's saving (null after today), the month before's (or null). */
const day = (date: string, thisMonth: number | null, lastMonth: number | null) => ({
  date,
  thisMonth: thisMonth === null ? null : usd(thisMonth),
  lastMonth: lastMonth === null ? null : usd(lastMonth),
});

/**
 * October 2026 at the fixed clock (Thu 22 Oct, Belgrade), from the demo dataset (task 026 References): this month to
 * the 22nd, September's 30 days, the ticks -$300 to $600.
 */
const octoberValues: [number | null, number | null][] = [
  [55_216, 52_640],
  [-2_800, -2_352],
  [16_856, 16_800],
  [-28_336, -24_472],
  [-1_478, -1_277],
  [-1_764, -1_428],
  [-2_128, -2_240],
  [-2_464, -2_128],
  [-4_200, -3_528],
  [7_280, 4_480],
  [-3_192, -4_032],
  [-5_880, -4_760],
  [-1_064, -1_120],
  [-2_016, -2_240],
  [-23_800, -18_648],
  [-1_478, -1_277],
  [-896, 2_688],
  [-14_784, -12_768],
  [-1_064, -1_120],
  [-2_464, -2_128],
  [-1_764, -1_428],
  [-26_600, -22_344],
  [null, -1_277],
  [null, 15_232],
  [null, -1_120],
  [null, -2_352],
  [null, 48_160],
  [null, 2_352],
  [null, -1_120],
  [null, -1_428],
  [null, null],
];
const dd = (index: number) => String(index + 1).padStart(2, '0');
const october = {
  month: '2026-10',
  days: octoberValues.map(([thisMonth, lastMonth], index) => day(`2026-10-${dd(index)}`, thisMonth, lastMonth)),
  ticks: [-30_000, -15_000, 0, 15_000, 30_000, 45_000, 60_000].map(usd),
};

/** A month of `length` days, every value as given, with the month before's days up to `previousLength`. */
const monthOf = (
  month: string,
  length: number,
  previousLength: number,
  value: (index: number) => [number | null, number],
  ticks: number[] | null,
) => ({
  month,
  days: Array.from({ length }, (_, index) => {
    const [thisMonth, lastMonth] = value(index);
    return day(`${month}-${dd(index)}`, thisMonth, index < previousLength ? lastMonth : null);
  }),
  ticks: ticks && ticks.map(usd),
});

/** Every value 0: the empty state, no ticks (#55, #124 e). */
const allZero = monthOf('2021-12', 31, 30, (index) => [index < 30 ? 0 : null, 0], null);

const withDays = (days: unknown[]) => ({ ...october, days });
const replaceDay = (index: number, value: unknown) => withDays(october.days.map((d, i) => (i === index ? value : d)));
const withTicks = (ticks: number[] | null) => ({ ...october, ticks: ticks && ticks.map(usd) });

/** The issue messages of a failed parse. */
function issues(value: unknown) {
  const result = savingSummaryResponseSchema.safeParse(value);
  expect(result.success).toBe(false);
  return result.error!.issues.map((issue) => issue.message);
}

// Task 026 T2, AC1 and AC11: one day, a plain date and the two savings in integer cents with USD, negative allowed
// (#11, #59, #96).
describe('savingSummaryDaySchema', () => {
  it.each([
    ['a day with both values', day('2026-10-04', -28_336, -24_472)],
    ['a day after today', day('2026-10-23', null, -1_277)],
    ['a day the month before lacks', day('2026-10-31', null, null)],
    ['a day of $0', day('2026-03-17', 0, 1_792)],
  ])('accepts %s', (_case, value) => {
    expect(savingSummaryDaySchema.parse(value)).toEqual(value);
  });

  it('drops unknown keys', () => {
    expect(savingSummaryDaySchema.parse({ ...day('2026-10-01', 1, 2), userId: 7 })).toEqual(day('2026-10-01', 1, 2));
  });

  it.each<[string, unknown]>([
    ['a timestamp as the date', { ...day('2026-10-01', 1, 1), date: '2026-10-01T00:00:00Z' }],
    ['a date that does not exist', { ...day('2026-10-01', 1, 1), date: '2026-02-30' }],
    ['a label as the date', { ...day('2026-10-01', 1, 1), date: '01 Oct' }],
    ['a float amount', { ...day('2026-10-01', 1, 1), thisMonth: usd(1.5) }],
    ['another currency', { ...day('2026-10-01', 1, 1), lastMonth: { cents: 1, currency: 'EUR' } }],
    ['no thisMonth', { date: '2026-10-01', lastMonth: usd(1) }],
    ['no lastMonth', { date: '2026-10-01', thisMonth: usd(1) }],
  ])('rejects %s', (_case, value) => {
    expect(savingSummaryDaySchema.safeParse(value).success).toBe(false);
  });
});

// Task 026 T2, AC1, AC10 and AC11: the month's days from the 1st, the nulls where #55 and #124 a put them, the ticks by
// the Saving Summary's rule (#68, #72, #124 d).
describe('savingSummaryResponseSchema', () => {
  it.each([
    ['October at the fixed clock', october],
    ['every value 0, with no ticks', allZero],
    [
      'March against February: no gray value on the 29th to the 31st',
      monthOf('2026-03', 31, 28, () => [100, -100], [-10_000, 0, 10_000, 20_000, 30_000, 40_000]),
    ],
    ['February 2024 (29 days) against January', monthOf('2024-02', 29, 31, () => [100, 100], [0, 25, 50, 75, 100])],
    [
      'February 2026 (28 days), the 1st the only day so far',
      monthOf('2026-02', 28, 31, (index) => [index === 0 ? 51_352 : null, 0], [0, 15_000, 30_000, 45_000, 60_000]),
    ],
    ['January against December of the year before', monthOf('2026-01', 31, 31, () => [-1, 0], [-4, -3, -2, -1, 0])],
    [
      'no day above $0: $0 the top and 4 steps down (#72)',
      monthOf('2026-10', 31, 30, () => [-28_336, -1], [-40_000, -30_000, -20_000, -10_000, 0]),
    ],
    [
      '10 ticks, the cap (#124 d2)',
      monthOf(
        '2022-06',
        30,
        31,
        (index) => [index === 16 ? -57_420 : 44_650, 0],
        [-62_500, -50_000, -37_500, -25_000, -12_500, 0, 12_500, 25_000, 37_500, 50_000],
      ),
    ],
  ])('accepts %s', (_case, value) => {
    expect(savingSummaryResponseSchema.parse(value)).toEqual(value);
  });

  it('drops unknown keys', () => {
    expect(savingSummaryResponseSchema.parse({ ...october, userId: 7 })).toEqual(october);
  });

  const order = 'The days of the month in order from the 1st';
  const lastMonthRule = 'A value exactly on the days the month before has';
  const steps = 'Ticks run in equal steps through $0, ascending';
  const below = 'Below $0, the first tick at or below the lowest value and no further';
  it.each<[string, unknown, string]>([
    ['a month that is not YYYY-MM', { ...october, month: '2026-1' }, 'Enter a valid month'],
    ['days not from the 1st', withDays(october.days.slice(1)), order],
    ['a day missing', withDays(october.days.filter((_, index) => index !== 10)), order],
    ['a day short', withDays(october.days.slice(0, 30)), 'Every day of the month'],
    ['32 days', withDays([...october.days, day('2026-10-31', null, null)]), '31'],
    ['a day of another month', replaceDay(4, day('2026-11-05', -1_478, -1_277)), order],
    ['the days out of order', withDays([october.days[1], october.days[0], ...october.days.slice(2)]), order],
    ['thisMonth null on the 1st', replaceDay(0, day('2026-10-01', null, 52_640)), 'The 1st has a value'],
    ['thisMonth null in the middle', replaceDay(9, day('2026-10-10', null, 4_480)), 'No value after a day to come'],
    ['lastMonth null on a day the month before has', replaceDay(29, day('2026-10-30', null, null)), lastMonthRule],
    ['lastMonth set on a day the month before lacks', replaceDay(30, day('2026-10-31', null, 0)), lastMonthRule],
    ['ticks null with a value', withTicks(null), 'A value other than $0 needs an axis'],
    [
      '11 ticks',
      withTicks([-150_000, -135_000, -120_000, -105_000, -90_000, -75_000, -60_000, -45_000, -30_000, -15_000, 0]),
      '10',
    ],
    ['ticks without $0', withTicks([-29_000, -14_000, 1_000, 16_000, 31_000, 46_000, 61_000]), steps],
    ['unequal steps', withTicks([-30_000, -15_000, 0, 15_000, 30_000, 45_000, 70_000]), steps],
    ['ticks descending', withTicks([60_000, 45_000, 30_000, 15_000, 0, -15_000, -30_000]), steps],
    ['3 steps above $0', withTicks([-30_000, -15_000, 0, 15_000, 30_000, 45_000]), '$0 and 4 equal steps up'],
    [
      '5 steps above $0',
      withTicks([-30_000, -15_000, 0, 15_000, 30_000, 45_000, 60_000, 75_000]),
      '$0 and 4 equal steps up',
    ],
    [
      'the top below the highest',
      withTicks([-37_500, -25_000, -12_500, 0, 12_500, 25_000, 37_500, 50_000]),
      'The top tick is at or above every value',
    ],
    [
      'an extra step below the lowest',
      withTicks([-45_000, -30_000, -15_000, 0, 15_000, 30_000, 45_000, 60_000]),
      below,
    ],
    ['the lowest tick above the lowest', withTicks([-15_000, 0, 15_000, 30_000, 45_000, 60_000]), below],
    ['ticks with every value 0', { ...allZero, ticks: [0, 1, 2, 3, 4].map(usd) }, 'Every value $0 is the empty state'],
    [
      'no day above $0 with 4 steps up',
      monthOf('2026-10', 31, 30, () => [-28_336, -1], [-30_000, -20_000, -10_000, 0, 10_000, 20_000, 30_000, 40_000]),
      '$0 the top and 4 equal steps down',
    ],
    [
      'no day above $0 with 3 steps down',
      monthOf('2026-10', 31, 30, () => [-28_336, -1], [-30_000, -20_000, -10_000, 0, 10_000]),
      '$0 the top and 4 equal steps down',
    ],
    [
      'no day above $0 with the lowest below the ticks',
      monthOf('2026-10', 31, 30, () => [-28_336, -1], [-20_000, -15_000, -10_000, -5_000, 0]),
      'The lowest tick is at or below every value',
    ],
    [
      'no day below $0 with a tick below $0',
      monthOf('2026-10', 31, 30, () => [100, 100], [-25, 0, 25, 50, 75, 100]),
      below,
    ],
  ])('rejects %s', (_case, value, message) => {
    expect(issues(value)).toContainEqual(expect.stringContaining(message));
  });
});

// Task 026 T2, AC11: the endpoint as the backend and the frontend read it (#74).
describe('savingSummaryContract', () => {
  it('declares GET /saving-summary with the goal month query and the response schema', () => {
    expect(savingSummaryContract.summary).toEqual({
      method: 'GET',
      path: '/saving-summary',
      request: undefined,
      query: savingsGoalMonthQuerySchema,
      response: savingSummaryResponseSchema,
    });
  });

  it('takes the month by the one month rule', () => {
    expect(savingSummaryContract.summary.query.parse({ month: '2026-10', userId: '7' })).toEqual({ month: '2026-10' });
    expect(savingSummaryContract.summary.query.safeParse({ month: '2026-1' }).success).toBe(false);
    expect(goalMonthSchema.safeParse('2026-10').success).toBe(true);
  });
});
