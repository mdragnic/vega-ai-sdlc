import type { AccountsResponse, CurrentUser, ErrorResponse } from '@finebank/shared';
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

/**
 * The answers every app test starts with (`setupServer(...signedInDefaults())`), so a test that opens Overview has
 * its accounts without asking: the demo accounts. A test's own `server.use` comes first.
 */
export const signedInDefaults = () => [accounts.answers()];

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
