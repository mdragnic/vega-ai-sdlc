// `npm run demo:generate -w backend`: writes src/demo/demo-dataset.json from docs/spec/demo-data.md
// (#53, #78). Rerun only when demo-data.md changes; a test requires the committed file to match.
// Node runs this file with its built-in type stripping, so it imports only node: modules and types.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type {
  AccountType,
  BillLogo,
  CardNetwork,
  ExpenseCategory,
  TransactionDirection,
  TransactionStatus,
} from '@finebank/shared';

import type { DemoDatasetJson } from '../src/demo/demo-dataset.js';

type DemoTransaction = DemoDatasetJson['transactions'][number];

const FIRST_YEAR = 2022;
const LAST_YEAR = 2028;

// demo-data.md, Accounts: created in this order (#24). Account numbers as stored, without spaces.
const accounts: {
  accountType: AccountType;
  bankName: string;
  branchName: string;
  cardNetwork: CardNetwork | null;
  accountNumber: string;
}[] = [
  {
    accountType: 'credit-card',
    bankName: 'Master Card',
    branchName: 'Main Branch',
    cardNetwork: 'mastercard',
    accountNumber: '3388 4556 8860 2598',
  },
  {
    accountType: 'checking',
    bankName: 'AB Bank Ltd',
    branchName: 'Park Street Branch',
    cardNetwork: 'visa',
    accountNumber: '6934 5669 9012 7310',
  },
  {
    accountType: 'savings',
    bankName: 'Brac Bank Ltd.',
    branchName: 'Gulshan Branch',
    cardNetwork: null,
    accountNumber: '1334 5688 6801 4421',
  },
  {
    accountType: 'investment',
    bankName: 'AB Bank Ltd',
    branchName: 'Park Street Branch',
    cardNetwork: null,
    accountNumber: '6984 5686 6201 6652',
  },
  {
    accountType: 'loan',
    bankName: 'City Bank Ltd.',
    branchName: 'Motijheel Branch',
    cardNetwork: null,
    accountNumber: '3634 5689 6601 9083',
  },
];
const OPENING_BALANCE_CENTS = 2_500_000;

// Positions in `accounts`.
const CREDIT_CARD = 0;
const CHECKING = 1;
const SAVINGS = 2;
const INVESTMENT = 3;
const LOAN = 4;

// demo-data.md, Monthly template, Income (no category).
const incomeTemplate: { days: number[]; item: string; shopName: string; account: number; baseCents: number }[] = [
  { days: [1], item: 'Design project', shopName: 'Acme Ltd.', account: CHECKING, baseCents: 70_000 },
  { days: [3, 10, 17, 24], item: 'Freelance payment', shopName: 'Bright Studio', account: CHECKING, baseCents: 16_000 },
  { days: [15], item: 'Dividend', shopName: 'AB Bank Ltd', account: INVESTMENT, baseCents: 7_500 },
  { days: [27], item: 'Card repayment', shopName: 'AB Bank Ltd', account: CREDIT_CARD, baseCents: 45_000 },
  { days: [28], item: 'Interest', shopName: 'Brac Bank Ltd.', account: SAVINGS, baseCents: 4_000 },
];

// demo-data.md, Monthly template, Expenses: [day, item, shop, category, account, base cents, status].
const expenseTemplate: [number, string, string, ExpenseCategory, number, number, TransactionStatus][] = [
  [1, 'House Rent', 'Park View Apartments', 'housing', CHECKING, 23_000, 'complete'],
  [2, 'Polo shirt', 'XL fashions', 'shopping', CREDIT_CARD, 2_000, 'complete'],
  [3, 'Taxi fare', 'Uber', 'transportation', CREDIT_CARD, 1_000, 'complete'],
  [4, 'Grocery', 'Green Grocers', 'food', CHECKING, 23_000, 'complete'],
  [5, 'Biriyani', 'Hajir Biriyani', 'food', CREDIT_CARD, 1_200, 'complete'],
  [6, 'Movie ticket', 'Inox', 'entertainment', CREDIT_CARD, 1_500, 'complete'],
  [7, 'Metro Card bill', 'Metro Rail', 'transportation', CHECKING, 2_000, 'complete'],
  [8, 'Pizza', 'Pizza Hit', 'food', CREDIT_CARD, 2_000, 'complete'],
  [9, 'Keyboard', 'Gadget & Gear', 'shopping', CREDIT_CARD, 3_000, 'complete'],
  [10, 'Loan installment', 'City Bank Ltd.', 'others', LOAN, 10_000, 'complete'],
  [11, 'Donation', 'City Charity Trust', 'others', CHECKING, 3_000, 'complete'],
  [12, 'iTunes', 'iTunes Store', 'entertainment', CHECKING, 5_000, 'complete'],
  [13, 'Taxi fare', 'Uber', 'transportation', CREDIT_CARD, 1_000, 'complete'],
  [14, 'Parking', 'City Parking', 'housing', CHECKING, 2_000, 'complete'],
  [15, 'Shirt', 'XL fashions', 'shopping', CHECKING, 23_000, 'complete'],
  [16, 'Biriyani', 'Hajir Biriyani', 'food', CREDIT_CARD, 1_200, 'complete'],
  [16, 'Pizza', 'Pizza Hit', 'food', CREDIT_CARD, 2_000, 'failed'],
  [17, 'GTR 5', 'Gadget & Gear', 'entertainment', CREDIT_CARD, 16_000, 'complete'],
  [18, 'Restaurant bill', 'Spice Garden', 'food', CHECKING, 12_000, 'complete'],
  [19, 'Taxi fare', 'Uber', 'transportation', CREDIT_CARD, 1_000, 'complete'],
  [20, 'Pizza', 'Pizza Hit', 'food', CREDIT_CARD, 2_000, 'complete'],
  [21, 'Movie ticket', 'Inox', 'entertainment', CREDIT_CARD, 1_500, 'complete'],
  [22, 'Jeans', 'Denim House', 'shopping', CHECKING, 19_000, 'complete'],
  [23, 'Biriyani', 'Hajir Biriyani', 'food', CREDIT_CARD, 1_200, 'complete'],
  [24, 'Gift', 'Gift Corner', 'others', CHECKING, 2_000, 'complete'],
  [25, 'Taxi fare', 'Uber', 'transportation', CREDIT_CARD, 1_000, 'complete'],
  [25, 'Polo shirt', 'XL fashions', 'shopping', CREDIT_CARD, 2_000, 'pending'],
  [26, 'Polo shirt', 'XL fashions', 'shopping', CREDIT_CARD, 2_000, 'complete'],
  [27, 'Parking', 'City Parking', 'housing', CHECKING, 2_000, 'complete'],
  [28, 'Pizza', 'Pizza Hit', 'food', CREDIT_CARD, 2_000, 'complete'],
  [29, 'Taxi fare', 'Uber', 'transportation', CREDIT_CARD, 1_000, 'complete'],
  [30, 'Movie ticket', 'Inox', 'entertainment', CREDIT_CARD, 1_500, 'complete'],
  [31, 'Biriyani', 'Hajir Biriyani', 'food', CREDIT_CARD, 1_200, 'complete'],
];

// demo-data.md, Amounts per month: percentages.
const yearFactor: Record<number, number> = {
  2022: 95,
  2023: 100,
  2024: 104,
  2025: 108,
  2026: 112,
  2027: 116,
  2028: 120,
};
const monthFactor: Record<ExpenseCategory, number[]> = {
  housing: [100, 95, 100, 87, 100, 105, 95, 110, 100, 90, 105, 120],
  food: [110, 95, 105, 109, 100, 90, 115, 105, 95, 110, 100, 125],
  transportation: [95, 100, 110, 114, 100, 85, 105, 120, 100, 95, 110, 115],
  entertainment: [120, 90, 100, 118, 100, 110, 125, 95, 85, 105, 115, 130],
  shopping: [115, 85, 90, 80, 100, 120, 95, 110, 105, 125, 90, 140],
  others: [90, 105, 95, 81, 100, 110, 100, 85, 120, 95, 105, 115],
};

// demo-data.md, Bills: one due date a year per biller, charged on Credit Card under Others (#56, #96).
const BILL_DESCRIPTION =
  'For advanced security and more flexible controls, the Professional plan helps you scale design processes company-wide.';
const billers: {
  title: string;
  logo: BillLogo;
  shopName: string;
  amountCents: number;
  due: string;
  charged: string;
}[] = [
  {
    title: 'Figma - Yearly Plan',
    logo: 'figma',
    shopName: 'Figma',
    amountCents: 15_000,
    due: '05-15',
    charged: '05-14',
  },
  {
    title: 'Adobe Inc - Yearly Plan',
    logo: 'adobe',
    shopName: 'Adobe Inc',
    amountCents: 55_900,
    due: '06-16',
    charged: '06-17',
  },
];

// demo-data.md, Savings goals: the target every month and the present amount by calendar month.
const GOAL_TARGET_CENTS = 2_000_000;
const goalPresentCents = [
  950_000, 1_025_000, 1_100_000, 1_175_000, 1_250_000, 1_325_000, 1_400_000, 1_475_000, 1_550_000, 1_625_000, 1_700_000,
  2_100_000,
];

// demo-data.md, Categories: one limit each (#32), in the contract's order.
const categories: ExpenseCategory[] = ['housing', 'food', 'transportation', 'entertainment', 'shopping', 'others'];
const CATEGORY_LIMIT_CENTS = 25_000;

// demo-data.md, Receipts: Figma's ID stays on one row (#27); the others come from a fixed seed.
const FIGMA_RECEIPT = '8C52d5DKDJ5';
const RECEIPT_SEED = 20_221_017;
const RECEIPT_LENGTH = 11;
const RECEIPT_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** `round_half_up(base x year% x month% / 10000)` in integer cents (demo-data.md). */
function scaleCents(baseCents: number, yearPercent: number, monthPercent: number): number {
  return Math.floor((baseCents * yearPercent * monthPercent + 5_000) / 10_000);
}

const pad = (value: number): string => String(value).padStart(2, '0');
const daysIn = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** mulberry32: a small seeded PRNG, so the receipts are the same on every run. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** A transaction without its receipt, which is drawn once every row is in order. */
type Row = Omit<DemoTransaction, 'receipt'>;

function row(
  date: string,
  account: number,
  direction: TransactionDirection,
  status: TransactionStatus,
  category: ExpenseCategory | null,
  item: string,
  shopName: string,
  amountCents: number,
): Row {
  // Every timestamp is 12:00 UTC on its date (demo-data.md).
  return {
    accountIndex: account,
    occurredAt: `${date}T12:00:00.000Z`,
    direction,
    status,
    category,
    item,
    shopName,
    amountCents,
  };
}

/** One day's rows: income in template order, expenses in template order, bill charges last. */
function dayRows(year: number, month: number, day: number): Row[] {
  const date = `${year}-${pad(month)}-${pad(day)}`;
  const income = incomeTemplate
    .filter((template) => template.days.includes(day))
    .map((t) =>
      row(
        date,
        t.account,
        'income',
        'complete',
        null,
        t.item,
        t.shopName,
        scaleCents(t.baseCents, yearFactor[year]!, 100),
      ),
    );
  const expenses = expenseTemplate
    .filter(([templateDay]) => templateDay === day)
    .map(([, item, shopName, category, account, baseCents, status]) =>
      row(
        date,
        account,
        'expense',
        status,
        category,
        item,
        shopName,
        scaleCents(baseCents, yearFactor[year]!, monthFactor[category][month - 1]!),
      ),
    );
  const charges = billers
    .filter((biller) => biller.charged === `${pad(month)}-${pad(day)}`)
    .map((b) => row(date, CREDIT_CARD, 'expense', 'complete', 'others', b.title, b.shopName, b.amountCents));
  return [...income, ...expenses, ...charges];
}

function withReceipts(rows: Row[]): DemoTransaction[] {
  const random = seededRandom(RECEIPT_SEED);
  const used = new Set([FIGMA_RECEIPT]);
  const draw = (): string => {
    for (;;) {
      let receipt = '';
      while (receipt.length < RECEIPT_LENGTH) {
        receipt += RECEIPT_ALPHABET[Math.floor(random() * RECEIPT_ALPHABET.length)];
      }
      if (!used.has(receipt)) {
        used.add(receipt);
        return receipt;
      }
    }
  };
  return rows.map((r) => {
    const isFigmaRow =
      r.item === 'Freelance payment' && r.accountIndex === CHECKING && r.occurredAt.startsWith('2023-04-17');
    return { ...r, receipt: isFigmaRow ? FIGMA_RECEIPT : draw() };
  });
}

/** The whole dataset, from the constants above. */
export function generate(): DemoDatasetJson {
  const years = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const rows = years.flatMap((year) =>
    months.flatMap((month) =>
      Array.from({ length: daysIn(year, month) }, (_, i) => i + 1).flatMap((day) => dayRows(year, month, day)),
    ),
  );

  return {
    accounts: accounts.map((account) => ({
      ...account,
      accountNumber: account.accountNumber.replaceAll(' ', ''),
      openingBalanceCents: OPENING_BALANCE_CENTS,
    })),
    transactions: withReceipts(rows),
    // The bill due in a year was last charged the year before; the 2022 bills have 2021 dates and no charge.
    bills: years.flatMap((year) =>
      billers.map((b) => ({
        title: b.title,
        description: BILL_DESCRIPTION,
        logo: b.logo,
        dueDate: `${year}-${b.due}`,
        lastChargeDate: `${year - 1}-${b.charged}`,
        amountCents: b.amountCents,
      })),
    ),
    savingsGoals: years.flatMap((year) =>
      months.map((month) => ({
        month: `${year}-${pad(month)}`,
        targetCents: GOAL_TARGET_CENTS,
        presentCents: goalPresentCents[month - 1]!,
      })),
    ),
    categoryLimits: categories.map((category) => ({ category, limitCents: CATEGORY_LIMIT_CENTS })),
  };
}

const section = (name: string, records: readonly object[]): string =>
  `  "${name}": [\n${records.map((record) => `    ${JSON.stringify(record)}`).join(',\n')}\n  ]`;

/** JSON with one record per line, so a change reads as a diff. */
export function serialize(dataset: DemoDatasetJson): string {
  const sections = [
    section('accounts', dataset.accounts),
    section('transactions', dataset.transactions),
    section('bills', dataset.bills),
    section('savingsGoals', dataset.savingsGoals),
    section('categoryLimits', dataset.categoryLimits),
  ];
  return `{\n${sections.join(',\n')}\n}\n`;
}

if (import.meta.main) {
  // The target defaults to the committed file; the generator test passes a temporary one.
  const target = process.argv[2] ?? fileURLToPath(new URL('../src/demo/demo-dataset.json', import.meta.url));
  writeFileSync(target, serialize(generate()));
  console.log(`Wrote ${target}`);
}
