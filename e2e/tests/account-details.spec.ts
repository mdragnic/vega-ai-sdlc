import type { APIRequestContext, Locator, Page, Request, Route } from '@playwright/test';

import { FRONTEND_URL } from '../constants';
import { expect, test } from '../fixtures';
import { box, computed, expectRing, signUp, tokenColor } from '../helpers';

const main = (page: Page) => page.getByRole('main');
const detailsRegion = (page: Page) => main(page).getByRole('region', { name: 'Account Details' });
const historyRegion = (page: Page) => main(page).getByRole('region', { name: 'Transactions History' });
/** A section's white card: the section's last child. */
const cardOf = (region: Locator) => region.locator(':scope > div').last();
const detailsCard = (page: Page) => cardOf(detailsRegion(page));
const historyCard = (page: Page) => cardOf(historyRegion(page));
const table = (page: Page) => historyRegion(page).getByRole('table');
const bodyRows = (page: Page) => table(page).locator('tbody > tr');
const headerRow = (page: Page) => table(page).locator('thead > tr');
const loadMore = (page: Page) => historyRegion(page).getByRole('button', { name: 'Load More' });
const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const activeItem = (page: Page) => sidebar(page).locator('a[aria-current="page"]');
const search = (page: Page) => page.getByRole('searchbox', { name: 'Search' });
const headerDate = (page: Page) => page.getByRole('banner').locator('time');

const ZONE_HEADERS = { 'X-Time-Zone': 'Europe/Belgrade' };

const moveBackendClock = async (page: Page, now: string) =>
  expect((await page.request.put('/api/test/clock', { data: { now } })).ok()).toBe(true);

type AccountsBody = { accounts: { id: number; accountType: string; balance: { cents: number } }[] };

/** The signed-in user's account IDs, oldest first (Credit Card, Checking, Savings, Investment, Loan). */
async function accountIds(request: APIRequestContext): Promise<number[]> {
  const response = await request.get('/api/accounts', { headers: ZONE_HEADERS });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as AccountsBody).accounts.map((account) => account.id);
}

const isAccountPath = (url: URL) => url.pathname.startsWith('/api/accounts/');
const isDetails = (url: URL) => /^\/api\/accounts\/[^/]+$/.test(url.pathname);
const isHistory = (url: URL) => /^\/api\/accounts\/[^/]+\/transactions$/.test(url.pathname);

/** Every request under `/api/accounts/` the page sends, from now on: its path, cursor and zone. */
function recordAccountRequests(page: Page) {
  const sent: { path: string; cursor: string | null; zone: string | undefined }[] = [];
  page.on('request', (request: Request) => {
    const url = new URL(request.url());
    if (!isAccountPath(url)) return;
    sent.push({ path: url.pathname, cursor: url.searchParams.get('cursor'), zone: request.headers()['x-time-zone'] });
  });
  return sent;
}

/** Waits until both cards show their content: no skeleton left. */
async function waitForCards(page: Page) {
  await expect(detailsRegion(page)).toBeVisible();
  await expect(main(page).locator('[aria-busy="true"]')).toHaveCount(0);
}

/** Signs up a new user at the backend's clock and opens its account at `index` once both cards show. */
async function openAccount(page: Page, index = 1) {
  await signUp(page.request);
  const ids = await accountIds(page.request);
  await page.goto(`/balances/${ids[index]}`);
  await expect(headerDate(page)).toBeVisible();
  await waitForCards(page);
  return ids;
}

/** Each label of the details card with its value, in reading order. */
const detailsShown = (page: Page) =>
  detailsCard(page).evaluate((card) =>
    [...card.querySelectorAll('dt')].map((term) => [term.textContent, term.nextElementSibling?.textContent]),
  );

type Row = [date: string, status: string, type: string, receipt: string, amount: string];

/** The rows as shown: each cell's text. */
const rowsShown = (page: Page): Promise<Row[]> =>
  bodyRows(page).evaluateAll((rows) =>
    rows.map((row) => [...row.querySelectorAll('td')].map((cell) => cell.textContent ?? '') as Row),
  );

async function expectRows(page: Page, expected: Row[]) {
  await expect(bodyRows(page)).toHaveCount(expected.length);
  expect(await rowsShown(page)).toEqual(expected);
}

/** The five accounts' details at the fixed clock, oldest first (demo-data.md; task 021 AC2). */
const demoDetails = [
  ['Master Card', 'Credit Card', '$21,019.18', 'Main Branch', '**** **** **** 2598'],
  ['AB Bank Ltd', 'Checking', '$33,362.48', 'Park Street Branch', '**** **** **** 7310'],
  ['Brac Bank Ltd.', 'Savings', '$27,356.80', 'Gulshan Branch', '**** **** **** 4421'],
  ['AB Bank Ltd', 'Investment', '$29,503.00', 'Park Street Branch', '**** **** **** 6652'],
  ['City Bank Ltd.', 'Loan', '$19,013.21', 'Motijheel Branch', '**** **** **** 9083'],
];
const labels = ['Bank Name', 'Account Type', 'Balance', 'Branch Name', 'Account Number'];
const readOut = (values: string[]) => labels.map((label, index) => [label, values[index]]);

/** Checking's first page at the fixed clock (AC4). */
const checkingPage1: Row[] = [
  ['22 Oct, 2026', 'Complete', 'Debit', 'z7YBsODpLNW', '-$266.00'],
  ['18 Oct, 2026', 'Complete', 'Debit', 'nPcvc24YHB7', '-$147.84'],
  ['17 Oct, 2026', 'Complete', 'Credit', 'SVqWhlvmJqw', '+$179.20'],
  ['15 Oct, 2026', 'Complete', 'Debit', '5vSKgU8NCTh', '-$322.00'],
  ['14 Oct, 2026', 'Complete', 'Debit', '93i3nSBYFAa', '-$20.16'],
  ['12 Oct, 2026', 'Complete', 'Debit', 'UYdw2FRyetE', '-$58.80'],
  ['11 Oct, 2026', 'Complete', 'Debit', 'UK5fQ9kfUyy', '-$31.92'],
  ['10 Oct, 2026', 'Complete', 'Credit', 'IhN8Byqe5aj', '+$179.20'],
  ['7 Oct, 2026', 'Complete', 'Debit', 'nPAdhi6fo6A', '-$21.28'],
  ['4 Oct, 2026', 'Complete', 'Debit', 'CrSNatgkImu', '-$283.36'],
];
/** The first two rows of Checking's second page (AC6). */
const checkingPage2Start: Row[] = [
  ['3 Oct, 2026', 'Complete', 'Credit', 'gceoLfSMg8H', '+$179.20'],
  ['1 Oct, 2026', 'Complete', 'Debit', 'dR9mGBqImes', '-$231.84'],
];
/** The Credit Card's Failed Pizza, its fifth row (AC4). */
const failedPizza: Row = ['16 Oct, 2026', 'Failed', 'Debit', 'CFP5E9VV2Fn', '-$24.64'];

const NOT_FOUND = '{"message":"Account not found"}';

// T22: AC1, AC2, AC10 and AC11, each account from Balances' "Details" (#10, #25, #47, #50, #57).
test('opens each account from its Balances card, without a page load, with its five values', async ({
  page,
  request,
}) => {
  // Another user first, so no ID equals its position.
  await signUp(request);
  await signUp(page.request);
  const ids = await accountIds(page.request);
  const sent = recordAccountRequests(page);
  const bodies: { path: string; text: string }[] = [];
  page.on('response', async (response) => {
    const url = new URL(response.url());
    if (isAccountPath(url) && response.ok()) bodies.push({ path: url.pathname, text: await response.text() });
  });
  await page.goto('/balances');
  await expect(main(page).getByRole('link', { name: 'Details' })).toHaveCount(5);
  let loads = 0;
  page.on('load', () => (loads += 1));

  for (const [index, id] of ids.entries()) {
    await main(page).getByRole('link', { name: 'Details' }).nth(index).click();

    await expect(page).toHaveURL(`${FRONTEND_URL}/balances/${id}`);
    await waitForCards(page);
    await expect(detailsRegion(page).getByRole('heading', { level: 2 })).toHaveText('Account Details');
    await expect(activeItem(page)).toHaveText('Balances');
    await expect(headerDate(page)).toHaveText('22 Oct, 2026');
    await expect(page.getByRole('banner').getByText(/^Hello /)).toHaveCount(0);
    expect(await detailsShown(page)).toEqual(readOut(demoDetails[index]!));
    await page.goBack();
    await expect(page).toHaveURL(`${FRONTEND_URL}/balances`);
  }

  expect(loads).toBe(0);
  expect(sent.length).toBeGreaterThanOrEqual(10);
  expect(new Set(sent.map(({ zone }) => zone))).toEqual(new Set(['Europe/Belgrade']));
  for (const { path, text } of bodies) {
    const body = JSON.parse(text) as Record<string, unknown>;
    if (path.endsWith('/transactions')) {
      expect(Object.keys(body)).toEqual(['transactions', 'nextCursor']);
      for (const row of body.transactions as Record<string, unknown>[]) {
        expect(Object.keys(row).toSorted()).toEqual(['amount', 'direction', 'occurredAt', 'receipt', 'status']);
      }
    } else {
      expect(Object.keys(body).toSorted()).toEqual([
        'accountType',
        'balance',
        'bankName',
        'branchName',
        'maskedNumber',
      ]);
    }
    expect(text.replace(/\*{4} \*{4} \*{4} \d{4}/g, ''), path).not.toMatch(/\d{12}|\d{4} \d{4}/);
  }
});

// T23: AC4 and AC6, Checking's history, "Load More" with its loading look, and the Credit Card's Failed row (#27).
test('shows Checking’s 10 rows, adds page 2 with "Load More" from page 1’s cursor, and the Credit Card’s Failed row', async ({
  page,
}) => {
  const ids = await openAccount(page);
  await expect(table(page).getByRole('columnheader')).toHaveText([
    'Date',
    'Status',
    'Transaction Type',
    'Receipt',
    'Amount',
  ]);
  await expectRows(page, checkingPage1);
  await expect(table(page).locator('a')).toHaveCount(0);
  const firstPage = await page.request.get(`/api/accounts/${ids[1]}/transactions`, { headers: ZONE_HEADERS });
  const { nextCursor } = (await firstPage.json()) as { nextCursor: string };
  let release!: () => void;
  const released = new Promise<void>((done) => {
    release = done;
  });
  const cursors: (string | null)[] = [];
  await page.route(
    (url) => isHistory(url),
    async (route: Route) => {
      const cursor = new URL(route.request().url()).searchParams.get('cursor');
      cursors.push(cursor);
      if (cursor !== null) await released;
      await route.continue();
    },
  );

  await loadMore(page).click();

  await expect(loadMore(page)).toHaveAttribute('aria-busy', 'true');
  await expect(loadMore(page)).toHaveAccessibleName('Load More');
  expect(await computed(loadMore(page), 'background-color')).toBe(await tokenColor(page, '--color-button-secondary'));
  await expect(loadMore(page).getByTestId('spinner')).toBeVisible();
  await loadMore(page).click({ force: true });
  release();
  await expect(bodyRows(page)).toHaveCount(20);
  expect((await rowsShown(page)).slice(0, 12)).toEqual([...checkingPage1, ...checkingPage2Start]);
  expect(cursors).toEqual([nextCursor]);

  await page.goto(`/balances/${ids[0]}`);
  await waitForCards(page);
  expect((await rowsShown(page))[4]).toEqual(failedPizza);
});

// T24: AC6, AC16 and AC17, the end of the list, the same-instant boundary and no rows (#6, #27, #117 a).
test('shows 10 rows and no button at 2022-01-15; at 2022-01-17 Load More adds Design project once, focus on it', async ({
  page,
}) => {
  await moveBackendClock(page, '2022-01-15T10:00:00Z');
  await openAccount(page);
  await expect(bodyRows(page)).toHaveCount(10);
  await expect(loadMore(page)).toHaveCount(0);

  // A user signed up at the next clock, so its session is valid there.
  await moveBackendClock(page, '2022-01-17T10:00:00Z');
  const later = page;
  await openAccount(later);
  await expect(bodyRows(later)).toHaveCount(10);
  expect((await rowsShown(later)).at(-1)).toEqual(['1 Jan, 2022', 'Complete', 'Debit', 'XI4W7ubVUlR', '-$218.50']);
  await loadMore(later).focus();
  await later.keyboard.press('Enter');

  await expect(bodyRows(later)).toHaveCount(11);
  expect((await rowsShown(later)).at(-1)).toEqual(['1 Jan, 2022', 'Complete', 'Credit', 'zoHdsqIkr4v', '+$665.00']);
  await expect(loadMore(later)).toHaveCount(0);
  await expect(bodyRows(later).nth(10)).toBeFocused();
  expect(await later.evaluate(() => document.activeElement === document.body)).toBe(false);

  const ids = await accountIds(later.request);
  await later.goto(`/balances/${ids[2]}`);
  await expect(historyRegion(later).getByText('No transactions yet')).toBeVisible();
  await expect(table(later)).toHaveCount(0);
  await expect(loadMore(later)).toHaveCount(0);
});

// T25: AC8 and AC9, today in the user's zone from the backend's clock; the cursor across midnight (#53, #54, #80).
test('continues "Load More" from the cursor after midnight; a reload shows the new day; New York starts with Jeans', async ({
  page,
  browser,
}) => {
  const ids = await openAccount(page);
  await moveBackendClock(page, '2026-10-23T22:30:00Z');
  await page.clock.setFixedTime('2026-10-23T22:30:00Z');

  await loadMore(page).click();

  await expect(bodyRows(page)).toHaveCount(20);
  expect((await rowsShown(page)).slice(10, 12)).toEqual(checkingPage2Start);
  expect((await rowsShown(page)).some(([date]) => date === '24 Oct, 2026')).toBe(false);

  await page.reload();
  await waitForCards(page);
  expect((await rowsShown(page)).slice(0, 3)).toEqual([
    ['24 Oct, 2026', 'Complete', 'Debit', expect.any(String), '-$21.28'],
    ['24 Oct, 2026', 'Complete', 'Credit', expect.any(String), '+$179.20'],
    checkingPage1[0],
  ]);
  const balances = (await (await page.request.get('/api/accounts', { headers: ZONE_HEADERS })).json()) as AccountsBody;
  const balance = (await detailsShown(page))[2]![1];
  const checkingCents = balances.accounts[1]!.balance.cents;
  expect(balance).toBe(`$${(checkingCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

  const context = await browser.newContext({ timezoneId: 'America/New_York' });
  const newYork = await context.newPage();
  await newYork.clock.install({ time: '2026-10-23T22:30:00Z' });
  await newYork.clock.setFixedTime('2026-10-23T22:30:00Z');
  await signUp(newYork.request);
  const newYorkIds = await accountIds(newYork.request);
  await newYork.goto(`/balances/${newYorkIds[1]}`);
  await waitForCards(newYork);
  expect((await rowsShown(newYork))[0]).toEqual(checkingPage1[0]);
  await context.close();
  expect(ids).toHaveLength(5);
});

// T26: AC12 and AC13 (Marko's addition 2), another user's, an unknown and a non-numeric ID open Balances with nothing
// of the account shown, and the API answers one 404 (#39, #46).
test('opens Balances for another user’s, an unknown and a malformed ID, showing nothing of an account', async ({
  page,
  request,
}) => {
  await signUp(request);
  const theirs = await accountIds(request);
  await signUp(page.request);
  const mine = await accountIds(page.request);
  const unknown = Math.max(...theirs, ...mine) + 100_000;
  // Every text the page adds from navigation on, kept across the redirect.
  await page.addInitScript(() => {
    const added: string[] = [];
    (window as unknown as { addedTexts: string[] }).addedTexts = added;
    // Rendered content only, also when it is removed again: not what the dev server adds to the head (its styles).
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const parent = mutation.target;
        if (document.head !== null && (parent === document.head || document.head.contains(parent))) continue;
        for (const node of mutation.addedNodes) {
          if (node.nodeName !== 'STYLE' && node.nodeName !== 'SCRIPT') added.push(node.textContent ?? '');
        }
      }
    }).observe(document, { childList: true, subtree: true });
  });
  const sent = recordAccountRequests(page);
  const notFoundBodies: string[] = [];
  page.on('response', async (response) => {
    if (isAccountPath(new URL(response.url())) && response.status() === 404) notFoundBodies.push(await response.text());
  });

  for (const [path, requests] of [
    [`/balances/${theirs[1]}`, 1],
    [`/balances/${unknown}`, 1],
    ['/balances/abc', 0],
    ['/balances/01', 0],
    ['/balances/1e3', 0],
    ['/balances/12abc', 0],
    ['/balances/9007199254740992', 0],
  ] as const) {
    await page.goto('/overview');
    await expect(headerDate(page)).toBeVisible();
    sent.length = 0;

    await page.goto(path);

    await expect(page).toHaveURL(`${FRONTEND_URL}/balances`);
    await expect(main(page).getByRole('region', { name: 'Balances' })).toBeVisible();
    await expect(activeItem(page)).toHaveText('Balances');
    const id = path.slice('/balances/'.length);
    expect(
      sent.filter((one) => one.path === `/api/accounts/${id}`),
      path,
    ).toHaveLength(requests);
    expect(sent.filter((one) => one.path === `/api/accounts/${id}/transactions`).length).toBeLessThanOrEqual(requests);
    const added = (await page.evaluate(() => (window as unknown as { addedTexts: string[] }).addedTexts)).join('\n');
    for (const text of ['Bank Name', 'Branch Name', 'Park Street Branch', 'Edit Details', 'z7YBsODpLNW', 'Debit']) {
      expect(added, `${path}: ${text}`).not.toContain(text);
    }
    await page.goBack();
    await expect(page).toHaveURL(`${FRONTEND_URL}/overview`);
  }
  expect(new Set(notFoundBodies)).toEqual(new Set([NOT_FOUND]));

  for (const raw of [String(theirs[1]), String(unknown), 'abc', '01', '1.0', '']) {
    for (const path of [`/api/accounts/${raw}${raw === '' ? '/' : ''}`, `/api/accounts/${raw}/transactions`]) {
      const response = await page.request.get(path, { headers: ZONE_HEADERS });
      expect(response.status(), path).toBe(404);
      expect(await response.text(), path).toBe(NOT_FOUND);
    }
  }
});

// T27: AC3, AC15 and AC16, the keyboard and the visual-only parts (#23, #26, #87, #117 a, #118 a).
test('tabs from the search field to "Load More" with the ring, then out; Edit Details and Remove do nothing', async ({
  page,
}) => {
  await openAccount(page);
  await expect(main(page).getByRole('link')).toHaveCount(0);
  await expect(main(page).getByRole('button')).toHaveText(['Load More']);

  await search(page).focus();
  await page.keyboard.press('Tab');
  await expect(loadMore(page)).toBeFocused();
  await expectRing(page, loadMore(page));
  await page.keyboard.press('Tab');
  expect(await main(page).evaluate((element) => element.contains(document.activeElement))).toBe(false);
  await loadMore(page).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(search(page)).toBeFocused();

  // "Load More" by keyboard: the first new row, with the ring, the page not scrolled by the move.
  await loadMore(page).focus();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('Enter');
  await expect(bodyRows(page)).toHaveCount(20);
  const newRow = bodyRows(page).nth(10);
  await expect(newRow).toBeFocused();
  await expectRing(page, newRow);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  await page.keyboard.press('Tab');
  await expect(loadMore(page)).toBeFocused();

  // By mouse (after a click on the empty sidebar): the next page's first row, no ring.
  await page.mouse.click(140, 600);
  await loadMore(page).click();
  await expect(bodyRows(page)).toHaveCount(30);
  const clickedRow = bodyRows(page).nth(20);
  await expect(clickedRow).toBeFocused();
  expect(await clickedRow.evaluate((node) => node.matches(':focus-visible'))).toBe(false);
  expect(await computed(clickedRow, 'outline-style')).toBe('none');

  // The visual-only parts and a row: nothing happens, no pointer.
  const url = page.url();
  const sent = recordAccountRequests(page);
  for (const text of ['Edit Details', 'Remove']) {
    const element = detailsCard(page).getByText(text, { exact: true });
    expect(await computed(element, 'cursor')).toBe('default');
    expect(await element.evaluate((node) => node.closest('[inert]') !== null)).toBe(true);
    const { x, y, width, height } = await box(element);
    await page.mouse.click(x + width / 2, y + height / 2);
  }
  await bodyRows(page).first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(page.url()).toBe(url);
  expect(sent).toEqual([]);
  await expect(bodyRows(page)).toHaveCount(30);
});

/** A route that holds the account requests until `release`, then fails every try, then lets them through. */
async function routeAccountFailures(page: Page, which: (url: URL) => boolean) {
  let mode: 'hold' | 'fail' | 'pass' = 'hold';
  let release!: () => void;
  const released = new Promise<void>((done) => {
    release = done;
  });
  let failures = 0;
  await page.route(
    (url) => which(url),
    async (route) => {
      if (mode === 'hold') await released;
      if (mode === 'pass') return route.continue();
      failures += 1;
      return route.fulfill({ status: 500, json: { message: 'Internal server error' } });
    },
  );
  return {
    fail: () => {
      mode = 'fail';
      release();
    },
    pass: () => {
      mode = 'pass';
    },
    failures: () => failures,
  };
}

const near = (actual: number, expected: number, what: string, tolerance = 0.5) =>
  expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);

// T28: AC17, the skeletons, the error state in each card, a keyboard Retry and a failed "Load More" (#6, #88, #89,
// #114, #117 b).
test('shows the skeletons, then the error state in each card, a keyboard Retry keeps focus in the card', async ({
  page,
}) => {
  await signUp(page.request);
  const ids = await accountIds(page.request);
  const routed = await routeAccountFailures(page, (url) => isDetails(url) || isHistory(url));
  await page.goto(`/balances/${ids[1]}`);

  await expect(main(page).locator('[aria-busy="true"]')).toHaveCount(2);
  near((await box(detailsCard(page))).height, 292, 'details skeleton 292');
  near((await box(historyCard(page))).height, 748, 'history skeleton 748');
  routed.fail();

  await expect(detailsRegion(page).getByRole('alert')).toHaveText('Something went wrong.', { timeout: 20_000 });
  await expect(historyRegion(page).getByRole('alert')).toHaveText('Something went wrong.', { timeout: 20_000 });
  expect(routed.failures()).toBe(8);
  near((await box(detailsCard(page))).height, 292, 'details error at its 292 minimum');
  near((await box(historyCard(page))).height, 412, 'history error at its 412 minimum');
  routed.pass();
  const retry = detailsRegion(page).getByRole('button', { name: 'Retry' });
  await retry.focus();
  await page.keyboard.press('Enter');

  await expect(detailsRegion(page).getByRole('alert')).toHaveCount(0);
  expect(await detailsShown(page)).toEqual(readOut(demoDetails[1]!));
  const focusedIn = await detailsRegion(page).evaluate((region) => region.contains(document.activeElement));
  expect(focusedIn).toBe(true);
  await expectRing(page, page.locator(':focus'));
  await expect(historyRegion(page).getByRole('alert')).toBeVisible();
  await historyRegion(page).getByRole('button', { name: 'Retry' }).click();
  await expectRows(page, checkingPage1);
});

test('keeps the rows when "Load More" fails, the message above the button, then adds the page once', async ({
  page,
}) => {
  await openAccount(page);
  let failing = true;
  await page.route(
    (url) => isHistory(url) && url.searchParams.has('cursor'),
    (route) =>
      failing ? route.fulfill({ status: 500, json: { message: 'Internal server error' } }) : route.continue(),
  );
  await loadMore(page).focus();
  await page.keyboard.press('Enter');

  const status = historyRegion(page).getByRole('status');
  await expect(status).toHaveText('Something went wrong.', { timeout: 20_000 });
  await expectRows(page, checkingPage1);
  await expect(loadMore(page)).toBeFocused();
  expect((await box(status)).y + (await box(status)).height).toBeLessThanOrEqual((await box(loadMore(page))).y);
  failing = false;
  await page.keyboard.press('Enter');

  await expect(bodyRows(page)).toHaveCount(20);
  expect((await rowsShown(page)).slice(0, 12)).toEqual([...checkingPage1, ...checkingPage2Start]);
  await expect(status).toHaveText('');
});

/** The right edge of the page: the window less a classic scrollbar's gutter (#101). */
const pageRight = (page: Page) => page.evaluate(() => document.body.getBoundingClientRect().right);
const scrollWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;
const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x - 0.5 &&
  inner.y >= outer.y - 0.5 &&
  inner.x + inner.width <= outer.x + outer.width + 0.5 &&
  inner.y + inner.height <= outer.y + outer.height + 0.5;

/** The box of each element's own text (all its lines) and its line count. */
const textBoxes = (locator: Locator) =>
  locator.evaluateAll((elements) =>
    elements.map((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const { x, y, width, height } = range.getBoundingClientRect();
      const rects = [...range.getClientRects()];
      return { x, y, width, height, lines: new Set(rects.map((rect) => Math.round(rect.y))).size };
    }),
  );

/** How many elements in `locator`, itself included, hold content wider or taller than their box. */
const overflowCount = (locator: Locator) =>
  locator.evaluate(
    (root) =>
      [root, ...root.querySelectorAll('*')].filter(
        (node) =>
          (node.clientWidth > 1 && node.scrollWidth > node.clientWidth + 1) ||
          (node.clientHeight > 1 && node.scrollHeight > node.clientHeight + 1),
      ).length,
  );

/** The centres of the Status, Transaction Type and Receipt texts as fractions of the table (task 021 References). */
const centres = [(242 + 192 / 2) / 1040, (242 + 192 + 258 / 2) / 1040, (242 + 192 + 258 + 216 / 2) / 1040];

/** AC20: 106's layout at the window's size, x from the page's right edge (#94, #101, #111). */
async function expectLayout(page: Page) {
  const right = await pageRight(page);
  const title = await box(detailsRegion(page).getByRole('heading', { level: 2 }));
  near(title.y, 104, 'title line box y');
  near(title.x, 304, 'title x');
  const card = await box(detailsCard(page));
  near(card.x, 304, 'details card x');
  near(card.y, 152, 'details card y');
  near(card.width, right - 32 - 304, 'details card width');
  near(card.height, 292, 'details card height');
  const content = { x: card.x + 32, width: card.width - 64 };

  const terms = await textBoxes(detailsCard(page).locator('dt'));
  const values = await textBoxes(detailsCard(page).locator('dd'));
  const termBoxes = await detailsCard(page)
    .locator('dt')
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const { x, y, height } = node.getBoundingClientRect();
        return { x, y, height };
      }),
    );
  const columnX = (column: number) => content.x + content.width * 0.304808 * column;
  for (const [index, term] of termBoxes.entries()) {
    const column = index % 3;
    const row = Math.floor(index / 3);
    near(term.x, columnX(column), `${labels[index]} column`);
    near(term.y, row === 0 ? 184 : 272, `${labels[index]} line box y`);
    near(term.height, 24, `${labels[index]} line box`);
    expect(terms[index]!.lines).toBe(1);
    expect(values[index]!.lines, `${labels[index]} value on one line`).toBe(1);
    near(values[index]!.x, columnX(column), `${labels[index]} value under its label`, 1);
  }
  const edit = await box(detailsCard(page).getByText('Edit Details', { exact: true }));
  near(edit.x, 336, 'Edit Details x');
  near(edit.y, 356, 'Edit Details y');
  near(edit.width, 160, 'Edit Details width');
  near(edit.height, 48, 'Edit Details height');
  const remove = await box(detailsCard(page).getByText('Remove', { exact: true }));
  near(remove.x, 336 + 160 + 40, 'Remove 40 after Edit Details');
  near(remove.y + remove.height / 2, 380, 'Remove centred on the button');

  const second = await box(historyRegion(page).getByRole('heading', { level: 2 }));
  near(second.y, 476, 'second title 32 under the details card');
  const history = await box(historyCard(page));
  near(history.y, 524, 'history card y');
  near(history.width, card.width, 'history card width');
  const tableBox = await box(table(page));
  near(tableBox.x, history.x + 32, 'table 32 inside the card');
  near(tableBox.width, history.width - 64, 'table 64 narrower than the card');
  const header = await box(headerRow(page));
  near(header.y, history.y + 28, 'header 28 under the card top');
  near(header.height, 40, 'header row: 24 line, 16 to the divider');
  const headerTexts = await textBoxes(headerRow(page).locator('th'));
  near(headerTexts[0]!.x, tableBox.x, 'Date header at the table edge', 1);
  for (const [index, fraction] of centres.entries()) {
    const { x, width } = headerTexts[index + 1]!;
    near(x + width / 2, tableBox.x + tableBox.width * fraction, `header ${index + 2} centre`, 1);
  }
  near(headerTexts[4]!.x + headerTexts[4]!.width, tableBox.x + tableBox.width, 'Amount header at the end', 1);

  await expect(bodyRows(page)).toHaveCount(10);
  let rowBottom = header.y + header.height;
  for (let index = 0; index < 10; index += 1) {
    const row = bodyRows(page).nth(index);
    const rowBox = await box(row);
    near(rowBox.y, rowBottom, `row ${index + 1} y`);
    near(rowBox.height, 56, `row ${index + 1} height: one line`);
    const texts = await textBoxes(row.locator('td'));
    near(texts[0]!.x, tableBox.x, `row ${index + 1} date at the table edge`, 1);
    for (const [column, fraction] of centres.entries()) {
      const text = texts[column + 1]!;
      near(text.x + text.width / 2, tableBox.x + tableBox.width * fraction, `row ${index + 1} column ${column + 2}`, 1);
    }
    near(texts[4]!.x + texts[4]!.width, tableBox.x + tableBox.width, `row ${index + 1} amount at the end`, 1);
    for (const text of texts) {
      expect(text.lines, `row ${index + 1}: one line`).toBe(1);
      near(text.y + text.height / 2, rowBox.y + 28, `row ${index + 1} text centred`, 1);
    }
    rowBottom = rowBox.y + rowBox.height;
  }
  const button = await box(loadMore(page));
  near(button.width, 192, 'Load More width');
  near(button.height, 48, 'Load More height');
  near(button.x + button.width / 2, history.x + history.width / 2, 'Load More centred');
  near(button.y, rowBottom + 32, 'Load More 32 under the last row');
  near(history.y + history.height, button.y + button.height + 40, 'card 40 under Load More');
  near(history.height, 748, 'history card height');
  const { pageEnd, windowHeight } = await page.evaluate(() => ({
    pageEnd: document.documentElement.scrollHeight - window.scrollY,
    windowHeight: window.innerHeight,
  }));
  near(pageEnd, Math.max(windowHeight, history.y + history.height + 32), 'page end 32 under the card');
  return { tableBox };
}

// T29: AC20, 106's layout at 1440x1024, wider at 1920 and 2560, the same at 1280 (#94, #101, #111).
test('places the cards, the values, the rows, the columns and "Load More" where 106 does, at every width', async ({
  page,
}) => {
  await openAccount(page);
  await expectLayout(page);
  expect(await scrollWidth(page)).toBe(Math.round(await pageRight(page)));

  let width = 0;
  for (const [viewportWidth, height] of [
    [1440, 1024],
    [1920, 1080],
    [2560, 1440],
  ] as const) {
    await page.setViewportSize({ width: viewportWidth, height });
    const { tableBox } = await expectLayout(page);
    expect(tableBox.width, `${viewportWidth}: wider`).toBeGreaterThan(width);
    width = tableBox.width;
  }

  await page.setViewportSize({ width: 1280, height: 1024 });
  await expectLayout(page);
  expect(await scrollWidth(page), 'no horizontal scroll at 1280').toBe(Math.round(await pageRight(page)));
});

const longWords =
  'The First Community Cooperative Savings and Commercial Bank of Greater Dhaka and Chittagong Division';
const longNoSpace = 'ParkStreetRiversideCommercialDistrict'.repeat(3).slice(0, 100);
const receiptWords =
  'Receipt for the annual premium subscription renewal of the family plan with every add-on included this year'.padEnd(
    120,
    'x',
  );
const receiptNoSpace = 'Zq7XyWv3Ut9Sr5Qp1On8Ml4Kj2Ih6Gf0Ed'.repeat(4).slice(0, 120);

/** The details with long names and the lowest balance, and the first page with long receipts and a large amount. */
async function routeLongData(page: Page, bankName: string, branchName: string) {
  await page.route(
    (url) => isDetails(url),
    async (route) => {
      const response = await route.fetch();
      const body = (await response.json()) as Record<string, unknown>;
      await route.fulfill({
        response,
        json: { ...body, bankName, branchName, balance: { cents: -9_007_199_254_740_991, currency: 'USD' } },
      });
    },
  );
  await page.route(
    (url) => isHistory(url) && !url.searchParams.has('cursor'),
    async (route) => {
      const response = await route.fetch();
      const body = (await response.json()) as { transactions: Record<string, unknown>[] };
      body.transactions[0] = { ...body.transactions[0], receipt: receiptWords };
      body.transactions[1] = { ...body.transactions[1], receipt: receiptNoSpace };
      body.transactions[2] = { ...body.transactions[2], amount: { cents: 100_000_000_000, currency: 'USD' } };
      await route.fulfill({ response, json: body });
    },
  );
}

// T29: AC21, long names, receipts, balance and amount: wrapped inside their columns or kept on one line, nothing cut,
// overlapping or leaving its card (#106, #108 b, #111 a, #115 b).
for (const [width, height] of [
  [1440, 1024],
  [1280, 1024],
] as const) {
  for (const [name, bankName, branchName] of [
    ['in words', longWords, longWords.toUpperCase()],
    ['with no space', longNoSpace, longNoSpace.toUpperCase()],
  ] as const) {
    test(`wraps 100-character names ${name} and 120-character receipts, keeps the balance and the amount on one line at ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await routeLongData(page, bankName, branchName);
      await openAccount(page);
      const card = await box(detailsCard(page));

      const values = await textBoxes(detailsCard(page).locator('dd'));
      const terms = await textBoxes(detailsCard(page).locator('dt'));
      const parts = [...terms, ...values];
      for (const [a, first] of parts.entries()) {
        expect(inside(first, card), `part ${a} inside the details card`).toBe(true);
        for (const second of parts.slice(a + 1)) expect(overlaps(first, second), `parts ${a} overlap`).toBe(false);
      }
      expect(values[0]!.lines, 'Bank Name wraps').toBeGreaterThan(1);
      expect(values[3]!.lines, 'Branch Name wraps').toBeGreaterThan(1);
      expect(values[2]!.lines, 'balance on one line').toBe(1);
      await expect(detailsCard(page).locator('dd').nth(2)).toHaveText('-$90,071,992,547,409.91');
      const edit = await box(detailsCard(page).getByText('Edit Details', { exact: true }));
      expect(edit.y, 'buttons under the values').toBeGreaterThanOrEqual(Math.max(...values.map((v) => v.y + v.height)));
      expect(card.height, 'the details card grows').toBeGreaterThan(292);

      const history = await box(historyCard(page));
      for (const index of [0, 1, 2]) {
        const row = bodyRows(page).nth(index);
        const rowBox = await box(row);
        const texts = await textBoxes(row.locator('td'));
        for (const [a, first] of texts.entries()) {
          expect(inside(first, rowBox), `row ${index + 1} cell ${a} inside its row`).toBe(true);
          expect(inside(first, history), `row ${index + 1} cell ${a} inside the card`).toBe(true);
          for (const second of texts.slice(a + 1)) expect(overlaps(first, second)).toBe(false);
        }
        expect(texts[4]!.lines, `row ${index + 1} amount on one line`).toBe(1);
        if (index < 2) {
          expect(texts[3]!.lines, `row ${index + 1} receipt wraps`).toBeGreaterThan(1);
          expect(rowBox.height, `row ${index + 1} grows`).toBeGreaterThan(56);
        }
      }
      // Checking's third row is income: a Credit.
      await expect(bodyRows(page).nth(2).locator('td').last()).toHaveText('+$1,000,000,000.00');
      expect(await overflowCount(detailsCard(page)), 'nothing scrolls inside the details card').toBe(0);
      expect(await overflowCount(historyCard(page)), 'nothing scrolls inside the history card').toBe(0);
      expect(await scrollWidth(page), 'no horizontal scroll').toBe(Math.round(await pageRight(page)));
    });
  }
}
