import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SettingsInput, SettingsPhoneInput } from '../../src/components';

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

// Task 030 T11, T19: AC2, AC15, the masked type: the Security tab's password fields (no eye, #129 c).
describe('SettingsInput password', () => {
  it('masks its value, keeps it from the spell checker, autocorrect and autocapitalize, and draws no eye', async () => {
    render(<SettingsInput label="Old Password" type="password" autoComplete="current-password" />);
    const field = screen.getByLabelText('Old Password');

    await userEvent.setup().type(field, 'Secret 12');

    expect(field).toHaveAttribute('type', 'password');
    expect(field).toHaveValue('Secret 12');
    expect(field).toHaveAttribute('spellcheck', 'false');
    expect(field).toHaveAttribute('autocorrect', 'off');
    expect(field).toHaveAttribute('autocapitalize', 'off');
    expect(field).toHaveAttribute('autocomplete', 'current-password');
    expect(field).not.toHaveAttribute('placeholder');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('is bordered as an editable field, red with its message, and a text field by default', () => {
    render(
      <>
        <SettingsInput label="New Password" type="password" error="Password must be at least 8 characters" />
        <SettingsInput label="Full name" />
      </>,
    );
    const field = screen.getByLabelText('New Password');

    expect(field).toHaveAccessibleDescription('Password must be at least 8 characters');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field.parentElement!.className).toMatch(/bordered/);
    expect(field.parentElement!.className).toMatch(/invalid/);
    expect(screen.getByRole('textbox', { name: 'Full name' })).toHaveAttribute('type', 'text');
    expect(screen.getByRole('textbox', { name: 'Full name' })).not.toHaveAttribute('spellcheck');
  });

  it('shows the mask in Gray/03, as 112 draws it, in its stylesheet', () => {
    const css = readFileSync(
      resolve(import.meta.dirname, '../../src/components/SettingsInput/SettingsInput.module.css'),
      'utf8',
    );

    expect(css).toMatch(/\.input\[type='password'\]\s*\{[^}]*color:\s*var\(--color-gray-03\)/);
  });
});

/** The read-only phone after a button, so focus can come from the keyboard or the mouse. */
function renderReadOnlyPhone(number = '5154758868') {
  render(
    <>
      <button type="button">Before</button>
      <SettingsPhoneInput readOnly countryCode="+880" value={number} />
    </>,
  );
  const group = screen.getByRole('group', { name: 'Phone Number' });
  return {
    user: userEvent.setup(),
    group,
    code: within(group).getByRole('textbox', { name: 'Country code' }),
    number: within(group).getByRole('textbox', { name: 'Phone Number' }),
  };
}

// Task 030 T11, T26: AC2, AC15, the read-only phone of the Security tab: two read-only inputs, the #87 ring on keyboard
// focus only, borderless as Email.
describe('SettingsPhoneInput read-only', () => {
  it('shows the stored code and number as two read-only inputs in the group, the divider between, no list', () => {
    const { group, code, number } = renderReadOnlyPhone();

    expect(code).toHaveValue('+880');
    expect(number).toHaveValue('5154758868');
    // Code review: as wide as the code also where `field-sizing: content` is not supported.
    expect(code).toHaveAttribute('size', '4');
    expect(code).toHaveAttribute('readonly');
    expect(number).toHaveAttribute('readonly');
    expect(within(group).queryByRole('combobox')).toBeNull();
    expect(group.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(code.parentElement!.className).not.toMatch(/bordered/);
  });

  it('shows the code and an empty number when no number is stored', () => {
    const { code, number } = renderReadOnlyPhone('');

    expect(code).toHaveValue('+880');
    expect(number).toHaveValue('');
  });

  it('changes nothing on typing, pasting or deleting', async () => {
    const { user, code, number } = renderReadOnlyPhone();

    await user.click(number);
    await user.keyboard('{End}{Backspace}9');
    await user.paste('123');
    await user.click(code);
    await user.keyboard('{Backspace}4');

    expect(number).toHaveValue('5154758868');
    expect(code).toHaveValue('+880');
  });

  it('is in the Tab order, code then number, each unmarked on keyboard focus and marked after a click', async () => {
    const { user, code, number } = renderReadOnlyPhone();
    screen.getByRole('button', { name: 'Before' }).focus();

    await user.tab();
    expect(code).toHaveFocus();
    expect(code).not.toHaveAttribute('data-pointer-focus');
    await user.tab();
    expect(number).toHaveFocus();
    expect(number).not.toHaveAttribute('data-pointer-focus');

    await user.click(code);
    expect(code).toHaveAttribute('data-pointer-focus');
    await user.keyboard('{ArrowLeft}');
    expect(code).not.toHaveAttribute('data-pointer-focus');
  });

  it('rings each read-only input on an unmarked keyboard focus in its stylesheet', () => {
    const css = readFileSync(
      resolve(import.meta.dirname, '../../src/components/SettingsPhoneInput/SettingsPhoneInput.module.css'),
      'utf8',
    );

    expect(css).toMatch(/\.readOnlyInput:focus-visible:not\(\[data-pointer-focus\]\)\s*\{[^}]*outline:/);
  });
});
