import type { RouteObject } from 'react-router';

import { RootPage } from './RootPage';

/** Route table for React Router data mode. Screens are added by later tasks. */
export const routes: RouteObject[] = [{ path: '/', element: <RootPage /> }];
