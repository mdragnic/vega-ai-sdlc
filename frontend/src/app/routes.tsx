import type { ReactNode } from 'react';
import { Navigate, type RouteObject } from 'react-router';

import { GuestOnly } from '../routes/GuestOnly';
import { paths } from '../routes/paths';
import { RequireAuth } from '../routes/RequireAuth';
import { AppShell, type ShellHandle } from './AppShell';
import { BalancesPage } from './pages/BalancesPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { SignUpPage } from './pages/SignUpPage';

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

/**
 * Every app page needs a session (#3) and opens in the shell, with its sidebar section (Account Details is
 * Balances, #47) and the greeting on Overview only (#10). The screens fill their content from task 013 on.
 */
const appPages: { path: string; handle: ShellHandle; element?: ReactNode }[] = [
  { path: paths.overview, handle: { section: 'overview', greeting: true }, element: <OverviewPage /> },
  { path: paths.balances, handle: { section: 'balances' }, element: <BalancesPage /> },
  { path: paths.accountDetails, handle: { section: 'balances' } },
  { path: paths.transactions, handle: { section: 'transactions' } },
  { path: paths.bills, handle: { section: 'bills' } },
  { path: paths.expenses, handle: { section: 'expenses' } },
  { path: paths.goals, handle: { section: 'goals' } },
  { path: paths.settingsAccount, handle: { section: 'settings' } },
  { path: paths.settingsSecurity, handle: { section: 'settings' } },
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
      { element: <AppShell />, children: appPages.map(({ element = null, ...page }) => ({ ...page, element })) },
    ],
  },
  // Settings opens on its Account tab, whose guard handles a signed-out visitor (#100).
  { path: paths.settings, element: <Navigate replace to={paths.settingsAccount} /> },
  ...devRoutes,
  // No not-found page: `/` and unknown URLs open Overview, or Login through its guard when signed out (#39).
  { path: '/', element: <Navigate replace to={paths.overview} /> },
  { path: '*', element: <Navigate replace to={paths.overview} /> },
];
