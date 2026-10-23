import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';

type AppRouter = ReturnType<typeof createBrowserRouter>;

/** Everything the app renders inside: the TanStack Query client and the router. */
export function AppProviders({ router }: { router: AppRouter }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
