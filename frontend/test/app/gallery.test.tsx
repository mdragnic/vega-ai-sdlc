import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  // Task 004 Scope: the content components.
  it('shows the content components in every listed state', async () => {
    await renderGallery();

    expect(
      within(figure('Section', 'Plain, like 104 Total Balance')).getByRole('region', { name: 'Total Balance' }),
    ).toBeInTheDocument();
    expect(
      within(figure('Section', 'With View All, like 104 Upcoming Bill')).getByRole('link', { name: 'View All' }),
    ).toHaveAccessibleDescription('Upcoming Bill');
    expect(
      within(figure('Section', 'With the note, like 104 Expenses Breakdown')).getByText('*Compare to last month'),
    ).toBeInTheDocument();

    for (const [name, label] of [
      ['All active', 'All'],
      ['Revenue active', 'Revenue'],
      ['Expenses active', 'Expenses'],
    ] as const) {
      expect(within(figure('MenuTab', name)).getByRole('tab', { name: label })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    }
    expect(within(figure('MenuTab', 'Interactive')).getAllByRole('tab')).toHaveLength(3);

    for (const variant of [
      'Recent Transaction (104)',
      'Expenses Breakdown (104)',
      'Card header (109)',
      'Goals (110)',
    ]) {
      const icons = within(figure('CategoryIcon', variant)).getAllByRole('img');
      expect(icons.map((icon) => icon.getAttribute('aria-label'))).toEqual([
        'Housing',
        'Food',
        'Transportation',
        'Entertainment',
        'Shopping',
        'Others',
        'Income',
      ]);
    }
    expect(within(figure('CategoryIcon', 'Table row (107)')).getAllByRole('img')).toHaveLength(7);

    for (const size of ['Compact (104)', 'Large (108)']) {
      const dates = [...figure('DateBox', size).querySelectorAll('time')];
      expect(dates.map((time) => time.getAttribute('datetime'))).toEqual(['2023-05-15', '2023-06-16', '2023-09-05']);
      expect(within(figure('AmountBox', size)).getByText('$1,000,000,000.00')).toBeInTheDocument();
    }

    expect(figure('DataState', 'Loading').querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(await within(figure('DataState', 'Empty')).findByText('No transactions yet')).toBeInTheDocument();
    expect(await within(figure('DataState', 'Error')).findByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(await within(figure('DataState', 'Ready')).findByText('$150.00')).toBeInTheDocument();

    const demo = figure('DataState', 'Error boundary: one widget breaks, the other keeps working');
    expect(within(demo).getByRole('button', { name: 'Render a bad amount' })).toBeInTheDocument();
    expect(await within(demo).findAllByText(/^\$\d/)).toHaveLength(2);
  });

  // #89: a failed background refetch keeps the data on screen, with no error state and no indicator.
  it('keeps the amount on screen when its background refetch fails', async () => {
    const user = userEvent.setup();
    await renderGallery();
    const example = figure('DataState', 'Background refetch fails: the data stays');
    expect(await within(example).findByText('$150.00')).toBeInTheDocument();
    expect(within(example).getByText('Query status: success')).toBeInTheDocument();

    await user.click(within(example).getByRole('button', { name: 'Refetch and fail' }));

    expect(await within(example).findByText('Query status: error')).toBeInTheDocument();
    expect(within(example).getByText('$150.00')).toBeInTheDocument();
    expect(within(example).queryByRole('alert')).toBeNull();
  });
});
