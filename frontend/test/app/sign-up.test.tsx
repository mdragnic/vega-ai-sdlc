import { authMessages, type ErrorResponse } from '@finebank/shared';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useEffect } from 'react';
import { createMemoryRouter, Outlet, type RouteObject } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { startGoogleSignIn } from '../../src/api/google';
import { AppProviders } from '../../src/app/AppProviders';
import { SignUpPage } from '../../src/app/pages/SignUpPage';
import { routes } from '../../src/app/routes';
import { googleUrl } from '../../src/assets/brand';
import { GuestOnly } from '../../src/routes/GuestOnly';
import { me, renderApp, signedInDefaults, today } from '../support/app';

// The page load of Google sign-in, which jsdom cannot do; the e2e tests follow it (task 012).
vi.mock('../../src/api/google', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/api/google')>()),
  startGoogleSignIn: vi.fn<(returnTo?: string) => void>(),
}));

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

/** The query client the app uses, captured from inside it. */
let appClient: QueryClient | undefined;

function ClientProbe() {
  const client = useQueryClient();
  useEffect(() => {
    appClient = client;
  }, [client]);
  return null;
}

/** The app's routes inside a layout that captures the query client. */
const probedRoutes: RouteObject[] = [
  {
    element: (
      <>
        <ClientProbe />
        <Outlet />
      </>
    ),
    children: routes,
  },
];

/** The new user as `POST /api/auth/signup` returns it. */
const newUser = { fullName: 'Tanzir Rahman', email: 'marko@x.com', username: 'marko' };

/** Answers `POST /api/auth/signup` with `respond` and records each request body. */
function signUpAnswers(respond: () => Response | Promise<Response>): unknown[] {
  const bodies: unknown[] = [];
  server.use(
    http.post('*/api/auth/signup', async ({ request }) => {
      bodies.push(await request.json());
      return respond();
    }),
  );
  return bodies;
}

const created = () => HttpResponse.json(newUser, { status: 201 });
const emailTaken = () =>
  HttpResponse.json(
    { message: authMessages.emailTaken, fieldErrors: { email: authMessages.emailTaken } } satisfies ErrorResponse,
    { status: 409 },
  );

const nameField = () => screen.getByRole('textbox', { name: 'Name' });
const emailField = () => screen.getByRole('textbox', { name: 'Email Address' });
const passwordField = () => screen.getByLabelText('Password');
const signUpButton = () => screen.getByRole('button', { name: 'Sign up' });
const signUpRequests = () => requests.filter((request) => request === 'POST /api/auth/signup');

/** Sign up, signed out, with the form on screen. */
async function openSignUp(appRoutes: RouteObject[] = routes) {
  server.use(me.signedOut());
  const app = renderApp('/sign-up', appRoutes);
  await screen.findByRole('button', { name: 'Sign up' });
  return app;
}

async function fill(user: UserEvent, fullName: string, email: string, password: string) {
  if (fullName) await user.type(nameField(), fullName);
  if (email) await user.type(emailField(), email);
  if (password) await user.type(passwordField(), password);
}

/** A valid form: the request is sent. */
const fillValid = (user: UserEvent) => fill(user, 'Tanzir Rahman', 'marko@x.com', 'abcdef12');

const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

/** The text of the message a field points to with aria-describedby. */
const fieldError = (field: HTMLElement) => {
  const id = field.getAttribute('aria-describedby');
  return id ? document.getElementById(id)?.textContent : undefined;
};

// T1: the screen of 102, top to bottom (AC1, AC3, AC8; #63, #66, #70).
describe('Sign up screen', () => {
  it('shows the elements of 102 in order', async () => {
    await openSignUp();
    const order = [
      screen.getByRole('img', { name: 'FINEbank.IO' }),
      screen.getByRole('heading', { level: 1, name: 'Create an account' }),
      nameField(),
      emailField(),
      passwordField(),
      screen.getByText('By continuing, you agree to our', { exact: false }),
      signUpButton(),
      screen.getByText('or sign up with'),
      screen.getByRole('button', { name: 'Continue with Google' }),
      screen.getByRole('link', { name: 'Sign in here' }),
    ];

    for (let index = 1; index < order.length; index += 1) {
      expect(follows(order[index - 1]!, order[index]!)).toBe(true);
    }
  });

  it('has the placeholder only on Email, and lets password managers fill the fields', async () => {
    await openSignUp();

    expect(nameField()).not.toHaveAttribute('placeholder');
    expect(emailField()).toHaveAttribute('placeholder', 'hello@example.com');
    expect(passwordField()).not.toHaveAttribute('placeholder');
    expect(nameField()).toHaveAttribute('autocomplete', 'name');
    expect(emailField()).toHaveAttribute('type', 'email');
    expect(emailField()).toHaveAttribute('autocomplete', 'email');
    expect(passwordField()).toHaveAttribute('type', 'password');
    expect(passwordField()).toHaveAttribute('autocomplete', 'new-password');
  });

  it('shows the terms line with "terms of service." as plain text, not a link and not focusable', async () => {
    await openSignUp();
    const terms = screen.getByText('terms of service.');

    expect(terms.parentElement).toHaveTextContent(/^By continuing, you agree to our terms of service\.$/);
    expect(terms.closest('a, button')).toBeNull();
    expect(terms).not.toHaveAttribute('tabindex');
    expect(screen.queryByRole('link', { name: /terms/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /terms/ })).toBeNull();
  });

  it('links "Sign in here" to Login with no return target, and shows the Google G', async () => {
    await openSignUp();
    const signIn = screen.getByRole('link', { name: 'Sign in here' });

    expect(signIn).toHaveAttribute('href', '/login');
    expect(signIn.parentElement).toHaveTextContent(/^Already have an account\? Sign in here$/);
    const google = screen.getByRole('button', { name: 'Continue with Google' });
    expect(google).toHaveAttribute('type', 'button');
    expect(google.querySelector('img')).toHaveAttribute('src', googleUrl);
    expect(signUpButton()).toHaveAttribute('type', 'submit');
  });

  it('opens Login in the app on "Sign in here"', async () => {
    const { user, url } = await openSignUp();

    await user.click(screen.getByRole('link', { name: 'Sign in here' }));

    expect(url()).toBe('/login');
    expect(await screen.findByRole('button', { name: 'Login' })).toBeInTheDocument();
  });
});

// T2: the eye shows and hides the password, frontend only (AC2, #51).
describe('password eye', () => {
  it('masks, shows and masks again, with no request and no submit', async () => {
    const { user, url } = await openSignUp();
    const before = requests.length;

    await user.type(passwordField(), 'secret');
    expect(passwordField()).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(passwordField()).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(passwordField()).toHaveAttribute('type', 'password');

    expect(requests.length).toBe(before);
    expect(url()).toBe('/sign-up');
    expect(screen.queryByText('Name is required')).toBeNull();
  });
});

// T3: a new account is signed in and opens Overview, with no earlier cached data (AC4; #3, #15, #39, #95).
describe('successful sign up', () => {
  it('sends the parsed values, opens Overview in place of Sign up, and keeps only the new session', async () => {
    const bodies = signUpAnswers(created);
    server.use(me.signedOut(), today.answers());
    // The page before Sign up. Not `/`, which redirects to Overview (task 011, #39).
    const router = createMemoryRouter(probedRoutes, { initialEntries: ['/goals', '/sign-up'], initialIndex: 1 });
    const user = userEvent.setup();
    render(<AppProviders router={router} />);
    await screen.findByRole('button', { name: 'Sign up' });
    act(() => {
      appClient!.setQueryData(['balance'], { cents: 2505600 });
    });

    await fill(user, '  Tanzir Rahman ', ' Marko@X.com ', ' abcdef12 ');
    await user.click(signUpButton());

    await waitFor(() => expect(router.state.location.pathname).toBe('/overview'));
    // The shell's sidebar, since Sign up has a `main` too until it unmounts.
    expect(await screen.findByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(bodies).toEqual([{ fullName: 'Tanzir Rahman', email: 'marko@x.com', password: ' abcdef12 ' }]);
    expect(signUpRequests()).toHaveLength(1);
    expect(appClient!.getQueryData(['session'])).toEqual(newUser);
    expect(
      appClient!
        .getQueryCache()
        .getAll()
        .map((query) => query.queryKey),
      // The new session's own: the header date and Overview's accounts (task 013); the earlier balance is gone.
    ).toEqual([['session'], ['calendar', 'today'], ['accounts']]);
    // The mutation holds the password: it is gone once Sign up is.
    await waitFor(() => expect(appClient!.getMutationCache().getAll()).toEqual([]));

    await act(() => router.navigate(-1));
    expect(router.state.location.pathname).toBe('/goals');
  });

  it('sends the request on Enter in a field', async () => {
    const bodies = signUpAnswers(created);
    const { user, url } = await openSignUp();

    await fillValid(user);
    await user.type(passwordField(), '{Enter}');

    await waitFor(() => expect(url()).toBe('/overview'));
    expect(bodies).toEqual([{ fullName: 'Tanzir Rahman', email: 'marko@x.com', password: 'abcdef12' }]);
  });
});

// T4: the shared schema checks the fields before any request (AC5, AC18; #15, #87, #95).
describe('field errors', () => {
  it('shows each required message under its field and focuses Name, with no request', async () => {
    const { user } = await openSignUp();

    await user.click(signUpButton());

    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(fieldError(nameField())).toBe('Name is required');
    expect(fieldError(emailField())).toBe('Email is required');
    expect(fieldError(passwordField())).toBe('Password is required');
    for (const field of [nameField(), emailField(), passwordField()]) {
      expect(field).toHaveAttribute('aria-invalid', 'true');
    }
    expect(nameField()).toHaveFocus();
    expect(signUpRequests()).toEqual([]);
  });

  it.each([
    ['a Name of only spaces', '   ', 'marko@x.com', 'abcdef12', 'Name is required'],
    ['a 101-character Name', 'x'.repeat(101), 'marko@x.com', 'abcdef12', 'Name must be at most 100 characters'],
  ])('shows the Name message for %s', async (_case, fullName, email, password, message) => {
    const { user } = await openSignUp();

    await fill(user, fullName, email, password);
    await user.click(signUpButton());

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(fieldError(nameField())).toBe(message);
    expect(nameField()).toHaveFocus();
    expect(emailField()).not.toHaveAttribute('aria-invalid', 'true');
    expect(signUpRequests()).toEqual([]);
  });

  it('shows the email format message and focuses Email', async () => {
    const { user } = await openSignUp();

    await fill(user, 'Tanzir Rahman', 'a@b', 'abcdef12');
    await user.click(signUpButton());

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(fieldError(emailField())).toBe('Enter a valid email address');
    expect(emailField()).toHaveFocus();
    expect(signUpRequests()).toEqual([]);
  });

  it.each([
    ['a 7-character password', 'abcde12', 'Password must be at least 8 characters'],
    ['a password of letters only', 'abcdefgh', 'Password must contain at least one letter and one number'],
    ['a 129-character password', `a1${'x'.repeat(127)}`, 'Password must be at most 128 characters'],
  ])('shows the Password message for %s and focuses Password', async (_case, password, message) => {
    const { user } = await openSignUp();

    await fill(user, 'Tanzir Rahman', 'marko@x.com', password);
    await user.click(signUpButton());

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(fieldError(passwordField())).toBe(message);
    expect(passwordField()).toHaveAttribute('aria-invalid', 'true');
    expect(passwordField()).toHaveFocus();
    expect(signUpRequests()).toEqual([]);
  });

  it('follows the typing after the first submit', async () => {
    const { user } = await openSignUp();

    await user.click(signUpButton());
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    await user.type(nameField(), 'Tanzir');
    await waitFor(() => expect(screen.queryByText('Name is required')).toBeNull());
    expect(nameField()).not.toHaveAttribute('aria-invalid', 'true');

    await user.type(passwordField(), 'abc');
    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
    await user.type(passwordField(), 'def12');
    await waitFor(() => expect(screen.queryByText('Password must be at least 8 characters')).toBeNull());
    expect(fieldError(emailField())).toBe('Email is required');
  });
});

// T5: an email already registered shows its message under Email and focus moves there, so a screen reader reads
// the message through aria-describedby (AC6, #15; task 010 gate).
describe('email already registered', () => {
  it('shows the message under Email only, keeps the values and moves focus to Email', async () => {
    signUpAnswers(emailTaken);
    const { user, url } = await openSignUp();

    await fillValid(user);
    await user.click(signUpButton());

    expect(await screen.findByText('An account with this email already exists')).toBeInTheDocument();
    expect(fieldError(emailField())).toBe('An account with this email already exists');
    expect(emailField()).toHaveAttribute('aria-invalid', 'true');
    expect(nameField()).not.toHaveAttribute('aria-invalid', 'true');
    expect(passwordField()).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(nameField()).toHaveValue('Tanzir Rahman');
    expect(emailField()).toHaveValue('marko@x.com');
    expect(passwordField()).toHaveValue('abcdef12');
    expect(emailField()).toHaveFocus();
    expect(emailField()).toHaveAccessibleDescription('An account with this email already exists');
    expect(screen.getByRole('link', { name: 'Sign in here' })).toBeInTheDocument();
    expect(url()).toBe('/sign-up');
  });

  it('keeps the message while another field changes and removes it when Email changes', async () => {
    signUpAnswers(emailTaken);
    const { user } = await openSignUp();

    await fillValid(user);
    await user.click(signUpButton());
    expect(await screen.findByText('An account with this email already exists')).toBeInTheDocument();

    await user.type(passwordField(), '3');
    expect(fieldError(emailField())).toBe('An account with this email already exists');

    await user.clear(emailField());
    await user.type(emailField(), 'other@x.com');
    await waitFor(() => expect(screen.queryByText('An account with this email already exists')).toBeNull());
    expect(emailField()).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('removes the message when the next submit starts', async () => {
    let answer: () => Response | Promise<Response> = emailTaken;
    signUpAnswers(() => answer());
    const { user } = await openSignUp();

    await fillValid(user);
    await user.click(signUpButton());
    expect(await screen.findByText('An account with this email already exists')).toBeInTheDocument();

    answer = async () => {
      await delay('infinite');
      return created();
    };
    await user.click(signUpButton());

    await waitFor(() => expect(signUpRequests()).toHaveLength(2));
    expect(signUpButton()).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('An account with this email already exists')).toBeNull();
  });
});

// T6: one request while loading; the Sign up button keeps keyboard focus (AC7). The held answer is a 500: after a
// 409 focus moves to Email (T5).
describe('while the sign up request runs', () => {
  it('shows the busy button, keeps focus and sends one request', async () => {
    const { promise: released, resolve: release } = Promise.withResolvers<void>();
    signUpAnswers(async () => {
      await released;
      return HttpResponse.json({ message: 'Internal server error' }, { status: 500 });
    });
    const { user } = await openSignUp();
    await fillValid(user);

    await user.click(signUpButton());
    await waitFor(() => expect(signUpButton()).toHaveAttribute('aria-busy', 'true'));
    const button = signUpButton();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    expect(within(button).getByTestId('spinner')).toBeInTheDocument();
    expect(button).toHaveFocus();

    await user.click(button);
    await user.keyboard('{Enter}');
    expect(button).toHaveFocus();

    release();
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(button).not.toHaveAttribute('aria-busy');
    expect(button).not.toHaveAttribute('aria-disabled');
    expect(button).toHaveFocus();
    expect(signUpRequests()).toHaveLength(1);
  });

  it('sends nothing on Enter in a field', async () => {
    signUpAnswers(async () => {
      await delay('infinite');
      return created();
    });
    const { user } = await openSignUp();
    await fillValid(user);

    await user.click(signUpButton());
    await waitFor(() => expect(signUpButton()).toHaveAttribute('aria-busy', 'true'));
    await user.type(nameField(), '{Enter}');
    await user.type(emailField(), '{Enter}');
    await user.type(passwordField(), '{Enter}');

    expect(signUpRequests()).toHaveLength(1);
  });

  // While Overview still loads (a lazy route), the signed-in session must not make GuestOnly replace Sign up with
  // the empty background: the screen keeps its busy button until it opens Overview itself (task 010 gate).
  it('stays busy after the 201 until Overview opens', async () => {
    const bodies = signUpAnswers(created);
    server.use(me.signedOut());
    const slowRoutes: RouteObject[] = [
      { element: <GuestOnly />, children: [{ path: '/sign-up', element: <SignUpPage /> }] },
      {
        path: '/overview',
        lazy: async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return { Component: () => <main>Overview</main> };
        },
      },
    ];
    const { user, url } = renderApp('/sign-up', slowRoutes);
    await screen.findByRole('button', { name: 'Sign up' });
    await fillValid(user);

    await user.click(signUpButton());
    await waitFor(() => expect(bodies).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(signUpButton()).toHaveAttribute('aria-busy', 'true');
    await user.click(signUpButton());
    expect(await screen.findByText('Overview', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(url()).toBe('/overview');
    expect(signUpRequests()).toHaveLength(1);
  });
});

// T7: the text above the Sign up button by status (AC7; #6, #74, #97 a).
describe('failed requests', () => {
  it.each([
    ['a 500 in the shared shape', () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 })],
    ['a 502 in plain text', () => new HttpResponse('Bad Gateway', { status: 502 })],
    ['a network error', () => HttpResponse.error()],
  ])('shows "Something went wrong." for %s', async (_name, respond) => {
    signUpAnswers(respond);
    const { user } = await openSignUp();

    await fillValid(user);
    await user.click(signUpButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/^Something went wrong\.$/);
    expect(follows(screen.getByText('terms of service.'), alert)).toBe(true);
    expect(follows(alert, signUpButton())).toBe(true);
    expect(screen.queryByText(/Internal server error/)).toBeNull();
    expect(signUpButton()).toHaveFocus();
    expect(signUpButton()).not.toHaveAttribute('aria-disabled');
  });

  // Task 010 review, item 3: the message above Sign up is the last attempt's. It stays while typing and goes when
  // the next submit starts, also when that submit stops at a field error and sends nothing.
  it('keeps the message while typing and removes it when the next submit starts', async () => {
    signUpAnswers(() => HttpResponse.json({ message: 'Internal server error' }, { status: 500 }));
    const { user } = await openSignUp();

    await fillValid(user);
    await user.click(signUpButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');

    await user.type(passwordField(), '3');
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');

    await user.clear(nameField());
    await user.click(signUpButton());

    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(signUpRequests()).toHaveLength(1);
  });

  it("shows the server's message for a 4xx in the shared shape", async () => {
    signUpAnswers(() => HttpResponse.json({ message: 'Invalid CSRF request' }, { status: 403 }));
    const { user } = await openSignUp();

    await fillValid(user);
    await user.click(signUpButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(/^Invalid CSRF request$/);
    expect(emailField()).not.toHaveAttribute('aria-invalid', 'true');
  });

  it("shows a 400's field errors under their fields", async () => {
    signUpAnswers(() =>
      HttpResponse.json(
        {
          message: 'Validation failed',
          fieldErrors: { fullName: 'Name is required', password: 'Password must be at least 8 characters' },
        } satisfies ErrorResponse,
        { status: 400 },
      ),
    );
    const { user } = await openSignUp();

    await fillValid(user);
    await user.click(signUpButton());

    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(fieldError(nameField())).toBe('Name is required');
    expect(fieldError(passwordField())).toBe('Password must be at least 8 characters');
    expect(emailField()).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(signUpButton()).toHaveFocus();
  });
});

// T8: "terms of service." is visual only (AC8; #15).
describe('visual-only items', () => {
  it('does nothing on "terms of service."', async () => {
    const { user, url } = await openSignUp();
    const before = requests.length;

    await user.click(screen.getByText('terms of service.'));

    expect(url()).toBe('/sign-up');
    expect(requests.length).toBe(before);
    expect(screen.queryByText('Name is required')).toBeNull();
  });
});

// Task 012 T19: "Continue with Google" starts the sign-in with no return target, so Overview opens; it replaces the
// Google half of task 010's T8, written for "visual only until task 012" (AC1, AC15; US-02 criterion 9).
describe('Continue with Google', () => {
  beforeEach(() => {
    vi.mocked(startGoogleSignIn).mockClear();
  });

  it('starts the sign-in without returnTo and sends no request of its own', async () => {
    const { user, url } = await openSignUp();
    const before = requests.length;

    await user.click(screen.getByRole('button', { name: 'Continue with Google' }));

    expect(vi.mocked(startGoogleSignIn).mock.calls).toEqual([[]]);
    expect(requests.length).toBe(before);
    expect(url()).toBe('/sign-up');
    expect(screen.queryByText('Name is required')).toBeNull();
  });
});

// T9: Sign up is for signed-out visitors only (AC9; #3, #97 b and c).
describe('session check', () => {
  it('sends a signed-in user to Overview without showing the form', async () => {
    server.use(me.signedIn());
    const { router, url } = renderApp('/sign-up');

    await waitFor(() => expect(url()).toBe('/overview'));
    expect(router.state.historyAction).toBe('REPLACE');
    expect(screen.queryByRole('button', { name: 'Sign up' })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('renders nothing while the check runs', async () => {
    server.use(me.pending());
    const { container, url } = renderApp('/sign-up');

    // Give the app time to render whatever it would render while waiting.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container).toBeEmptyDOMElement();
    expect(url()).toBe('/sign-up');
  });

  it('shows the form when the first check fails', async () => {
    server.use(
      http.get('*/api/auth/me', () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 })),
    );
    const { url } = renderApp('/sign-up');

    expect(await screen.findByRole('button', { name: 'Sign up' })).toBeInTheDocument();
    expect(url()).toBe('/sign-up');
  });
});
