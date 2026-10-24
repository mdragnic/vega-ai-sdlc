import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Dropdown } from '../../src/components';

// The Account Type values of #26, in display order.
const accountTypes = [
  { value: 'credit-card', label: 'Credit Card' },
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'investment', label: 'Investment' },
  { value: 'loan', label: 'Loan' },
];

type Variant = 'box' | 'plain' | 'inline' | 'input';

/** A controlled Dropdown, like a screen keeps it, starting on Checking. */
function Harness({ onValueChange, variant = 'input' }: { onValueChange: (value: string) => void; variant?: Variant }) {
  const [value, setValue] = useState('checking');
  return (
    <Dropdown
      variant={variant}
      options={accountTypes}
      value={value}
      onValueChange={(next) => {
        onValueChange(next);
        setValue(next);
      }}
      aria-label="Account Type"
    />
  );
}

function renderDropdown(variant?: Variant) {
  const onValueChange = vi.fn<(value: string) => void>();
  render(<Harness onValueChange={onValueChange} variant={variant} />);
  return { user: userEvent.setup(), onValueChange, trigger: screen.getByRole('combobox', { name: 'Account Type' }) };
}

const optionLabels = () => screen.getAllByRole('option').map((option) => option.textContent);

describe('Dropdown', () => {
  // T14, AC12: the trigger is a closed combobox that shows the selected label.
  it('shows the selected label on a closed combobox', () => {
    const { trigger } = renderDropdown();

    expect(trigger).toHaveTextContent('Checking');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('can be named by a visible label', () => {
    render(
      <>
        <span id="account-type-label">Account Type</span>
        <Dropdown
          variant="input"
          options={accountTypes}
          value="loan"
          onValueChange={() => undefined}
          aria-labelledby="account-type-label"
        />
      </>,
    );

    expect(screen.getByRole('combobox', { name: 'Account Type' })).toHaveTextContent('Loan');
  });

  // T14, AC13: a click opens the listbox with the options in order and the selected one marked.
  it('opens on a click with the selected option marked', async () => {
    const { user, trigger } = renderDropdown();

    await user.click(trigger);

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(optionLabels()).toEqual(['Credit Card', 'Checking', 'Savings', 'Investment', 'Loan']);
    expect(screen.getByRole('option', { name: 'Checking' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Savings' })).toHaveAttribute('aria-selected', 'false');
  });

  it.each(['{Enter}', ' ', '{ArrowDown}'])('opens on %s', async (key) => {
    const { user, trigger } = renderDropdown();
    trigger.focus();

    await user.keyboard(key);

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  // T14, AC14: choosing by click calls onValueChange once, closes the list and returns focus.
  it('chooses an option by click', async () => {
    const { user, trigger, onValueChange } = renderDropdown();
    await user.click(trigger);

    await user.click(screen.getByRole('option', { name: 'Savings' }));

    expect(onValueChange.mock.calls).toEqual([['savings']]);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveTextContent('Savings');
  });

  it('chooses an option with the arrows and Enter', async () => {
    const { user, trigger, onValueChange } = renderDropdown();
    trigger.focus();
    await user.keyboard('{Enter}');

    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onValueChange.mock.calls).toEqual([['investment']]);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveTextContent('Investment');
  });

  it('calls nothing when the selected option is chosen again', async () => {
    const { user, trigger, onValueChange } = renderDropdown();
    await user.click(trigger);

    await user.click(screen.getByRole('option', { name: 'Checking' }));

    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes on Esc with no change', async () => {
    const { user, trigger, onValueChange } = renderDropdown();
    await user.click(trigger);

    await user.keyboard('{ArrowDown}{Escape}');

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(trigger).toHaveTextContent('Checking');
    expect(trigger).toHaveFocus();
  });

  // jsdom ignores the pointer-events Radix turns off outside the list, so the check is disabled here.
  it('closes on a click outside with no change', async () => {
    const { trigger, onValueChange } = renderDropdown();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await user.click(trigger);

    await user.click(document.body);

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  // #87: focus that comes back after the mouse is marked, so the trigger shows no ring (the CSS is checked in
  // e2e, T17). Here the trigger had keyboard focus before the mouse opened the list.
  it('marks the returning focus as a pointer one after a mouse open and a click outside', async () => {
    const { trigger } = renderDropdown('box');
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await user.tab();
    expect(trigger).toHaveFocus();
    expect(trigger).not.toHaveAttribute('data-pointer-focus');

    await user.click(trigger);
    await user.click(document.body);

    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute('data-pointer-focus');
  });

  it('keeps the returning focus a keyboard one after a keyboard open and Esc', async () => {
    const { user, trigger } = renderDropdown('box');
    await user.tab();
    await user.keyboard('{Enter}');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).not.toHaveAttribute('data-pointer-focus');
  });

  // T14, AC14: Home, End and typeahead move the highlight.
  it('moves the highlight with Home, End and typing', async () => {
    const { user, trigger } = renderDropdown();
    trigger.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('option', { name: 'Checking' })).toHaveFocus();

    await user.keyboard('{End}');
    expect(screen.getByRole('option', { name: 'Loan' })).toHaveFocus();

    await user.keyboard('{Home}');
    expect(screen.getByRole('option', { name: 'Credit Card' })).toHaveFocus();

    await user.keyboard('S');
    expect(screen.getByRole('option', { name: 'Savings' })).toHaveFocus();
  });

  // The value reaches a form through `name`, like the other fields.
  it('submits its value with a form under its name', () => {
    render(
      <form aria-label="Account">
        <Dropdown
          variant="input"
          options={accountTypes}
          value="investment"
          onValueChange={() => undefined}
          aria-label="Account Type"
          name="accountType"
        />
      </form>,
    );

    const form = screen.getByRole<HTMLFormElement>('form', { name: 'Account' });
    expect(new FormData(form).get('accountType')).toBe('investment');
  });

  // AC12: `inline` is the label alone (111); the other variants draw a chevron.
  it.each([
    ['box', true],
    ['plain', true],
    ['input', true],
    ['inline', false],
  ] as const)('draws a chevron in the %s variant: %s', (variant, chevron) => {
    const { trigger } = renderDropdown(variant);

    expect(within(trigger).queryByText('Checking')).not.toBeNull();
    expect(trigger.querySelector('svg') !== null).toBe(chevron);
  });
});
