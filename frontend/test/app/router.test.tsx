import { screen, waitFor } from '@testing-library/react';
import { setupServer } from 'msw/node';
import type { RouteObject } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { routes } from '../../src/app/routes';
import { me, renderApp, signedInDefaults, today } from '../support/app';

const server = setupServer(...signedInDefaults());

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

// T13: no not-found page. `/` and unknown URLs open Overview, or Login with Overview as the return target when
// signed out (AC15; #3, #39).
describe('router', () => {
  it.each(['/', '/foo', '/overview/extra', '/settings/foo'])(
    'opens Overview at %s when signed in, replacing that URL, without errors',
    async (path) => {
      const consoleError = vi.spyOn(console, 'error');
      server.use(me.signedIn(), today.answers());
      const { router, url } = renderApp(path);

      await waitFor(() => expect(url()).toBe('/overview'));
      expect(router.state.historyAction).toBe('REPLACE');
      expect(await screen.findByText('Hello Tanzir')).toBeInTheDocument();
      expect(consoleError).not.toHaveBeenCalled();
    },
  );

  // Task 023 T22, AC20: the scroll fixture pages exist only in the e2e run (VITE_E2E_FIXTURES), never here.
  it.each(['/test/scroll/a', '/test/scroll/b'])(
    'opens Overview at %s when signed in: no fixture route without VITE_E2E_FIXTURES',
    async (path) => {
      server.use(me.signedIn(), today.answers());
      const { url } = renderApp(path);

      await waitFor(() => expect(url()).toBe('/overview'));
      expect(await screen.findByText('Hello Tanzir')).toBeInTheDocument();
    },
  );

  it('has no fixture route in the route table without VITE_E2E_FIXTURES', () => {
    const allPaths = (table: RouteObject[]): string[] =>
      table.flatMap((route) => [...(route.path === undefined ? [] : [route.path]), ...allPaths(route.children ?? [])]);

    expect(import.meta.env.VITE_E2E_FIXTURES).toBeUndefined();
    expect(allPaths(routes).filter((path) => path.startsWith('/test'))).toEqual([]);
    expect(allPaths(routes)).toContain('/bills');
  });

  it.each(['/', '/foo'])('opens Login with Overview as the return target at %s when signed out', async (path) => {
    const consoleError = vi.spyOn(console, 'error');
    server.use(me.signedOut());
    const { url } = renderApp(path);

    await waitFor(() => expect(url()).toBe('/login?returnTo=%2Foverview'));
    expect(await screen.findByRole('button', { name: 'Login' })).toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
