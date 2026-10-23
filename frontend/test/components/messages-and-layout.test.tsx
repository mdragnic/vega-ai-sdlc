import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuthLayout, FieldError, FormError, Spinner, TextDivider } from '../../src/components';

// T10: the server error above the submit button is announced (AC9, #6).
describe('FormError', () => {
  it('shows the message as an alert', () => {
    render(<FormError>Email or password is incorrect</FormError>);

    expect(screen.getByRole('alert')).toHaveTextContent('Email or password is incorrect');
  });

  it('renders nothing without a message', () => {
    const { container } = render(<FormError />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('FieldError', () => {
  it('shows the message with the given id', () => {
    render(<FieldError id="email-error">Email is required</FieldError>);

    expect(screen.getByText('Email is required')).toHaveAttribute('id', 'email-error');
  });
});

describe('Spinner', () => {
  it('is hidden from assistive technology', () => {
    render(<Spinner />);

    expect(screen.getByTestId('spinner')).toHaveAttribute('aria-hidden', 'true');
  });
});

// T12: centered text with a line on each side (AC11).
describe('TextDivider', () => {
  it('shows the text between two decorative lines', () => {
    render(<TextDivider>or sign in with</TextDivider>);
    const text = screen.getByText('or sign in with');

    expect(text.previousElementSibling).toHaveAttribute('aria-hidden', 'true');
    expect(text.nextElementSibling).toHaveAttribute('aria-hidden', 'true');
  });
});

// AC10 layout is measured in the browser (T11); here only the structure.
describe('AuthLayout', () => {
  it('puts the logo at the top of the main column, before the content', () => {
    render(
      <AuthLayout>
        <p>Form content</p>
      </AuthLayout>,
    );
    const main = screen.getByRole('main');
    const logo = screen.getByRole('img', { name: 'FINEbank.IO' });

    expect(main).toContainElement(logo);
    expect(main.firstElementChild).toBe(logo);
    expect(main).toContainElement(screen.getByText('Form content'));
  });

  it('lets the screen add its own class for the top offset', () => {
    render(
      <AuthLayout className="login-offset">
        <p>Form content</p>
      </AuthLayout>,
    );

    expect(screen.getByRole('main')).toHaveClass('login-offset');
  });
});
