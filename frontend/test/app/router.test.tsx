import { render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '../../src/app/AppProviders';
import { routes } from '../../src/app/routes';

afterEach(() => {
  vi.restoreAllMocks();
});

// T12: the router renders the root page (AC2).
describe('router', () => {
  it('renders the root page at / without errors', async () => {
    const consoleError = vi.spyOn(console, 'error');
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });

    render(<AppProviders router={router} />);

    expect(await screen.findByRole('main')).toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
