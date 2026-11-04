import { ConflictException, type INestApplication } from '@nestjs/common';
import { formatCompactMoney, goalMessages, savingSummaryResponseSchema } from '@finebank/shared';
import { DataSource } from 'typeorm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { VisibleTransactions } from '../src/bank-data/visible-transactions.js';
import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { SavingSummaryService } from '../src/goals/saving-summary.service.js';
import { signUp } from './helpers/auth.js';
import { userIdOf } from './helpers/finance.js';
import { createTestApp } from './helpers/test-app.js';

const FIXED_NOW = '2026-10-22T10:00:00.000Z';
const BELGRADE = 'Europe/Belgrade';
const NEW_YORK = 'America/New_York';

const usd = (cents: number) => ({ cents, currency: 'USD' as const });

/** The demo dataset's daily savings, computed at detailing from `demo-dataset.json` (task 026 References). */
const october = [
  55_216, -2_800, 16_856, -28_336, -1_478, -1_764, -2_128, -2_464, -4_200, 7_280, -3_192, -5_880, -1_064, -2_016,
  -23_800, -1_478, -896, -14_784, -1_064, -2_464, -1_764, -26_600, -1_478, 15_792, -1_064, -2_800, 48_384, 2_016,
  -1_064, -1_764, -1_478,
];
const september = [
  52_640, -2_352, 16_800, -24_472, -1_277, -1_428, -2_240, -2_128, -3_528, 4_480, -4_032, -4_760, -1_120, -2_240,
  -18_648, -1_277, 2_688, -12_768, -1_120, -2_128, -1_428, -22_344, -1_277, 15_232, -1_120, -2_352, 48_160, 2_352,
  -1_120, -1_428,
];
const march2026 = [
  52_640, -2_016, 16_688, -27_048, -1_411, -1_680, -2_464, -2_352, -3_024, 7_280, -3_192, -5_600, -1_232, -2_240,
  -14_784, -1_411, 0, -14_112, -1_232, -2_352, -1_680, -19_152, -1_411, 15_792, -1_232, -2_016, 48_160, 2_128, -1_232,
  -1_680, -1_411,
];
const february2026 = [
  53_928, -1_904, 16_800, -24_472, -1_277, -1_512, -2_240, -2_128, -2_856, 6_160, -3_528, -5_040, -1_120, -2_128,
  -13_496, -1_277, 1_792, -12_768, -1_120, -2_128, -1_512, -18_088, -1_277, 15_568, -1_120, -1_904, 48_272, 2_352,
];

/** Each day's `[date, thisMonth, lastMonth]` in cents, null where the answer has none. */
const rows = (answer: {
  days: { date: string; thisMonth: { cents: number } | null; lastMonth: { cents: number } | null }[];
}) => answer.days.map(({ date, thisMonth, lastMonth }) => [date, thisMonth?.cents ?? null, lastMonth?.cents ?? null]);

/** The expected rows of `month`: this month's values up to `upTo` days, the month before's on its days. */
const expected = (month: string, length: number, thisMonth: number[], upTo: number, lastMonth: number[]) =>
  Array.from({ length }, (_, index) => [
    `${month}-${String(index + 1).padStart(2, '0')}`,
    index < upTo ? thisMonth[index]! : null,
    index < lastMonth.length ? lastMonth[index]! : null,
  ]);

// Task 026 T6 to T8: the service on the test database with seeded users (#11, #42, #53, #54, #55, #57, #59, #68, #72,
// #80, #123 b, #124). Another user signs up first, so IDs never equal positions.
describe('SavingSummaryService', () => {
  let app: INestApplication;
  let clock: FixedClock;
  let db: DataSource;
  let service: SavingSummaryService;
  let userId: number;

  beforeAll(async () => {
    app = await createTestApp({ config: { nodeEnv: 'test', testNow: FIXED_NOW } });
    clock = app.get(FixedClock);
    db = app.get(DataSource);
    service = app.get(SavingSummaryService);
    await signUp(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    clock.set(new Date(FIXED_NOW));
    userId = (await userIdOf(db, (await signUp(app)).user.email))!;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** A Complete row at an instant on the user's first account (or another user's), stored as the app stores it. */
  async function addTransaction(
    instant: string,
    direction: 'income' | 'expense',
    cents: number,
    owner = userId,
    status = 'complete',
  ) {
    const [account] = await db.query<{ id: number }[]>(
      'SELECT id FROM accounts WHERE user_id = ? ORDER BY id LIMIT 1',
      [owner],
    );
    await db.query(
      `INSERT INTO transactions (account_id, occurred_at, direction, status, category, item, shop_name, receipt, amount_cents)
       VALUES (?, ?, ?, ?, ?, 'Added row', 'Acme Ltd.', 'Ab3dE5gH9jK', ?)`,
      [
        account!.id,
        new Date(instant).toISOString().replace('T', ' ').replace('Z', ''),
        direction,
        status,
        direction === 'expense' ? 'others' : null,
        cents,
      ],
    );
  }

  // T6: AC1, AC2 and AC8, October at the fixed clock.
  describe('October at the fixed clock in Belgrade', () => {
    it('answers this month to the 22nd against September’s 30 days, the ticks -$300 to $600', async () => {
      const answer = await service.summary(userId, BELGRADE, '2026-10');

      expect(answer.month).toBe('2026-10');
      expect(rows(answer)).toEqual(expected('2026-10', 31, october, 22, september));
      expect(answer.ticks?.map(formatCompactMoney)).toEqual(['-$300', '-$150', '$0', '$150', '$300', '$450', '$600']);
      expect(savingSummaryResponseSchema.parse(answer)).toEqual(answer);
    });

    it('sends integer cents with USD, negative allowed (#11, #59, #96)', async () => {
      const answer = await service.summary(userId, BELGRADE, '2026-10');

      expect(answer.days[3]).toEqual({ date: '2026-10-04', thisMonth: usd(-28_336), lastMonth: usd(-24_472) });
      expect(answer.days[0]).toEqual({ date: '2026-10-01', thisMonth: usd(55_216), lastMonth: usd(52_640) });
    });

    it('never counts the Failed Pizza on the 16th: -$14.78, not -$39.42 (#57)', async () => {
      const answer = await service.summary(userId, BELGRADE, '2026-10');

      expect(answer.days[15]!.thisMonth).toEqual(usd(-1_478));
    });

    it('never counts a row dated after today, nor one Pending or Failed today (#53, #57)', async () => {
      await addTransaction('2026-10-23T12:00:00Z', 'income', 1_000_000);
      await addTransaction('2026-10-22T12:00:00Z', 'income', 1_000_000, userId, 'pending');
      await addTransaction('2026-10-22T13:00:00Z', 'expense', 1_000_000, userId, 'failed');

      const answer = await service.summary(userId, BELGRADE, '2026-10');

      expect(rows(answer)).toEqual(expected('2026-10', 31, october, 22, september));
    });
  });

  // T6: AC4 and AC5, past months.
  describe('past months', () => {
    it('answers March 2026’s 31 days against February’s 28, no gray value on the 29th to the 31st', async () => {
      const answer = await service.summary(userId, BELGRADE, '2026-03');

      expect(rows(answer)).toEqual(expected('2026-03', 31, march2026, 31, february2026));
      expect(answer.ticks?.map(formatCompactMoney)).toEqual(['-$300', '-$150', '$0', '$150', '$300', '$450', '$600']);
    });

    it.each([
      ['2025-12', ['-$375', '-$250', '-$125', '$0', '$125', '$250', '$375', '$500']],
      ['2022-06', ['-$625', '-$500', '-$375', '-$250', '-$125', '$0', '$125', '$250', '$375', '$500']],
    ])('gives %s its labels', async (month, labels) => {
      const answer = await service.summary(userId, BELGRADE, month);

      expect(answer.ticks?.map(formatCompactMoney)).toEqual(labels);
      expect(answer.days.every((each) => each.thisMonth !== null)).toBe(true);
    });

    it('gives June 2022’s 17th -$574.20, its lowest day', async () => {
      const answer = await service.summary(userId, BELGRADE, '2022-06');

      expect(answer.days[16]).toEqual({ date: '2022-06-17', thisMonth: usd(-57_420), lastMonth: usd(0) });
      expect(answer.days).toHaveLength(30);
    });

    it('answers January 2022 against December 2021, which has no rows: every gray value $0', async () => {
      const answer = await service.summary(userId, BELGRADE, '2022-01');

      expect(answer.days.map((each) => each.lastMonth)).toEqual(Array.from({ length: 31 }, () => usd(0)));
    });
  });

  // T6: AC9, every value $0 is the empty state.
  it('answers every value $0 and no ticks for December 2021 at 2021-12-31T10:00:00Z (#55, #124 e)', async () => {
    clock.set(new Date('2021-12-31T10:00:00Z'));

    const answer = await service.summary(userId, BELGRADE, '2021-12');

    expect(rows(answer)).toEqual(
      expected(
        '2021-12',
        31,
        Array.from({ length: 31 }, () => 0),
        31,
        Array.from({ length: 30 }, () => 0),
      ),
    );
    expect(answer.ticks).toBeNull();
  });

  // T7: AC6, the midnight in both zones.
  describe('at 2026-10-31T23:30:00Z', () => {
    beforeEach(() => {
      clock.set(new Date('2026-10-31T23:30:00Z'));
    });

    it('in Belgrade answers November with one value, 1 Nov $513.52, against October’s 1st to 30th', async () => {
      const answer = await service.summary(userId, BELGRADE, '2026-11');

      expect(rows(answer)).toEqual(expected('2026-11', 30, [51_352], 1, october.slice(0, 30)));
      expect(answer.ticks?.map(formatCompactMoney)).toEqual(['-$300', '-$150', '$0', '$150', '$300', '$450', '$600']);
    });

    it('in New York answers October’s 31 values, the 25th -$10.64 without the Pending Polo shirt', async () => {
      const answer = await service.summary(userId, NEW_YORK, '2026-10');

      expect(rows(answer)).toEqual(expected('2026-10', 31, october, 31, september));
      expect(answer.days[24]!.thisMonth).toEqual(usd(-1_064));
      expect(answer.days[30]!.thisMonth).toEqual(usd(-1_478));
    });
  });

  // T7: AC7, rows at the month and DST edges, DST-safe through `startOfDay` (#54, #80).
  describe('rows at the edges, the clock at 2026-10-31T12:00:00Z', () => {
    beforeEach(async () => {
      clock.set(new Date('2026-10-31T12:00:00Z'));
      await addTransaction('2026-09-30T22:30:00Z', 'income', 100_000);
      // Belgrade leaves summer time on 25 Oct: 22:30Z is 23:30 that day, 23:30Z is 00:30 on the 26th.
      await addTransaction('2026-10-25T22:30:00Z', 'expense', 1_000);
      await addTransaction('2026-10-25T23:30:00Z', 'expense', 2_000);
    });

    it('in Belgrade counts the first on 1 Oct and the others on the 25th and the 26th', async () => {
      const answer = await service.summary(userId, BELGRADE, '2026-10');

      expect(answer.days[0]!.thisMonth).toEqual(usd(55_216 + 100_000));
      expect(answer.days[29]!.lastMonth).toEqual(usd(-1_428));
      expect(answer.days[24]!.thisMonth).toEqual(usd(-1_064 - 1_000));
      expect(answer.days[25]!.thisMonth).toEqual(usd(-2_800 - 2_000));
    });

    it('in New York counts the first on 30 Sep (the gray line) and the others both on the 25th', async () => {
      const answer = await service.summary(userId, NEW_YORK, '2026-10');

      expect(answer.days[0]!.thisMonth).toEqual(usd(55_216));
      expect(answer.days[29]!.lastMonth).toEqual(usd(-1_428 + 100_000));
      expect(answer.days[24]!.thisMonth).toEqual(usd(-1_064 - 1_000 - 2_000));
      expect(answer.days[25]!.thisMonth).toEqual(usd(-2_800));
    });

    it('reads nothing before the month before: a row at 2026-08-31T22:30:00Z (1 Sep in Belgrade) counts there only', async () => {
      await addTransaction('2026-08-31T22:30:00Z', 'income', 7);

      expect((await service.summary(userId, BELGRADE, '2026-10')).days[0]!.lastMonth).toEqual(usd(52_640 + 7));
      expect((await service.summary(userId, NEW_YORK, '2026-10')).days[0]!.lastMonth).toEqual(usd(52_640));
    });
  });

  // T7: AC7, another user's rows never count (#39, #46).
  it('never counts another user’s row', async () => {
    const before = await service.summary(userId, BELGRADE, '2026-10');
    const other = (await userIdOf(db, (await signUp(app)).user.email))!;
    await addTransaction('2026-10-05T12:00:00Z', 'income', 1_000_000, other);

    expect(await service.summary(userId, BELGRADE, '2026-10')).toEqual(before);
    expect((await service.summary(other, BELGRADE, '2026-10')).days[4]!.thisMonth).toEqual(usd(-1_478 + 1_000_000));
  });

  // T8: AC11, the month check first (#123 b).
  describe('the month check', () => {
    it.each(['2026-11', '2021-12', '2027-05'])(
      'answers 409 monthUnavailable for %s and reads no transaction',
      async (month) => {
        const list = vi.spyOn(app.get(VisibleTransactions), 'list');

        const read = service.summary(userId, BELGRADE, month);

        await expect(read).rejects.toThrow(ConflictException);
        await expect(read).rejects.toThrow(goalMessages.monthUnavailable);
        expect(list).not.toHaveBeenCalled();
      },
    );

    it('reads the transactions once for a month in the list, from the month before’s first instant', async () => {
      const list = vi.spyOn(app.get(VisibleTransactions), 'list');

      await service.summary(userId, BELGRADE, '2026-10');

      expect(list).toHaveBeenCalledTimes(1);
      expect(list).toHaveBeenCalledWith(userId, BELGRADE, {
        occurredFrom: new Date('2026-08-31T22:00:00.000Z'),
        occurredBefore: new Date('2026-10-31T23:00:00.000Z'),
      });
    });
  });
});
