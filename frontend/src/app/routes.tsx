import type { RouteObject } from 'react-router';

import { GuestOnly } from '../routes/GuestOnly';
import { paths } from '../routes/paths';
import { RequireAuth } from '../routes/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { RootPage } from './RootPage';

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

/** Every app page needs a session (#3). Until the shell and the screens exist, each renders the empty page frame. */
const appPaths = [
  paths.overview,
  paths.balances,
  paths.accountDetails,
  paths.transactions,
  paths.bills,
  paths.expenses,
  paths.goals,
  paths.settingsAccount,
  paths.settingsSecurity,
];

/** Route table for React Router data mode. Screens are added by later tasks. */
export const routes: RouteObject[] = [
  { path: '/', element: <RootPage /> },
  { element: <GuestOnly />, children: [{ path: paths.login, element: <LoginPage /> }] },
  { element: <RequireAuth />, children: appPaths.map((path) => ({ path, element: <RootPage /> })) },
  ...devRoutes,
];
