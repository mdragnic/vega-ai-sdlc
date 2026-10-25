import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { GoalPopupInput, PopupInputSmall } from '../../src/components';

const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

function renderPopup({ saving = false, formError }: { saving?: boolean; formError?: string } = {}) {
  const onSubmit = vi.fn<(event: FormEvent<HTMLFormElement>) => void>();
  render(
    <GoalPopupInput
      open
      onOpenChange={() => undefined}
      title="Adjust the goal"
      onSubmit={onSubmit}
      saving={saving}
      formError={formError}
    >
      <PopupInputSmall label="Target Amounts" defaultValue="500000" />
      <PopupInputSmall label="Present Amounts" placeholder="Write present amount here" />
    </GoalPopupInput>,
  );
  return { user: userEvent.setup(), onSubmit };
}

/** A one-field popup, for re-rendering with another `saving`. */
function onePopup(saving: boolean, onSubmit: (event: FormEvent<HTMLFormElement>) => void) {
  return (
    <GoalPopupInput open onOpenChange={() => undefined} title="Adjust the goal" onSubmit={onSubmit} saving={saving}>
      <PopupInputSmall label="Target Amounts" defaultValue="500000" />
    </GoalPopupInput>
  );
}

describe('GoalPopupInput', () => {
  it('is a popup with the fields, then Save, then the X', async () => {
    const { user } = renderPopup();
    const dialog = screen.getByRole('dialog', { name: 'Adjust the goal' });
    const present = screen.getByRole('textbox', { name: 'Present Amounts' });
    const save = screen.getByRole('button', { name: 'Save' });

    expect(dialog).toContainElement(save);
    expect(save).toHaveAttribute('type', 'submit');
    expect(screen.getByRole('textbox', { name: 'Target Amounts' })).toHaveFocus();

    await user.tab();
    expect(present).toHaveFocus();
    await user.tab();
    expect(save).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  // T12: Save and Enter submit once each (AC11).
  it('calls onSubmit once when Save is clicked', async () => {
    const { user, onSubmit } = renderPopup();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0].defaultPrevented).toBe(true);
  });

  it('calls onSubmit once when Enter is pressed in a field', async () => {
    const { user, onSubmit } = renderPopup();

    await user.type(screen.getByRole('textbox', { name: 'Present Amounts' }), '12{Enter}');

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  // T12: while saving, Save is disabled with the spinner, and Enter does not submit again (AC11, #6).
  // Task 009 T9: disabled through aria-disabled, so Save stays focusable and keeps focus (task 005 review finding 7).
  it('disables Save with the spinner while saving, keeping its focus', async () => {
    const { user, onSubmit } = renderPopup({ saving: true });
    const save = screen.getByRole('button', { name: 'Save' });

    expect(save).not.toBeDisabled();
    expect(save).toHaveAttribute('aria-disabled', 'true');
    expect(save).toHaveAttribute('aria-busy', 'true');
    expect(within(save).getByTestId('spinner')).toBeInTheDocument();

    await user.click(save);
    expect(save).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.type(screen.getByRole('textbox', { name: 'Target Amounts' }), '{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // Task 009 T9: Save keeps keyboard focus when saving starts and ends (AC10; task 005 review finding 7).
  it('keeps focus on Save while saving turns on and off', () => {
    const onSubmit = vi.fn<(event: FormEvent<HTMLFormElement>) => void>();
    const { rerender } = render(onePopup(false, onSubmit));
    const save = screen.getByRole('button', { name: 'Save' });
    save.focus();

    rerender(onePopup(true, onSubmit));
    expect(save).toHaveFocus();
    // A natively disabled button loses focus in the browser (jsdom keeps it), so it must not be one.
    expect(save).not.toBeDisabled();
    expect(save).toHaveAttribute('aria-disabled', 'true');

    rerender(onePopup(false, onSubmit));
    expect(save).toHaveFocus();
    expect(save).not.toHaveAttribute('aria-disabled');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // T12: the server error shows above Save as an alert (AC11, #6).
  it('shows the form error above Save', () => {
    renderPopup({ formError: 'The goal could not be saved. Try again.' });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('The goal could not be saved. Try again.');
    expect(follows(alert, screen.getByRole('button', { name: 'Save' }))).toBe(true);
    expect(follows(screen.getByRole('textbox', { name: 'Present Amounts' }), alert)).toBe(true);
  });

  it('shows no alert without a form error', () => {
    renderPopup();

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
