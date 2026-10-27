import {
  type AccountsResponse,
  type CurrentUser,
  type ErrorResponse,
  goalProgress,
  type RecentTransactionRow,
  type RecentTransactionsResponse,
  type SavingsGoalRequest,
  type SavingsGoalResponse,
  type UpcomingBillsResponse,
} from '@finebank/shared';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { createMemoryRouter, type RouteObject } from 'react-router';

import { AppProviders } from '../../src/app/AppProviders';
import { routes } from '../../src/app/routes';

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

/** The demo accounts on 22 Oct 2026 as `GET /api/accounts` returns them (demo-data.md, task 013 AC1, AC2). */
export const demoAccounts: AccountsResponse = {
  totalBalance: usd(13_025_467),
  accounts: [
    {
      id: 1,
      accountType: 'credit-card',
      cardNetwork: 'mastercard',
      maskedNumber: '**** **** **** 2598',
      balance: usd(2_101_918),
    },
    {
      id: 2,
      accountType: 'checking',
      cardNetwork: 'visa',
      maskedNumber: '**** **** **** 7310',
      balance: usd(3_336_248),
    },
    { id: 3, accountType: 'savings', cardNetwork: null, maskedNumber: '**** **** **** 4421', balance: usd(2_735_680) },
    {
      id: 4,
      accountType: 'investment',
      cardNetwork: null,
      maskedNumber: '**** **** **** 6652',
      balance: usd(2_950_300),
    },
    { id: 5, accountType: 'loan', cardNetwork: null, maskedNumber: '**** **** **** 9083', balance: usd(1_901_321) },
  ],
};

/** `GET /api/accounts` answers. */
export const accounts = {
  answers: (body: AccountsResponse = demoAccounts) => http.get('*/api/accounts', () => HttpResponse.json(body)),
  pending: () =>
    http.get('*/api/accounts', async () => {
      await delay('infinite');
      return HttpResponse.json(demoAccounts);
    }),
  fails: () =>
    http.get('*/api/accounts', () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 })),
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

/**
 * A backend's goal for one test: `GET /api/savings-goals/current` answers it; `PUT /api/savings-goals` records the
 * body, saves it with the progress from `goalProgress`, as the backend does, and answers it.
 */
export function goalBackend(initial: SavingsGoalResponse = demoGoal) {
  let current = initial;
  const saved: SavingsGoalRequest[] = [];
  const handlers = [
    http.get(currentGoalPath, () => HttpResponse.json(current)),
    http.put(saveGoalPath, async ({ request }) => {
      const body = (await request.json()) as SavingsGoalRequest;
      saved.push(body);
      current = {
        month: body.month,
        goal: { target: body.target, present: body.present, progress: goalProgress(body.present, body.target) },
      };
      return HttpResponse.json(current);
    }),
  ];
  return { handlers, saved };
}

/** A bill as `GET /api/bills/upcoming` sends it. */
type UpcomingBillBody = UpcomingBillsResponse['bills'][number];

/** The demo bills due in a year (demo-data.md, Bills). */
export const demoFigmaBill = (year: number): UpcomingBillBody => ({
  title: 'Figma - Yearly Plan',
  logo: 'figma',
  dueDate: `${year}-05-15`,
  lastChargeDate: `${year - 1}-05-14`,
  amount: usd(15_000),
});
export const demoAdobeBill = (year: number): UpcomingBillBody => ({
  title: 'Adobe Inc - Yearly Plan',
  logo: 'adobe',
  dueDate: `${year}-06-16`,
  lastChargeDate: `${year - 1}-06-17`,
  amount: usd(55_900),
});

/** The 4 upcoming bills a first login gets on 22 Oct 2026, soonest first (demo-data.md; task 015 AC1, AC2). */
export const demoBills: UpcomingBillsResponse = {
  bills: [demoFigmaBill(2027), demoAdobeBill(2027), demoFigmaBill(2028), demoAdobeBill(2028)],
};

const upcomingBillsPath = '*/api/bills/upcoming';

/** `GET /api/bills/upcoming` answers: the demo, none, one (Adobe due 16 Jun 2028), pending and failing. */
export const upcomingBills = {
  answers: (body: UpcomingBillsResponse = demoBills) => http.get(upcomingBillsPath, () => HttpResponse.json(body)),
  none: () => http.get(upcomingBillsPath, () => HttpResponse.json({ bills: [] })),
  one: () => http.get(upcomingBillsPath, () => HttpResponse.json({ bills: [demoAdobeBill(2028)] })),
  pending: () =>
    http.get(upcomingBillsPath, async () => {
      await delay('infinite');
      return HttpResponse.json(demoBills);
    }),
  fails: () =>
    http.get(upcomingBillsPath, () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 })),
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

/**
 * The answers every app test starts with (`setupServer(...signedInDefaults())`), so a test that opens Overview has
 * its accounts, its goal, its bills and its recent transactions without asking: the demo data of each. A test's own
 * `server.use` comes first.
 */
export const signedInDefaults = () => [
  accounts.answers(),
  savingsGoal.answers(),
  upcomingBills.answers(),
  recentTransactions.answers(),
];

/** Every app path in `paths`, with an Account Details path for `/balances/:accountId`. */
export const appPaths = [
  '/overview',
  '/balances',
  '/balances/12',
  '/transactions',
  '/bills',
  '/expenses',
  '/goals',
  '/settings/account',
  '/settings/security',
] as const;

/** The whole app (providers and routes) in a memory router at `initialEntry`. */
export function renderApp(initialEntry: string, appRoutes: RouteObject[] = routes) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [initialEntry] });
  const user = userEvent.setup();
  const view = render(<AppProviders router={router} />);
  /** The current path, query and hash. */
  const url = () => {
    const { pathname, search, hash } = router.state.location;
    return `${pathname}${search}${hash}`;
  };
  return { router, user, url, ...view };
}
