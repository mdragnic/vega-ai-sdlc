import { screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { me, renderApp, signedInDefaults } from '../support/app';

const server = setupServer(...signedInDefaults());

/** Every request the app sends, as `METHOD /path`. */
let requests: string[] = [];

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  requests = [];
  server.events.on('request:start', ({ request }) => {
    requests.push(`${request.method} ${new URL(request.url).pathname}`);
  });
});
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

const emailField = () => screen.getByRole('textbox', { name: 'Email Address' });
const resetButton = () => screen.getByRole('button', { name: 'Password Reset' });

/** Forgot Password, signed out, with the form on screen. */
async function openForgotPassword() {
  server.use(me.signedOut());
  const app = renderApp('/forgot-password');
  await screen.findByRole('button', { name: 'Password Reset' });
  return app;
}

const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

// T10: the screen of 103, top to bottom, built as a form a reset flow can use later (AC12, AC13, AC15; #16).
describe('Forgot Password screen', () => {
  it('shows the elements of 103 in order', async () => {
    await openForgotPassword();
    const text = screen.getByText('Enter your email address to get the', { exact: false });
    const order = [
      screen.getByRole('img', { name: 'FINEbank.IO' }),
      screen.getByRole('heading', { level: 1, name: 'Forgot Password?' }),
      text,
      emailField(),
      resetButton(),
      screen.getByRole('link', { name: 'Back to login' }),
    ];

    for (let index = 1; index < order.length; index += 1) {
      expect(follows(order[index - 1]!, order[index]!)).toBe(true);
    }
    expect(text).toHaveTextContent(/^Enter your email address to get the ?password reset link\.$/);
  });

  it('breaks the text after "the", as drawn', async () => {
    await openForgotPassword();
    const text = screen.getByText('Enter your email address to get the', { exact: false });

    expect(text.innerHTML).toBe('Enter your email address to get the<br>password reset link.');
  });

  it('has the Email placeholder of 103 and lets the browser fill it', async () => {
    await openForgotPassword();

    expect(emailField()).toHaveAttribute('type', 'email');
    expect(emailField()).toHaveAttribute('placeholder', 'hello@example.com');
    expect(emailField()).toHaveAttribute('autocomplete', 'email');
    expect(emailField()).toHaveAttribute('name', 'email');
  });

  it('puts Email in a form whose submit button is "Password Reset", with no browser validation', async () => {
    await openForgotPassword();
    const form = emailField().closest('form');

    expect(form).not.toBeNull();
    expect(form).toHaveAttribute('novalidate');
    expect(resetButton()).toHaveAttribute('type', 'submit');
    expect(resetButton().closest('form')).toBe(form);
  });

  it('opens Login in the app on "Back to login"', async () => {
    const { user, url } = await openForgotPassword();
    const back = screen.getByRole('link', { name: 'Back to login' });

    expect(back).toHaveAttribute('href', '/login');
    await user.click(back);

    expect(url()).toBe('/login');
    expect(await screen.findByRole('button', { name: 'Login' })).toBeInTheDocument();
  });
});

// T11: "Password Reset" does nothing yet (AC14, #16).
describe('Password Reset', () => {
  const submits: [string, (user: UserEvent) => Promise<void>][] = [
    ['a click', (user) => user.click(resetButton())],
    ['Enter in the field', (user) => user.type(emailField(), '{Enter}')],
  ];
  const values = ['', 'abc', 'marko@x.com'];

  for (const [how, submit] of submits) {
    it.each(values)(`sends nothing and shows nothing on ${how} with "%s"`, async (value) => {
      const { user, url } = await openForgotPassword();
      if (value) await user.type(emailField(), value);
      const before = requests.length;

      await submit(user);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(requests.length).toBe(before);
      expect(screen.queryByRole('alert')).toBeNull();
      expect(emailField()).not.toHaveAttribute('aria-invalid');
      expect(emailField()).not.toHaveAttribute('aria-describedby');
      expect(resetButton()).not.toHaveAttribute('aria-busy');
      expect(screen.queryByText(/required|valid|sent|check your/i)).toBeNull();
      expect(url()).toBe('/forgot-password');
      expect(emailField()).toHaveValue(value);
    });
  }
});

// T12: Forgot Password is for signed-out visitors only (AC16; #97 c, #99 a).
describe('session check', () => {
  it('sends a signed-in user to Overview without showing the screen', async () => {
    server.use(me.signedIn());
    const { router, url } = renderApp('/forgot-password');

    await waitFor(() => expect(url()).toBe('/overview'));
    expect(router.state.historyAction).toBe('REPLACE');
    expect(screen.queryByRole('button', { name: 'Password Reset' })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('renders nothing while the check runs', async () => {
    server.use(me.pending());
    const { container, url } = renderApp('/forgot-password');

    // Give the app time to render whatever it would render while waiting.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container).toBeEmptyDOMElement();
    expect(url()).toBe('/forgot-password');
  });
});
