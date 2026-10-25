import { beforeAll, describe, expect, it } from 'vitest';

import { type DemoDataset, loadDemoDataset } from '../src/demo/demo-dataset.js';

type DemoTransaction = DemoDataset['transactions'][number];

const CREDIT_CARD = 0;
const CHECKING = 1;
const LOAN = 4;

const dateOf = (transaction: DemoTransaction): string => transaction.occurredAt.toISOString().slice(0, 10);
const isCharge = (transaction: DemoTransaction): boolean => transaction.item.endsWith(' - Yearly Plan');
const perMonth = (dataset: DemoDataset, month: string): number =>
  dataset.transactions.filter((t) => dateOf(t).startsWith(month)).length;

/** Every calendar date from 2022-01-01 to 2028-12-31, built without the generator's code. */
function everyDate(): string[] {
  const dates: string[] = [];
  for (let day = Date.UTC(2022, 0, 1); day <= Date.UTC(2028, 11, 31); day += 86_400_000) {
    dates.push(new Date(day).toISOString().slice(0, 10));
  }
  return dates;
}

// T5: the committed dataset holds what docs/spec/demo-data.md says (#53, #56, #78, AC3).
describe('the committed demo dataset', () => {
  let dataset: DemoDataset;
  let byDate: Map<string, DemoTransaction[]>;

  beforeAll(() => {
    dataset = loadDemoDataset();
    byDate = Map.groupBy(dataset.transactions, dateOf);
  });

  it('has 5 accounts, 3,411 transactions, 14 bills, 84 savings goals and 6 limits', () => {
    expect(
      [dataset.accounts, dataset.transactions, dataset.bills, dataset.savingsGoals, dataset.categoryLimits].map(
        (records) => records.length,
      ),
    ).toEqual([5, 3411, 14, 84, 6]);
  });

  it('has the 5 accounts of the Accounts table in order, numbers without spaces', () => {
    expect(dataset.accounts).toEqual([
      {
        accountType: 'credit-card',
        bankName: 'Master Card',
        branchName: 'Main Branch',
        cardNetwork: 'mastercard',
        accountNumber: '3388455688602598',
        openingBalanceCents: 2_500_000,
      },
      {
        accountType: 'checking',
        bankName: 'AB Bank Ltd',
        branchName: 'Park Street Branch',
        cardNetwork: 'visa',
        accountNumber: '6934566990127310',
        openingBalanceCents: 2_500_000,
      },
      {
        accountType: 'savings',
        bankName: 'Brac Bank Ltd.',
        branchName: 'Gulshan Branch',
        cardNetwork: null,
        accountNumber: '1334568868014421',
        openingBalanceCents: 2_500_000,
      },
      {
        accountType: 'investment',
        bankName: 'AB Bank Ltd',
        branchName: 'Park Street Branch',
        cardNetwork: null,
        accountNumber: '6984568662016652',
        openingBalanceCents: 2_500_000,
      },
      {
        accountType: 'loan',
        bankName: 'City Bank Ltd.',
        branchName: 'Motijheel Branch',
        cardNetwork: null,
        accountNumber: '3634568966019083',
        openingBalanceCents: 2_500_000,
      },
    ]);
  });

  describe('transactions', () => {
    it('run from 1 Jan 2022 to 31 Dec 2028, each at 12:00 UTC, in date order', () => {
      const instants = dataset.transactions.map((transaction) => transaction.occurredAt.toISOString());

      expect(instants[0]).toBe('2022-01-01T12:00:00.000Z');
      expect(instants.at(-1)).toBe('2028-12-31T12:00:00.000Z');
      expect(instants.filter((instant) => !instant.endsWith('T12:00:00.000Z'))).toEqual([]);
      expect(instants.every((instant, i) => i === 0 || instants[i - 1]! <= instant)).toBe(true);
    });

    it('list income first, then expenses, then bill charges within a day, in template order', () => {
      expect(byDate.get('2026-10-03')!.map(({ item, direction }) => `${direction} ${item}`)).toEqual([
        'income Freelance payment',
        'expense Taxi fare',
      ]);
      expect(byDate.get('2026-10-01')!.map(({ item }) => item)).toEqual(['Design project', 'House Rent']);
      expect(byDate.get('2026-10-16')!.map(({ item, status }) => `${item} ${status}`)).toEqual([
        'Biriyani complete',
        'Pizza failed',
      ]);
      expect(byDate.get('2026-06-17')!.map(({ item }) => item)).toEqual([
        'Freelance payment',
        'GTR 5',
        'Adobe Inc - Yearly Plan',
      ]);
      expect(byDate.get('2024-05-14')!.map(({ item }) => item)).toEqual(['Parking', 'Figma - Yearly Plan']);
      for (const rows of byDate.values()) {
        const rank = rows.map((row) => (row.direction === 'income' ? 0 : isCharge(row) ? 2 : 1));
        expect(rank).toEqual(rank.toSorted((a, b) => a - b));
      }
    });

    it('have rows on days 29 to 31 only in months with those days', () => {
      expect(byDate.get('2024-02-29')!.map(({ item }) => item)).toEqual(['Taxi fare']);
      expect(byDate.has('2023-02-29')).toBe(false);
      // 8 income and 30 expense rows on days 1 to 28 (16 and 25 have two), plus one per day after 28 and the charges.
      expect(
        ['2023-02', '2024-02', '2026-04', '2026-05', '2026-06', '2026-10', '2028-12'].map((month) =>
          perMonth(dataset, month),
        ),
      ).toEqual([38, 39, 40, 42, 41, 41, 41]);
    });

    it.each<[string, string, number, number]>([
      ['GTR 5', '2023-05-17', CREDIT_CARD, 16_000], // Figma's date and amount, every factor 100%
      ['Taxi fare', '2026-10-19', CREDIT_CARD, 1_064], // $10.00 x 112% x 95%
      ['Taxi fare', '2022-01-03', CREDIT_CARD, 903], // $10.00 x 95% x 95% = $9.025, half up
      ['Movie ticket', '2022-09-06', CREDIT_CARD, 1_211], // $15.00 x 95% x 85% = $12.1125
      ['Biriyani', '2024-01-05', CREDIT_CARD, 1_373], // $12.00 x 104% x 110% = $13.728
      ['Jeans', '2026-10-22', CHECKING, 26_600], // $190.00 x 112% x 125%
      ['Loan installment', '2028-12-10', LOAN, 13_800], // $100.00 x 120% x 115%
      ['Design project', '2026-10-01', CHECKING, 78_400], // income: $700.00 x 112%, no month factor
      ['Interest', '2022-02-28', 2, 3_800], // $40.00 x 95%
      ['Figma - Yearly Plan', '2026-05-14', CREDIT_CARD, 15_000], // bill charges are not scaled
      ['Adobe Inc - Yearly Plan', '2028-06-17', CREDIT_CARD, 55_900],
    ])('%s on %s: account %i, %i cents', (item, date, accountIndex, cents) => {
      const rows = byDate.get(date)!.filter((row) => row.item === item);

      expect(rows.map((row) => [row.accountIndex, row.amountCents])).toEqual([[accountIndex, cents]]);
    });

    it('pay the Freelance payment at $160.00 times the year factor', () => {
      const amounts = [2022, 2023, 2024, 2025, 2026, 2027, 2028].map(
        (year) => byDate.get(`${year}-04-17`)!.find((row) => row.item === 'Freelance payment')!.amountCents,
      );

      expect(amounts).toEqual([15_200, 16_000, 16_640, 17_280, 17_920, 18_560, 19_200]);
    });

    it('give every expense one of the 6 categories and income none', () => {
      const income = dataset.transactions.filter((t) => t.direction === 'income');
      const expenses = dataset.transactions.filter((t) => t.direction === 'expense');

      expect(income.length + expenses.length).toBe(3411);
      expect(new Set(income.map((t) => t.category))).toEqual(new Set([null]));
      expect(new Set(expenses.map((t) => t.category))).toEqual(
        new Set(['housing', 'food', 'transportation', 'entertainment', 'shopping', 'others']),
      );
    });

    it('have a Complete expense on every day from 2022 to 2028', () => {
      const dates = everyDate();
      const missing = dates.filter(
        (date) => !byDate.get(date)?.some((t) => t.direction === 'expense' && t.status === 'complete'),
      );

      expect(dates).toHaveLength(2557);
      expect(missing).toEqual([]);
    });

    it('have one Failed and one Pending row a month, each with a Complete expense on its day', () => {
      const notComplete = dataset.transactions.filter((t) => t.status !== 'complete');
      const alone = notComplete.filter(
        (t) => !byDate.get(dateOf(t))!.some((row) => row.direction === 'expense' && row.status === 'complete'),
      );

      expect(
        notComplete
          .filter((t) => t.status === 'failed')
          .map(dateOf)
          .slice(0, 2),
      ).toEqual(['2022-01-16', '2022-02-16']);
      expect(notComplete.map(({ item, status }) => `${item} ${status}`).toSorted()).toEqual([
        ...Array<string>(84).fill('Pizza failed'),
        ...Array<string>(84).fill('Polo shirt pending'),
      ]);
      expect(alone).toEqual([]);
    });

    it('have unique 11-character receipts, with 8C52d5DKDJ5 only on the Freelance payment of 17 Apr 2023 on Checking', () => {
      const receipts = dataset.transactions.map((t) => t.receipt);
      const figma = dataset.transactions.filter((t) => t.receipt === '8C52d5DKDJ5');

      expect(new Set(receipts).size).toBe(3411);
      expect(receipts.filter((receipt) => !/^[A-Za-z0-9]{11}$/.test(receipt))).toEqual([]);
      expect(figma.map((t) => [dateOf(t), t.item, t.accountIndex, t.amountCents, t.status])).toEqual([
        ['2023-04-17', 'Freelance payment', CHECKING, 16_000, 'complete'],
      ]);
      // Drawn from the alphabet, not stuck on a few characters.
      expect(new Set(receipts.join('')).size).toBe(62);
    });
  });

  it('has the 14 bills, one per biller and year, with the Bills description', () => {
    const description =
      'For advanced security and more flexible controls, the Professional plan helps you scale design processes company-wide.';
    const expected = [2022, 2023, 2024, 2025, 2026, 2027, 2028].flatMap((year) => [
      ['Figma - Yearly Plan', 'figma', `${year}-05-15`, `${year - 1}-05-14`, 15_000],
      ['Adobe Inc - Yearly Plan', 'adobe', `${year}-06-16`, `${year - 1}-06-17`, 55_900],
    ]);

    expect(dataset.bills.map((b) => [b.title, b.logo, b.dueDate, b.lastChargeDate, b.amountCents])).toEqual(expected);
    expect(new Set(dataset.bills.map((b) => b.description))).toEqual(new Set([description]));
  });

  it('has 14 Complete bill charges on Credit Card, Others, titled as the bill', () => {
    const charges = dataset.transactions.filter(isCharge);

    expect(
      charges.map((t) => [dateOf(t), t.item, t.shopName, t.accountIndex, t.category, t.status, t.amountCents]),
    ).toEqual(
      [2022, 2023, 2024, 2025, 2026, 2027, 2028].flatMap((year) => [
        [`${year}-05-14`, 'Figma - Yearly Plan', 'Figma', CREDIT_CARD, 'others', 'complete', 15_000],
        [`${year}-06-17`, 'Adobe Inc - Yearly Plan', 'Adobe Inc', CREDIT_CARD, 'others', 'complete', 55_900],
      ]),
    );
  });

  it('has a $20,000.00 savings goal for every month, with the present amount of the calendar month', () => {
    const present = [9_500, 10_250, 11_000, 11_750, 12_500, 13_250, 14_000, 14_750, 15_500, 16_250, 17_000, 21_000];
    const expected = [2022, 2023, 2024, 2025, 2026, 2027, 2028].flatMap((year) =>
      present.map((dollars, i) => ({
        month: `${year}-${String(i + 1).padStart(2, '0')}`,
        targetCents: 2_000_000,
        presentCents: dollars * 100,
      })),
    );

    expect(dataset.savingsGoals).toEqual(expected);
    expect(dataset.savingsGoals.find((goal) => goal.month === '2026-10')).toEqual({
      month: '2026-10',
      targetCents: 2_000_000,
      presentCents: 1_625_000,
    });
  });

  it('has a $250.00 limit for each category', () => {
    expect(dataset.categoryLimits).toEqual(
      ['housing', 'food', 'transportation', 'entertainment', 'shopping', 'others'].map((category) => ({
        category,
        limitCents: 25_000,
      })),
    );
  });

  it('keeps every account balance positive to the end of 2028, the lowest being Loan at $15,932.45 in Dec 2028', () => {
    const balances = dataset.accounts.map((account) => account.openingBalanceCents);
    let lowest = { cents: Infinity, account: -1, date: '' };
    for (const t of dataset.transactions) {
      if (t.status !== 'complete') continue;
      balances[t.accountIndex]! += t.direction === 'income' ? t.amountCents : -t.amountCents;
      if (balances[t.accountIndex]! < lowest.cents) {
        lowest = { cents: balances[t.accountIndex]!, account: t.accountIndex, date: dateOf(t) };
      }
    }

    expect(lowest).toEqual({ cents: 1_593_245, account: LOAN, date: '2028-12-10' });
  });
});
