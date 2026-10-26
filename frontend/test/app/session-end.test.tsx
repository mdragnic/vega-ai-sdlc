import { type ContractEntry, type ErrorResponse, authMessages } from '@finebank/shared';
import { act, screen, waitFor } from '@testing-library/react';
import { focusManager, type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { useEffect } from 'react';
import { setupServer } from 'msw/node';
import type { RouteObject } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { apiRequest } from '../../src/api/client';
import { LoginPage } from '../../src/app/pages/LoginPage';
import { GuestOnly } from '../../src/routes/GuestOnly';
import { RequireAuth } from '../../src/routes/RequireAuth';
import { authenticationRequired, me, renderApp, signedInDefaults, signedInUser } from '../support/app';

const server = setupServer(...signedInDefaults());

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
  vi.restoreAllMocks();
  // Hand window focus back to the browser events, also after a failed test.
  focusManager.setFocused(undefined);
});
afterAll(() => server.close());

const balance = {
  method: 'GET',
  path: '/probe/balance',
  request: undefined,
  response: z.object({ cents: z.number() }),
} satisfies ContractEntry;

const rename = {
  method: 'POST',
  path: '/probe/rename',
  request: z.object({ name: z.string() }),
  response: z.object({ name: z.string() }),
} satisfies ContractEntry;

const unauthorized = () => HttpResponse.json(authenticationRequired satisfies ErrorResponse, { status: 401 });

/** Session checks that fail with something other than 401. */
const meFailures = {
  'a 500': () =>
    http.get('*/api/auth/me', () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 })),
  'a network error': () => http.get('*/api/auth/me', () => HttpResponse.error()),
};

/** The query client the app uses, captured from inside it. */
let appClient: QueryClient | undefined;

function ClientProbe() {
  const client = useQueryClient();
  useEffect(() => {
    appClient = client;
  }, [client]);
  return null;
}

/** An app page with this user's data (a query) and an action (a mutation). */
function BillsPage() {
  const query = useQuery({ queryKey: ['balance'], queryFn: () => apiRequest(balance) });
  const mutation = useMutation({ mutationFn: () => apiRequest(rename, { name: 'Savings' }) });
  return (
    <main>
      <ClientProbe />
      <p>{query.data ? `Balance ${query.data.cents}` : 'Loading'}</p>
      <button type="button" onClick={() => mutation.mutate()}>
        Rename
      </button>
    </main>
  );
}

const testRoutes: RouteObject[] = [
  {
    element: <GuestOnly />,
    children: [
      {
        path: '/login',
        element: (
          <>
            <ClientProbe />
            <LoginPage />
          </>
        ),
      },
    ],
  },
  { element: <RequireAuth />, children: [{ path: '/bills', element: <BillsPage /> }] },
];

/** Every cached query key, as JSON, with the data of the session. */
const cacheContents = () =>
  appClient!
    .getQueryCache()
    .getAll()
    .map((query) => ({ key: JSON.stringify(query.queryKey), data: query.state.data }));

/** Counts requests to one path. */
function countRequests(path: string): () => number {
  let count = 0;
  server.events.on('request:start', ({ request }) => {
    if (new URL(request.url).pathname === path) count += 1;
  });
  return () => count;
}

// T12: a 401 while the app is open ends the session in the app: Login opens with the page as the return target,
// and this user's cached data is gone (AC15; #3, #39, #75).
describe('a session that ends while the app is open', () => {
  it('opens Login and removes the cached data when a query gets 401', async () => {
    server.use(
      me.signedIn(),
      http.get('*/api/probe/balance', () => HttpResponse.json({ cents: 2505600 })),
    );
    const { url } = renderApp('/bills', testRoutes);
    expect(await screen.findByText('Balance 2505600')).toBeInTheDocument();
    expect(cacheContents()).toContainEqual({ key: '["balance"]', data: { cents: 2505600 } });

    server.use(http.get('*/api/probe/balance', unauthorized));
    const balanceRequests = countRequests('/api/probe/balance');
    await act(() => appClient!.refetchQueries({ queryKey: ['balance'] }));

    await waitFor(() => expect(url()).toBe('/login?returnTo=%2Fbills'));
    expect(await screen.findByRole('button', { name: 'Login' })).toBeInTheDocument();
    expect(cacheContents()).toEqual([{ key: '["session"]', data: null }]);
    // A 401 is not retried.
    expect(balanceRequests()).toBe(1);
  });

  it('opens Login and removes the cached data when a mutation gets 401', async () => {
    server.use(
      me.signedIn(),
      http.get('*/api/probe/balance', () => HttpResponse.json({ cents: 2505600 })),
      http.post('*/api/probe/rename', unauthorized),
    );
    const { user, url } = renderApp('/bills', testRoutes);
    expect(await screen.findByText('Balance 2505600')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Rename' }));

    await waitFor(() => expect(url()).toBe('/login?returnTo=%2Fbills'));
    expect(cacheContents()).toEqual([{ key: '["session"]', data: null }]);
  });

  it('opens Login when the session check on window focus gets 401', async () => {
    server.use(
      me.signedIn(),
      http.get('*/api/probe/balance', () => HttpResponse.json({ cents: 2505600 })),
    );
    const { url } = renderApp('/bills', testRoutes);
    expect(await screen.findByText('Balance 2505600')).toBeInTheDocument();

    server.use(me.signedOut());
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });

    await waitFor(() => expect(url()).toBe('/login?returnTo=%2Fbills'));
    expect(cacheContents()).toEqual([{ key: '["session"]', data: null }]);
  });

  // A 401 already removes the cached data (above), and a failed re-check keeps the session (#98), so nothing
  // leaves an earlier user's data on Login today. The login removes any anyway (#39); the test puts some there.
  it('shows a new user none of the earlier data after they log in', async () => {
    server.use(me.signedOut());
    const { user, url } = renderApp('/login?returnTo=%2Fbills', testRoutes);
    await screen.findByRole('button', { name: 'Login' });
    act(() => {
      appClient!.setQueryData(['balance'], { cents: 2505600 });
    });

    const { promise: balanceReleased, resolve: releaseBalance } = Promise.withResolvers<void>();
    server.use(
      http.post('*/api/auth/login', () => HttpResponse.json({ ...signedInUser, email: 'second@example.com' })),
      http.get('*/api/probe/balance', async () => {
        await balanceReleased;
        return HttpResponse.json({ cents: 100 });
      }),
    );
    await user.type(screen.getByRole('textbox', { name: 'Email Address' }), 'second@example.com');
    await user.type(screen.getByLabelText('Password'), 'abcdef12');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => expect(url()).toBe('/bills'));
    // The second user's balance is still loading: the first user's is not shown meanwhile.
    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(screen.queryByText('Balance 2505600')).toBeNull();
    releaseBalance();
    expect(await screen.findByText('Balance 100')).toBeInTheDocument();
  });

  // A session check sent before the login, answered 401 after it, must not end the new session (code review).
  it('keeps the new session when a session check sent before the login fails after it', async () => {
    const { promise: meHeld, resolve: releaseMe } = Promise.withResolvers<void>();
    let meRequests = 0;
    server.use(
      http.get('*/api/auth/me', async () => {
        meRequests += 1;
        if (meRequests > 1) await meHeld;
        return unauthorized();
      }),
      http.post('*/api/auth/login', () => HttpResponse.json(signedInUser)),
      http.get('*/api/probe/balance', () => HttpResponse.json({ cents: 2505600 })),
    );
    const { user, url } = renderApp('/login?returnTo=%2Fbills', testRoutes);
    await screen.findByRole('button', { name: 'Login' });
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(meRequests).toBe(2));

    await user.type(screen.getByRole('textbox', { name: 'Email Address' }), 'tanzir@example.com');
    await user.type(screen.getByLabelText('Password'), 'abcdef12');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(await screen.findByText('Balance 2505600')).toBeInTheDocument();
    releaseMe();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(url()).toBe('/bills');
    expect(screen.getByText('Balance 2505600')).toBeInTheDocument();
  });

  it("leaves the session and the cache alone on a failed login's 401", async () => {
    server.use(
      me.signedOut(),
      http.post('*/api/auth/login', () =>
        HttpResponse.json({ message: authMessages.invalidCredentials } satisfies ErrorResponse, { status: 401 }),
      ),
    );
    const { user, url } = renderApp('/login', testRoutes);
    await screen.findByRole('button', { name: 'Login' });
    act(() => {
      appClient!.setQueryData(['unrelated'], 'kept');
    });

    await user.type(screen.getByRole('textbox', { name: 'Email Address' }), 'tanzir@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect');
    expect(url()).toBe('/login');
    expect(cacheContents()).toContainEqual({ key: '["unrelated"]', data: 'kept' });
  });
});

// T13: only the first check counts a failure that is not a 401 as signed out (#97 b). After that only a 401 ends
// the session: a failed re-check keeps the user, the page and its data, and the next focus checks again (AC16, #98).
describe('a session re-check that fails with something other than 401', () => {
  it.each(Object.keys(meFailures) as (keyof typeof meFailures)[])(
    'keeps the user on the page with its data on %s, until a 401',
    async (failure) => {
      server.use(
        me.signedIn(),
        http.get('*/api/probe/balance', () => HttpResponse.json({ cents: 2505600 })),
      );
      const { url } = renderApp('/bills', testRoutes);
      expect(await screen.findByText('Balance 2505600')).toBeInTheDocument();

      server.use(meFailures[failure]());
      const meRequests = countRequests('/api/auth/me');
      act(() => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
      });
      await waitFor(() => expect(appClient!.getQueryState(['session'])?.status).toBe('error'));
      // Give the app time to act on the failure, and to retry the check if it did.
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(url()).toBe('/bills');
      expect(screen.getByText('Balance 2505600')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Login' })).toBeNull();
      expect(cacheContents()).toContainEqual({ key: '["balance"]', data: { cents: 2505600 } });
      expect(meRequests()).toBe(1);

      server.use(me.signedOut());
      act(() => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
      });

      await waitFor(() => expect(url()).toBe('/login?returnTo=%2Fbills'));
      expect(meRequests()).toBe(2);
      expect(cacheContents()).toEqual([{ key: '["session"]', data: null }]);
    },
  );

  it('keeps a user who logged in after a failed first check', async () => {
    server.use(
      meFailures['a 500'](),
      http.post('*/api/auth/login', () => HttpResponse.json(signedInUser)),
      http.get('*/api/probe/balance', () => HttpResponse.json({ cents: 2505600 })),
    );
    const { user, url } = renderApp('/bills', testRoutes);
    await waitFor(() => expect(url()).toBe('/login?returnTo=%2Fbills'));
    await user.type(await screen.findByRole('textbox', { name: 'Email Address' }), 'tanzir@example.com');
    await user.type(screen.getByLabelText('Password'), 'abcdef12');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(await screen.findByText('Balance 2505600')).toBeInTheDocument();

    server.use(meFailures['a network error']());
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(appClient!.getQueryState(['session'])?.status).toBe('error'));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(url()).toBe('/bills');
    expect(screen.getByText('Balance 2505600')).toBeInTheDocument();
  });
});
