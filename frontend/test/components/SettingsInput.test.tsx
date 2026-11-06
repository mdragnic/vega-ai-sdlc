import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SettingsInput } from '../../src/components';

/** The read-only Email after a button, so focus can come from the keyboard or the mouse. */
function renderEmail() {
  render(
    <>
      <button type="button">Before</button>
      <SettingsInput label="Email" readOnly value="tanzir@example.com" />
    </>,
  );
  return { user: userEvent.setup(), email: screen.getByRole('textbox', { name: 'Email' }) };
}

// Task 028: AC16, the read-only Email shows the #87 ring on keyboard focus only. Chrome matches :focus-visible on a
// text input focused by the mouse, read-only included, so a pointer focus is marked and the ring left off for it.
describe('SettingsInput read-only', () => {
  it('marks a focus that came from the mouse', async () => {
    const { user, email } = renderEmail();

    await user.click(email);

    expect(email).toHaveFocus();
    expect(email).toHaveAttribute('data-pointer-focus');
  });

  it('leaves a keyboard focus unmarked, also after an earlier click elsewhere', async () => {
    const { user, email } = renderEmail();
    await user.click(email);
    await user.click(screen.getByRole('button', { name: 'Before' }));

    await user.tab();

    expect(email).toHaveFocus();
    expect(email).not.toHaveAttribute('data-pointer-focus');
  });

  it('drops the mark when a key is pressed in it', async () => {
    const { user, email } = renderEmail();
    await user.click(email);

    await user.keyboard('{ArrowLeft}');

    expect(email).not.toHaveAttribute('data-pointer-focus');
  });

  it('rings only an unmarked keyboard focus in its stylesheet (the CSS module stub names any class)', () => {
    const css = readFileSync(
      resolve(import.meta.dirname, '../../src/components/SettingsInput/SettingsInput.module.css'),
      'utf8',
    );

    expect(css).toMatch(/\.control:has\(\.readOnly:focus-visible:not\(\[data-pointer-focus\]\)\)/);
  });
});
