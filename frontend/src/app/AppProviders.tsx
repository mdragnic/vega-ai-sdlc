import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import { createQueryClient } from '../api/session';

type AppRouter = ReturnType<typeof createBrowserRouter>;

/** Everything the app renders inside: the TanStack Query client (which ends the session on a 401) and the router. */
export function AppProviders({ router }: { router: AppRouter }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
