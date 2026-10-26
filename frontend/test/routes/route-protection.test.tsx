import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { appPaths, me, renderApp, signedInDefaults } from '../support/app';

const server = setupServer(...signedInDefaults());

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

/** Counts the session checks. */
function countMeRequests(): () => number {
  let count = 0;
  server.events.on('request:start', ({ request }) => {
    if (new URL(request.url).pathname === '/api/auth/me') count += 1;
  });
  return () => count;
}

const loginForm = () => screen.findByRole('button', { name: 'Login' });

// T11: every app path needs a session; Login is for signed-out visitors only (AC12, AC13, #3).
describe('signed out', () => {
  it.each(appPaths)('sends %s to Login with the page as the return target', async (path) => {
    server.use(me.signedOut());
    const { url } = renderApp(path);

    await waitFor(() => expect(url()).toBe(`/login?returnTo=${encodeURIComponent(path)}`));
    expect(await loginForm()).toBeInTheDocument();
  });

  it('keeps the query and hash of the page asked for', async () => {
    server.use(me.signedOut());
    const { url } = renderApp('/balances/12?view=1#top');

    await waitFor(() => expect(url()).toBe('/login?returnTo=%2Fbalances%2F12%3Fview%3D1%23top'));
  });

  it('shows the Login form at /login', async () => {
    server.use(me.signedOut());
    const { url } = renderApp('/login');

    expect(await loginForm()).toBeInTheDocument();
    expect(url()).toBe('/login');
  });
});

describe('signed in', () => {
  it.each(['/login', '/login?returnTo=%2Fbills'])('sends %s to Overview without showing the form', async (path) => {
    server.use(me.signedIn());
    const { url } = renderApp(path);

    await waitFor(() => expect(url()).toBe('/overview'));
    expect(screen.queryByRole('button', { name: 'Login' })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it.each(appPaths)('renders the page frame at %s', async (path) => {
    server.use(me.signedIn());
    const { url } = renderApp(path);

    expect(await screen.findByRole('main')).toBeInTheDocument();
    expect(url()).toBe(path);
  });

  // The replaced history entry: Back from Overview does not reopen Login.
  it('replaces Login in the history', async () => {
    server.use(me.signedIn());
    const { router } = renderApp('/login');

    await waitFor(() => expect(router.state.location.pathname).toBe('/overview'));
    expect(router.state.historyAction).toBe('REPLACE');
  });
});

// T11 and #97 (c): only the page background while the session check runs.
describe('while the session check runs', () => {
  it.each(['/login', '/overview'])('renders nothing on %s', async (path) => {
    server.use(me.pending());
    const { container, url } = renderApp(path);

    // Give the app time to render whatever it would render while waiting.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container).toBeEmptyDOMElement();
    expect(url()).toBe(path);
  });
});

// T13: a failing first session check, when the app opens, counts as signed out, with no retry (AC16, #97 b).
// A failing re-check after that is in session-end.test.tsx (#98).
describe('when the first session check fails', () => {
  const failures = {
    'a 500': () =>
      http.get('*/api/auth/me', () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 })),
    'a network error': () => http.get('*/api/auth/me', () => HttpResponse.error()),
  };

  it.each(Object.keys(failures) as (keyof typeof failures)[])(
    'sends an app path to Login with its return target on %s, checking once',
    async (failure) => {
      server.use(failures[failure]());
      const meRequests = countMeRequests();
      const { url } = renderApp('/overview');

      await waitFor(() => expect(url()).toBe('/login?returnTo=%2Foverview'));
      expect(await loginForm()).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Email Address' })).toBeInTheDocument();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(meRequests()).toBe(1);
    },
  );

  it.each(Object.keys(failures) as (keyof typeof failures)[])(
    'shows the Login form on %s, checking once',
    async (failure) => {
      server.use(failures[failure]());
      const meRequests = countMeRequests();
      const { url } = renderApp('/login');

      expect(await loginForm()).toBeInTheDocument();
      expect(url()).toBe('/login');
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(meRequests()).toBe(1);
    },
  );
});

// T15: the development pages stay outside the guards (AC18). `/` is no page: it opens Overview (task 011, #39).
describe('outside the guards', () => {
  it('sends / signed out to Login for Overview', async () => {
    server.use(me.signedOut());
    const { url } = renderApp('/');

    await waitFor(() => expect(url()).toBe('/login?returnTo=%2Foverview'));
    expect(await loginForm()).toBeInTheDocument();
  });

  it('renders /dev/components signed out', async () => {
    server.use(me.signedOut());
    const { url } = renderApp('/dev/components');

    // The route's lazy chunk is compiled on its first import, which takes longer while the whole suite runs.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Component gallery' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(url()).toBe('/dev/components');
  });

  it('renders /dev/popup signed out', async () => {
    server.use(me.signedOut());
    const { url } = renderApp('/dev/popup');

    expect(await screen.findByRole('button', { name: 'Open two-field popup' }, { timeout: 5000 })).toBeInTheDocument();
    expect(url()).toBe('/dev/popup');
  });
});
