import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, type FormEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { IconEye, IconEyeOff } from '../../src/assets/icons';
import { Input } from '../../src/components';

function svgMarkup(Icon: typeof IconEye): string {
  const { container, unmount } = render(<Icon />);
  const markup = container.querySelector('svg')!.innerHTML;
  unmount();
  return markup;
}

const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('Input', () => {
  // T1: the label names the field; no placeholder unless given (AC1, #63).
  it('links the label to the field and shows a placeholder only when one is given', () => {
    const { rerender } = render(<Input label="Email Address" />);

    const field = screen.getByLabelText('Email Address');
    expect(field.tagName).toBe('INPUT');
    expect(field).not.toHaveAttribute('placeholder');

    rerender(<Input label="Email Address" placeholder="hello@example.com" />);
    expect(screen.getByLabelText('Email Address')).toHaveAttribute('placeholder', 'hello@example.com');
  });

  it('gives each field its own id', () => {
    render(
      <>
        <Input label="Name" />
        <Input label="Email Address" />
      </>,
    );

    expect(screen.getByLabelText('Name').id).not.toBe(screen.getByLabelText('Email Address').id);
  });

  it('has no visibility toggle unless it is a password field', () => {
    render(<Input label="Email Address" type="email" />);

    expect(screen.getByLabelText('Email Address')).toHaveAttribute('type', 'email');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  // T3: the eye toggles masked and visible text, frontend only, and never submits (AC2, #51).
  it('masks a password and toggles it with the eye button without submitting the form', async () => {
    const user = userEvent.setup();
    const eye = svgMarkup(IconEye);
    const eyeOff = svgMarkup(IconEyeOff);
    const onSubmit = vi.fn<(event: FormEvent) => void>((event) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Input label="Password" type="password" />
      </form>,
    );
    const field = screen.getByLabelText('Password');

    await user.type(field, 'secret12');
    expect(field).toHaveAttribute('type', 'password');
    const show = screen.getByRole('button', { name: 'Show password' });
    expect(show).toHaveAttribute('type', 'button');
    expect(show.querySelector('svg')!.innerHTML).toBe(eye);

    await user.click(show);
    expect(field).toHaveAttribute('type', 'text');
    expect(field).toHaveValue('secret12');
    const hide = screen.getByRole('button', { name: 'Hide password' });
    expect(hide.querySelector('svg')!.innerHTML).toBe(eyeOff);

    await user.click(hide);
    expect(field).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Show password' }).querySelector('svg')!.innerHTML).toBe(eye);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // A shown password is plain text to the browser: no spell checker (which may send it to a remote
  // service), autocorrect or autocapitalize may touch it.
  it('keeps a password out of the spell checker and autocorrect, also while shown', async () => {
    const user = userEvent.setup();
    render(<Input label="Password" type="password" />);
    const field = screen.getByLabelText('Password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));

    expect(field).toHaveAttribute('type', 'text');
    expect(field).toHaveAttribute('spellcheck', 'false');
    expect(field).toHaveAttribute('autocorrect', 'off');
    expect(field).toHaveAttribute('autocapitalize', 'off');
  });

  // Clicking the eye keeps focus in the field, so the Active border stays while typing (#63).
  it('keeps focus in the field when the eye is clicked', async () => {
    const user = userEvent.setup();
    render(<Input label="Password" type="password" />);
    const field = screen.getByLabelText('Password');

    await user.click(field);
    await user.click(screen.getByRole('button', { name: 'Show password' }));

    expect(field).toHaveFocus();
  });

  // T4: the label action sits in the label row, after the label and before the field (AC3).
  it('shows the label action in the label row, after the label', () => {
    render(<Input label="Password" type="password" labelAction={<a href="/forgot-password">Forgot Password?</a>} />);
    const label = screen.getByText('Password', { selector: 'label' });
    const action = screen.getByRole('link', { name: 'Forgot Password?' });
    const field = screen.getByLabelText('Password');

    expect(label.parentElement).toContainElement(action);
    expect(label.parentElement).not.toContainElement(field);
    expect(follows(label, action)).toBe(true);
    expect(follows(action, field)).toBe(true);
  });

  // T5: an error shows under the field and describes it (AC4, #6).
  it('shows an error under the field, marks it invalid and describes it', () => {
    render(<Input label="Email Address" error="Email is required" />);
    const field = screen.getByLabelText('Email Address');
    const message = screen.getByText('Email is required');

    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(message.id).not.toBe('');
    expect(field).toHaveAttribute('aria-describedby', message.id);
    expect(field).toHaveAccessibleDescription('Email is required');
    expect(follows(field, message)).toBe(true);
  });

  it('is neither invalid nor described without an error', () => {
    render(<Input label="Email Address" />);
    const field = screen.getByLabelText('Email Address');

    expect(field).not.toHaveAttribute('aria-invalid');
    expect(field).not.toHaveAttribute('aria-describedby');
  });

  it("keeps the caller's own description next to the error", () => {
    const { rerender } = render(
      <>
        <p id="email-hint">We never share it</p>
        <Input label="Email Address" aria-describedby="email-hint" />
      </>,
    );
    expect(screen.getByLabelText('Email Address')).toHaveAccessibleDescription('We never share it');

    rerender(
      <>
        <p id="email-hint">We never share it</p>
        <Input label="Email Address" aria-describedby="email-hint" error="Email is required" />
      </>,
    );
    expect(screen.getByLabelText('Email Address')).toHaveAccessibleDescription('We never share it Email is required');
  });

  it('treats a null label action as none', () => {
    render(<Input label="Password" type="password" labelAction={null} />);
    const labelRow = screen.getByText('Password', { selector: 'label' }).parentElement!;

    expect(labelRow.children).toHaveLength(1);
  });

  it('forwards the ref and passes name, onChange and onBlur through', async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLInputElement>();
    const onChange = vi.fn<() => void>();
    const onBlur = vi.fn<() => void>();
    render(<Input label="Name" name="name" ref={ref} onChange={onChange} onBlur={onBlur} />);
    const field = screen.getByLabelText('Name');

    await user.type(field, 'Ta');
    await user.tab();

    expect(ref.current).toBe(field);
    expect(field).toHaveAttribute('name', 'name');
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
