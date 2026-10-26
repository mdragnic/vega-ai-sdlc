import { screen, waitFor } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { me, renderApp, today } from '../support/app';

const server = setupServer();

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

  it.each(['/', '/foo'])('opens Login with Overview as the return target at %s when signed out', async (path) => {
    const consoleError = vi.spyOn(console, 'error');
    server.use(me.signedOut());
    const { url } = renderApp(path);

    await waitFor(() => expect(url()).toBe('/login?returnTo=%2Foverview'));
    expect(await screen.findByRole('button', { name: 'Login' })).toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
