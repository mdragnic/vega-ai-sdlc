import { act, screen, waitFor, within } from '@testing-library/react';
import { focusManager, onlineManager, type QueryClient, useQueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useEffect } from 'react';
import type { RouteObject } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { routes } from '../../src/app/routes';
import { appPaths, me, renderApp, signedInDefaults, signedInUser, today, TODAY } from '../support/app';

const server = setupServer(...signedInDefaults());

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
  vi.useRealTimers();
  vi.restoreAllMocks();
  // Hand window focus back to the browser events, also after a failed test.
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
});
afterAll(() => server.close());

const todayPath = '/api/calendar/today';
const logoutPath = '/api/auth/logout';
const logoutFailedMessage = "Couldn't log out. Please try again.";

/** Counts the requests to one path. */
function countRequests(path: string): () => number {
  let count = 0;
  server.events.on('request:start', ({ request }) => {
    if (new URL(request.url).pathname === path) count += 1;
  });
  return () => count;
}

/** The query client the app uses, captured from inside it. */
let appClient: QueryClient | undefined;

function ClientProbe() {
  const client = useQueryClient();
  useEffect(() => {
    appClient = client;
  }, [client]);
  return null;
}

/** The real route table with `element` as the content of the route at `path`. */
function withContent(table: RouteObject[], path: string, element: RouteObject['element']): RouteObject[] {
  return table.map((route) => {
    if (route.path === path) return { ...route, element };
    return route.children ? { ...route, children: withContent(route.children, path, element) } : route;
  });
}

/** The app with a probe of the query client inside the Bills page, and data of the session in the cache. */
async function openBillsWithData() {
  const view = renderApp('/bills', withContent(routes, '/bills', <ClientProbe />));
  expect(await within(await screen.findByRole('banner')).findByText('22 Oct, 2026')).toBeInTheDocument();
  act(() => {
    appClient!.setQueryData(['balance'], { cents: 2505600 });
  });
  return view;
}

const cacheKeys = () =>
  appClient!
    .getQueryCache()
    .getAll()
    .map((query) => JSON.stringify(query.queryKey));

const sidebar = () => screen.getByRole('navigation', { name: 'Main' });
const sidebarLink = (name: string) => within(sidebar()).getByRole('link', { name });
const currentLinks = () =>
  within(sidebar())
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.textContent);
const logoutButton = () => screen.getByRole('button', { name: 'Logout' });

const refocusWindow = () =>
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });

/** The sidebar item that is Active on each app path (AC2, #47). */
const activeItem: Record<(typeof appPaths)[number], string> = {
  '/overview': 'Overview',
  '/balances': 'Balances',
  '/balances/12': 'Balances',
  '/transactions': 'Transactions',
  '/bills': 'Bills',
  '/expenses': 'Expenses',
  '/goals': 'Goals',
  '/settings/account': 'Settings',
  '/settings/security': 'Settings',
};

/** The sections of Overview in 104's order (task 013). */
const overviewSections = [
  'Total Balance',
  'Goals',
  'Upcoming Bill',
  'Recent Transaction',
  'Statistics',
  'Expenses Breakdown',
];

/** The sections of the screens built so far (Overview, task 013; Balances, task 019); the others are empty. */
const builtSections: Partial<Record<(typeof appPaths)[number], string[]>> = {
  '/overview': overviewSections,
  '/balances': ['Balances'],
};

// T4: every app path opens in the shell with the signed-in user and today's date (AC1, AC2, AC4).
describe('the shell on each app path', () => {
  it.each(appPaths)('shows the user, the date and the section of %s', async (path) => {
    server.use(me.signedIn(), today.answers());
    const { container, url } = renderApp(path);

    expect(await within(await screen.findByRole('banner')).findByText('22 Oct, 2026')).toHaveAttribute(
      'datetime',
      TODAY,
    );
    expect(within(sidebar().parentElement!).getByText('Tanzir Rahman')).toBeInTheDocument();
    const avatar = screen.getByRole('img', { name: 'Tanzir Rahman' });
    expect(avatar).toHaveTextContent('TR');
    // The initials avatar is no photo. Overview's Total Balance card shows a card network logo (task 013), and the
    // Balances cards theirs (task 019).
    const sections = builtSections[path] ?? [];
    expect((sections.length > 0 ? sidebar().parentElement! : container).querySelector('img')).toBeNull();
    expect(currentLinks()).toEqual([activeItem[path]]);
    // The greeting on Overview only.
    expect(screen.queryByText(/Hello/)?.textContent ?? null).toBe(path === '/overview' ? 'Hello Tanzir' : null);
    // Overview holds its six sections (task 013) and Balances its one (task 019); the other screens are empty until
    // their tasks, Account Details (`/balances/12`) until task 021.
    const main = screen.getByRole('main');
    expect(
      within(main)
        .queryAllByRole('region')
        .map((region) => within(region).getByRole('heading', { level: 2 }).textContent),
    ).toEqual(sections);
    expect(main.childNodes.length === 0).toBe(sections.length === 0);
    expect(url()).toBe(path);
  });

  // Task 019: Balances fills its content; its cards show the card network logos.
  it('shows the Balances section with its cards’ logos on /balances', async () => {
    server.use(me.signedIn(), today.answers());
    renderApp('/balances');

    const logos = await within(await screen.findByRole('main')).findAllByRole('img');
    expect(logos.map((logo) => logo.getAttribute('alt'))).toEqual(['Mastercard', 'VISA']);
  });

  it('greets with the first word of the Full Name', async () => {
    server.use(
      http.get('*/api/auth/me', () => HttpResponse.json({ ...signedInUser, fullName: 'Ana Marija Kovač' })),
      today.answers(),
    );
    renderApp('/overview');

    expect(await screen.findByText('Hello Ana')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ana Marija Kovač' })).toHaveTextContent('AK');
  });
});

// T5: the sidebar links and "View profile" move between pages inside the same shell (AC2, AC3, AC12).
describe('moving between pages', () => {
  it('opens each section from the sidebar, then the Account tab from "View profile", in one shell', async () => {
    server.use(me.signedIn(), today.answers());
    const { user, url } = renderApp('/overview');
    await within(await screen.findByRole('banner')).findByText('22 Oct, 2026');
    const shell = sidebar();

    for (const [name, path] of [
      ['Balances', '/balances'],
      ['Transactions', '/transactions'],
      ['Bills', '/bills'],
      ['Expenses', '/expenses'],
      ['Goals', '/goals'],
      ['Settings', '/settings/account'],
      ['Overview', '/overview'],
    ] as const) {
      await user.click(sidebarLink(name));
      await waitFor(() => expect(url()).toBe(path));
      expect(currentLinks()).toEqual([name]);
      // The same sidebar element: the shell was not mounted again.
      expect(sidebar()).toBe(shell);
    }

    await user.click(screen.getByRole('link', { name: 'View profile' }));
    await waitFor(() => expect(url()).toBe('/settings/account'));
    expect(currentLinks()).toEqual(['Settings']);
    expect(sidebar()).toBe(shell);
  });
});

// T6: the header without its date while it loads and after a failure (AC6, #100 a).
describe('the header date while it loads or fails', () => {
  it('shows everything but the date while the request runs, and adds only the date when it arrives', async () => {
    const { promise: answered, resolve: answer } = Promise.withResolvers<void>();
    server.use(
      me.signedIn(),
      http.get('*/api/calendar/today', async () => {
        await answered;
        return HttpResponse.json({ today: TODAY });
      }),
    );
    renderApp('/overview');
    const header = await screen.findByRole('banner');
    const greeting = screen.getByText('Hello Tanzir');
    const [chevron, bell] = header.querySelectorAll('svg');
    const search = screen.getByRole('search');

    // The header's date; Overview's bill rows have their own `time` elements (task 015).
    expect(header.querySelector('time')).toBeNull();
    expect(greeting.nextElementSibling).toBe(chevron);
    expect(chevron!.nextElementSibling).toBe(bell);

    answer();
    const date = await within(await screen.findByRole('banner')).findByText('22 Oct, 2026');

    expect(chevron!.nextElementSibling).toBe(date);
    expect(date.nextElementSibling).toBe(bell);
    // The same elements, not new ones.
    expect(screen.getByText('Hello Tanzir')).toBe(greeting);
    expect(screen.getByRole('search')).toBe(search);
  });

  it('leaves the date out, with no message, after the request and its 3 retries fail', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.use(
      me.signedIn(),
      http.get('*/api/calendar/today', () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 })),
    );
    const todayRequests = countRequests(todayPath);
    const { user } = renderApp('/overview');
    await screen.findByText('Hello Tanzir');

    await vi.advanceTimersByTimeAsync(30_000);

    expect(todayRequests()).toBe(4);
    // The header's date; Overview's bill rows have their own `time` elements (task 015).
    expect(screen.getByRole('banner').querySelector('time')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    // Everything else works.
    await user.click(sidebarLink('Bills'));
    expect(currentLinks()).toEqual(['Bills']);
  });

  it('keeps a date already shown when a later request fails', async () => {
    server.use(me.signedIn(), today.answers());
    renderApp('/overview');
    await within(await screen.findByRole('banner')).findByText('22 Oct, 2026');

    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.use(
      http.get('*/api/calendar/today', () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 })),
    );
    const todayRequests = countRequests(todayPath);
    refocusWindow();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(todayRequests()).toBe(4);
    expect(within(screen.getByRole('banner')).getByText('22 Oct, 2026')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

// T7: the date is asked for again on window focus and on a move to another page, never on a timer (AC7, #100 b).
describe('the header date after midnight', () => {
  it('shows the new date when the window gets focus back', async () => {
    server.use(me.signedIn(), today.answers('2026-10-22'));
    renderApp('/overview');
    await within(await screen.findByRole('banner')).findByText('22 Oct, 2026');

    server.use(today.answers('2026-10-23'));
    refocusWindow();

    expect(await within(await screen.findByRole('banner')).findByText('23 Oct, 2026')).toBeInTheDocument();
  });

  it('shows the new date when another app page opens', async () => {
    server.use(me.signedIn(), today.answers('2026-10-22'));
    const { user } = renderApp('/overview');
    await within(await screen.findByRole('banner')).findByText('22 Oct, 2026');

    server.use(today.answers('2026-10-23'));
    const todayRequests = countRequests(todayPath);
    await user.click(sidebarLink('Balances'));

    expect(await within(await screen.findByRole('banner')).findByText('23 Oct, 2026')).toBeInTheDocument();
    expect(todayRequests()).toBe(1);
  });

  it('does not ask again while time passes with no focus or move', async () => {
    server.use(me.signedIn(), today.answers('2026-10-22'));
    renderApp('/overview');
    await within(await screen.findByRole('banner')).findByText('22 Oct, 2026');
    const todayRequests = countRequests(todayPath);

    vi.useFakeTimers({ shouldAdvanceTime: true });
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);

    expect(todayRequests()).toBe(0);
    expect(within(screen.getByRole('banner')).getByText('22 Oct, 2026')).toBeInTheDocument();
  });
});

// T8: Logout ends the session and opens Login with no return target (AC8, #3, #39).
describe('Logout', () => {
  it('sends one request and on its 204 opens exactly /login, with the session data gone', async () => {
    server.use(
      me.signedIn(),
      today.answers(),
      http.post('*/api/auth/logout', () => new HttpResponse(null, { status: 204 })),
    );
    const logoutRequests = countRequests(logoutPath);
    const { router, user, url } = await openBillsWithData();
    expect(cacheKeys()).toEqual(expect.arrayContaining(['["balance"]', '["calendar","today"]']));
    server.use(me.signedOut());

    await user.click(logoutButton());

    await waitFor(() => expect(url()).toBe('/login'));
    expect(router.state.historyAction).toBe('REPLACE');
    expect(await screen.findByRole('button', { name: 'Login' })).toBeInTheDocument();
    expect(logoutRequests()).toBe(1);
    expect(
      appClient!
        .getQueryCache()
        .getAll()
        .map((query) => [query.queryKey, query.state.data]),
    ).toEqual([[['session'], null]]);
  });

  // Found in the manual check: the logout is forgotten (its mutation collected) once the shell is gone, which can
  // happen before Login has opened. The guard must keep the Login it chose; a slow Login route makes that moment
  // long enough to see.
  it('opens /login without a return target, also when Login takes time to open', async () => {
    const { promise: loginLoaded, resolve: loadLogin } = Promise.withResolvers<void>();
    server.use(
      me.signedIn(),
      today.answers(),
      http.post('*/api/auth/logout', () => new HttpResponse(null, { status: 204 })),
    );
    const slowLogin = routes.map((route) =>
      route.element && route.children?.some((child) => child.path === '/login')
        ? {
            ...route,
            children: route.children.map((child) =>
              child.path === '/login'
                ? {
                    path: '/login',
                    lazy: async () => {
                      await loginLoaded;
                      return { element: child.element };
                    },
                  }
                : child,
            ),
          }
        : route,
    ) as RouteObject[];
    const { user, url } = renderApp('/goals', slowLogin);
    await within(await screen.findByRole('banner')).findByText('22 Oct, 2026');

    await user.click(logoutButton());
    // The shell is gone and the logout forgotten while Login still loads.
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 50));
    loadLogin();

    expect(await screen.findByRole('button', { name: 'Login' })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(url()).toBe('/login');
  });

  // Code review: offline, a paused request would show nothing and leave Logout disabled (#100 c).
  it('says so when the browser is offline, and logs out with the next click once it is back', async () => {
    server.use(
      me.signedIn(),
      today.answers(),
      http.post('*/api/auth/logout', () => HttpResponse.error()),
    );
    const { user, url } = renderApp('/bills');
    await within(await screen.findByRole('banner')).findByText('22 Oct, 2026');
    act(() => onlineManager.setOnline(false));

    await user.click(logoutButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(logoutFailedMessage);
    expect(logoutButton()).not.toHaveAttribute('aria-disabled');
    expect(url()).toBe('/bills');

    // Back online the app checks the session again; the server still has it until the logout succeeds.
    act(() => onlineManager.setOnline(true));
    server.use(http.post('*/api/auth/logout', () => new HttpResponse(null, { status: 204 })));
    await user.click(logoutButton());

    await waitFor(() => expect(url()).toBe('/login'));
  });

  // T9: one request at a time (AC9, #100 c).
  it('sends nothing more while its request runs, keeping focus and its look', async () => {
    const { promise: answered, resolve: answer } = Promise.withResolvers<void>();
    server.use(
      me.signedIn(),
      today.answers(),
      http.post('*/api/auth/logout', async () => {
        await answered;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const logoutRequests = countRequests(logoutPath);
    const { user, url } = renderApp('/bills');
    await within(await screen.findByRole('banner')).findByText('22 Oct, 2026');
    const button = logoutButton();
    const idleClass = button.className;

    await user.click(button);
    await waitFor(() => expect(logoutRequests()).toBe(1));
    await user.click(button);
    await user.keyboard('{Enter}');
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(logoutRequests()).toBe(1);
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    expect(button.className).toBe(idleClass);

    answer();
    await waitFor(() => expect(url()).toBe('/login'));
  });

  // T10: a failed logout keeps the user signed in on the page and says so (AC10, #100 c).
  it('keeps the session and the page on a 500 and on a network error, says so, and logs out on the next 204', async () => {
    const answers: (() => Response)[] = [
      () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 }),
      () => HttpResponse.error(),
      () => new HttpResponse(null, { status: 204 }),
    ];
    const held: PromiseWithResolvers<void>[] = answers.map(() => Promise.withResolvers<void>());
    let calls = 0;
    server.use(
      me.signedIn(),
      today.answers(),
      http.post('*/api/auth/logout', async () => {
        const call = calls;
        calls += 1;
        await held[call]!.promise;
        return answers[call]!();
      }),
    );
    const { user, url } = await openBillsWithData();

    for (const call of [0, 1]) {
      await user.click(logoutButton());
      // While the request runs, an earlier message is gone.
      await waitFor(() => expect(calls).toBe(call + 1));
      expect(screen.queryByRole('alert')).toBeNull();
      held[call]!.resolve();

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(logoutFailedMessage);
      expect(alert.nextElementSibling).toBe(logoutButton());
      expect(logoutButton()).toHaveFocus();
      expect(logoutButton()).not.toHaveAttribute('aria-disabled');
      expect(url()).toBe('/bills');
      expect(appClient!.getQueryData(['session'])).toEqual(signedInUser);
      expect(appClient!.getQueryData(['balance'])).toEqual({ cents: 2505600 });
    }

    await user.click(logoutButton());
    await waitFor(() => expect(calls).toBe(3));
    expect(screen.queryByRole('alert')).toBeNull();
    server.use(me.signedOut());
    held[2]!.resolve();

    await waitFor(() => expect(url()).toBe('/login'));
  });
});

// T11: signed out, the shell never shows (AC13, #97 c).
describe('signed out', () => {
  it('shows no shell while the session check runs', async () => {
    server.use(me.pending(), today.answers());
    const { container } = renderApp('/overview');

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it('asks for no date', async () => {
    server.use(me.signedOut(), today.answers());
    const todayRequests = countRequests(todayPath);
    const { url } = renderApp('/goals');

    await waitFor(() => expect(url()).toBe('/login?returnTo=%2Fgoals'));
    expect(todayRequests()).toBe(0);
  });
});

// T12: /settings opens the Account tab (AC14, #100).
describe('/settings', () => {
  it('opens the Account tab with Settings Active, replacing /settings', async () => {
    server.use(me.signedIn(), today.answers());
    const { router, url } = renderApp('/settings');

    await waitFor(() => expect(url()).toBe('/settings/account'));
    expect(router.state.historyAction).toBe('REPLACE');
    await within(await screen.findByRole('banner')).findByText('22 Oct, 2026');
    expect(currentLinks()).toEqual(['Settings']);
  });

  it('opens Login with the Account tab as the return target when signed out', async () => {
    server.use(me.signedOut());
    const { url } = renderApp('/settings');

    await waitFor(() => expect(url()).toBe('/login?returnTo=%2Fsettings%2Faccount'));
  });
});

describe('a session that ends while the shell is open', () => {
  it('removes the date with the rest of the cached data', async () => {
    server.use(me.signedIn(), today.answers());
    const { url } = await openBillsWithData();

    server.use(me.signedOut());
    refocusWindow();

    await waitFor(() => expect(url()).toBe('/login?returnTo=%2Fbills'));
    expect(cacheKeys()).toEqual(['["session"]']);
  });
});

// The ScrollRestoration in the shell needs the data router; this guards against a render error.
describe('rendering', () => {
  it('logs no console errors while moving between pages', async () => {
    const consoleError = vi.spyOn(console, 'error');
    server.use(me.signedIn(), today.answers());
    const { user } = renderApp('/overview');
    await within(await screen.findByRole('banner')).findByText('22 Oct, 2026');

    await user.click(sidebarLink('Goals'));
    await within(await screen.findByRole('banner')).findByText('22 Oct, 2026');

    expect(consoleError).not.toHaveBeenCalled();
  });
});
