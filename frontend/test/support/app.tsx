import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  type AccountDetailsRequest,
  type AccountDetailsResponse,
  type AccountsResponse,
  type AccountType,
  type CurrentUser,
  type ErrorResponse,
  EXPECTED_USER_HEADER,
  type ExpensesBreakdownResponse,
  type MonthlyComparisonResponse,
  goalMessages,
  goalProgress,
  type RecentTransactionRow,
  type RecentTransactionsResponse,
  type SavingsGoalRequest,
  type SavingsGoalResponse,
  type TransactionHistoryPage,
  type TransactionHistoryRow,
  type TransactionRow,
  type TransactionsPage,
  type TransactionsTab,
  type UpcomingBillsResponse,
  type WeeklyComparisonResponse,
  writeGuardMessages,
} from '@finebank/shared';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { StrictMode } from 'react';
import { createMemoryRouter, type RouteObject } from 'react-router';

import { AppProviders } from '../../src/app/AppProviders';
import { routes } from '../../src/app/routes';
import dataStateStyles from '../../src/components/DataState/DataState.module.css';

/** The signed-in user as `GET /api/auth/me` returns it. */
export const signedInUser: CurrentUser = {
  fullName: 'Tanzir Rahman',
  email: 'tanzir@example.com',
  username: 'tanzir',
};

/** The guard's 401 body (task 007). */
export const authenticationRequired: ErrorResponse = { message: 'Authentication required' };

/** `GET /api/auth/me` answers. */
export const me = {
  signedIn: () => http.get('*/api/auth/me', () => HttpResponse.json(signedInUser)),
  signedOut: () => http.get('*/api/auth/me', () => HttpResponse.json(authenticationRequired, { status: 401 })),
  pending: () =>
    http.get('*/api/auth/me', async () => {
      await delay('infinite');
      return HttpResponse.json(signedInUser);
    }),
};

/** The backend's today in the test, as `GET /api/calendar/today` returns it. */
export const TODAY = '2026-10-22';

/** `GET /api/calendar/today` answers. */
export const today = {
  answers: (value: string = TODAY) => http.get('*/api/calendar/today', () => HttpResponse.json({ today: value })),
};

const usd = (cents: number) => ({ cents, currency: 'USD' }) as const;

/**
 * The demo accounts on 22 Oct 2026 as `GET /api/accounts` returns them, with their Bank Names (demo-data.md, task 013
 * AC1, AC2; task 019 AC2).
 */
export const demoAccounts: AccountsResponse = {
  totalBalance: usd(13_025_467),
  accounts: [
    {
      id: 1,
      accountType: 'credit-card',
      bankName: 'Master Card',
      cardNetwork: 'mastercard',
      maskedNumber: '**** **** **** 2598',
      balance: usd(2_101_918),
    },
    {
      id: 2,
      accountType: 'checking',
      bankName: 'AB Bank Ltd',
      cardNetwork: 'visa',
      maskedNumber: '**** **** **** 7310',
      balance: usd(3_336_248),
    },
    {
      id: 3,
      accountType: 'savings',
      bankName: 'Brac Bank Ltd.',
      cardNetwork: null,
      maskedNumber: '**** **** **** 4421',
      balance: usd(2_735_680),
    },
    {
      id: 4,
      accountType: 'investment',
      bankName: 'AB Bank Ltd',
      cardNetwork: null,
      maskedNumber: '**** **** **** 6652',
      balance: usd(2_950_300),
    },
    {
      id: 5,
      accountType: 'loan',
      bankName: 'City Bank Ltd.',
      cardNetwork: null,
      maskedNumber: '**** **** **** 9083',
      balance: usd(1_901_321),
    },
  ],
};

/**
 * Three more accounts, after the demo ones, for a grid of 6 or 8 (#24); their ids are not their positions. The total
 * is the backend's, as sent.
 */
const extraAccounts: AccountsResponse['accounts'] = [
  {
    id: 12,
    accountType: 'savings',
    bankName: 'Eastern Bank Ltd.',
    cardNetwork: 'visa',
    maskedNumber: '**** **** **** 1206',
    balance: usd(1_000_000),
  },
  {
    id: 17,
    accountType: 'checking',
    bankName: 'Prime Bank',
    cardNetwork: 'mastercard',
    maskedNumber: '**** **** **** 3317',
    balance: usd(-25_050),
  },
  {
    id: 30,
    accountType: 'investment',
    bankName: 'Dhaka Bank',
    cardNetwork: null,
    maskedNumber: '**** **** **** 5530',
    balance: usd(0),
  },
];

/** A 100-character Bank Name in words, the longest #26 allows. */
export const longBankNameInWords =
  'The First Community Cooperative Savings and Commercial Bank of Greater Dhaka and Chittagong Division';
/** A 100-character Bank Name with no space. */
export const longBankNameNoSpace =
  'InternationalcommercialandcooperativesavingsbankInternationalcommercialandcooperativesavingsbankInte';

/** The demo accounts with Checking's Bank Name replaced by `bankName`. */
const withCheckingBankName = (bankName: string): AccountsResponse => ({
  ...demoAccounts,
  accounts: demoAccounts.accounts.map((account) => (account.id === 2 ? { ...account, bankName } : account)),
});

/** The first `count` accounts of the demo ones and the extra ones. */
const firstAccounts = (count: number): AccountsResponse => ({
  ...demoAccounts,
  accounts: [...demoAccounts.accounts, ...extraAccounts].slice(0, count),
});

const accountsPath = '*/api/accounts';
const accountsFailure = () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 });

/**
 * `GET /api/accounts` answers: the demo, none, one, six and eight accounts, a 100-character Bank Name on Checking in
 * words or with no space, pending, failing, and failing on the first try and its 3 retries, then the demo (a Retry).
 */
export const accounts = {
  answers: (body: AccountsResponse = demoAccounts) => http.get(accountsPath, () => HttpResponse.json(body)),
  none: () => http.get(accountsPath, () => HttpResponse.json({ totalBalance: usd(0), accounts: [] })),
  one: () => http.get(accountsPath, () => HttpResponse.json(firstAccounts(1))),
  six: () => http.get(accountsPath, () => HttpResponse.json(firstAccounts(6))),
  eight: () => http.get(accountsPath, () => HttpResponse.json(firstAccounts(8))),
  longBankName: () => http.get(accountsPath, () => HttpResponse.json(withCheckingBankName(longBankNameInWords))),
  longBankNameNoSpace: () => http.get(accountsPath, () => HttpResponse.json(withCheckingBankName(longBankNameNoSpace))),
  pending: () =>
    http.get(accountsPath, async () => {
      await delay('infinite');
      return HttpResponse.json(demoAccounts);
    }),
  fails: () => http.get(accountsPath, accountsFailure),
  failsThenAnswers: () => {
    let tries = 0;
    return http.get(accountsPath, () => {
      tries += 1;
      return tries <= 4 ? accountsFailure() : HttpResponse.json(demoAccounts);
    });
  },
};

/** The demo goal of Oct 2026 as `GET /api/savings-goals/current` returns it (demo-data.md; task 014 AC1, AC2). */
export const demoGoal: SavingsGoalResponse = {
  month: '2026-10',
  goal: { target: usd(2_000_000), present: usd(1_625_000), progress: 0.8125 },
};

/** The current month with no goal (#58, #85). */
export const noGoal: SavingsGoalResponse = { month: '2026-10', goal: null };

const currentGoalPath = '*/api/savings-goals/current';
const saveGoalPath = '*/api/savings-goals';

/** `GET /api/savings-goals/current` answers. */
export const savingsGoal = {
  answers: (body: SavingsGoalResponse = demoGoal) => http.get(currentGoalPath, () => HttpResponse.json(body)),
  pending: () =>
    http.get(currentGoalPath, async () => {
      await delay('infinite');
      return HttpResponse.json(demoGoal);
    }),
  fails: () =>
    http.get(currentGoalPath, () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 })),
};

/** The write guard's 400 for a write without `X-Expected-User` (task 022, #119), as the backend answers it. */
const expectedUserMissing = () =>
  HttpResponse.json({ message: writeGuardMessages.expectedUserInvalid } satisfies ErrorResponse, { status: 400 });

/** The write guard's 409 body: another user is signed in (#119). */
export const otherUserSignedIn: ErrorResponse = { message: writeGuardMessages.otherUser };

/**
 * A backend's goal for one test: `GET /api/savings-goals/current` answers it; `PUT /api/savings-goals` records the
 * body and its `X-Expected-User`, saves it with the progress from `goalProgress`, as the backend does, and answers it;
 * without the header it answers the write guard's 400 and saves nothing, as the backend (task 022).
 */
export function goalBackend(initial: SavingsGoalResponse = demoGoal) {
  let current = initial;
  const saved: SavingsGoalRequest[] = [];
  const expectedUsers: (string | null)[] = [];
  const handlers = [
    http.get(currentGoalPath, () => HttpResponse.json(current)),
    http.put(saveGoalPath, async ({ request }) => {
      expectedUsers.push(request.headers.get(EXPECTED_USER_HEADER));
      if (!request.headers.get(EXPECTED_USER_HEADER)) return expectedUserMissing();
      const body = (await request.json()) as SavingsGoalRequest;
      saved.push(body);
      current = {
        month: body.month,
        goal: { target: body.target, present: body.present, progress: goalProgress(body.present, body.target) },
      };
      return HttpResponse.json(current);
    }),
  ];
  return { handlers, saved, expectedUsers };
}

/** The 12 months of a year, newest first. */
const yearDown = (year: number) =>
  ['12', '11', '10', '09', '08', '07', '06', '05', '04', '03', '02', '01'].map((month) => `${year}-${month}`);

/**
 * The 58 months of `GET /api/savings-goals/months` at the fixed clock in Belgrade, `2026-10` down to `2022-01`, written
 * out (task 025 AC3; #123 a).
 */
export const demoGoalMonths: string[] = [
  ...yearDown(2026).slice(2),
  ...yearDown(2025),
  ...yearDown(2024),
  ...yearDown(2023),
  ...yearDown(2022),
];

/** The demo dataset's savings goals by month (demo-data.md, Savings goals), read from the backend's file. */
const demoGoalRows = new Map(
  (
    JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../backend/src/demo/demo-dataset.json'), 'utf8')) as {
      savingsGoals: { month: string; targetCents: number; presentCents: number }[];
    }
  ).savingsGoals.map((row) => [row.month, row]),
);

/** A month's demo goal as `GET /api/savings-goals?month=` answers it, `goal: null` for a month the dataset lacks. */
export function demoGoalOf(month: string): SavingsGoalResponse {
  const row = demoGoalRows.get(month);
  if (!row) return { month, goal: null };
  const target = usd(row.targetCents);
  const present = usd(row.presentCents);
  return { month, goal: { target, present, progress: goalProgress(present, target) } };
}

const goalMonthsPath = '*/api/savings-goals/months';
const goalMonthPath = '*/api/savings-goals';
const goalReadFailure = () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 });
/** The 409 of a month the user cannot choose, on the one-month read and the save (#123 b). */
const monthUnavailable = () =>
  HttpResponse.json({ message: goalMessages.monthUnavailable } satisfies ErrorResponse, { status: 409 });

/** `GET /api/savings-goals/months` answers (task 025). */
export const savingsGoalMonths = {
  answers: (months: string[] = demoGoalMonths) => http.get(goalMonthsPath, () => HttpResponse.json({ months })),
  /** Only the current month, as for a user with no data up to today. */
  one: () => http.get(goalMonthsPath, () => HttpResponse.json({ months: ['2026-10'] })),
  /** At 2026-10-31T23:30:00Z in Belgrade: 59 months from `2026-11`. */
  belgradeMidnight: () => http.get(goalMonthsPath, () => HttpResponse.json({ months: ['2026-11', ...demoGoalMonths] })),
  pending: () =>
    http.get(goalMonthsPath, async () => {
      await delay('infinite');
      return HttpResponse.json({ months: demoGoalMonths });
    }),
  fails: () => http.get(goalMonthsPath, goalReadFailure),
  /** Fails the first load and its 3 retries, then answers the demo list (Retry). */
  failsThenAnswers: () => {
    let tries = 0;
    return http.get(goalMonthsPath, () => {
      tries += 1;
      return tries <= 4 ? goalReadFailure() : HttpResponse.json({ months: demoGoalMonths });
    });
  },
};

/** The month a `GET /api/savings-goals?month=` request names. */
const monthOf = (request: Request) => new URL(request.url).searchParams.get('month') ?? '';

/** `GET /api/savings-goals?month=` answers (task 025). */
export const savingsGoalForMonth = {
  /** The demo goal of the month the query names. */
  answers: () => http.get(goalMonthPath, ({ request }) => HttpResponse.json(demoGoalOf(monthOf(request)))),
  /** The month with no goal. */
  none: () => http.get(goalMonthPath, ({ request }) => HttpResponse.json({ month: monthOf(request), goal: null })),
  pending: () =>
    http.get(goalMonthPath, async ({ request }) => {
      await delay('infinite');
      return HttpResponse.json(demoGoalOf(monthOf(request)));
    }),
  fails: () => http.get(goalMonthPath, goalReadFailure),
  /** Fails the first load and its 3 retries, then answers the demo goal (Retry). */
  failsThenAnswers: () => {
    let tries = 0;
    return http.get(goalMonthPath, ({ request }) => {
      tries += 1;
      return tries <= 4 ? goalReadFailure() : HttpResponse.json(demoGoalOf(monthOf(request)));
    });
  },
  /** The 409 of a month the user cannot choose (#123 b). */
  unavailable: () => http.get(goalMonthPath, monthUnavailable),
};

/**
 * A backend's goals for one Goals test (task 025): `GET /api/savings-goals/months` answers `months`;
 * `GET /api/savings-goals?month=` the month's goal (the demo goals unless changed), or the #123 b 409 for a month not in
 * the list; `GET /api/savings-goals/current` the first month's; `PUT /api/savings-goals` records the body and its
 * `X-Expected-User`, refuses a month not in the list with the 409, saves the rest with the progress from `goalProgress`
 * and answers it; without the header the write guard's 400.
 */
export function goalsBackend(months: string[] = demoGoalMonths) {
  const goals = new Map(months.map((month) => [month, demoGoalOf(month)]));
  const saved: SavingsGoalRequest[] = [];
  const expectedUsers: (string | null)[] = [];
  const handlers = [
    http.get(goalMonthsPath, () => HttpResponse.json({ months })),
    http.get(currentGoalPath, () => HttpResponse.json(goals.get(months[0]!))),
    http.get(goalMonthPath, ({ request }) => {
      const goal = goals.get(monthOf(request));
      return goal ? HttpResponse.json(goal) : monthUnavailable();
    }),
    http.put(saveGoalPath, async ({ request }) => {
      expectedUsers.push(request.headers.get(EXPECTED_USER_HEADER));
      if (!request.headers.get(EXPECTED_USER_HEADER)) return expectedUserMissing();
      const body = (await request.json()) as SavingsGoalRequest;
      saved.push(body);
      if (!goals.has(body.month)) return monthUnavailable();
      const answer: SavingsGoalResponse = {
        month: body.month,
        goal: { target: body.target, present: body.present, progress: goalProgress(body.present, body.target) },
      };
      goals.set(body.month, answer);
      return HttpResponse.json(answer);
    }),
  ];
  /** Sets a month's stored goal, as another tab's save would. */
  const set = (answer: SavingsGoalResponse) => goals.set(answer.month, answer);
  return { handlers, saved, expectedUsers, set };
}

/** A bill as `GET /api/bills/upcoming` sends it. */
type UpcomingBillBody = UpcomingBillsResponse['bills'][number];

/** The description of every demo bill (demo-data.md, Bills). */
export const demoBillDescription =
  'For advanced security and more flexible controls, the Professional plan helps you scale design processes company-wide.';

/** The demo bills due in a year (demo-data.md, Bills). */
export const demoFigmaBill = (year: number): UpcomingBillBody => ({
  title: 'Figma - Yearly Plan',
  description: demoBillDescription,
  logo: 'figma',
  dueDate: `${year}-05-15`,
  lastChargeDate: `${year - 1}-05-14`,
  amount: usd(15_000),
});
export const demoAdobeBill = (year: number): UpcomingBillBody => ({
  title: 'Adobe Inc - Yearly Plan',
  description: demoBillDescription,
  logo: 'adobe',
  dueDate: `${year}-06-16`,
  lastChargeDate: `${year - 1}-06-17`,
  amount: usd(55_900),
});

/** The 4 upcoming bills a first login gets on 22 Oct 2026, soonest first (demo-data.md; task 015 AC1, AC2). */
export const demoBills: UpcomingBillsResponse = {
  bills: [demoFigmaBill(2027), demoAdobeBill(2027), demoFigmaBill(2028), demoAdobeBill(2028)],
};

/** Three bills of another list, in the order sent (task 023 T7): more than Overview's two, fewer than the demo's 4. */
export const threeBills: UpcomingBillsResponse = {
  bills: [
    { ...demoAdobeBill(2027), title: 'First bill', dueDate: '2026-11-01', lastChargeDate: '2025-11-02' },
    { ...demoFigmaBill(2027), title: 'Second bill', dueDate: '2026-12-01', lastChargeDate: '2025-12-02' },
    { ...demoAdobeBill(2027), title: 'Third bill', dueDate: '2027-01-01', lastChargeDate: '2026-01-02' },
  ],
};

/** A 120-character text in words, with no hyphen (task 023 AC17). */
export const longBillWords = `Figma - ${'Organization Plan with every seat '.repeat(4)}`.slice(0, 120);
/** A 120-character text with no space. */
export const longBillNoSpace = 'FigmaOrganizationPlanWithEverySeat'.repeat(4).slice(0, 120);

/**
 * The long data of task 023 AC17: a 120-character title and description in words with `$1,000,000,000.00`, the same
 * with no space, then a demo bill.
 */
export const longBills: UpcomingBillsResponse = {
  bills: [
    { ...demoFigmaBill(2027), title: longBillWords, description: longBillWords, amount: usd(100_000_000_000) },
    { ...demoAdobeBill(2027), title: longBillNoSpace, description: longBillNoSpace, amount: usd(100_000_000_000) },
    demoFigmaBill(2028),
  ],
};

const upcomingBillsPath = '*/api/bills/upcoming';
const billsFailure = () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 });

/**
 * `GET /api/bills/upcoming` answers: the demo, none, one (Adobe due 16 Jun 2028), pending, failing, and failing on the
 * first request and its 3 retries, then the demo (a Retry).
 */
export const upcomingBills = {
  answers: (body: UpcomingBillsResponse = demoBills) => http.get(upcomingBillsPath, () => HttpResponse.json(body)),
  none: () => http.get(upcomingBillsPath, () => HttpResponse.json({ bills: [] })),
  one: () => http.get(upcomingBillsPath, () => HttpResponse.json({ bills: [demoAdobeBill(2028)] })),
  pending: () =>
    http.get(upcomingBillsPath, async () => {
      await delay('infinite');
      return HttpResponse.json(demoBills);
    }),
  fails: () => http.get(upcomingBillsPath, billsFailure),
  failsThenAnswers: () => {
    let tries = 0;
    return http.get(upcomingBillsPath, () => {
      tries += 1;
      return tries <= 4 ? billsFailure() : HttpResponse.json(demoBills);
    });
  },
};

/** A row as `GET /api/transactions/recent` sends it. */
export type RecentTransactionBody = RecentTransactionRow;

/** A demo transaction of October 2026: every one is stored at 12:00 UTC (demo-data.md). */
const octoberAt = (day: number) => `2026-10-${String(day).padStart(2, '0')}T12:00:00.000Z`;

/** The demo expenses of a first login on 22 Oct 2026, newest first (demo-data.md, "What a first login shows"). */
export const demoExpenses: RecentTransactionBody[] = [
  {
    item: 'Jeans',
    shopName: 'Denim House',
    category: 'shopping',
    direction: 'expense',
    occurredAt: octoberAt(22),
    amount: usd(26_600),
  },
  {
    item: 'Movie ticket',
    shopName: 'Inox',
    category: 'entertainment',
    direction: 'expense',
    occurredAt: octoberAt(21),
    amount: usd(1_764),
  },
  {
    item: 'Pizza',
    shopName: 'Pizza Hit',
    category: 'food',
    direction: 'expense',
    occurredAt: octoberAt(20),
    amount: usd(2_464),
  },
  {
    item: 'Taxi fare',
    shopName: 'Uber',
    category: 'transportation',
    direction: 'expense',
    occurredAt: octoberAt(19),
    amount: usd(1_064),
  },
  {
    item: 'Restaurant bill',
    shopName: 'Spice Garden',
    category: 'food',
    direction: 'expense',
    occurredAt: octoberAt(18),
    amount: usd(14_784),
  },
];

const demoFreelance = (day: number): RecentTransactionBody => ({
  item: 'Freelance payment',
  shopName: 'Bright Studio',
  category: null,
  direction: 'income',
  occurredAt: octoberAt(day),
  amount: usd(17_920),
});

/** The demo income of a first login on 22 Oct 2026, newest first. */
export const demoRevenue: RecentTransactionBody[] = [
  demoFreelance(17),
  {
    item: 'Dividend',
    shopName: 'AB Bank Ltd',
    category: null,
    direction: 'income',
    occurredAt: octoberAt(15),
    amount: usd(8_400),
  },
  demoFreelance(10),
  demoFreelance(3),
  {
    item: 'Design project',
    shopName: 'Acme Ltd.',
    category: null,
    direction: 'income',
    occurredAt: octoberAt(1),
    amount: usd(78_400),
  },
];

/** The three lists a first login gets on 22 Oct 2026 (task 016 AC1, AC2): no income from 18 to 22 Oct. */
export const demoRecentTransactions: RecentTransactionsResponse = {
  all: demoExpenses,
  revenue: demoRevenue,
  expenses: demoExpenses,
};

/** Fewer than 5: 3 rows in All, 1 in Revenue and none in Expenses. */
export const fewRecentTransactions: RecentTransactionsResponse = {
  all: [demoExpenses[0]!, demoRevenue[0]!, demoExpenses[1]!],
  revenue: [demoRevenue[0]!],
  expenses: [],
};

const recentTransactionsPath = '*/api/transactions/recent';

/**
 * `GET /api/transactions/recent` answers: the demo, all empty, Revenue empty only, fewer than 5, pending and
 * failing.
 */
export const recentTransactions = {
  answers: (body: RecentTransactionsResponse = demoRecentTransactions) =>
    http.get(recentTransactionsPath, () => HttpResponse.json(body)),
  none: () => http.get(recentTransactionsPath, () => HttpResponse.json({ all: [], revenue: [], expenses: [] })),
  noRevenue: () =>
    http.get(recentTransactionsPath, () => HttpResponse.json({ ...demoRecentTransactions, revenue: [] })),
  few: () => http.get(recentTransactionsPath, () => HttpResponse.json(fewRecentTransactions)),
  pending: () =>
    http.get(recentTransactionsPath, async () => {
      await delay('infinite');
      return HttpResponse.json(demoRecentTransactions);
    }),
  fails: () =>
    http.get(recentTransactionsPath, () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 })),
};

/** A demo row of `GET /api/transactions` in 2026, stored at 12:00 UTC (demo-data.md): income has no category. */
const demoRow = (
  item: string,
  shopName: string,
  category: TransactionRow['category'],
  date: string,
  paymentMethod: TransactionRow['paymentMethod'],
  cents: number,
): TransactionRow => ({
  item,
  shopName,
  category,
  direction: category === null ? 'income' : 'expense',
  occurredAt: `2026-${date}T12:00:00.000Z`,
  paymentMethod,
  amount: usd(cents),
});

/** Cursors as the backend makes them (the last row's instant and ID, base64url): opaque to the frontend. */
export const demoCursors = {
  allPage2: 'MjAyNi0xMC0xNVQxMjowMDowMC4wMDBaXzIzNDE',
  allPage3: 'MjAyNi0xMC0wN1QxMjowMDowMC4wMDBaXzIzMzA',
  revenuePage2: 'MjAyNi0wOS0xNVQxMjowMDowMC4wMDBaXzIyODc',
  expensesPage2: 'MjAyNi0xMC0xNFQxMjowMDowMC4wMDBaXzIzMzk',
} as const;

/** All's first page on 22 Oct 2026 (task 020 References): Shirt last, at Dividend's instant. */
export const demoAllPage1: TransactionsPage = {
  transactions: [
    demoRow('Jeans', 'Denim House', 'shopping', '10-22', 'checking', 26_600),
    demoRow('Movie ticket', 'Inox', 'entertainment', '10-21', 'credit-card', 1_764),
    demoRow('Pizza', 'Pizza Hit', 'food', '10-20', 'credit-card', 2_464),
    demoRow('Taxi fare', 'Uber', 'transportation', '10-19', 'credit-card', 1_064),
    demoRow('Restaurant bill', 'Spice Garden', 'food', '10-18', 'checking', 14_784),
    demoRow('GTR 5', 'Gadget & Gear', 'entertainment', '10-17', 'credit-card', 18_816),
    demoRow('Freelance payment', 'Bright Studio', null, '10-17', 'checking', 17_920),
    demoRow('Pizza', 'Pizza Hit', 'food', '10-16', 'credit-card', 2_464),
    demoRow('Biriyani', 'Hajir Biriyani', 'food', '10-16', 'credit-card', 1_478),
    demoRow('Shirt', 'XL fashions', 'shopping', '10-15', 'checking', 32_200),
  ],
  nextCursor: demoCursors.allPage2,
};

/** All's second page: Dividend first. */
export const demoAllPage2: TransactionsPage = {
  transactions: [
    demoRow('Dividend', 'AB Bank Ltd', null, '10-15', 'investment', 8_400),
    demoRow('Parking', 'City Parking', 'housing', '10-14', 'checking', 2_016),
    demoRow('Taxi fare', 'Uber', 'transportation', '10-13', 'credit-card', 1_064),
    demoRow('iTunes', 'iTunes Store', 'entertainment', '10-12', 'checking', 5_880),
    demoRow('Donation', 'City Charity Trust', 'others', '10-11', 'checking', 3_192),
    demoRow('Loan installment', 'City Bank Ltd.', 'others', '10-10', 'loan', 10_640),
    demoRow('Freelance payment', 'Bright Studio', null, '10-10', 'checking', 17_920),
    demoRow('Keyboard', 'Gadget & Gear', 'shopping', '10-09', 'credit-card', 4_200),
    demoRow('Pizza', 'Pizza Hit', 'food', '10-08', 'credit-card', 2_464),
    demoRow('Metro Card bill', 'Metro Rail', 'transportation', '10-07', 'checking', 2_128),
  ],
  nextCursor: demoCursors.allPage3,
};

/** A last page after All's second: two rows and no cursor, for the end of a list. */
export const lastAllPage: TransactionsPage = {
  transactions: [
    demoRow('Movie ticket', 'Inox', 'entertainment', '10-06', 'credit-card', 1_764),
    demoRow('Biriyani', 'Hajir Biriyani', 'food', '10-05', 'credit-card', 1_478),
  ],
  nextCursor: null,
};

/** Revenue's first page. */
export const demoRevenuePage1: TransactionsPage = {
  transactions: [
    demoRow('Freelance payment', 'Bright Studio', null, '10-17', 'checking', 17_920),
    demoRow('Dividend', 'AB Bank Ltd', null, '10-15', 'investment', 8_400),
    demoRow('Freelance payment', 'Bright Studio', null, '10-10', 'checking', 17_920),
    demoRow('Freelance payment', 'Bright Studio', null, '10-03', 'checking', 17_920),
    demoRow('Design project', 'Acme Ltd.', null, '10-01', 'checking', 78_400),
    demoRow('Interest', 'Brac Bank Ltd.', null, '09-28', 'savings', 4_480),
    demoRow('Card repayment', 'AB Bank Ltd', null, '09-27', 'credit-card', 50_400),
    demoRow('Freelance payment', 'Bright Studio', null, '09-24', 'checking', 17_920),
    demoRow('Freelance payment', 'Bright Studio', null, '09-17', 'checking', 17_920),
    demoRow('Dividend', 'AB Bank Ltd', null, '09-15', 'investment', 8_400),
  ],
  nextCursor: demoCursors.revenuePage2,
};

/** Expenses' first page: All's without the Freelance payment, then Parking. */
export const demoExpensesPage1: TransactionsPage = {
  transactions: [
    ...demoAllPage1.transactions.filter((row) => row.direction === 'expense'),
    demoAllPage2.transactions[1]!,
  ],
  nextCursor: demoCursors.expensesPage2,
};

/** Each tab's pages in order: the first for no cursor, each later one for the cursor of the page before. */
export type TransactionPages = Record<TransactionsTab, TransactionsPage[]>;

/** The demo on 22 Oct 2026: each tab's first page, and All's second (task 020 AC2 to AC4). */
export const demoTransactionPages: TransactionPages = {
  all: [demoAllPage1, demoAllPage2],
  revenue: [demoRevenuePage1],
  expenses: [demoExpensesPage1],
};

/** The demo with a third page on All that ends the list. */
export const endingTransactionPages: TransactionPages = {
  ...demoTransactionPages,
  all: [demoAllPage1, demoAllPage2, lastAllPage],
};

/** One page per tab with no cursor: All 3 rows, Revenue 1, Expenses 2. */
export const fewTransactionPages: TransactionPages = {
  all: [{ transactions: demoAllPage1.transactions.slice(4, 7), nextCursor: null }],
  revenue: [{ transactions: [demoAllPage1.transactions[6]!], nextCursor: null }],
  expenses: [{ transactions: demoAllPage1.transactions.slice(4, 6), nextCursor: null }],
};

/** All exactly 10 rows with no cursor: the whole list. */
export const tenTransactionPages: TransactionPages = {
  ...demoTransactionPages,
  all: [{ ...demoAllPage1, nextCursor: null }],
};

/** No rows on any tab. */
export const noTransactionPages: TransactionPages = {
  all: [{ transactions: [], nextCursor: null }],
  revenue: [{ transactions: [], nextCursor: null }],
  expenses: [{ transactions: [], nextCursor: null }],
};

/** A 120-character item in words. */
export const longItemInWords =
  'Annual premium subscription renewal for the professional design and collaboration suite with extended cloud storage plan';
/** A 120-character shop in words. */
export const longShopInWords =
  'The Grand Central Department Store and Shopping Arcade of the Greater Metropolitan Area and Its Surrounding District Ltd';
/** A 120-character item with no space. */
export const longItemNoSpace = 'Annualpremiumsubscriptionrenewal'.repeat(4).slice(0, 120);
/** A 120-character shop with no space. */
export const longShopNoSpace = 'GrandCentralDepartmentStoreArcade'.repeat(4).slice(0, 120);

/** All's first page with long texts on its first two rows and `$1,000,000,000.00` on the third (#106, #115 b). */
export const longTransactionPages: TransactionPages = {
  ...demoTransactionPages,
  all: [
    {
      ...demoAllPage1,
      transactions: [
        { ...demoAllPage1.transactions[0]!, item: longItemInWords, shopName: longShopInWords },
        { ...demoAllPage1.transactions[1]!, item: longItemNoSpace, shopName: longShopNoSpace },
        { ...demoAllPage1.transactions[2]!, amount: usd(100_000_000_000) },
        ...demoAllPage1.transactions.slice(3),
      ],
    },
    demoAllPage2,
  ],
};

const transactionsPath = '*/api/transactions';
const transactionsFailure = () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 });

/**
 * A backend of `pages`: the tab's first page for no cursor, the page after the cursor's for one; 400 for a tab or a
 * cursor it does not know, as the real one.
 */
function answerPages(pages: TransactionPages, request: Request) {
  const query = new URL(request.url).searchParams;
  const tabPages = pages[query.get('tab') as TransactionsTab] ?? [];
  const cursor = query.get('cursor');
  const page =
    cursor === null
      ? tabPages[0]
      : tabPages.find((_, index) => index > 0 && tabPages[index - 1]!.nextCursor === cursor);
  return page ? HttpResponse.json(page) : HttpResponse.json({ message: 'The cursor is not valid' }, { status: 400 });
}

/**
 * `GET /api/transactions` answers, keyed on the query: the demo pages (or others), pending, failing, failing on the
 * first try and its 3 retries then answered (a Retry), and a Load More failing on its first try and 3 retries, then
 * answered.
 */
export const transactions = {
  answers: (pages: TransactionPages = demoTransactionPages) =>
    http.get(transactionsPath, ({ request }) => answerPages(pages, request)),
  pending: () =>
    http.get(transactionsPath, async ({ request }) => {
      await delay('infinite');
      return answerPages(demoTransactionPages, request);
    }),
  fails: () => http.get(transactionsPath, transactionsFailure),
  failsThenAnswers: (pages: TransactionPages = demoTransactionPages) => {
    let tries = 0;
    return http.get(transactionsPath, ({ request }) => {
      tries += 1;
      return tries <= 4 ? transactionsFailure() : answerPages(pages, request);
    });
  },
  loadMoreFails: (pages: TransactionPages = demoTransactionPages) =>
    http.get(transactionsPath, ({ request }) =>
      new URL(request.url).searchParams.has('cursor') ? transactionsFailure() : answerPages(pages, request),
    ),
  loadMoreFailsThenAnswers: (pages: TransactionPages = demoTransactionPages) => {
    let tries = 0;
    return http.get(transactionsPath, ({ request }) => {
      if (new URL(request.url).searchParams.has('cursor')) {
        tries += 1;
        if (tries <= 4) return transactionsFailure();
      }
      return answerPages(pages, request);
    });
  },
};

/** The one 404 of the account routes (task 021). */
export const accountNotFound: ErrorResponse = { message: 'Account not found' };
const accountNotFoundResponse = () => HttpResponse.json(accountNotFound, { status: 404 });
const accountFailure = () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 });

/**
 * The demo accounts' details on 22 Oct 2026 as `GET /api/accounts/:accountId` returns them, by the IDs of
 * `demoAccounts` (demo-data.md; task 021 AC2): the same type, Bank Name, number and balance as their Balances cards.
 */
export const demoAccountDetails: Record<number, AccountDetailsResponse> = {
  1: {
    accountType: 'credit-card',
    bankName: 'Master Card',
    branchName: 'Main Branch',
    maskedNumber: '**** **** **** 2598',
    balance: usd(2_101_918),
  },
  2: {
    accountType: 'checking',
    bankName: 'AB Bank Ltd',
    branchName: 'Park Street Branch',
    maskedNumber: '**** **** **** 7310',
    balance: usd(3_336_248),
  },
  3: {
    accountType: 'savings',
    bankName: 'Brac Bank Ltd.',
    branchName: 'Gulshan Branch',
    maskedNumber: '**** **** **** 4421',
    balance: usd(2_735_680),
  },
  4: {
    accountType: 'investment',
    bankName: 'AB Bank Ltd',
    branchName: 'Park Street Branch',
    maskedNumber: '**** **** **** 6652',
    balance: usd(2_950_300),
  },
  5: {
    accountType: 'loan',
    bankName: 'City Bank Ltd.',
    branchName: 'Motijheel Branch',
    maskedNumber: '**** **** **** 9083',
    balance: usd(1_901_321),
  },
};

/** A 100-character Branch Name in words, the longest #26 allows. */
export const longBranchNameInWords =
  'Park Street Riverside Commercial District Main Corporate Branch Office Number Twelve North Wing Unit'.padEnd(
    100,
    'x',
  );
/** A 100-character Branch Name with no space. */
export const longBranchNameNoSpace = 'ParkStreetRiversideCommercialDistrict'.repeat(3).slice(0, 100);

/** Checking's details with long data (task 021 AC21): `bankName` and `branchName`, the lowest balance allowed. */
export const longAccountDetails = (bankName: string, branchName: string): AccountDetailsResponse => ({
  ...demoAccountDetails[2]!,
  bankName,
  branchName,
  balance: usd(-9_007_199_254_740_991),
});

const accountDetailsPath = '*/api/accounts/:accountId';

/** The details by account ID, or the one 404, as the real backend. */
const answerDetails = (details: Record<number, AccountDetailsResponse>, accountId: unknown) => {
  const found = details[Number(accountId)];
  return found ? HttpResponse.json(found) : accountNotFoundResponse();
};

/**
 * `GET /api/accounts/:accountId` answers: the demo accounts by ID (404 for any other ID), others, pending, failing,
 * failing on the first try and its 3 retries then the demo (a Retry), and 404 for every ID.
 */
export const accountDetails = {
  answers: (details: Record<number, AccountDetailsResponse> = demoAccountDetails) =>
    http.get(accountDetailsPath, ({ params }) => answerDetails(details, params.accountId)),
  pending: () =>
    http.get(accountDetailsPath, async ({ params }) => {
      await delay('infinite');
      return answerDetails(demoAccountDetails, params.accountId);
    }),
  fails: () => http.get(accountDetailsPath, accountFailure),
  failsThenAnswers: () => {
    let tries = 0;
    return http.get(accountDetailsPath, ({ params }) => {
      tries += 1;
      return tries <= 4 ? accountFailure() : answerDetails(demoAccountDetails, params.accountId);
    });
  },
  notFound: () => http.get(accountDetailsPath, accountNotFoundResponse),
};

/** A `PATCH /api/accounts/:accountId` as the backend received it (task 022). */
export type DetailsWrite = {
  accountId: string;
  body: unknown;
  expectedUser: string | null;
  zone: string | null;
};

async function readWrite(request: Request, accountId: unknown): Promise<DetailsWrite> {
  return {
    accountId: String(accountId),
    body: (await request.clone().json()) as unknown,
    expectedUser: request.headers.get(EXPECTED_USER_HEADER),
    zone: request.headers.get('X-Time-Zone'),
  };
}

/** Each demo account's ID by the type it starts with: each demo account has its own type (demo-data.md). */
const demoAccountIdByType: Record<AccountType, number> = {
  'credit-card': 1,
  checking: 2,
  savings: 3,
  investment: 4,
  loan: 5,
};

/**
 * A stateful demo backend for Account Details' writes (task 022), as the real one: `GET /api/accounts`,
 * `GET /api/accounts/:accountId` and `GET /api/transactions` answer the demo with every saved change (the Bank Name and
 * the type on the accounts list, the three fields on the details, the type as the Payment Method of the account's rows
 * on every tab); `PATCH /api/accounts/:accountId` records the request, stores the three fields it is sent (the form
 * sends them trimmed) and answers the details; 404 for an account it does not know, the write guard's 400 without
 * `X-Expected-User`. `hold` keeps the next PATCHes waiting until `release`.
 */
export function accountsBackend(pages: TransactionPages = demoTransactionPages) {
  const details: Record<number, AccountDetailsResponse> = structuredClone(demoAccountDetails);
  const writes: DetailsWrite[] = [];
  let held: PromiseWithResolvers<void> | null = null;
  const list = (): AccountsResponse => ({
    ...demoAccounts,
    accounts: demoAccounts.accounts.map((account) => ({
      ...account,
      bankName: details[account.id]!.bankName,
      accountType: details[account.id]!.accountType,
    })),
  });
  const withTypes = (): TransactionPages =>
    Object.fromEntries(
      Object.entries(pages).map(([tab, tabPages]) => [
        tab,
        tabPages.map((page) => ({
          ...page,
          transactions: page.transactions.map((row) => ({
            ...row,
            paymentMethod: details[demoAccountIdByType[row.paymentMethod]]!.accountType,
          })),
        })),
      ]),
    ) as TransactionPages;
  const handlers = [
    http.get(accountsPath, () => HttpResponse.json(list())),
    http.get(accountDetailsPath, ({ params }) => answerDetails(details, params.accountId)),
    http.get(transactionsPath, ({ request }) => answerPages(withTypes(), request)),
    http.patch(accountDetailsPath, async ({ params, request }) => {
      const write = await readWrite(request, params.accountId);
      writes.push(write);
      if (held) await held.promise;
      if (!write.expectedUser) return expectedUserMissing();
      const id = Number(params.accountId);
      const found = details[id];
      if (!found) return accountNotFoundResponse();
      const { bankName, branchName, accountType } = write.body as AccountDetailsRequest;
      details[id] = { ...found, bankName, branchName, accountType };
      return HttpResponse.json(details[id]);
    }),
  ];
  return {
    handlers,
    writes,
    details,
    hold: () => {
      held = Promise.withResolvers<void>();
    },
    release: () => {
      held?.resolve();
      held = null;
    },
  };
}

/**
 * `PATCH /api/accounts/:accountId` failures (task 022), each recording the request in `writes`: 500, a network error,
 * 400 with `fieldErrors`, the one 404 and the write guard's 409.
 */
export const updateAccountDetails = {
  fails: (writes: DetailsWrite[] = []) =>
    http.patch(accountDetailsPath, async ({ params, request }) => {
      writes.push(await readWrite(request, params.accountId));
      return HttpResponse.json({ message: 'Internal server error' }, { status: 500 });
    }),
  networkError: (writes: DetailsWrite[] = []) =>
    http.patch(accountDetailsPath, async ({ params, request }) => {
      writes.push(await readWrite(request, params.accountId));
      return HttpResponse.error();
    }),
  fieldErrors: (fieldErrors: Record<string, string>, writes: DetailsWrite[] = []) =>
    http.patch(accountDetailsPath, async ({ params, request }) => {
      writes.push(await readWrite(request, params.accountId));
      return HttpResponse.json({ message: 'Validation failed', fieldErrors } satisfies ErrorResponse, { status: 400 });
    }),
  notFound: (writes: DetailsWrite[] = []) =>
    http.patch(accountDetailsPath, async ({ params, request }) => {
      writes.push(await readWrite(request, params.accountId));
      return accountNotFoundResponse();
    }),
  otherUser: (writes: DetailsWrite[] = []) =>
    http.patch(accountDetailsPath, async ({ params, request }) => {
      writes.push(await readWrite(request, params.accountId));
      return HttpResponse.json(otherUserSignedIn, { status: 409 });
    }),
};

/** A history row as `GET /api/accounts/:accountId/transactions` sends it: the demo's are stored at 12:00 UTC. */
const historyRow = (
  date: string,
  status: TransactionHistoryRow['status'],
  direction: TransactionHistoryRow['direction'],
  receipt: string,
  cents: number,
): TransactionHistoryRow => ({
  occurredAt: `2026-${date}T12:00:00.000Z`,
  status,
  direction,
  receipt,
  amount: usd(cents),
});

/** Cursors as the backend makes them: opaque to the frontend. */
export const demoHistoryCursors = {
  checkingPage2: 'MjAyNi0xMC0wNFQxMjowMDowMC4wMDBaXzEyOTA',
  checkingPage3: 'MjAyNi0wOS0xNVQxMjowMDowMC4wMDBaXzEyNjI',
} as const;

/** Checking's first page on 22 Oct 2026 (task 021 References, the seed): Jeans first, Grocery last. */
export const demoCheckingHistoryPage1: TransactionHistoryPage = {
  transactions: [
    historyRow('10-22', 'complete', 'expense', 'z7YBsODpLNW', 26_600),
    historyRow('10-18', 'complete', 'expense', 'nPcvc24YHB7', 14_784),
    historyRow('10-17', 'complete', 'income', 'SVqWhlvmJqw', 17_920),
    historyRow('10-15', 'complete', 'expense', '5vSKgU8NCTh', 32_200),
    historyRow('10-14', 'complete', 'expense', '93i3nSBYFAa', 2_016),
    historyRow('10-12', 'complete', 'expense', 'UYdw2FRyetE', 5_880),
    historyRow('10-11', 'complete', 'expense', 'UK5fQ9kfUyy', 3_192),
    historyRow('10-10', 'complete', 'income', 'IhN8Byqe5aj', 17_920),
    historyRow('10-07', 'complete', 'expense', 'nPAdhi6fo6A', 2_128),
    historyRow('10-04', 'complete', 'expense', 'CrSNatgkImu', 28_336),
  ],
  nextCursor: demoHistoryCursors.checkingPage2,
};

/** Checking's second page: the Freelance payment of 3 Oct first, then House Rent. */
export const demoCheckingHistoryPage2: TransactionHistoryPage = {
  transactions: [
    historyRow('10-03', 'complete', 'income', 'gceoLfSMg8H', 17_920),
    historyRow('10-01', 'complete', 'expense', 'dR9mGBqImes', 23_184),
    historyRow('10-01', 'complete', 'income', 'tCVmvauhOp2', 78_400),
    historyRow('09-27', 'complete', 'expense', 'WQNNoDFvLkW', 2_240),
    historyRow('09-24', 'complete', 'expense', 'IIi2wjhROnv', 2_688),
    historyRow('09-24', 'complete', 'income', 'RlP3QuUPF9n', 17_920),
    historyRow('09-22', 'complete', 'expense', 'kuti5FrFrA5', 22_344),
    historyRow('09-18', 'complete', 'expense', 'WRVovyTJFmc', 12_768),
    historyRow('09-17', 'complete', 'income', 'ryXZj7Rr9EP', 17_920),
    historyRow('09-15', 'complete', 'expense', 'R8TepGymZJI', 27_048),
  ],
  nextCursor: demoHistoryCursors.checkingPage3,
};

/** A last page after Checking's second: two rows and no cursor, for the end of the list. */
export const lastCheckingHistoryPage: TransactionHistoryPage = {
  transactions: [
    historyRow('09-12', 'complete', 'expense', 'LastRow0001', 5_880),
    historyRow('09-10', 'pending', 'expense', 'LastRow0002', 3_192),
  ],
  nextCursor: null,
};

/** The Credit Card's first page: its fifth row the Failed Pizza. */
export const demoCreditCardHistoryPage1: TransactionHistoryPage = {
  transactions: [
    historyRow('10-21', 'complete', 'expense', 'N5wzoyzWlSv', 1_764),
    historyRow('10-20', 'complete', 'expense', 'kDku2tvFqPj', 2_464),
    historyRow('10-19', 'complete', 'expense', 'KhM9w4NZiNd', 1_064),
    historyRow('10-17', 'complete', 'expense', 'blvr2yPddNK', 18_816),
    historyRow('10-16', 'failed', 'expense', 'CFP5E9VV2Fn', 2_464),
    historyRow('10-16', 'complete', 'expense', 'xXRRh2tEox5', 1_478),
    historyRow('10-13', 'complete', 'expense', 'vAcNSlFZkAM', 1_064),
    historyRow('10-09', 'complete', 'expense', 'jc0NB9AcLby', 4_200),
    historyRow('10-08', 'complete', 'expense', 'Flz15bt0nCv', 2_464),
    historyRow('10-06', 'complete', 'expense', 'Cpu5e850TNM', 1_764),
  ],
  nextCursor: 'MjAyNi0xMC0wNlQxMjowMDowMC4wMDBaXzEyODU',
};

/** Each account's pages by its ID, in order: the first for no cursor, each later one for the cursor of the one before. */
export type HistoryPages = Record<number, TransactionHistoryPage[]>;

/** One page of `rows` with no cursor. */
const onlyPage = (...rows: TransactionHistoryRow[]): TransactionHistoryPage[] => [
  { transactions: rows, nextCursor: null },
];

/**
 * The demo on 22 Oct 2026: Checking's first two pages and the Credit Card's first; Savings, Investment and Loan their
 * newest row only (the frontend test needs no more of them).
 */
export const demoHistoryPages: HistoryPages = {
  1: [demoCreditCardHistoryPage1],
  2: [demoCheckingHistoryPage1, demoCheckingHistoryPage2],
  3: onlyPage(historyRow('09-28', 'complete', 'income', 'coYqvpXaD5B', 4_480)),
  4: onlyPage(historyRow('10-15', 'complete', 'income', 'A9TZ9fXoycD', 8_400)),
  5: onlyPage(historyRow('10-10', 'complete', 'expense', 'nCeBYCGopZb', 10_640)),
};

/** The demo with a third page on Checking that ends the list. */
export const endingHistoryPages: HistoryPages = {
  ...demoHistoryPages,
  2: [demoCheckingHistoryPage1, demoCheckingHistoryPage2, lastCheckingHistoryPage],
};

/** Checking with 3 rows, no cursor. */
export const fewHistoryPages: HistoryPages = {
  ...demoHistoryPages,
  2: onlyPage(...demoCheckingHistoryPage1.transactions.slice(0, 3)),
};

/** Checking with exactly 10 rows, no cursor: the whole list. */
export const tenHistoryPages: HistoryPages = {
  ...demoHistoryPages,
  2: [{ ...demoCheckingHistoryPage1, nextCursor: null }],
};

/** Checking with no rows. */
export const noHistoryPages: HistoryPages = { ...demoHistoryPages, 2: onlyPage() };

/** A 120-character receipt in words. */
export const longReceiptInWords =
  'Receipt for the annual premium subscription renewal of the family plan with every add-on included this year'.padEnd(
    120,
    'x',
  );
/** A 120-character receipt with no space. */
export const longReceiptNoSpace = 'Zq7XyWv3Ut9Sr5Qp1On8Ml4Kj2Ih6Gf0Ed'.repeat(4).slice(0, 120);

/** Checking's first page with the long receipts on its first two rows and `$1,000,000,000.00` on the third. */
export const longHistoryPages: HistoryPages = {
  ...demoHistoryPages,
  2: [
    {
      ...demoCheckingHistoryPage1,
      transactions: demoCheckingHistoryPage1.transactions.map((row, index) => {
        if (index === 0) return { ...row, receipt: longReceiptInWords };
        if (index === 1) return { ...row, receipt: longReceiptNoSpace };
        if (index === 2) return { ...row, amount: usd(100_000_000_000) };
        return row;
      }),
    },
  ],
};

const accountHistoryPath = '*/api/accounts/:accountId/transactions';

/**
 * A backend of `pages`: the account's first page for no cursor, the page after the cursor's for one; the one 404 for
 * an account it does not know and 400 for a cursor it does not know, as the real one.
 */
function answerHistory(pages: HistoryPages, accountId: unknown, request: Request) {
  const accountPages = pages[Number(accountId)];
  if (accountPages === undefined) return accountNotFoundResponse();
  const cursor = new URL(request.url).searchParams.get('cursor');
  const page =
    cursor === null
      ? accountPages[0]
      : accountPages.find((_, index) => index > 0 && accountPages[index - 1]!.nextCursor === cursor);
  return page ? HttpResponse.json(page) : HttpResponse.json({ message: 'The cursor is not valid' }, { status: 400 });
}

/**
 * `GET /api/accounts/:accountId/transactions` answers, keyed on the account and the cursor: the demo pages (or
 * others), pending, failing, failing on the first try and its 3 retries then answered (a Retry), a Load More failing
 * on every try, or on its first try and 3 retries then answered, and 404 for every account.
 */
export const accountHistory = {
  answers: (pages: HistoryPages = demoHistoryPages) =>
    http.get(accountHistoryPath, ({ params, request }) => answerHistory(pages, params.accountId, request)),
  pending: () =>
    http.get(accountHistoryPath, async ({ params, request }) => {
      await delay('infinite');
      return answerHistory(demoHistoryPages, params.accountId, request);
    }),
  fails: () => http.get(accountHistoryPath, accountFailure),
  failsThenAnswers: (pages: HistoryPages = demoHistoryPages) => {
    let tries = 0;
    return http.get(accountHistoryPath, ({ params, request }) => {
      tries += 1;
      return tries <= 4 ? accountFailure() : answerHistory(pages, params.accountId, request);
    });
  },
  loadMoreFails: (pages: HistoryPages = demoHistoryPages) =>
    http.get(accountHistoryPath, ({ params, request }) =>
      new URL(request.url).searchParams.has('cursor')
        ? accountFailure()
        : answerHistory(pages, params.accountId, request),
    ),
  loadMoreFailsThenAnswers: (pages: HistoryPages = demoHistoryPages) => {
    let tries = 0;
    return http.get(accountHistoryPath, ({ params, request }) => {
      if (new URL(request.url).searchParams.has('cursor')) {
        tries += 1;
        if (tries <= 4) return accountFailure();
      }
      return answerHistory(pages, params.accountId, request);
    });
  },
  notFound: () => http.get(accountHistoryPath, accountNotFoundResponse),
};

/** A day of `GET /api/statistics/weekly-comparison`: this week's date and both weeks' cents, `null` after today. */
const comparisonDay = (date: string, lastWeek: number, thisWeek: number | null) => ({
  date,
  lastWeek: usd(lastWeek),
  thisWeek: thisWeek === null ? null : usd(thisWeek),
});

/**
 * The answer a first login gets on Thu 22 Oct 2026 in Belgrade (demo-data.md, "What a first login shows"; task 017
 * AC1): Mon 19 to Sun 25 Oct, last week's values every day, this week's to today, the ticks $0 to $400.
 */
export const demoWeeklyComparison: WeeklyComparisonResponse = {
  days: [
    comparisonDay('2026-10-19', 5_880, 1_064),
    comparisonDay('2026-10-20', 1_064, 2_464),
    comparisonDay('2026-10-21', 2_016, 1_764),
    comparisonDay('2026-10-22', 32_200, 26_600),
    comparisonDay('2026-10-23', 1_478, null),
    comparisonDay('2026-10-24', 18_816, null),
    comparisonDay('2026-10-25', 14_784, null),
  ],
  ticks: [0, 10_000, 20_000, 30_000, 40_000].map(usd),
};

/** Every value of both weeks 0: no ticks, the empty state (#55). */
export const allZeroWeeklyComparison: WeeklyComparisonResponse = {
  days: demoWeeklyComparison.days.map(({ date, thisWeek }) => comparisonDay(date, 0, thisWeek === null ? null : 0)),
  ticks: null,
};

/** This week all 0 with last week's values and their ticks. */
export const quietWeekComparison: WeeklyComparisonResponse = {
  days: demoWeeklyComparison.days.map((day) => ({ ...day, thisWeek: day.thisWeek && usd(0) })),
  ticks: demoWeeklyComparison.ticks,
};

const weeklyComparisonPath = '*/api/statistics/weekly-comparison';

/** `GET /api/statistics/weekly-comparison` answers: the demo, all 0, this week all 0, pending and failing. */
export const weeklyComparison = {
  answers: (body: WeeklyComparisonResponse = demoWeeklyComparison) =>
    http.get(weeklyComparisonPath, () => HttpResponse.json(body)),
  allZero: () => http.get(weeklyComparisonPath, () => HttpResponse.json(allZeroWeeklyComparison)),
  quietWeek: () => http.get(weeklyComparisonPath, () => HttpResponse.json(quietWeekComparison)),
  pending: () =>
    http.get(weeklyComparisonPath, async () => {
      await delay('infinite');
      return HttpResponse.json(demoWeeklyComparison);
    }),
  fails: () =>
    http.get(weeklyComparisonPath, () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 })),
};

type BreakdownCategory = ExpensesBreakdownResponse['categories'][number];
type LineItem = BreakdownCategory['recent'][number];

/** A line item of an Expenses card as the backend sends it: the name, the amount and the time in UTC. */
const lineItem = (item: string, cents: number, occurredAt: string): LineItem => ({
  item,
  amount: usd(cents),
  occurredAt,
});
/** A demo row: every one is stored at 12:00 UTC (demo-data.md). */
const demoLineItem = (item: string, cents: number, date: string) => lineItem(item, cents, `${date}T12:00:00.000Z`);

/**
 * One category of `GET /api/expenses/breakdown`: this month's total so far, its change (null without one) and its 2 most
 * recent Complete expenses of this month, newest first (task 024).
 */
const breakdownCategory = (
  category: BreakdownCategory['category'],
  total: number,
  change: BreakdownCategory['change'],
  recent: LineItem[] = [],
): BreakdownCategory => ({ category, total: usd(total), change, recent });

const up = (percent: number) => ({ percent, direction: 'up' }) as const;
const down = (percent: number) => ({ percent, direction: 'down' }) as const;

/** The 2 most recent Complete expenses of 1 to 22 Oct 2026 per category (task 024 References, AC12). */
export const demoLineItems = {
  housing: [demoLineItem('Parking', 2_016, '2026-10-14'), demoLineItem('House Rent', 23_184, '2026-10-01')],
  food: [demoLineItem('Pizza', 2_464, '2026-10-20'), demoLineItem('Restaurant bill', 14_784, '2026-10-18')],
  transportation: [demoLineItem('Taxi fare', 1_064, '2026-10-19'), demoLineItem('Taxi fare', 1_064, '2026-10-13')],
  entertainment: [demoLineItem('Movie ticket', 1_764, '2026-10-21'), demoLineItem('GTR 5', 18_816, '2026-10-17')],
  shopping: [demoLineItem('Jeans', 26_600, '2026-10-22'), demoLineItem('Shirt', 32_200, '2026-10-15')],
  others: [demoLineItem('Donation', 3_192, '2026-10-11'), demoLineItem('Loan installment', 10_640, '2026-10-10')],
} satisfies Record<BreakdownCategory['category'], LineItem[]>;

/**
 * The answer a first login gets on Thu 22 Oct 2026 in Belgrade: 1 to 22 Oct against all of Sep (demo-data.md, "What a
 * first login shows"; task 018 AC1), with each category's items (task 024 AC12). Overview's card never shows the items.
 */
export const demoExpensesBreakdown: ExpensesBreakdownResponse = {
  categories: [
    breakdownCategory('housing', 25_200, down(17), demoLineItems.housing),
    breakdownCategory('food', 51_004, up(7), demoLineItems.food),
    breakdownCategory('transportation', 5_320, down(32), demoLineItems.transportation),
    breakdownCategory('entertainment', 28_224, up(16), demoLineItems.entertainment),
    breakdownCategory('shopping', 65_800, up(14), demoLineItems.shopping),
    breakdownCategory('others', 13_832, down(31), demoLineItems.others),
  ],
};

/** Last month $0.00 for every category: the totals with no change and their items (task 018 AC5, at 2022-01-15). */
export const noLastMonthBreakdown: ExpensesBreakdownResponse = {
  categories: [
    breakdownCategory('housing', 23_750, null, [
      demoLineItem('Parking', 1_900, '2022-01-14'),
      demoLineItem('House Rent', 21_850, '2022-01-01'),
    ]),
    breakdownCategory('food', 27_379, null, [
      demoLineItem('Pizza', 2_090, '2022-01-08'),
      demoLineItem('Biriyani', 1_254, '2022-01-05'),
    ]),
    breakdownCategory('transportation', 3_611, null, [
      demoLineItem('Taxi fare', 903, '2022-01-13'),
      demoLineItem('Metro Card bill', 1_805, '2022-01-07'),
    ]),
    breakdownCategory('entertainment', 7_410, null, [
      demoLineItem('iTunes', 5_700, '2022-01-12'),
      demoLineItem('Movie ticket', 1_710, '2022-01-06'),
    ]),
    breakdownCategory('shopping', 30_591, null, [
      demoLineItem('Shirt', 25_128, '2022-01-15'),
      demoLineItem('Keyboard', 3_278, '2022-01-09'),
    ]),
    breakdownCategory('others', 11_115, null, [
      demoLineItem('Donation', 2_565, '2022-01-11'),
      demoLineItem('Loan installment', 8_550, '2022-01-10'),
    ]),
  ],
};

/** Nothing in either month: six $0.00 with no change and no item (task 018 AC5, at 2021-12-31). */
export const allZeroBreakdown: ExpensesBreakdownResponse = {
  categories: demoExpensesBreakdown.categories.map(({ category }) => breakdownCategory(category, 0, null)),
};

/**
 * A mix (task 018 AC3, AC14): Housing `0%` with no arrow, Food `$0.00` with `100%` down, Transportation with no change,
 * Entertainment `$1,000,000,000.00`, Shopping and Others as the demo; the items to match.
 */
export const mixedBreakdown: ExpensesBreakdownResponse = {
  categories: [
    breakdownCategory('housing', 20_000, { percent: 0, direction: null }, [
      demoLineItem('House Rent', 20_000, '2026-10-01'),
    ]),
    breakdownCategory('food', 0, down(100)),
    breakdownCategory('transportation', 5_320, null, demoLineItems.transportation),
    breakdownCategory('entertainment', 100_000_000_000, up(250), [
      demoLineItem('Watch', 100_000_000_000, '2026-10-20'),
    ]),
    breakdownCategory('shopping', 65_800, up(14), demoLineItems.shopping),
    breakdownCategory('others', 13_832, down(31), demoLineItems.others),
  ],
};

/**
 * 1 Nov 2026 in Belgrade (task 024 AC14, at 2026-10-31T23:00:00Z): Housing's one item, the House Rent of 1 Nov; the
 * other five `$0.00`, 100% down, with no item.
 */
export const oneItemBreakdown: ExpensesBreakdownResponse = {
  categories: [
    breakdownCategory('housing', 27_048, down(1), [demoLineItem('House Rent', 27_048, '2026-11-01')]),
    breakdownCategory('food', 0, down(100)),
    breakdownCategory('transportation', 0, down(100)),
    breakdownCategory('entertainment', 0, down(100)),
    breakdownCategory('shopping', 0, down(100)),
    breakdownCategory('others', 0, down(100)),
  ],
};

/** A 120-character item name in words, and one with no space (task 024 AC23). */
export const longLineItemInWords = 'Annual premium subscription renewal for the whole family '.repeat(3).slice(0, 120);
export const longLineItemNoSpace = 'Annualpremiumsubscriptionrenewalforthewholefamily'.repeat(3).slice(0, 120);

/**
 * The long data (task 024 AC23): Housing a $1,000,000,000.00 total with an item of that amount and a long name in
 * words, Food a long name with no space; the other four as the demo.
 */
export const longBreakdown: ExpensesBreakdownResponse = {
  categories: [
    breakdownCategory('housing', 100_000_000_000, up(250), [
      demoLineItem(longLineItemInWords, 100_000_000_000, '2026-10-21'),
      demoLineItem('House Rent', 23_184, '2026-10-01'),
    ]),
    breakdownCategory('food', 51_004, up(7), [
      demoLineItem(longLineItemNoSpace, 2_464, '2026-10-20'),
      demoLineItem('Restaurant bill', 14_784, '2026-10-18'),
    ]),
    ...demoExpensesBreakdown.categories.slice(2),
  ],
};

const expensesBreakdownPath = '*/api/expenses/breakdown';

/**
 * `GET /api/expenses/breakdown` answers: the demo, last month $0.00, all $0.00, the mix, one item, the long data,
 * pending, failing, and failing 4 times (the request and its 3 retries) then the demo.
 */
export const expensesBreakdown = {
  answers: (body: ExpensesBreakdownResponse = demoExpensesBreakdown) =>
    http.get(expensesBreakdownPath, () => HttpResponse.json(body)),
  noLastMonth: () => http.get(expensesBreakdownPath, () => HttpResponse.json(noLastMonthBreakdown)),
  allZero: () => http.get(expensesBreakdownPath, () => HttpResponse.json(allZeroBreakdown)),
  mixed: () => http.get(expensesBreakdownPath, () => HttpResponse.json(mixedBreakdown)),
  oneItem: () => http.get(expensesBreakdownPath, () => HttpResponse.json(oneItemBreakdown)),
  long: () => http.get(expensesBreakdownPath, () => HttpResponse.json(longBreakdown)),
  pending: () =>
    http.get(expensesBreakdownPath, async () => {
      await delay('infinite');
      return HttpResponse.json(demoExpensesBreakdown);
    }),
  fails: () =>
    http.get(expensesBreakdownPath, () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 })),
  failsThenAnswers: () => {
    let tries = 0;
    return http.get(expensesBreakdownPath, () => {
      tries += 1;
      return tries <= 4
        ? HttpResponse.json({ message: 'Internal server error' }, { status: 500 })
        : HttpResponse.json(demoExpensesBreakdown);
    });
  },
};

const monthsOf = (year: number) =>
  Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`);

/** A chart answer: the 12 months of `year`, last year's values and this year's (shorter: null after it), the ticks. */
const monthlyAnswer = (
  year: number,
  lastYear: number[],
  thisYear: number[],
  ticks: number[] | null,
): MonthlyComparisonResponse => ({
  months: monthsOf(year).map((month, index) => ({
    month,
    lastYear: usd(lastYear[index]!),
    thisYear: thisYear[index] === undefined ? null : usd(thisYear[index]),
  })),
  ticks: ticks && ticks.map(usd),
});

const year2025 = [
  199_240, 165_261, 179_972, 174_445, 197_844, 247_912, 193_421, 191_231, 180_894, 198_295, 183_411, 234_036,
];
const year2026ToToday = [206_616, 171_383, 186_636, 180_909, 204_616, 255_026, 200_588, 198_312, 187_595, 189_380];
const demoChartTicks = [0, 100_000, 200_000, 300_000, 400_000];
const zeros = Array.from({ length: 12 }, () => 0);

/**
 * The answer a first login gets on Thu 22 Oct 2026 in Belgrade (task 024 References, AC3): 2025 against 2026 to
 * October, Nov and Dec null, the ticks $0 to $4k.
 */
export const demoMonthlyComparison = monthlyAnswer(2026, year2025, year2026ToToday, demoChartTicks);

/** Every value of both years 0 (31 Dec 2021, AC7): no ticks, the empty state. */
export const allZeroMonthlyComparison = monthlyAnswer(2021, zeros, zeros, null);

/** Last year all 0 (15 Jan 2022, AC7): January's teal bar $1,038.56, the ticks $0 to $2k. */
export const lastYearZeroMonthlyComparison = monthlyAnswer(
  2022,
  zeros,
  [103_856],
  [0, 50_000, 100_000, 150_000, 200_000],
);

/** The year change in Belgrade (2026-12-31T23:00:00Z, AC5): 2027's January $266.80 against all of 2026. */
export const newYearMonthlyComparison = monthlyAnswer(
  2027,
  [...year2026ToToday.slice(0, 9), 205_636, 190_204, 242_704],
  [26_680],
  demoChartTicks,
);

const monthlyComparisonPath = '*/api/expenses/monthly-comparison';

/**
 * `GET /api/expenses/monthly-comparison` answers: the demo, all 0, last year all 0, the year change, pending, failing,
 * and failing 4 times (the request and its 3 retries) then the demo.
 */
export const monthlyComparison = {
  answers: (body: MonthlyComparisonResponse = demoMonthlyComparison) =>
    http.get(monthlyComparisonPath, () => HttpResponse.json(body)),
  allZero: () => http.get(monthlyComparisonPath, () => HttpResponse.json(allZeroMonthlyComparison)),
  lastYearZero: () => http.get(monthlyComparisonPath, () => HttpResponse.json(lastYearZeroMonthlyComparison)),
  newYear: () => http.get(monthlyComparisonPath, () => HttpResponse.json(newYearMonthlyComparison)),
  pending: () =>
    http.get(monthlyComparisonPath, async () => {
      await delay('infinite');
      return HttpResponse.json(demoMonthlyComparison);
    }),
  fails: () =>
    http.get(monthlyComparisonPath, () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 })),
  failsThenAnswers: () => {
    let tries = 0;
    return http.get(monthlyComparisonPath, () => {
      tries += 1;
      return tries <= 4
        ? HttpResponse.json({ message: 'Internal server error' }, { status: 500 })
        : HttpResponse.json(demoMonthlyComparison);
    });
  },
};

/**
 * The answers every app test starts with (`setupServer(...signedInDefaults())`), so a test that opens Overview has
 * its accounts, its goal, its bills, its recent transactions, its weekly comparison and its expenses breakdown without
 * asking, one that opens Transactions has its pages, one that opens a demo account's Account Details has its details
 * and history, one that opens Expenses has its monthly comparison and the same expenses breakdown, and one that opens
 * Goals has its months and each month's goal: the demo data of each. A test's own `server.use` comes first.
 */
export const signedInDefaults = () => [
  accounts.answers(),
  savingsGoal.answers(),
  savingsGoalMonths.answers(),
  savingsGoalForMonth.answers(),
  upcomingBills.answers(),
  recentTransactions.answers(),
  weeklyComparison.answers(),
  expensesBreakdown.answers(),
  monthlyComparison.answers(),
  transactions.answers(),
  accountDetails.answers(),
  accountHistory.answers(),
];

/** DataState's root (task 017): where focus goes after Retry, with tabindex="-1" from then on; never a Tab stop. */
const isDataStateRoot = (element: Element) =>
  element.classList.contains(dataStateStyles.root!) && element.getAttribute('tabindex') === '-1';

/** The DataState root inside `container` after a Retry: exactly one. */
export function dataStateRootIn(container: Element): HTMLElement {
  const roots = [...container.querySelectorAll('[tabindex="-1"]')].filter(isDataStateRoot);
  if (roots.length !== 1) throw new Error(`Expected one DataState root, found ${roots.length}`);
  return roots[0] as HTMLElement;
}

/**
 * Every app path in `paths`, with an Account Details path for `/balances/:accountId`: Checking's ID, a demo account
 * the MSW answers (task 021; an unknown ID opens Balances).
 */
export const appPaths = [
  '/overview',
  '/balances',
  '/balances/2',
  '/transactions',
  '/bills',
  '/expenses',
  '/goals',
  '/settings/account',
  '/settings/security',
] as const;

/**
 * The whole app (providers and routes) in a memory router at `initialEntry`; inside `<StrictMode>` with `strict`, as
 * `main.tsx` renders it in development and e2e (it runs effects and ref cleanups twice on mount).
 */
export function renderApp(initialEntry: string, appRoutes: RouteObject[] = routes, { strict = false } = {}) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [initialEntry] });
  const user = userEvent.setup();
  const app = <AppProviders router={router} />;
  const view = render(strict ? <StrictMode>{app}</StrictMode> : app);
  /** The current path, query and hash. */
  const url = () => {
    const { pathname, search, hash } = router.state.location;
    return `${pathname}${search}${hash}`;
  };
  return { router, user, url, ...view };
}
