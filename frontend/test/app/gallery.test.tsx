import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '../../src/app/AppProviders';
import { routes } from '../../src/app/routes';
import * as components from '../../src/components';

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderGallery() {
  const router = createMemoryRouter(routes, { initialEntries: ['/dev/components'] });
  render(<AppProviders router={router} />);
  return screen.findByRole('heading', { level: 1, name: 'Component gallery' });
}

// The dev gallery (AC12): one section per shared component. Vitest runs in development mode.
describe('component gallery', () => {
  it('has a section for every exported component', async () => {
    const consoleError = vi.spyOn(console, 'error');

    await renderGallery();

    for (const name of Object.keys(components)) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('shows the undesigned states', async () => {
    await renderGallery();

    const input = screen.getByRole('region', { name: 'Input' });
    expect(within(input).getByRole('figure', { name: 'Field error' })).toHaveTextContent('Email is required');
    expect(within(input).getByRole('button', { name: 'Hide password' })).toBeInTheDocument();

    const primary = screen.getByRole('region', { name: 'ButtonPrimary' });
    expect(within(within(primary).getByRole('figure', { name: 'Disabled' })).getByRole('button')).toBeDisabled();
    expect(within(within(primary).getByRole('figure', { name: 'Loading' })).getByRole('button')).toHaveAttribute(
      'aria-busy',
      'true',
    );

    const remindMe = screen.getByRole('region', { name: 'RemindMe' });
    expect(within(within(remindMe).getByRole('figure', { name: 'Unchecked' })).getByRole('checkbox')).toHaveAttribute(
      'aria-checked',
      'false',
    );

    expect(within(screen.getByRole('region', { name: 'FormError' })).getByRole('alert')).toBeInTheDocument();
  });
});
