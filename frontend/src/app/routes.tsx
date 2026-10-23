import type { RouteObject } from 'react-router';

import { RootPage } from './RootPage';

// The component gallery exists in development only. Vite replaces import.meta.env.DEV with false in a
// production build, so this route and its lazy chunk are dropped from the bundle (test/app/gallery-build.test.ts).
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: '/dev/components',
        lazy: async () => ({ Component: (await import('./dev/ComponentGallery')).ComponentGallery }),
        // Opened directly, the route renders nothing while its chunk loads (React Router warns otherwise).
        HydrateFallback: () => null,
      },
    ]
  : [];

/** Route table for React Router data mode. Screens are added by later tasks. */
export const routes: RouteObject[] = [{ path: '/', element: <RootPage /> }, ...devRoutes];
