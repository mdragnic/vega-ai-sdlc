import type { CurrentUser, ErrorResponse } from '@finebank/shared';
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
