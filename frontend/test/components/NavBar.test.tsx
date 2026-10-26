import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { Logout, NavBar, NavMenu } from '../../src/components';
import navMenuStyles from '../../src/components/NavMenu/NavMenu.module.css';
import { paths } from '../../src/routes/paths';

const renderInRouter = (ui: ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

const items = [
  ['Overview', paths.overview],
  ['Balances', paths.balances],
  ['Transactions', paths.transactions],
  ['Bills', paths.bills],
  ['Expenses', paths.expenses],
  ['Goals', paths.goals],
  ['Settings', paths.settingsAccount],
] as const;

function renderNavBar(activeSection: 'overview' | 'balances' = 'overview', onLogout = vi.fn<() => void>()) {
  renderInRouter(<NavBar activeSection={activeSection} fullName="Tanzir Rahman" onLogout={onLogout} />);
  return within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('link');
}

// T1: the sidebar from top to bottom (AC1, AC4).
describe('NavBar', () => {
  it('shows the seven sections in order as links to their paths, each with its icon', () => {
    const links = renderNavBar();

    expect(links.map((link) => link.textContent)).toEqual(items.map(([label]) => label));
    expect(links.map((link) => link.getAttribute('href'))).toEqual(items.map(([, path]) => path));
    for (const link of links) {
      expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('puts the logo first, then the sections, Logout, the divider and the profile block', () => {
    renderNavBar();
    const order = [
      screen.getByRole('img', { name: 'FINEbank.IO' }),
      screen.getByRole('navigation', { name: 'Main' }),
      screen.getByRole('button', { name: 'Logout' }),
      screen.getByRole('separator'),
      screen.getByText('Tanzir Rahman'),
      screen.getByRole('link', { name: 'View profile' }),
    ];

    const following = order
      .slice(1)
      .map((next, index) => Boolean(order[index]!.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING));

    expect(following).toEqual([true, true, true, true, true]);
  });

  // AC4: each item is reached with Tab, in order.
  it('lets the keyboard reach every section link in order', async () => {
    const user = userEvent.setup();
    const links = renderNavBar();

    for (const link of links) {
      await user.tab();
      expect(link).toHaveFocus();
    }
  });

  // T2: only the given section is Active (AC2).
  it.each([
    ['balances', 'Balances'],
    ['overview', 'Overview'],
  ] as const)('marks only %s as the current page with the Active style', (section, label) => {
    const links = renderNavBar(section);

    for (const link of links) {
      const isActive = link.textContent === label;
      expect(link.getAttribute('aria-current')).toBe(isActive ? 'page' : null);
      expect(link.classList.contains(navMenuStyles.active!)).toBe(isActive);
    }
  });

  // T4: Logout calls its handler once (AC5).
  it('calls onLogout once when Logout is clicked', async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn<() => void>();
    renderNavBar('overview', onLogout);

    await user.click(screen.getByRole('button', { name: 'Logout' }));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});

describe('NavMenu', () => {
  it('is a link to its section with its label, Inactive unless active', () => {
    renderInRouter(<NavMenu section="goals" />);
    const link = screen.getByRole('link', { name: 'Goals' });

    expect(link).toHaveAttribute('href', paths.goals);
    expect(link).not.toHaveAttribute('aria-current');
    expect(link).not.toHaveClass(navMenuStyles.active!);
  });

  it('is the current page with the Active style when active', () => {
    renderInRouter(<NavMenu section="settings" active />);
    const link = screen.getByRole('link', { name: 'Settings' });

    expect(link).toHaveAttribute('href', paths.settingsAccount);
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link).toHaveClass(navMenuStyles.active!);
  });
});

describe('Logout', () => {
  it('is a plain button with the icon hidden from assistive technology', async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn<() => void>();
    const onSubmit = vi.fn<() => void>();
    render(
      <form onSubmit={onSubmit}>
        <Logout onLogout={onLogout} />
      </form>,
    );
    const button = screen.getByRole('button', { name: 'Logout' });

    await user.click(button);

    expect(button).toHaveAttribute('type', 'button');
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // T9, #100 (c): while the request runs, clicks and Enter do nothing; focus stays, the look stays.
  it('cancels clicks and Enter while pending, keeping focus and its look', async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn<() => void>();
    const { rerender } = render(<Logout onLogout={onLogout} />);
    const button = screen.getByRole('button', { name: 'Logout' });
    const idleClass = button.className;

    rerender(<Logout onLogout={onLogout} pending />);
    await user.click(button);
    await user.keyboard('{Enter}');

    expect(onLogout).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    expect(button.className).toBe(idleClass);

    rerender(<Logout onLogout={onLogout} />);
    await user.keyboard('{Enter}');
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(button).not.toHaveAttribute('aria-disabled');
  });
});

// T10, #100 (c): a failed logout says so next to Logout.
describe('NavBar logout state', () => {
  it('shows the failure as an alert right before Logout, in the sidebar', () => {
    renderInRouter(
      <NavBar
        activeSection="overview"
        fullName="Tanzir Rahman"
        onLogout={vi.fn<() => void>()}
        logoutError="Couldn't log out. Please try again."
      />,
    );
    const alert = screen.getByRole('alert');

    expect(alert).toHaveTextContent("Couldn't log out. Please try again.");
    expect(alert.nextElementSibling).toBe(screen.getByRole('button', { name: 'Logout' }));
    expect(screen.getByRole('navigation', { name: 'Main' }).parentElement).toContainElement(alert);
  });

  it('shows no alert without a failure', () => {
    renderNavBar();

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('passes pending to Logout', async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn<() => void>();
    renderInRouter(<NavBar activeSection="overview" fullName="Tanzir Rahman" onLogout={onLogout} logoutPending />);

    await user.click(screen.getByRole('button', { name: 'Logout' }));

    expect(onLogout).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Logout' })).toHaveAttribute('aria-disabled', 'true');
  });
});
