import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AmountBox, ButtonSmall, DateBox } from '../../src/components';

const usd = (cents: number) => ({ cents, currency: 'USD' as const });

// T10: the date box shows the month over the day inside <time> (AC10, #88).
describe('DateBox', () => {
  it.each(['compact', 'large'] as const)('shows May over 15 in a <time> element (%s)', (size) => {
    const { container } = render(<DateBox date="2023-05-15" size={size} />);
    const time = container.querySelector('time')!;

    expect(time).toHaveAttribute('dateTime', '2023-05-15');
    expect([...time.children].map((part) => part.textContent)).toEqual(['May', '15']);
  });

  it('shows a day under 10 with two digits', () => {
    const { container } = render(<DateBox date="2023-09-05" size="compact" />);

    expect([...container.querySelector('time')!.children].map((part) => part.textContent)).toEqual(['Sep', '05']);
  });
});

// T10: the amount box shows the formatted amount (AC11, #11).
describe('AmountBox', () => {
  it.each([
    [15000, '$150.00'],
    [55900, '$559.00'],
    [100000000000, '$1,000,000,000.00'],
  ])('shows %i cents as %s', (cents, text) => {
    render(<AmountBox amount={usd(cents)} size="compact" />);

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('shows the same text in the large size', () => {
    render(<AmountBox amount={usd(15000)} size="large" />);

    expect(screen.getByText('$150.00')).toBeInTheDocument();
  });
});

// Figma `Button small` (2:42): the Retry button of the error state.
describe('ButtonSmall', () => {
  it('is a plain button that calls onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn<() => void>();
    render(<ButtonSmall onClick={onClick}>Retry</ButtonSmall>);
    const button = screen.getByRole('button', { name: 'Retry' });

    await user.click(button);

    expect(button).toHaveAttribute('type', 'button');
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
