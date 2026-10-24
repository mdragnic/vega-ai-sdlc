import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Popup, PopupInputSmall } from '../../src/components';

/** An opener button and a two-field popup it opens, like the Goals card pencil and 104.1. */
function Harness({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Edit goal
      </button>
      <Popup
        open={open}
        onOpenChange={(next) => {
          onOpenChange?.(next);
          setOpen(next);
        }}
        title="Edit the goal"
      >
        <PopupInputSmall label="Target Amounts" defaultValue="500000" />
        <PopupInputSmall label="Present Amounts" placeholder="Write present amount here" />
      </Popup>
    </>
  );
}

async function openPopup(onOpenChange?: (open: boolean) => void) {
  const user = userEvent.setup();
  render(<Harness onOpenChange={onOpenChange} />);
  const opener = screen.getByRole('button', { name: 'Edit goal' });
  await user.click(opener);
  return { user, opener, dialog: screen.getByRole('dialog', { name: 'Edit the goal' }) };
}

describe('Popup', () => {
  // T1: a modal dialog named by its title; focus on the first field; X after the content (AC1).
  it('opens as a modal dialog named by its title, with focus on the first field', async () => {
    const { dialog } = await openPopup();

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('textbox', { name: 'Target Amounts' })).toHaveFocus();
  });

  // The prefilled value is not selected, as drawn: the caret waits at its end.
  it('puts the caret at the end of the first field, with nothing selected', async () => {
    await openPopup();

    const target = screen.getByRole<HTMLInputElement>('textbox', { name: 'Target Amounts' });
    expect([target.selectionStart, target.selectionEnd]).toEqual([6, 6]);
  });

  // Popup is the shell of every popup: a first field without a text selection (number, checkbox) must not throw.
  it('focuses a first field that has no text selection, without an error', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const reported: unknown[] = [];
    const onError = (event: ErrorEvent) => reported.push(event.error);
    window.addEventListener('error', onError);
    render(
      <Popup open onOpenChange={() => undefined} title="Settings">
        <input type="number" aria-label="Count" defaultValue="3" />
      </Popup>,
    );
    window.removeEventListener('error', onError);

    expect(screen.getByRole('spinbutton', { name: 'Count' })).toHaveFocus();
    expect(reported).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('focuses the X when the content has nothing to focus', async () => {
    const user = userEvent.setup();
    render(
      <Popup open onOpenChange={() => undefined} title="Notice">
        <p>No fields here.</p>
      </Popup>,
    );
    await user.keyboard('{Shift>}{/Shift}');

    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('renders nothing while closed', () => {
    render(<Harness />);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('keeps Tab and Shift+Tab inside: the fields, then the X', async () => {
    const { user } = await openPopup();
    const target = screen.getByRole('textbox', { name: 'Target Amounts' });
    const present = screen.getByRole('textbox', { name: 'Present Amounts' });
    const close = screen.getByRole('button', { name: 'Close' });

    await user.tab();
    expect(present).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab();
    expect(target).toHaveFocus();

    await user.tab({ shift: true });
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(present).toHaveFocus();
  });

  it('hides everything outside it from assistive technology', async () => {
    await openPopup();

    expect(
      screen.getByRole('button', { name: 'Edit goal', hidden: true }).closest('[aria-hidden="true"]'),
    ).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit goal' })).toBeNull();
    expect(screen.getByRole('dialog').closest('[aria-hidden="true"]')).toBeNull();
  });

  // T5: X, Esc and the dimmed area close it, once each, and focus returns to the opener (AC5, #35).
  it('closes with the X and returns focus to the opener', async () => {
    const onOpenChange = vi.fn<(open: boolean) => void>();
    const { user, opener } = await openPopup(onOpenChange);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onOpenChange.mock.calls).toEqual([[false]]);
    expect(opener).toHaveFocus();
  });

  it('closes with Esc and returns focus to the opener', async () => {
    const onOpenChange = vi.fn<(open: boolean) => void>();
    const { user, opener } = await openPopup(onOpenChange);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onOpenChange.mock.calls).toEqual([[false]]);
    expect(opener).toHaveFocus();
  });

  it('closes with a click on the dimmed area and returns focus to the opener', async () => {
    const onOpenChange = vi.fn<(open: boolean) => void>();
    const { user, opener, dialog } = await openPopup(onOpenChange);
    const overlay = dialog.previousElementSibling!;

    await user.click(overlay);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onOpenChange.mock.calls).toEqual([[false]]);
    expect(opener).toHaveFocus();
  });

  it('stays open on a click inside the panel', async () => {
    const onOpenChange = vi.fn<(open: boolean) => void>();
    const { user, dialog } = await openPopup(onOpenChange);

    await user.click(dialog);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  // The whole page is blocked (#35): a press outside the dimmed area, on the sidebar or the header, does not
  // close it and does not take focus out of it. Radix turns pointer events off there, so a browser sends the
  // press to the page root, which cannot take focus (e2e, T4).
  it('stays open and keeps focus on a press outside the dimmed area', async () => {
    const onOpenChange = vi.fn<(open: boolean) => void>();
    const { user } = await openPopup(onOpenChange);
    await user.tab();
    const present = screen.getByRole('textbox', { name: 'Present Amounts' });
    expect(present).toHaveFocus();

    await userEvent.setup({ pointerEventsCheck: 0 }).click(document.documentElement);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(present).toHaveFocus();
  });

  // T5: the content unmounts on close, so changes are discarded (AC5, #35).
  it('shows the initial values again after a change, a close and a reopen', async () => {
    const { user, opener } = await openPopup();
    await user.type(screen.getByRole('textbox', { name: 'Target Amounts' }), '9');
    await user.type(screen.getByRole('textbox', { name: 'Present Amounts' }), '12');

    await user.keyboard('{Escape}');
    await user.click(opener);

    expect(screen.getByRole('textbox', { name: 'Target Amounts' })).toHaveValue('500000');
    expect(screen.getByRole('textbox', { name: 'Present Amounts' })).toHaveValue('');
  });
});
