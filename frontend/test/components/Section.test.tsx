import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { Section } from '../../src/components';

const inRouter = (children: ReactNode) => render(<MemoryRouter>{children}</MemoryRouter>);

// T3: a region named by its h2 title, with "View All", a note, or neither on the right (AC3, AC4).
describe('Section', () => {
  it('is a region named by its h2 title, with the children after the title', () => {
    inRouter(
      <Section title="Total Balance" gap="sm">
        <p>Card content</p>
      </Section>,
    );
    const region = screen.getByRole('region', { name: 'Total Balance' });
    const heading = within(region).getByRole('heading', { level: 2, name: 'Total Balance' });
    const content = within(region).getByText('Card content');

    expect(heading.compareDocumentPosition(content)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('shows only the title when it has no "View All" and no note', () => {
    inRouter(
      <Section title="Total Balance" gap="lg">
        <p>Card content</p>
      </Section>,
    );
    const region = screen.getByRole('region', { name: 'Total Balance' });

    expect(within(region).queryByRole('link')).toBeNull();
    expect(region.textContent).toBe('Total BalanceCard content');
  });

  it('links "View All" to the given path, described by the section title', () => {
    inRouter(
      <>
        <Section title="Upcoming Bill" gap="sm" viewAllTo="/bills">
          <p>Bills</p>
        </Section>
        <Section title="Recent Transaction" gap="sm" viewAllTo="/transactions">
          <p>Transactions</p>
        </Section>
      </>,
    );
    const bills = within(screen.getByRole('region', { name: 'Upcoming Bill' })).getByRole('link', { name: 'View All' });
    const transactions = within(screen.getByRole('region', { name: 'Recent Transaction' })).getByRole('link', {
      name: 'View All',
    });

    expect(bills).toHaveAttribute('href', '/bills');
    expect(bills).toHaveAccessibleDescription('Upcoming Bill');
    expect(transactions).toHaveAttribute('href', '/transactions');
    expect(transactions).toHaveAccessibleDescription('Recent Transaction');
    // The chevron is decorative: the link's name stays "View All".
    expect(bills.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows the note on the title row instead of a link', () => {
    inRouter(
      <Section title="Expenses Breakdown" gap="sm" note="*Compare to last month">
        <p>Categories</p>
      </Section>,
    );
    const region = screen.getByRole('region', { name: 'Expenses Breakdown' });

    expect(within(region).getByText('*Compare to last month')).toBeInTheDocument();
    expect(within(region).queryByRole('link')).toBeNull();
  });
});
