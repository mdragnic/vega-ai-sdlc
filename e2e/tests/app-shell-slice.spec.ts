import type { Locator, Page, Request, Route } from '@playwright/test';

import { FRONTEND_URL } from '../constants';
import { expect, test } from '../fixtures';
import { box, computed, expectRing, sessionCookie, signUp, tokenColor, type User } from '../helpers';

const sections = ['Overview', 'Balances', 'Transactions', 'Bills', 'Expenses', 'Goals', 'Settings'] as const;
const logoutFailedMessage = "Couldn't log out. Please try again.";
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
const builtSections: Partial<Record<string, string[]>> = {
  '/overview': overviewSections,
  '/balances': ['Balances'],
};

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const navBar = (page: Page) => sidebar(page).locator('..');
const activeItem = (page: Page) => sidebar(page).locator('a[aria-current="page"]');
const header = (page: Page) => page.getByRole('banner');
const headerDate = (page: Page) => header(page).locator('time');
const logoutButton = (page: Page) => page.getByRole('button', { name: 'Logout' });
const loginButton = (page: Page) => page.getByRole('button', { name: 'Login' });

async function logIn(page: Page, user: User) {
  await page.getByRole('textbox', { name: 'Email Address' }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await loginButton(page).click();
}

/** Opens `path` signed in and waits for the shell with its date. */
async function openSignedIn(page: Page, path: string, date = '22 Oct, 2026') {
  await page.goto(path);
  await expect(headerDate(page)).toHaveText(date);
}

/** The window gets focus back, as TanStack Query sees it (task 009). */
const refocus = (page: Page) =>
  page.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));

const moveBackendClock = async (page: Page, now: string) =>
  expect((await page.request.put('/api/test/clock', { data: { now } })).ok()).toBe(true);

/** A block taller than the window at the end of the content area, so the page scrolls. */
const injectTallContent = (page: Page) =>
  page.getByRole('main').evaluate((main) => {
    const block = document.createElement('div');
    block.style.height = '3000px';
    main.append(block);
  });

const app = [
  ['/overview', 'Overview'],
  ['/balances', 'Balances'],
  ['/balances/abc', 'Balances'],
  ['/transactions', 'Transactions'],
  ['/bills', 'Bills'],
  ['/expenses', 'Expenses'],
  ['/goals', 'Goals'],
  ['/settings/account', 'Settings'],
  ['/settings/security', 'Settings'],
] as const;

// T15: every app path in the shell with the signed-in user, the Active item and the date (AC1, AC2, AC4).
test('opens every app path in the shell for the signed-in user', async ({ page }) => {
  await signUp(page.request);

  for (const [path, item] of app) {
    await openSignedIn(page, path);
    await expect(page).toHaveURL(`${FRONTEND_URL}${path}`);
    await expect(navBar(page).getByText('Tanzir Rahman', { exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Tanzir Rahman' })).toHaveText('TR');
    const pageSections = builtSections[path] ?? [];
    // The initials avatar is no photo. Overview's Total Balance card shows a card network logo (task 013), and the
    // Balances cards theirs (task 019).
    await expect((pageSections.length > 0 ? navBar(page) : page).locator('img')).toHaveCount(0);
    await expect(activeItem(page)).toHaveCount(1);
    await expect(activeItem(page)).toHaveText(item);
    await expect(header(page).getByText(/^Hello /)).toHaveCount(path === '/overview' ? 1 : 0);
    if (path === '/overview') await expect(header(page).getByText('Hello Tanzir')).toBeVisible();
    // Overview holds its six sections (task 013) and Balances its one with the cards' logos (task 019); the other
    // screens are empty until their tasks, Account Details (`/balances/abc`) until task 021.
    await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(pageSections);
    if (path === '/balances') {
      await expect(page.getByRole('main').getByRole('img')).toHaveCount(2);
      await expect(page.getByRole('main').getByRole('img', { name: 'Mastercard' })).toBeVisible();
      await expect(page.getByRole('main').getByRole('img', { name: 'VISA' })).toBeVisible();
    }
    if (pageSections.length === 0) await expect(page.getByRole('main')).toBeEmpty();
  }
});

// T16: the backend's today in the browser's zone, never the browser's clock (AC5, #54, #80).
for (const [zone, date] of [
  ['Europe/Belgrade', '23 Oct, 2026'],
  ['America/New_York', '22 Oct, 2026'],
] as const) {
  test.describe(`in ${zone}`, () => {
    test.use({ timezoneId: zone });

    test(`shows ${date} at 2026-10-22T22:30:00Z, asked for with the zone`, async ({ page }) => {
      await moveBackendClock(page, '2026-10-22T22:30:00Z');
      await signUp(page.request);
      // The browser's own clock says something else entirely.
      await page.clock.setFixedTime('2030-06-15T12:00:00Z');
      const zones: (string | undefined)[] = [];
      page.on('request', (request) => {
        if (request.url().endsWith('/api/calendar/today')) zones.push(request.headers()['x-time-zone']);
      });

      await openSignedIn(page, '/overview', date);

      expect(zones.length).toBeGreaterThan(0);
      expect(new Set(zones)).toEqual(new Set([zone]));
    });
  });
}

// T17: a page open past midnight shows the new date on focus or on the next page (AC7, #100 b).
test('shows the new date after midnight on window focus and on a move to another page', async ({ page }) => {
  await moveBackendClock(page, '2026-10-22T21:59:00Z');
  await signUp(page.request);
  await openSignedIn(page, '/overview', '22 Oct, 2026');

  await moveBackendClock(page, '2026-10-22T22:01:00Z');
  await refocus(page);
  await expect(headerDate(page)).toHaveText('23 Oct, 2026');

  await moveBackendClock(page, '2026-10-22T21:59:00Z');
  await page.reload();
  await expect(headerDate(page)).toHaveText('22 Oct, 2026');
  await moveBackendClock(page, '2026-10-22T22:01:00Z');
  await sidebar(page).getByRole('link', { name: 'Balances' }).click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/balances`);
  await expect(headerDate(page)).toHaveText('23 Oct, 2026');
});

// T18: the shell without its date while it loads and after it fails; nothing moves (AC6, #100 a).
test('shows the shell without the date while it loads and after it fails, with nothing moved', async ({ page }) => {
  await signUp(page.request);
  await openSignedIn(page, '/overview');
  const withDate = {
    chevron: await box(header(page).locator('svg').first()),
    search: await box(header(page).getByRole('search')),
  };

  const { promise: released, resolve: release } = Promise.withResolvers<void>();
  let todayRequests = 0;
  await page.route('**/api/calendar/today', async (route) => {
    todayRequests += 1;
    await released;
    await route.fulfill({ status: 500, json: { message: 'Internal server error' } });
  });
  await page.reload();

  await expect(header(page).getByText('Hello Tanzir')).toBeVisible();
  await expect(navBar(page).getByText('Tanzir Rahman', { exact: true })).toBeVisible();
  await expect(headerDate(page)).toHaveCount(0);
  expect(await box(header(page).locator('svg').first())).toEqual(withDate.chevron);
  expect(await box(header(page).getByRole('search'))).toEqual(withDate.search);

  release();
  // The first request and its 3 retries (1, 2 and 4 seconds apart).
  await expect.poll(() => todayRequests, { timeout: 15_000 }).toBe(4);
  await page.waitForTimeout(500);
  await expect(headerDate(page)).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await box(header(page).getByRole('search'))).toEqual(withDate.search);
});

// T19: the sidebar and "View profile" move between pages without a full page load (AC3, AC12).
test('moves between pages from the sidebar and "View profile" without a page load', async ({ page }) => {
  await signUp(page.request);
  await openSignedIn(page, '/overview');
  let loads = 0;
  page.on('load', () => {
    loads += 1;
  });
  // A full page load would drop this.
  await page.evaluate(() => Object.assign(window, { shellMarker: true }));

  for (const [name, path] of [
    ['Balances', '/balances'],
    ['Transactions', '/transactions'],
    ['Bills', '/bills'],
    ['Expenses', '/expenses'],
    ['Goals', '/goals'],
    ['Settings', '/settings/account'],
    ['Overview', '/overview'],
  ] as const) {
    await sidebar(page).getByRole('link', { name }).click();
    await expect(page).toHaveURL(`${FRONTEND_URL}${path}`);
    await expect(activeItem(page)).toHaveText(name);
  }
  await page.getByRole('link', { name: 'View profile' }).click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/settings/account`);
  await expect(activeItem(page)).toHaveText('Settings');

  expect(loads).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { shellMarker?: boolean }).shellMarker)).toBe(true);
});

// T20: Logout ends the session and opens Login with no return target; the next login opens Overview (AC8, #3).
test('logs out to /login with one request and no dialog, and the next login opens Overview', async ({ page }) => {
  const user = await signUp(page.request);
  await openSignedIn(page, '/bills');
  page.on('dialog', (dialog) => {
    throw new Error(`Unexpected dialog: ${dialog.message()}`);
  });
  const logouts: Request[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/auth/logout')) logouts.push(request);
  });

  await logoutButton(page).click();

  await expect(page).toHaveURL(`${FRONTEND_URL}/login`);
  await expect(loginButton(page)).toBeVisible();
  expect(logouts).toHaveLength(1);
  expect(logouts[0]!.method()).toBe('POST');
  expect((await logouts[0]!.response())?.status()).toBe(204);
  expect(await sessionCookie(page)).toBeUndefined();

  await logIn(page, user);
  await expect(page).toHaveURL(`${FRONTEND_URL}/overview`);
  await expect(headerDate(page)).toHaveText('22 Oct, 2026');
});

test('after Logout, Back and an app URL open Login, never an app page', async ({ page }) => {
  await signUp(page.request);
  await openSignedIn(page, '/overview');
  await sidebar(page).getByRole('link', { name: 'Bills' }).click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/bills`);

  await logoutButton(page).click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/login`);
  // Back once Login shows, as a person would: the URL changes a moment before the screen does.
  await expect(loginButton(page)).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(`${FRONTEND_URL}/login?returnTo=%2Foverview`);
  await expect(loginButton(page)).toBeVisible();
  await expect(sidebar(page)).toHaveCount(0);

  await page.goto('/goals');
  await expect(page).toHaveURL(`${FRONTEND_URL}/login?returnTo=%2Fgoals`);
  await expect(loginButton(page)).toBeVisible();
  await expect(sidebar(page)).toHaveCount(0);
});

// T21: one logout request at a time; a failure keeps the user signed in and says so (AC9, AC10, #100 c).
test('sends one logout at a time, and a failed logout keeps the session and says so', async ({ page }) => {
  await signUp(page.request);
  await openSignedIn(page, '/bills');
  const held: Route[] = [];
  await page.route('**/api/auth/logout', (route) => {
    held.push(route);
  });
  const message = page.getByRole('alert');

  await logoutButton(page).click();
  await expect.poll(() => held.length).toBe(1);
  // Forced: Playwright waits for an aria-disabled button to be enabled, but a user can still click it.
  await logoutButton(page).click({ force: true });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  expect(held).toHaveLength(1);
  await expect(logoutButton(page)).toBeFocused();
  await expect(logoutButton(page)).toHaveAttribute('aria-disabled', 'true');

  const failures: ((route: Route) => Promise<void>)[] = [
    (route) => route.fulfill({ status: 500, json: { message: 'Internal server error' } }),
    (route) => route.abort('failed'),
  ];
  for (const [index, fail] of failures.entries()) {
    if (index > 0) {
      await logoutButton(page).click();
      await expect.poll(() => held.length).toBe(index + 1);
      // Gone while the new request runs.
      await expect(message).toHaveCount(0);
    }
    await fail(held[index]!);

    await expect(message).toHaveText(logoutFailedMessage);
    // Right above Logout, inside the sidebar.
    const messageBox = await box(message);
    const logoutBox = await box(logoutButton(page));
    expect(messageBox.y + messageBox.height).toBeLessThanOrEqual(logoutBox.y);
    expect(logoutBox.y - (messageBox.y + messageBox.height)).toBeLessThanOrEqual(16);
    expect(messageBox.x + messageBox.width).toBeLessThanOrEqual(280);
    expect(logoutBox).toEqual({ x: 28, y: 780, width: 224, height: 48 });
    await expect(logoutButton(page)).toBeFocused();
    await expect(page).toHaveURL(`${FRONTEND_URL}/bills`);
    expect(await sessionCookie(page)).toBeDefined();
    expect((await page.request.get('/api/auth/me')).status()).toBe(200);
    await expect(headerDate(page)).toHaveText('22 Oct, 2026');
  }

  await logoutButton(page).click();
  await expect.poll(() => held.length).toBe(3);
  await expect(message).toHaveCount(0);
  await held[2]!.continue();
  await expect(page).toHaveURL(`${FRONTEND_URL}/login`);
});

// Code review: with the browser offline the logout fails at once and says so, instead of waiting (#100 c).
test('says so when Logout is clicked offline, and logs out once back online', async ({ page }) => {
  await signUp(page.request);
  await openSignedIn(page, '/bills');

  await page.context().setOffline(true);
  await logoutButton(page).click();

  await expect(page.getByRole('alert')).toHaveText(logoutFailedMessage);
  await expect(logoutButton(page)).not.toHaveAttribute('aria-disabled');
  await expect(logoutButton(page)).toBeFocused();
  await expect(page).toHaveURL(`${FRONTEND_URL}/bills`);

  await page.context().setOffline(false);
  await logoutButton(page).click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/login`);
  expect(await sessionCookie(page)).toBeUndefined();
});

// T22: a logout in one tab ends the session in the other on its next focus (AC11, #3).
test('opens Login in a second tab when it gets focus back after a logout in the first', async ({ page }) => {
  await signUp(page.request);
  await openSignedIn(page, '/overview');
  const second = await page.context().newPage();
  await second.goto('/goals');
  await expect(headerDate(second)).toHaveText('22 Oct, 2026');

  await page.bringToFront();
  await logoutButton(page).click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/login`);

  await second.bringToFront();
  await refocus(second);
  await expect(second).toHaveURL(`${FRONTEND_URL}/login?returnTo=%2Fgoals`);
  await expect(loginButton(second)).toBeVisible();
});

// T23: signed out, every app URL, `/settings`, `/` and unknown URLs open Login with their target (AC13 to AC15).
for (const [path, returnTo, item] of [
  ['/balances/abc', '/balances/abc', 'Balances'],
  ['/settings/security', '/settings/security', 'Settings'],
  ['/settings', '/settings/account', 'Settings'],
  ['/', '/overview', 'Overview'],
  ['/nope', '/overview', 'Overview'],
] as const) {
  test(`signed out, ${path} opens Login, and after login ${returnTo} in the shell`, async ({ page, request }) => {
    const user = await signUp(request);

    await page.goto(path);

    await expect(page).toHaveURL(`${FRONTEND_URL}/login?returnTo=${encodeURIComponent(returnTo)}`);
    await expect(sidebar(page)).toHaveCount(0);
    await logIn(page, user);
    await expect(page).toHaveURL(`${FRONTEND_URL}${returnTo}`);
    await expect(headerDate(page)).toHaveText('22 Oct, 2026');
    await expect(activeItem(page)).toHaveText(item);
  });
}

// T24: signed in, `/settings`, `/` and unknown URLs are replaced in the history (AC14, AC15).
test('replaces /settings, / and an unknown URL in the history', async ({ page }) => {
  await signUp(page.request);

  for (const [before, path, opened] of [
    ['/bills', '/settings', '/settings/account'],
    ['/goals', '/', '/overview'],
    ['/expenses', '/nope/deeper', '/overview'],
  ] as const) {
    await openSignedIn(page, before);
    await page.goto(path);
    await expect(page).toHaveURL(`${FRONTEND_URL}${opened}`);
    await expect(headerDate(page)).toHaveText('22 Oct, 2026');

    await page.goBack();
    await expect(page).toHaveURL(`${FRONTEND_URL}${before}`);
    await expect(headerDate(page)).toHaveText('22 Oct, 2026');
  }
});

// T25: full width at any size from 1280, scrolling sideways below it (AC16, AC17, #94). With a classic
// scrollbar the app page leaves its gutter free, and the 1280 minimum includes it (#100, #101).
test('fills the window from 1280 wide and scrolls sideways below it', async ({ page }) => {
  await signUp(page.request);
  await openSignedIn(page, '/overview');
  const gutters: number[] = [];

  for (const [width, height] of [
    [2560, 1440],
    [1920, 1080],
    [1280, 1024],
    [1100, 800],
  ] as const) {
    await page.setViewportSize({ width, height });
    const measured = await page.evaluate(() => {
      window.scrollTo(10, 0);
      const scrollsSideways = window.scrollX > 0;
      window.scrollTo(0, 0);
      return {
        viewport: document.documentElement.getBoundingClientRect().width,
        pageWidth: document.body.getBoundingClientRect().width,
        scrollsSideways,
      };
    });
    gutters.push(width - measured.viewport);
    // The page fills the window less the gutter, down to 1280 less a classic scrollbar's 15px (#101).
    const pageWidth = Math.max(measured.viewport, 1265);

    expect(measured.pageWidth).toBe(pageWidth);
    expect(measured.scrollsSideways).toBe(pageWidth > measured.viewport);
    expect(measured.scrollsSideways).toBe(width < 1280);
    expect(await box(navBar(page))).toEqual({ x: 0, y: 0, width: 280, height });
    expect(await box(header(page))).toMatchObject({ x: 280, y: 0, width: pageWidth - 280, height: 88 });
    expect(await box(page.getByRole('main'))).toMatchObject({ x: 280, width: pageWidth - 280 });
    const search = await box(header(page).getByRole('search'));
    expect(search.x + search.width).toBe(pageWidth - 32);
    const line = await header(page).evaluate((element) => getComputedStyle(element, '::after').width);
    expect(line).toBe(`${pageWidth - 280}px`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(pageWidth);
  }
  // The same gutter at every size: the scrollbar's width, or none where scrollbars take no space.
  expect(new Set(gutters).size).toBe(1);
});

test('keeps Login centered from 1280 wide and scrolls sideways below it', async ({ page }) => {
  await page.goto('/login');
  const column = page.getByRole('main');
  await expect(loginButton(page)).toBeVisible();

  // Below 1280 the page is 1265 wide, plus a classic scrollbar where the page scrolls (#101): the column from x 432.5.
  for (const [width, height, x, pageWidth] of [
    [1920, 1080, 760, 1920],
    [1100, 800, 432.5, 1265],
  ] as const) {
    await page.setViewportSize({ width, height });
    expect(await box(column)).toMatchObject({ x, width: 400 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(pageWidth);
    expect(await computed(page.locator('body'), 'background-color')).toBe(await tokenColor(page, '--color-gray-06'));
  }
});

// T26: the header and the content scroll, the sidebar stays; the gutter only on app pages (AC18, #5, #83, #100).
test('scrolls the header and the content while the sidebar stays in place', async ({ page }) => {
  await signUp(page.request);
  await openSignedIn(page, '/transactions');
  await injectTallContent(page);
  const sidebarParts = [
    page.getByRole('img', { name: 'FINEbank.IO' }),
    sidebar(page),
    logoutButton(page),
    page.getByRole('link', { name: 'View profile' }),
  ];
  const before = await Promise.all(sidebarParts.map(box));
  const headerBefore = await box(header(page));

  await page.evaluate(() => window.scrollTo(0, 800));

  expect(await page.evaluate(() => window.scrollY)).toBe(800);
  expect(await Promise.all(sidebarParts.map(box))).toEqual(before);
  expect((await box(header(page))).y).toBe(headerBefore.y - 800);
});

test('reserves the scrollbar gutter on app pages only', async ({ page }) => {
  const gutter = () => page.evaluate(() => getComputedStyle(document.documentElement).scrollbarGutter);
  for (const path of ['/login', '/sign-up', '/forgot-password']) {
    await page.goto(path);
    await expect(page.getByRole('main')).toBeVisible();
    expect(await gutter()).toBe('auto');
  }
  // The development gallery draws the app layout too, but is no app page.
  await page.goto('/dev/components');
  await expect(page.getByRole('heading', { level: 1, name: 'Component gallery' })).toBeVisible();
  expect(await gutter()).toBe('auto');

  await signUp(page.request);
  await openSignedIn(page, '/overview');
  expect(await gutter()).toBe('stable');
  await logoutButton(page).click();
  await expect(loginButton(page)).toBeVisible();
  expect(await gutter()).toBe('auto');
});

// T27: another page opens at the top; Back and Forward restore the position (AC19, #100 d).
test('opens another page at the top and restores the position on Back and Forward', async ({ page }) => {
  await signUp(page.request);
  await openSignedIn(page, '/transactions');
  // The empty screens do not scroll yet. React leaves a node it did not create in place, so this block stays in
  // the content area on every page, inside the layout, where the sidebar stays in place.
  await injectTallContent(page);
  const scrollY = () => page.evaluate(() => window.scrollY);

  await page.evaluate(() => window.scrollTo(0, 800));
  await expect.poll(scrollY).toBe(800);
  await sidebar(page).getByRole('link', { name: 'Bills' }).click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/bills`);
  await expect.poll(scrollY).toBe(0);

  await page.evaluate(() => window.scrollTo(0, 300));
  await expect.poll(scrollY).toBe(300);
  await page.goBack();
  await expect(page).toHaveURL(`${FRONTEND_URL}/transactions`);
  await expect.poll(scrollY).toBe(800);

  await page.goForward();
  await expect(page).toHaveURL(`${FRONTEND_URL}/bills`);
  await expect.poll(scrollY).toBe(300);
});

// T28: keyboard order and the teal ring through the shell; Enter on a link keeps focus on it (AC20, #87).
test('tabs through the shell with the teal ring, and Enter on a link keeps its focus', async ({ page }) => {
  await signUp(page.request);
  await openSignedIn(page, '/balances');
  const order: Locator[] = [
    ...sections.map((name) => sidebar(page).getByRole('link', { name })),
    logoutButton(page),
    page.getByRole('link', { name: 'View profile' }),
  ];

  // The sidebar's top left corner, before its first link: the next Tab starts there.
  await navBar(page).click({ position: { x: 5, y: 5 } });
  for (const target of order) {
    await page.keyboard.press('Tab');
    await expect(target).toBeFocused();
    await expectRing(page, target);
  }
  await page.keyboard.press('Tab');
  await expect(page.getByRole('searchbox', { name: 'Search' })).toBeFocused();
  const field = header(page).getByRole('search');
  expect(await computed(field, 'outline-style')).toBe('solid');
  expect(await computed(field, 'outline-width')).toBe('2px');
  expect(await computed(field, 'outline-offset')).toBe('2px');
  expect(await computed(field, 'outline-color')).toBe(await tokenColor(page, '--color-primary'));

  const bills = sidebar(page).getByRole('link', { name: 'Bills' });
  await bills.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(`${FRONTEND_URL}/bills`);
  await expect(activeItem(page)).toHaveText('Bills');
  await expect(bills).toBeFocused();
  await expectRing(page, bills);

  const goals = sidebar(page).getByRole('link', { name: 'Goals' });
  await goals.click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/goals`);
  await expect(goals).toBeFocused();
  expect(await goals.evaluate((node) => node.matches(':focus-visible'))).toBe(false);
  expect(await computed(goals, 'outline-style')).toBe('none');
});

// T29: task 003's positions, measured on 104 and 105, on the real routes (AC21; CSS px, halved from the 2x PNGs).
test('the sidebar matches the positions measured on 104, on Overview and Balances', async ({ page }) => {
  await signUp(page.request);

  for (const [path, active] of [
    ['/overview', 'Overview'],
    ['/balances', 'Balances'],
  ] as const) {
    await openSignedIn(page, path);
    const links = sidebar(page).getByRole('link');

    expect(await box(navBar(page))).toEqual({ x: 0, y: 0, width: 280, height: 1024 });
    expect(await computed(navBar(page), 'background-color')).toBe(await tokenColor(page, '--color-default-black'));
    const logo = await box(page.getByRole('img', { name: 'FINEbank.IO' }));
    expect(logo).toMatchObject({ x: 58, width: 164 });
    expect(logo.y + logo.height).toBe(72);

    for (const [index, name] of sections.entries()) {
      expect(await box(links.nth(index))).toEqual({ x: 28, y: 120 + 64 * index, width: 224, height: 48 });
      expect(await box(links.nth(index).locator('svg'))).toEqual({ x: 44, y: 132 + 64 * index, width: 24, height: 24 });
      expect((await box(links.nth(index).getByText(name))).x).toBe(80);
    }
    expect(await computed(sidebar(page).getByRole('link', { name: active }), 'background-color')).toBe(
      await tokenColor(page, '--color-primary'),
    );

    expect(await box(logoutButton(page))).toEqual({ x: 28, y: 780, width: 224, height: 48 });
    expect(await box(navBar(page).getByRole('separator'))).toEqual({ x: 28, y: 872, width: 224, height: 1 });
    expect(await box(page.getByRole('img', { name: 'Tanzir Rahman' }))).toEqual({
      x: 28,
      y: 908,
      width: 32,
      height: 32,
    });
    expect((await box(navBar(page).getByText('Tanzir Rahman', { exact: true }))).x).toBe(76);
    expect((await box(page.getByRole('link', { name: 'View profile' }))).x).toBe(76);
  }
});

// The left side as measured; the right side from the page's right edge, which a classic scrollbar's gutter moves
// in by its width (#101). Without a gutter that edge is 1440, and the boxes are those measured on 104 and 105.
test('the header matches the positions measured on 104 and 105, on Overview and Balances', async ({ page }) => {
  await signUp(page.request);

  for (const path of ['/overview', '/balances'] as const) {
    await openSignedIn(page, path);
    const right = await page.evaluate(() => document.body.getBoundingClientRect().right);
    expect(await box(header(page))).toEqual({ x: 280, y: 0, width: right - 280, height: 88 });
    const line = await header(page).evaluate((element) => {
      const style = getComputedStyle(element, '::after');
      return { color: style.backgroundColor, height: style.height, bottom: style.bottom };
    });
    expect(line).toEqual({ color: await tokenColor(page, '--color-gray-05'), height: '1px', bottom: '0px' });

    const [chevron, bell, searchIcon] = await header(page).locator('svg').all();
    const chevronBox = await box(chevron!);
    expect(chevronBox).toMatchObject({ y: 32, width: 24, height: 24 });
    if (path === '/overview') {
      const greeting = await box(header(page).getByText('Hello Tanzir'));
      expect(greeting.x).toBe(304);
      expect(chevronBox.x).toBe(greeting.x + greeting.width + 24);
      expect(Math.abs(chevronBox.x - 468)).toBeLessThanOrEqual(1.5);
    } else {
      expect(chevronBox.x).toBe(304);
    }
    expect((await box(headerDate(page))).x).toBe(chevronBox.x + 24 + 4);
    expect(await box(bell!)).toEqual({ x: right - 448, y: 32, width: 24, height: 24 });
    expect(await box(header(page).getByRole('search'))).toEqual({ x: right - 384, y: 20, width: 352, height: 48 });
    expect(await box(searchIcon!)).toEqual({ x: right - 80, y: 32, width: 24, height: 24 });
  }
});
