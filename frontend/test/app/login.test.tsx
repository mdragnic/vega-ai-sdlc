import { authMessages, type ErrorResponse } from '@finebank/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createMemoryRouter, type RouteObject } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '../../src/app/AppProviders';
import { LoginPage } from '../../src/app/pages/LoginPage';
import { routes } from '../../src/app/routes';
import { googleUrl } from '../../src/assets/brand';
import { GuestOnly } from '../../src/routes/GuestOnly';
import { RequireAuth } from '../../src/routes/RequireAuth';
import { me, renderApp, signedInUser, today } from '../support/app';

const server = setupServer();

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

/** Answers `POST /api/auth/login` with `respond` and records each request body. */
function loginAnswers(respond: () => Response | Promise<Response>): unknown[] {
  const bodies: unknown[] = [];
  server.use(
    http.post('*/api/auth/login', async ({ request }) => {
      bodies.push(await request.json());
      return respond();
    }),
  );
  return bodies;
}

const invalidCredentials = () =>
  HttpResponse.json({ message: authMessages.invalidCredentials } satisfies ErrorResponse, { status: 401 });

const emailField = () => screen.getByRole('textbox', { name: 'Email Address' });
const passwordField = () => screen.getByLabelText('Password');
const loginButton = () => screen.getByRole('button', { name: 'Login' });
const keepSignedIn = () => screen.getByRole('checkbox', { name: 'Keep me signed in' });
const loginRequests = () => requests.filter((request) => request === 'POST /api/auth/login');

/** Login, signed out, with the form on screen. */
async function openLogin(path = '/login') {
  server.use(me.signedOut());
  const app = renderApp(path);
  await screen.findByRole('button', { name: 'Login' });
  return app;
}

async function fill(user: UserEvent, email: string, password: string) {
  if (email) await user.type(emailField(), email);
  if (password) await user.type(passwordField(), password);
}

const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

// T1: the screen of 101, top to bottom (AC1, AC3, AC5; #63, #66, #70).
describe('Login screen', () => {
  it('shows the elements of 101 in order', async () => {
    await openLogin();
    const order = [
      screen.getByRole('img', { name: 'FINEbank.IO' }),
      emailField(),
      screen.getByRole('link', { name: 'Forgot Password?' }),
      passwordField(),
      keepSignedIn(),
      loginButton(),
      screen.getByText('or sign in with'),
      screen.getByRole('button', { name: 'Continue with Google' }),
      screen.getByRole('link', { name: 'Create an account' }),
    ];

    for (let index = 1; index < order.length; index += 1) {
      expect(follows(order[index - 1]!, order[index]!)).toBe(true);
    }
  });

  it('has no placeholders and lets password managers fill the fields', async () => {
    await openLogin();

    expect(emailField()).not.toHaveAttribute('placeholder');
    expect(passwordField()).not.toHaveAttribute('placeholder');
    expect(emailField()).toHaveAttribute('type', 'email');
    expect(emailField()).toHaveAttribute('autocomplete', 'email');
    expect(passwordField()).toHaveAttribute('autocomplete', 'current-password');
  });

  it('opens with "Keep me signed in" checked', async () => {
    await openLogin();

    expect(keepSignedIn()).toHaveAttribute('aria-checked', 'true');
  });

  it('links to Forgot Password and Sign up, and shows the Google G', async () => {
    await openLogin();

    expect(screen.getByRole('link', { name: 'Forgot Password?' })).toHaveAttribute('href', '/forgot-password');
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/sign-up');
    const google = screen.getByRole('button', { name: 'Continue with Google' });
    expect(google).toHaveAttribute('type', 'button');
    expect(google.querySelector('img')).toHaveAttribute('src', googleUrl);
    expect(loginButton()).toHaveAttribute('type', 'submit');
  });

  // T25 in the unit suite: a router link, no page load (AC5).
  it.each([
    ['Forgot Password?', '/forgot-password'],
    ['Create an account', '/sign-up'],
  ])('navigates in the app on "%s"', async (name, path) => {
    const { user, url } = await openLogin();

    await user.click(screen.getByRole('link', { name }));

    expect(url()).toBe(path);
  });
});

// T2: the eye shows and hides the password, frontend only (AC2, #51).
describe('password eye', () => {
  it('masks, shows and masks again, with no request', async () => {
    const { user, url } = await openLogin();
    const before = requests.length;

    await user.type(passwordField(), 'secret');
    expect(passwordField()).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(passwordField()).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(passwordField()).toHaveAttribute('type', 'password');

    expect(requests.length).toBe(before);
    expect(url()).toBe('/login');
    expect(screen.queryByText('Email is required')).toBeNull();
  });
});

// T3: the checkbox toggles, and the request follows it (AC3, AC6, #14).
describe('Keep me signed in', () => {
  it('toggles on click', async () => {
    const { user } = await openLogin();

    await user.click(keepSignedIn());
    expect(keepSignedIn()).toHaveAttribute('aria-checked', 'false');
    await user.click(keepSignedIn());
    expect(keepSignedIn()).toHaveAttribute('aria-checked', 'true');
  });

  it.each([
    [0, true],
    [1, false],
  ])('after %i clicks sends keepSignedIn %s', async (clicks, sent) => {
    const bodies = loginAnswers(invalidCredentials);
    const { user } = await openLogin();

    for (let click = 0; click < clicks; click += 1) await user.click(keepSignedIn());
    await fill(user, 'tanzir@example.com', 'abcdef12');
    await user.click(loginButton());

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ email: 'tanzir@example.com', password: 'abcdef12', keepSignedIn: sent });
  });
});

/** The text of the message a field points to with aria-describedby. */
const fieldError = (field: HTMLElement) => {
  const id = field.getAttribute('aria-describedby');
  return id ? document.getElementById(id)?.textContent : undefined;
};

// T4: the shared schema checks the fields before any request (AC6, AC7, AC19; #14, #87, #95).
describe('field errors', () => {
  it('shows each required message under its field and focuses Email, with no request', async () => {
    const { user } = await openLogin();

    await user.click(loginButton());

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(fieldError(emailField())).toBe('Email is required');
    expect(fieldError(passwordField())).toBe('Password is required');
    expect(emailField()).toHaveAttribute('aria-invalid', 'true');
    expect(passwordField()).toHaveAttribute('aria-invalid', 'true');
    expect(emailField()).toHaveFocus();
    expect(loginRequests()).toEqual([]);
  });

  it('shows the email format message and focuses the first failing field', async () => {
    const { user } = await openLogin();

    await fill(user, 'a@b', '');
    await user.click(loginButton());

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(fieldError(emailField())).toBe('Enter a valid email address');
    expect(emailField()).toHaveFocus();
    expect(loginRequests()).toEqual([]);
  });

  it('shows the password maximum and focuses Password when Email is valid', async () => {
    const { user } = await openLogin();

    await fill(user, 'tanzir@example.com', 'x'.repeat(129));
    await user.click(loginButton());

    expect(await screen.findByText('Password must be at most 128 characters')).toBeInTheDocument();
    expect(fieldError(passwordField())).toBe('Password must be at most 128 characters');
    expect(emailField()).not.toHaveAttribute('aria-invalid', 'true');
    expect(passwordField()).toHaveFocus();
    expect(loginRequests()).toEqual([]);
  });

  it('follows the typing after the first submit', async () => {
    const { user } = await openLogin();

    await user.click(loginButton());
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    await user.type(emailField(), 'tanzir');
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    await user.type(emailField(), '@example.com');

    await waitFor(() => expect(screen.queryByText('Enter a valid email address')).toBeNull());
    expect(emailField()).not.toHaveAttribute('aria-invalid', 'true');
    expect(fieldError(passwordField())).toBe('Password is required');
  });

  it('sends a 3-character password, which fails as wrong credentials', async () => {
    const bodies = loginAnswers(invalidCredentials);
    const { user } = await openLogin();

    await fill(user, 'tanzir@example.com', 'abc');
    await user.click(loginButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect');
    expect(bodies).toEqual([{ email: 'tanzir@example.com', password: 'abc', keepSignedIn: true }]);
  });

  it('sends the email trimmed and lowercased and the password as typed', async () => {
    const bodies = loginAnswers(invalidCredentials);
    const { user } = await openLogin();

    await fill(user, ' Marko@X.com ', ' Pass word1 ');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ email: 'marko@x.com', password: ' Pass word1 ', keepSignedIn: true });
  });
});

// T5: a successful login opens the return target, or Overview, replacing Login in the history (AC6, AC13, #3).
describe('successful login', () => {
  it('opens the return target with its query and hash, and Back does not reopen Login', async () => {
    loginAnswers(() => HttpResponse.json(signedInUser));
    server.use(me.signedOut(), today.answers());
    // The page before Login. Not `/`, which redirects to Overview (task 011, #39).
    const router = createMemoryRouter(routes, {
      initialEntries: ['/goals', '/login?returnTo=%2Fbills%3Ftab%3D1%23x'],
      initialIndex: 1,
    });
    const user = userEvent.setup();
    render(<AppProviders router={router} />);
    await screen.findByRole('button', { name: 'Login' });

    await fill(user, 'Tanzir@Example.com', 'abcdef12');
    await user.click(loginButton());

    await waitFor(() => expect(router.state.location.pathname).toBe('/bills'));
    expect(`${router.state.location.search}${router.state.location.hash}`).toBe('?tab=1#x');
    // The page renders in the shell: the session holds the user, though `me` still answers 401. The shell's
    // sidebar, since Login has a `main` too until it unmounts.
    expect(await screen.findByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Login' })).toBeNull();
    expect(loginRequests()).toHaveLength(1);

    await router.navigate(-1);
    expect(router.state.location.pathname).toBe('/goals');
  });

  // While the return target still loads (a lazy route), the signed-in session must not send Login to Overview.
  it('opens a return target that takes time to load', async () => {
    loginAnswers(() => HttpResponse.json(signedInUser));
    server.use(me.signedOut());
    const slowRoutes: RouteObject[] = [
      { element: <GuestOnly />, children: [{ path: '/login', element: <LoginPage /> }] },
      {
        element: <RequireAuth />,
        children: [
          {
            path: '/bills',
            lazy: async () => {
              await new Promise((resolve) => setTimeout(resolve, 100));
              return { Component: () => <main>Bills</main> };
            },
          },
          { path: '/overview', element: <main>Overview</main> },
        ],
      },
    ];
    const { user, url } = renderApp('/login?returnTo=%2Fbills', slowRoutes);
    await screen.findByRole('button', { name: 'Login' });

    await fill(user, 'tanzir@example.com', 'abcdef12');
    await user.click(loginButton());

    expect(await screen.findByText('Bills', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(url()).toBe('/bills');
    expect(screen.queryByText('Overview')).toBeNull();
  });

  it('opens Overview without a return target', async () => {
    loginAnswers(() => HttpResponse.json(signedInUser));
    const { user, url } = await openLogin();

    await fill(user, 'tanzir@example.com', 'abcdef12');
    await user.click(loginButton());

    await waitFor(() => expect(url()).toBe('/overview'));
    expect(await screen.findByRole('main')).toBeInTheDocument();
  });

  it('opens Overview for a return target outside the app', async () => {
    loginAnswers(() => HttpResponse.json(signedInUser));
    const { user, url } = await openLogin('/login?returnTo=%2F%2Fevil.example');

    await fill(user, 'tanzir@example.com', 'abcdef12');
    await user.click(loginButton());

    await waitFor(() => expect(url()).toBe('/overview'));
  });
});

// T6: wrong credentials show one generic message above the Login button (AC8, #14).
describe('wrong credentials', () => {
  it('shows the message above Login, marks no field and keeps the values', async () => {
    loginAnswers(invalidCredentials);
    const { user, url } = await openLogin();

    await fill(user, 'tanzir@example.com', 'wrong-password');
    await user.click(loginButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/^Email or password is incorrect$/);
    expect(follows(keepSignedIn(), alert)).toBe(true);
    expect(follows(alert, loginButton())).toBe(true);
    expect(emailField()).not.toHaveAttribute('aria-invalid');
    expect(passwordField()).not.toHaveAttribute('aria-invalid');
    expect(emailField()).toHaveValue('tanzir@example.com');
    expect(passwordField()).toHaveValue('wrong-password');
    expect(url()).toBe('/login');
  });

  it('keeps the message while typing and removes it when the next submit starts', async () => {
    let answer: () => Response | Promise<Response> = invalidCredentials;
    loginAnswers(() => answer());
    const { user } = await openLogin();

    await fill(user, 'tanzir@example.com', 'wrong-password');
    await user.click(loginButton());
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.type(passwordField(), '2');
    expect(screen.getByRole('alert')).toHaveTextContent('Email or password is incorrect');

    answer = async () => {
      await delay('infinite');
      return invalidCredentials();
    };
    await user.click(loginButton());

    await waitFor(() => expect(loginRequests()).toHaveLength(2));
    expect(loginButton()).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

// T7: one request while loading; the Login button keeps keyboard focus (AC9, row 009 note).
describe('while the login request runs', () => {
  it('shows the busy button, keeps focus and sends one request', async () => {
    const { promise: released, resolve: release } = Promise.withResolvers<void>();
    loginAnswers(async () => {
      await released;
      return invalidCredentials();
    });
    const { user } = await openLogin();
    await fill(user, 'tanzir@example.com', 'abcdef12');

    await user.click(loginButton());
    await waitFor(() => expect(loginButton()).toHaveAttribute('aria-busy', 'true'));
    const button = loginButton();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    expect(within(button).getByTestId('spinner')).toBeInTheDocument();
    expect(button).toHaveFocus();

    await user.click(button);
    await user.keyboard('{Enter}');
    expect(button).toHaveFocus();

    release();
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect');
    expect(button).not.toHaveAttribute('aria-busy');
    expect(button).not.toHaveAttribute('aria-disabled');
    expect(button).toHaveFocus();
    expect(loginRequests()).toHaveLength(1);
  });

  it('sends nothing on Enter in a field', async () => {
    loginAnswers(async () => {
      await delay('infinite');
      return invalidCredentials();
    });
    const { user } = await openLogin();
    await fill(user, 'tanzir@example.com', 'abcdef12');

    await user.click(loginButton());
    await waitFor(() => expect(loginButton()).toHaveAttribute('aria-busy', 'true'));
    await user.type(passwordField(), '{Enter}');
    await user.type(emailField(), '{Enter}');

    expect(loginRequests()).toHaveLength(1);
  });
});

// T8: the text above the Login button by status (AC9, #97 a).
describe('failed requests', () => {
  it.each([
    ['a 500 in the shared shape', () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 })],
    ['a 502 in plain text', () => new HttpResponse('Bad Gateway', { status: 502 })],
    ['a network error', () => HttpResponse.error()],
    ['a 404 in plain text', () => new HttpResponse('Not Found', { status: 404 })],
  ])('shows "Something went wrong." for %s', async (_name, respond) => {
    loginAnswers(respond);
    const { user } = await openLogin();

    await fill(user, 'tanzir@example.com', 'abcdef12');
    await user.click(loginButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(/^Something went wrong\.$/);
    expect(screen.queryByText(/Internal server error/)).toBeNull();
    expect(loginButton()).toHaveFocus();
    expect(loginButton()).not.toHaveAttribute('aria-disabled');
  });

  it("shows the server's message for a 4xx in the shared shape", async () => {
    loginAnswers(() => HttpResponse.json({ message: 'Invalid CSRF request' }, { status: 403 }));
    const { user } = await openLogin();

    await fill(user, 'tanzir@example.com', 'abcdef12');
    await user.click(loginButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(/^Invalid CSRF request$/);
  });

  it("shows a 400's field errors under their fields", async () => {
    loginAnswers(() =>
      HttpResponse.json(
        { message: 'Validation failed', fieldErrors: { email: 'Enter a valid email address' } } satisfies ErrorResponse,
        { status: 400 },
      ),
    );
    const { user } = await openLogin();

    await fill(user, 'tanzir@example.com', 'abcdef12');
    await user.click(loginButton());

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(emailField()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(loginButton()).toHaveFocus();
  });

  it("shows a 400's message when none of its field errors is a field on the screen", async () => {
    loginAnswers(() =>
      HttpResponse.json(
        { message: 'Validation failed', fieldErrors: { keepSignedIn: 'Invalid input' } } satisfies ErrorResponse,
        { status: 400 },
      ),
    );
    const { user } = await openLogin();

    await fill(user, 'tanzir@example.com', 'abcdef12');
    await user.click(loginButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(/^Validation failed$/);
  });
});

// T14: "Continue with Google" is visual only until task 012 (AC17).
describe('Continue with Google', () => {
  it('does nothing', async () => {
    const { user, url } = await openLogin();
    const before = requests.length;

    await user.click(screen.getByRole('button', { name: 'Continue with Google' }));

    expect(url()).toBe('/login');
    expect(requests.length).toBe(before);
    expect(screen.queryByText('Email is required')).toBeNull();
  });
});
