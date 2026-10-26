import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Header, HeaderSearch } from '../../src/components';

afterEach(() => {
  vi.restoreAllMocks();
});

// T7: greeting only when given, then the "»" icon and the date (AC7, #10, #11).
describe('Header', () => {
  it('shows the greeting, the "»" icon and the date in that order', () => {
    const { container } = render(<Header greetingName="Tanzir" today="2023-05-19" />);
    const greeting = screen.getByText('Hello Tanzir');
    const date = screen.getByText('19 May, 2023');
    const chevron = container.querySelector('svg')!;

    expect(greeting.compareDocumentPosition(chevron) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(chevron.compareDocumentPosition(date) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(date).toHaveAttribute('datetime', '2023-05-19');
  });

  it('shows only the "»" icon and the date without a greeting', () => {
    const { container } = render(<Header today="2023-05-19" />);

    expect(screen.queryByText(/Hello/)).toBeNull();
    expect(container.querySelector('svg')!.nextElementSibling).toBe(screen.getByText('19 May, 2023'));
  });

  it('formats the plain date as is, whatever the time zone', () => {
    render(<Header today="2026-01-01" />);

    expect(screen.getByText('1 Jan, 2026')).toBeInTheDocument();
  });

  // T8: the "»" icon and the bell are visual only; the bell keeps its teal dot (AC8, #8, #10).
  it('draws the "»" icon and the bell as decoration only, the bell with its dot', async () => {
    const user = userEvent.setup();
    const { container } = render(<Header greetingName="Tanzir" today="2023-05-19" />);
    const icons = [...container.querySelectorAll('svg')];
    const [chevron, bell] = icons;

    for (const icon of [chevron!, bell!]) {
      await user.click(icon);
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      expect(icon.closest('button, a, [role="button"]')).toBeNull();
    }
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(bell!.querySelector('[style*="--color-primary"]')).not.toBeNull();
  });

  // T6, #100 (a): before the date arrives, and after a failed request, everything else is in place.
  it('leaves out only the date without today', () => {
    const { container } = render(<Header greetingName="Tanzir" />);
    const chevron = container.querySelector('svg')!;

    expect(container.querySelector('time')).toBeNull();
    expect(screen.getByText('Hello Tanzir').nextElementSibling).toBe(chevron);
    expect(chevron.nextElementSibling).toBe(container.querySelectorAll('svg')[1]);
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument();
  });

  it('includes the search field', () => {
    render(<Header today="2023-05-19" />);

    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveAttribute('placeholder', 'Search here');
  });
});

// T9: the search field takes text but searches, submits and requests nothing (AC9, #7).
describe('HeaderSearch', () => {
  it('shows the placeholder and the search icon', () => {
    const { container } = render(<HeaderSearch />);

    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveAttribute('placeholder', 'Search here');
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps typed text, and Enter submits nothing and sends no request', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const onSubmit = vi.fn<(event: FormEvent) => void>((event) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <HeaderSearch />
      </form>,
    );
    const field = screen.getByRole('searchbox', { name: 'Search' });

    await user.type(field, 'rent{Enter}');

    expect(field).toHaveValue('rent');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
