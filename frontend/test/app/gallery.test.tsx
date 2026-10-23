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

const figure = (region: string, name: string) =>
  within(screen.getByRole('region', { name: region })).getByRole('figure', { name });

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

  // Task 003 Scope: the app shell sections.
  it('shows the app shell parts in every listed state', async () => {
    await renderGallery();

    expect(within(figure('NavMenu', 'Active')).getAllByRole('link')).toHaveLength(7);
    expect(within(figure('NavMenu', 'Inactive')).getAllByRole('link')).toHaveLength(7);
    expect(
      within(figure('NavMenu', 'Active'))
        .getAllByRole('link')
        .every((link) => link.getAttribute('aria-current') === 'page'),
    ).toBe(true);
    expect(within(figure('NavMenu', 'Hover')).getAllByRole('link')).toHaveLength(7);

    expect(within(figure('Profile', 'With photo')).getByRole('img', { name: 'Tanzir Rahman' }).tagName).toBe('IMG');
    expect(
      within(figure('Profile', 'Initials, two words')).getByRole('img', { name: 'Tanzir Rahman' }),
    ).toHaveTextContent('TR');
    expect(within(figure('Profile', 'Initials, one word')).getByRole('img', { name: 'Marko' })).toHaveTextContent('M');

    expect(within(figure('Header', 'With greeting')).getByText('Hello Tanzir')).toBeInTheDocument();
    expect(within(figure('Header', 'Without greeting')).queryByText(/Hello/)).toBeNull();

    const like104 = figure('AppLayout', 'Like 104: Overview active, with greeting');
    expect(within(like104).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(within(like104).getByText('Hello Tanzir')).toBeInTheDocument();
    expect(within(like104).getByText('19 May, 2023')).toBeInTheDocument();
    expect(within(like104).getByRole('img', { name: 'Tanzir Rahman' })).toHaveTextContent('TR');

    const like105 = figure('AppLayout', 'Like 105: Balances active, no greeting');
    expect(within(like105).getByRole('link', { name: 'Balances' })).toHaveAttribute('aria-current', 'page');
    expect(within(like105).queryByText(/Hello/)).toBeNull();
  });
});
