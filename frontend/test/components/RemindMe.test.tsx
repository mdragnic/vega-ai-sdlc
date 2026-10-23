import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RemindMe } from '../../src/components';

// T9: the box, the label and Space each toggle it (AC8).
describe('RemindMe', () => {
  it('toggles on a click on the box, a click on the label and Space', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn<(checked: boolean) => void>();
    render(<RemindMe label="Keep me signed in" defaultChecked onCheckedChange={onCheckedChange} />);
    const box = screen.getByRole('checkbox', { name: 'Keep me signed in' });
    expect(box).toHaveAttribute('aria-checked', 'true');

    await user.click(box);
    expect(box).toHaveAttribute('aria-checked', 'false');

    await user.click(screen.getByText('Keep me signed in'));
    expect(box).toHaveAttribute('aria-checked', 'true');

    box.focus();
    await user.keyboard(' ');
    expect(box).toHaveAttribute('aria-checked', 'false');

    expect(onCheckedChange.mock.calls).toEqual([[false], [true], [false]]);
  });

  it('shows the check mark only while checked', async () => {
    const user = userEvent.setup();
    render(<RemindMe label="Keep me signed in" />);
    const box = screen.getByRole('checkbox', { name: 'Keep me signed in' });
    expect(box).toHaveAttribute('aria-checked', 'false');
    expect(box.querySelector('svg')).not.toBeInTheDocument();

    await user.click(box);

    expect(box.querySelector('svg')).toBeInTheDocument();
  });

  it('follows a controlled value', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn<(checked: boolean) => void>();
    render(<RemindMe label="Keep me signed in" checked={false} onCheckedChange={onCheckedChange} />);
    const box = screen.getByRole('checkbox', { name: 'Keep me signed in' });

    await user.click(box);

    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(box).toHaveAttribute('aria-checked', 'false');
  });
});
