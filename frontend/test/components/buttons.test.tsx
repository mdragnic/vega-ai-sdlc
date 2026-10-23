import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { googleUrl } from '../../src/assets/brand';
import { ButtonPrimary, ButtonSecondary } from '../../src/components';

// T7: default, disabled and loading (AC6, #6).
describe('ButtonPrimary', () => {
  it('calls onClick by default', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn<() => void>();
    render(<ButtonPrimary onClick={onClick}>Login</ButtonPrimary>);

    await user.click(screen.getByRole('button', { name: 'Login' }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Login' })).not.toHaveAttribute('aria-busy');
    expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
  });

  it('is a plain button unless told to submit', () => {
    render(
      <>
        <ButtonPrimary>Login</ButtonPrimary>
        <ButtonPrimary type="submit">Sign up</ButtonPrimary>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Login' })).toHaveAttribute('type', 'button');
    expect(screen.getByRole('button', { name: 'Sign up' })).toHaveAttribute('type', 'submit');
  });

  it('ignores clicks while disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn<() => void>();
    render(
      <ButtonPrimary disabled onClick={onClick}>
        Login
      </ButtonPrimary>,
    );

    await user.click(screen.getByRole('button', { name: 'Login' }));

    expect(screen.getByRole('button', { name: 'Login' })).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('while loading is busy and disabled, shows a spinner, keeps its name and ignores clicks', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn<() => void>();
    const onSubmit = vi.fn<() => void>();
    render(
      <form onSubmit={onSubmit}>
        <ButtonPrimary type="submit" loading onClick={onClick}>
          Login
        </ButtonPrimary>
      </form>,
    );
    const button = screen.getByRole('button', { name: 'Login' });

    await user.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(within(button).getByTestId('spinner')).toBeInTheDocument();
    expect(button).toHaveAccessibleName('Login');
    expect(onClick).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

// T8: with and without the Google G (AC7, #70).
describe('ButtonSecondary', () => {
  it('shows the icon before the label', () => {
    render(<ButtonSecondary icon={<img src={googleUrl} alt="" />}>Continue with Google</ButtonSecondary>);
    const button = screen.getByRole('button', { name: 'Continue with Google' });
    const icon = button.querySelector('img');

    expect(icon).toHaveAttribute('src', googleUrl);
    // The label already says Google, so the image is decorative and does not repeat it.
    expect(icon).toHaveAttribute('alt', '');
    expect(button).toHaveAccessibleName('Continue with Google');
    expect(icon!.compareDocumentPosition(within(button).getByText('Continue with Google'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('shows only the label without an icon', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn<() => void>();
    render(<ButtonSecondary onClick={onClick}>Continue with Google</ButtonSecondary>);
    const button = screen.getByRole('button', { name: 'Continue with Google' });

    await user.click(button);

    expect(button.querySelector('img')).not.toBeInTheDocument();
    expect(button).toHaveAttribute('type', 'button');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // An empty icon slot would add its width and gap and push the label off center.
  it('treats a null icon as none', () => {
    render(<ButtonSecondary icon={null}>Continue with Google</ButtonSecondary>);

    expect(screen.getByRole('button', { name: 'Continue with Google' }).children).toHaveLength(1);
  });
});
