import { act, render, screen, waitFor, within } from '@testing-library/react';
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

type Variant = 'box' | 'plain' | 'inline' | 'input' | 'comparison';

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

  // Task 028 AC5: an option's typeahead text, so the country codes (`+880`) are found by their digits.
  it('moves the highlight to the option whose typeahead text starts with what is typed', async () => {
    const codes = ['+1', '+7', '+81', '+86', '+880', '+886'].map((code) => ({
      value: code,
      label: code,
      textValue: code.slice(1),
    }));
    render(<Dropdown variant="inline" options={codes} value="+1" onValueChange={() => undefined} aria-label="Code" />);
    const user = userEvent.setup();
    screen.getByRole('combobox', { name: 'Code' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('option', { name: '+1' })).toHaveFocus();

    await user.keyboard('880');

    expect(screen.getByRole('option', { name: '+880' })).toHaveFocus();
  });

  // Task 028 (code review): a form links a field error to the trigger and focuses it through its ref.
  it('gives the trigger its description, its invalid state and its element to the ref', () => {
    let attached: HTMLButtonElement | null = null;
    render(
      <>
        <p id="code-error">Choose a country code</p>
        <Dropdown
          variant="inline"
          options={accountTypes}
          value="checking"
          onValueChange={() => undefined}
          aria-label="Code"
          aria-describedby="code-error"
          aria-invalid
          triggerRef={(node) => {
            attached = node;
          }}
        />
      </>,
    );
    const trigger = screen.getByRole('combobox', { name: 'Code' });

    expect(trigger).toHaveAccessibleDescription('Choose a country code');
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(attached).toBe(trigger);
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
    ['comparison', true],
    ['inline', false],
  ] as const)('draws a chevron in the %s variant: %s', (variant, chevron) => {
    const { trigger } = renderDropdown(variant);

    expect(within(trigger).queryByText('Checking')).not.toBeNull();
    expect(trigger.querySelector('svg') !== null).toBe(chevron);
  });
});

/** The Account Type select of 106 edit mode: an `id` on the trigger, named by a visible `<label for>` (task 022). */
function Labelled({
  disabled = false,
  onValueChange = () => undefined,
}: {
  disabled?: boolean;
  onValueChange?: () => void;
}) {
  const [value, setValue] = useState('checking');
  return (
    <>
      <label htmlFor="account-type">Account Type</label>
      <Dropdown
        id="account-type"
        variant="input"
        options={accountTypes}
        value={value}
        onValueChange={(next) => {
          onValueChange();
          setValue(next);
        }}
        disabled={disabled}
      />
      <button type="button">Elsewhere</button>
    </>
  );
}

// Task 022 T11, AC2 and AC4: the `id` prop for a visible label (task 005 review item 10) and `disabled` for a form
// while it saves.
describe('Dropdown with a visible label and disabled', () => {
  it('is named by its <label for> through its id', () => {
    render(<Labelled />);

    const trigger = screen.getByRole('combobox', { name: 'Account Type' });
    expect(trigger).toHaveAttribute('id', 'account-type');
    expect(trigger).toHaveTextContent('Checking');
  });

  it('takes focus on a click on its label, the list staying closed', async () => {
    render(<Labelled />);
    const user = userEvent.setup();

    await user.click(screen.getByText('Account Type'));

    expect(screen.getByRole('combobox', { name: 'Account Type' })).toHaveFocus();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('still opens on a click on the trigger itself', async () => {
    render(<Labelled />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('combobox', { name: 'Account Type' }));

    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  // Code review of task 022: a click with no pointer press before it, as assistive technology sends one, opens every
  // variant as Radix does, the labelled one too; only the label's own click is turned into a focus.
  it.each(['box', 'plain', 'inline', 'input', 'comparison'] as const)(
    'opens the %s variant on a click with no pointer press, as assistive technology clicks',
    async (variant) => {
      const { trigger } = renderDropdown(variant);

      act(() => trigger.click());

      expect(await screen.findByRole('listbox')).toBeInTheDocument();
    },
  );

  it('opens the labelled one on a click with no pointer press', async () => {
    render(<Labelled />);

    act(() => screen.getByRole('combobox', { name: 'Account Type' }).click());

    expect(await screen.findByRole('listbox')).toBeInTheDocument();
  });

  it('does not open while disabled, by a click or a key, and keeps its value and its look', async () => {
    const onValueChange = vi.fn<() => void>();
    const { rerender } = render(<Labelled onValueChange={onValueChange} />);
    const user = userEvent.setup();
    const enabledClass = screen.getByRole('combobox', { name: 'Account Type' }).className;

    rerender(<Labelled disabled onValueChange={onValueChange} />);
    const trigger = screen.getByRole('combobox', { name: 'Account Type' });
    await user.click(trigger);
    trigger.focus();
    for (const key of ['{Enter}', ' ', '{ArrowDown}', '{ArrowUp}']) await user.keyboard(key);

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(trigger).toHaveTextContent('Checking');
    expect(trigger).toBeDisabled();
    expect(trigger.className).toBe(enabledClass);
  });

  it('opens again once enabled', async () => {
    const { rerender } = render(<Labelled disabled />);
    const user = userEvent.setup();

    rerender(<Labelled />);
    await user.click(screen.getByRole('combobox', { name: 'Account Type' }));

    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });
});

// Task 017 T12, AC7: the comparison look of 104 Statistics ("Weekly Comparison") and 109 ("Monthly Comparison").
describe('Dropdown comparison look', () => {
  const comparisons = [{ value: 'weekly', label: 'Weekly Comparison' }];

  function renderComparison() {
    const onValueChange = vi.fn<(value: string) => void>();
    render(
      <Dropdown
        variant="comparison"
        options={comparisons}
        value="weekly"
        onValueChange={onValueChange}
        aria-label="Statistics"
      />,
    );
    return { user: userEvent.setup(), onValueChange, trigger: screen.getByRole('combobox', { name: 'Statistics' }) };
  }

  it('shows the label, then the 24px down chevron, hidden from assistive technology', () => {
    const { trigger } = renderComparison();

    expect(trigger).toHaveTextContent(/^Weekly Comparison$/);
    const chevron = trigger.lastElementChild!;
    expect(chevron.tagName.toLowerCase()).toBe('svg');
    expect(chevron).toHaveAttribute('viewBox', '0 0 24 24');
    expect(chevron).toHaveAttribute('aria-hidden', 'true');
    expect(trigger.firstElementChild).toHaveTextContent('Weekly Comparison');
  });

  it('opens the shared list with its one option selected; choosing it again changes nothing', async () => {
    const { user, onValueChange, trigger } = renderComparison();

    await user.click(trigger);
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Weekly Comparison']);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await user.click(options[0]!);

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(trigger).toHaveTextContent('Weekly Comparison');
  });
});
