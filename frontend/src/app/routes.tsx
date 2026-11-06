import type { ReactNode } from 'react';
import { Navigate, type RouteObject } from 'react-router';

import { GuestOnly } from '../routes/GuestOnly';
import { paths } from '../routes/paths';
import { RequireAuth } from '../routes/RequireAuth';
import { AppShell, type ShellHandle } from './AppShell';
import { AccountDetailsPage } from './pages/AccountDetailsPage';
import { BalancesPage } from './pages/BalancesPage';
import { BillsPage } from './pages/BillsPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { GoalsPage } from './pages/GoalsPage';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { SignUpPage } from './pages/SignUpPage';
import { TransactionsPage } from './pages/TransactionsPage';

// The component gallery and the popup page exist in development only. Vite replaces import.meta.env.DEV with
// false in a production build, so these routes and their lazy chunks are dropped from the bundle
// (test/app/gallery-build.test.ts).
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: '/dev/components',
        lazy: async () => ({ Component: (await import('./dev/ComponentGallery')).ComponentGallery }),
        // Opened directly, the route renders nothing while its chunk loads (React Router warns otherwise).
        HydrateFallback: () => null,
      },
      {
        path: '/dev/popup',
        lazy: async () => ({ Component: (await import('./dev/PopupDemo')).PopupDemo }),
        HydrateFallback: () => null,
      },
    ]
  : [];

/** The two pages of the e2e scroll fixture, each with a link to the other. */
const scrollFixturePaths = { a: '/test/scroll/a', b: '/test/scroll/b' } as const;

// Task 011's scroll tests need pages taller than the window inside the shell (e2e app-shell-slice T26, T27): two
// fixture pages that never depend on a real page being empty (Marko, task 023). They exist only in the dev server
// Playwright starts, which sets VITE_E2E_FIXTURES: never in `npm run dev`, the unit tests or a production build, where
// Vite replaces import.meta.env.DEV with false and drops them (test/app/gallery-build.test.ts).
const scrollFixtureRoutes: RouteObject[] =
  import.meta.env.DEV && import.meta.env.VITE_E2E_FIXTURES === 'true'
    ? (
        [
          [scrollFixturePaths.a, scrollFixturePaths.b],
          [scrollFixturePaths.b, scrollFixturePaths.a],
        ] as const
      ).map(([path, other]) => ({
        path,
        // The shell's handle needs a section; the tests do not read it.
        handle: { section: 'overview' } satisfies ShellHandle,
        lazy: async () => {
          const { ScrollFixture } = await import('./test-fixtures/ScrollFixture');
          return { element: <ScrollFixture otherPage={other} /> };
        },
        HydrateFallback: () => null,
      }))
    : [];

/**
 * Every app page needs a session (#3) and opens in the shell, with its sidebar section (Account Details is
 * Balances, #47) and the greeting on Overview only (#10). The screens fill their content from task 013 on; Settings from
 * task 028.
 */
const appPages: { path: string; handle: ShellHandle; element?: ReactNode }[] = [
  { path: paths.overview, handle: { section: 'overview', greeting: true }, element: <OverviewPage /> },
  { path: paths.balances, handle: { section: 'balances' }, element: <BalancesPage /> },
  { path: paths.accountDetails, handle: { section: 'balances' }, element: <AccountDetailsPage /> },
  { path: paths.transactions, handle: { section: 'transactions' }, element: <TransactionsPage /> },
  { path: paths.bills, handle: { section: 'bills' }, element: <BillsPage /> },
  { path: paths.expenses, handle: { section: 'expenses' }, element: <ExpensesPage /> },
  { path: paths.goals, handle: { section: 'goals' }, element: <GoalsPage /> },
  // One page for both tabs, kept mounted across them (task 028): the same element type at the same place.
  { path: paths.settingsAccount, handle: { section: 'settings' }, element: <SettingsPage /> },
  { path: paths.settingsSecurity, handle: { section: 'settings' }, element: <SettingsPage /> },
];

/** Route table for React Router data mode. Screens are added by later tasks. */
export const routes: RouteObject[] = [
  {
    element: <GuestOnly />,
    children: [
      { path: paths.login, element: <LoginPage /> },
      { path: paths.signUp, element: <SignUpPage /> },
      { path: paths.forgotPassword, element: <ForgotPasswordPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    // `element: null` until the screen exists: an empty content area, without React Router's empty-route warning.
    children: [
      {
        element: <AppShell />,
        children: [...appPages.map(({ element = null, ...page }) => ({ ...page, element })), ...scrollFixtureRoutes],
      },
    ],
  },
  // Settings opens on its Account tab, whose guard handles a signed-out visitor (#100).
  { path: paths.settings, element: <Navigate replace to={paths.settingsAccount} /> },
  ...devRoutes,
  // No not-found page: `/` and unknown URLs open Overview, or Login through its guard when signed out (#39).
  { path: '/', element: <Navigate replace to={paths.overview} /> },
  { path: '*', element: <Navigate replace to={paths.overview} /> },
];
