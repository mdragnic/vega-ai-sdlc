import type { RouteObject } from 'react-router';

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

/** Route table for React Router data mode. Screens are added by later tasks. */
export const routes: RouteObject[] = [{ path: '/', element: <RootPage /> }, ...devRoutes];
