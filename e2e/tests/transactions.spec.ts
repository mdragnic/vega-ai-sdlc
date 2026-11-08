import type { Locator, Page, Request, Route } from '@playwright/test';

import { FRONTEND_URL } from '../constants';
import { expect, test } from '../fixtures';
import { box, computed, expectRing, expectSignedColours, signUp, tokenColor } from '../helpers';

const main = (page: Page) => page.getByRole('main');
const section = (page: Page) => main(page).getByRole('region', { name: 'Recent Transaction' });
const tablist = (page: Page) => section(page).getByRole('tablist', { name: 'Recent Transaction' });
const tab = (page: Page, name: TabName) => tablist(page).getByRole('tab', { name });
const panel = (page: Page) => section(page).getByRole('tabpanel');
/** The white card: the panel's one child. */
const card = (page: Page) => panel(page).locator(':scope > div');
const table = (page: Page) => panel(page).getByRole('table');
const bodyRows = (page: Page) => table(page).locator('tbody > tr');
const headerRow = (page: Page) => table(page).locator('thead > tr');
const loadMore = (page: Page) => panel(page).getByRole('button', { name: 'Load More' });
const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const search = (page: Page) => page.getByRole('searchbox', { name: 'Search' });
const headerDate = (page: Page) => page.getByRole('banner').locator('time');

type TabName = 'All' | 'Revenue' | 'Expenses';

const moveBackendClock = async (page: Page, now: string) =>
  expect((await page.request.put('/api/test/clock', { data: { now } })).ok()).toBe(true);

const isList = (url: URL) => url.pathname === '/api/transactions';
const isListRequest = (request: Request) => isList(new URL(request.url()));

/** Every `GET /api/transactions` the page sends, from now on: its tab, cursor and zone. */
function recordPageRequests(page: Page) {
  const sent: { tab: string | null; cursor: string | null; zone: string | undefined }[] = [];
  page.on('request', (request) => {
    if (!isListRequest(request)) return;
    const url = new URL(request.url());
    sent.push({
      tab: url.searchParams.get('tab'),
      cursor: url.searchParams.get('cursor'),
      zone: request.headers()['x-time-zone'],
    });
  });
  return sent;
}

/** Waits until the panel shows its content: the table's rows, the empty message or the error state. */
async function waitForPanel(page: Page) {
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).locator('[aria-busy="true"]')).toHaveCount(0);
}

/** Signs up a new user at the backend's clock and opens Transactions once its first page shows. */
async function openTransactions(page: Page) {
  await signUp(page.request);
  await page.goto('/transactions');
  await expect(headerDate(page)).toBeVisible();
  await waitForPanel(page);
}

type Row = [icon: string, item: string, shop: string, date: string, method: string, amount: string];

/** The rows as shown: the icon's name and each cell's text. */
async function rowsShown(page: Page): Promise<Row[]> {
  return bodyRows(page).evaluateAll((rows) =>
    rows.map(
      (row) =>
        [
          row.querySelector('[role="img"]')?.getAttribute('aria-label') ?? '',
          ...[...row.querySelectorAll('td')].map((cell) => cell.textContent ?? ''),
        ] as Row,
    ),
  );
}

async function expectRows(page: Page, expected: Row[]) {
  await expect(bodyRows(page)).toHaveCount(expected.length);
  expect(await rowsShown(page)).toEqual(expected);
}

/** All's first page at the fixed clock (task 020 AC2): the Failed Pizza like a Complete row. */
const allPage1: Row[] = [
  ['Shopping', 'Jeans', 'Denim House', '22 Oct, 2026', 'Checking', '-$266.00'],
  ['Entertainment', 'Movie ticket', 'Inox', '21 Oct, 2026', 'Credit Card', '-$17.64'],
  ['Food', 'Pizza', 'Pizza Hit', '20 Oct, 2026', 'Credit Card', '-$24.64'],
  ['Transportation', 'Taxi fare', 'Uber', '19 Oct, 2026', 'Credit Card', '-$10.64'],
  ['Food', 'Restaurant bill', 'Spice Garden', '18 Oct, 2026', 'Checking', '-$147.84'],
  ['Entertainment', 'GTR 5', 'Gadget & Gear', '17 Oct, 2026', 'Credit Card', '-$188.16'],
  ['Income', 'Freelance payment', 'Bright Studio', '17 Oct, 2026', 'Checking', '+$179.20'],
  ['Food', 'Pizza', 'Pizza Hit', '16 Oct, 2026', 'Credit Card', '-$24.64'],
  ['Food', 'Biriyani', 'Hajir Biriyani', '16 Oct, 2026', 'Credit Card', '-$14.78'],
  ['Shopping', 'Shirt', 'XL fashions', '15 Oct, 2026', 'Checking', '-$322.00'],
];
/** All's second page (AC4): Dividend, at Shirt's instant, first. */
const allPage2: Row[] = [
  ['Income', 'Dividend', 'AB Bank Ltd', '15 Oct, 2026', 'Investment', '+$84.00'],
  ['Housing', 'Parking', 'City Parking', '14 Oct, 2026', 'Checking', '-$20.16'],
  ['Transportation', 'Taxi fare', 'Uber', '13 Oct, 2026', 'Credit Card', '-$10.64'],
  ['Entertainment', 'iTunes', 'iTunes Store', '12 Oct, 2026', 'Checking', '-$58.80'],
  ['Others', 'Donation', 'City Charity Trust', '11 Oct, 2026', 'Checking', '-$31.92'],
  ['Others', 'Loan installment', 'City Bank Ltd.', '10 Oct, 2026', 'Loan', '-$106.40'],
  ['Income', 'Freelance payment', 'Bright Studio', '10 Oct, 2026', 'Checking', '+$179.20'],
  ['Shopping', 'Keyboard', 'Gadget & Gear', '9 Oct, 2026', 'Credit Card', '-$42.00'],
  ['Food', 'Pizza', 'Pizza Hit', '8 Oct, 2026', 'Credit Card', '-$24.64'],
  ['Transportation', 'Metro Card bill', 'Metro Rail', '7 Oct, 2026', 'Checking', '-$21.28'],
];
const freelance = (date: string): Row => ['Income', 'Freelance payment', 'Bright Studio', date, 'Checking', '+$179.20'];
/** Revenue's first page (AC3). */
const revenuePage1: Row[] = [
  freelance('17 Oct, 2026'),
  ['Income', 'Dividend', 'AB Bank Ltd', '15 Oct, 2026', 'Investment', '+$84.00'],
  freelance('10 Oct, 2026'),
  freelance('3 Oct, 2026'),
  ['Income', 'Design project', 'Acme Ltd.', '1 Oct, 2026', 'Checking', '+$784.00'],
  ['Income', 'Interest', 'Brac Bank Ltd.', '28 Sep, 2026', 'Savings', '+$44.80'],
  ['Income', 'Card repayment', 'AB Bank Ltd', '27 Sep, 2026', 'Credit Card', '+$504.00'],
  freelance('24 Sep, 2026'),
  freelance('17 Sep, 2026'),
  ['Income', 'Dividend', 'AB Bank Ltd', '15 Sep, 2026', 'Investment', '+$84.00'],
];
/** Expenses' first page (AC3): All's without the Freelance payment, then Parking. */
const expensesPage1: Row[] = [...allPage1.filter((row) => row[0] !== 'Income'), allPage2[1]!];

/** The selected tab in the designed Active style, the others not (#19). */
async function expectSelected(page: Page, name: TabName) {
  const teal = await tokenColor(page, '--color-primary');
  const secondary = await tokenColor(page, '--color-secondary');
  for (const each of ['All', 'Revenue', 'Expenses'] as const) {
    await expect(tab(page, each)).toHaveAttribute('aria-selected', String(each === name));
    const style = {
      color: await computed(tab(page, each), 'color'),
      underline: await computed(tab(page, each), 'border-bottom-color'),
      weight: await computed(tab(page, each), 'font-weight'),
    };
    if (each === name) expect(style).toEqual({ color: teal, underline: teal, weight: '700' });
    else expect(style).toMatchObject({ color: secondary, weight: '600' });
  }
  await expect(panel(page)).toHaveAccessibleName(name);
  await expect(table(page)).toHaveAccessibleName(name);
}

/** Holds every Load More (a request with a cursor) until `release` is called. */
async function holdLoadMore(page: Page) {
  let release!: () => void;
  const released = new Promise<void>((done) => {
    release = done;
  });
  await page.route(
    (url) => isList(url) && url.searchParams.has('cursor'),
    async (route: Route) => {
      await released;
      await route.continue();
    },
  );
  return release;
}

// T19: AC1 to AC4, from the sidebar and from Overview's "View All"; the tabs; "Load More" held, then released.
test('opens from the sidebar and "View All", shows each tab’s first 10 and adds page 2 with "Load More"', async ({
  page,
}) => {
  await signUp(page.request);
  const sent = recordPageRequests(page);
  await page.goto('/overview');
  await expect(headerDate(page)).toHaveText('22 Oct, 2026');

  await sidebar(page).getByRole('link', { name: 'Transactions' }).click();

  await expect(page).toHaveURL(`${FRONTEND_URL}/transactions`);
  await waitForPanel(page);
  await expect(section(page).getByRole('heading', { level: 2 })).toHaveText('Recent Transaction');
  await expect(sidebar(page).locator('a[aria-current="page"]')).toHaveText('Transactions');
  await expect(headerDate(page)).toHaveText('22 Oct, 2026');
  await expect(page.getByRole('banner').getByText(/^Hello /)).toHaveCount(0);
  await expect(tablist(page).getByRole('tab')).toHaveCount(3);
  for (const [index, name] of ['All', 'Revenue', 'Expenses'].entries()) {
    await expect(tablist(page).getByRole('tab').nth(index)).toHaveAccessibleName(name);
  }
  await expectSelected(page, 'All');
  await expect(table(page).getByRole('columnheader')).toHaveText([
    'Items',
    'Shop Name',
    'Date',
    'Payment Method',
    'Amount',
  ]);
  await expectRows(page, allPage1);
  await expect(loadMore(page)).toBeVisible();
  // A Gray/06 divider under every row but the last.
  const gray06 = await tokenColor(page, '--color-gray-06');
  const dividers = await bodyRows(page).evaluateAll((rows) =>
    rows.map((row) => {
      const style = getComputedStyle(row.querySelector('td')!);
      return [style.borderBottomWidth, style.borderBottomColor];
    }),
  );
  expect(dividers.slice(0, 9)).toEqual(Array.from({ length: 9 }, () => ['1px', gray06]));
  expect(dividers[9]![0]).toBe('0px');

  for (const [name, rows] of [
    ['Revenue', revenuePage1],
    ['Expenses', expensesPage1],
    ['All', allPage1],
  ] as const) {
    await tab(page, name).click();
    await expectSelected(page, name);
    await expectRows(page, rows);
  }
  expect(sent.map(({ tab: name, cursor }) => [name, cursor])).toEqual([
    ['all', null],
    ['revenue', null],
    ['expenses', null],
    ['all', null],
  ]);
  expect(new Set(sent.map(({ zone }) => zone))).toEqual(new Set(['Europe/Belgrade']));

  // "Load More", held: the loading look, one request with page 1's cursor, then page 2 under the 10 rows.
  const firstPage = (await (
    await page.request.get('/api/transactions?tab=all', { headers: { 'X-Time-Zone': 'Europe/Belgrade' } })
  ).json()) as { nextCursor: string };
  const release = await holdLoadMore(page);
  await loadMore(page).click();
  await expect(loadMore(page)).toHaveAttribute('aria-busy', 'true');
  await expect(loadMore(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(loadMore(page).getByTestId('spinner')).toBeVisible();
  await expect(loadMore(page)).toHaveAccessibleName('Load More');
  expect(await computed(loadMore(page), 'background-color')).toBe(await tokenColor(page, '--color-button-secondary'));
  // A click on the busy button asks for nothing (force: Playwright waits for an aria-disabled button otherwise).
  await loadMore(page).click({ force: true });
  await expect(bodyRows(page)).toHaveCount(10);
  release();

  await expect(bodyRows(page)).toHaveCount(20);
  await expectRows(page, [...allPage1, ...allPage2]);
  expect(sent.filter(({ cursor }) => cursor !== null)).toEqual([
    { tab: 'all', cursor: firstPage.nextCursor, zone: 'Europe/Belgrade' },
  ]);
  const items = (await rowsShown(page)).map((row) => row[1]);
  expect(items.filter((item) => item === 'Shirt')).toHaveLength(1);
  expect(items.filter((item) => item === 'Dividend')).toHaveLength(1);

  // From Overview's Recent Transaction "View All", on All again.
  await page.goto('/overview');
  await main(page).getByRole('region', { name: 'Recent Transaction' }).getByRole('link', { name: 'View All' }).click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/transactions`);
  await waitForPanel(page);
  await expectSelected(page, 'All');
  await expectRows(page, allPage1);
});

// T20: AC6 and AC7, the cursor continues after the clock passes midnight; the new day only on a new first page.
test('continues "Load More" from the cursor after the backend clock moves a day on; a reload shows the new day', async ({
  page,
}) => {
  await openTransactions(page);
  await expectRows(page, allPage1);

  await moveBackendClock(page, '2026-10-23T10:00:00Z');
  await loadMore(page).click();

  await expect(bodyRows(page)).toHaveCount(20);
  await expectRows(page, [...allPage1, ...allPage2]);
  const items = (await rowsShown(page)).map((row) => row[1]);
  expect(items.filter((item) => item === 'Shirt')).toHaveLength(1);
  expect(items).not.toContain('Gift');

  await page.reload();
  await waitForPanel(page);
  expect((await rowsShown(page))[0]).toEqual([
    'Food',
    'Biriyani',
    'Hajir Biriyani',
    '23 Oct, 2026',
    'Credit Card',
    '-$14.78',
  ]);
  await expect(bodyRows(page)).toHaveCount(10);
});

// T21: AC5 and AC16, the end of the list: no "Load More", focus on the last page's first row (#27, #117 a).
test('hides "Load More" at the end of the list, with focus on the last page’s first row', async ({ page }) => {
  await moveBackendClock(page, '2022-01-08T10:00:00Z');
  await openTransactions(page);
  await expect(bodyRows(page)).toHaveCount(10);
  await expect(loadMore(page)).toHaveCount(0);

  await moveBackendClock(page, '2022-01-09T10:00:00Z');
  await openTransactions(page);
  await expect(bodyRows(page)).toHaveCount(10);
  expect((await rowsShown(page))[9]).toEqual([
    'Housing',
    'House Rent',
    'Park View Apartments',
    '1 Jan, 2022',
    'Checking',
    '-$218.50',
  ]);
  await loadMore(page).focus();
  await page.keyboard.press('Enter');

  await expect(bodyRows(page)).toHaveCount(11);
  expect((await rowsShown(page))[10]).toEqual([
    'Income',
    'Design project',
    'Acme Ltd.',
    '1 Jan, 2022',
    'Checking',
    '+$665.00',
  ]);
  await expect(loadMore(page)).toHaveCount(0);
  await expect(bodyRows(page).nth(10)).toBeFocused();
  await expect(bodyRows(page).nth(10)).toHaveAttribute('tabindex', '-1');
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);

  await tab(page, 'Revenue').click();
  await waitForPanel(page);
  await expect(bodyRows(page)).toHaveCount(2);
  expect((await rowsShown(page)).map((row) => row[1])).toEqual(['Freelance payment', 'Design project']);
  await expect(loadMore(page)).toHaveCount(0);
});

// T22: AC7 and AC9, today and the dates in the browser's zone (#53, #54, #80).
for (const [zone, firstRows, lateDate] of [
  ['Europe/Belgrade', ['Gift', 'Freelance payment', 'Biriyani', 'Jeans'], '23 Oct, 2026'],
  ['America/New_York', ['Biriyani', 'Jeans'], '22 Oct, 2026'],
] as const) {
  test.describe(`in ${zone}`, () => {
    test.use({ timezoneId: zone });

    test(`starts All with ${firstRows.join(', ')} at 2026-10-23T22:30:00Z and shows 2026-10-22T23:30:00Z on ${lateDate}`, async ({
      page,
    }) => {
      await moveBackendClock(page, '2026-10-23T22:30:00Z');
      await openTransactions(page);

      expect((await rowsShown(page)).slice(0, firstRows.length).map((row) => row[1])).toEqual(firstRows);
      if (zone === 'Europe/Belgrade') {
        expect((await rowsShown(page)).slice(0, 2).map((row) => row[3])).toEqual(['24 Oct, 2026', '24 Oct, 2026']);
      }

      await page.route(
        (url) => isList(url),
        (route) =>
          route.fulfill({
            json: {
              transactions: [
                {
                  item: 'Jeans',
                  shopName: 'Denim House',
                  category: 'shopping',
                  direction: 'expense',
                  occurredAt: '2026-10-22T23:30:00.000Z',
                  paymentMethod: 'checking',
                  amount: { cents: 26_600, currency: 'USD' },
                },
              ],
              nextCursor: null,
            },
          }),
      );
      await page.reload();
      await waitForPanel(page);

      await expectRows(page, [['Shopping', 'Jeans', 'Denim House', lateDate, 'Checking', '-$266.00']]);
    });
  });
}

/** Overview's Recent Transaction rows of a tab: item, shop, amount and date. */
async function overviewRows(page: Page, name: TabName) {
  const recent = main(page).getByRole('region', { name: 'Recent Transaction' });
  await recent.getByRole('tab', { name }).click();
  await expect(recent.getByRole('tabpanel')).toHaveAccessibleName(name);
  return recent
    .getByRole('tabpanel')
    .getByRole('listitem')
    .evaluateAll((items) =>
      items.map((item) => [...item.querySelectorAll('p, time')].map((element) => element.textContent ?? '')),
    );
}

// T23: AC8, each tab's first 5 are Overview's Recent Transaction rows, in order (#40).
for (const now of ['2026-10-22T10:00:00Z', '2026-10-23T22:30:00Z']) {
  test(`shows each tab’s first 5 as Overview’s Recent Transaction at ${now}`, async ({ page }) => {
    await moveBackendClock(page, now);
    await signUp(page.request);
    await page.goto('/overview');
    await expect(main(page).getByRole('region', { name: 'Recent Transaction' }).getByRole('listitem')).toHaveCount(5);
    const overview: Record<string, string[][]> = {};
    for (const name of ['All', 'Revenue', 'Expenses'] as const) overview[name] = await overviewRows(page, name);

    await page.goto('/transactions');
    await waitForPanel(page);
    for (const name of ['All', 'Revenue', 'Expenses'] as const) {
      await tab(page, name).click();
      await expect(table(page)).toHaveAccessibleName(name);
      await expect(bodyRows(page)).toHaveCount(10);
      const firstFive = (await rowsShown(page))
        .slice(0, 5)
        .map(([, item, shop, date, , amount]) => [item, shop, amount, date]);
      expect({ name, rows: firstFive }).toEqual({ name, rows: overview[name] });
    }
  });
}

// T24: AC14 and AC15, the states: the skeleton, the error and Retry, no transactions, a failed "Load More" (#6, #88,
// #89, #117 b).
test('shows the skeleton, then the error state after the retries, and Retry loads the rows', async ({ page }) => {
  await signUp(page.request);
  let mode: 'hold' | 'fail' | 'pass' = 'hold';
  let release!: () => void;
  const released = new Promise<void>((done) => {
    release = done;
  });
  let failures = 0;
  await page.route(
    (url) => isList(url),
    async (route) => {
      if (mode === 'hold') await released;
      if (mode === 'pass') return route.continue();
      failures += 1;
      return route.fulfill({ status: 500, json: { message: 'Internal server error' } });
    },
  );
  await page.goto('/transactions');

  await expect(panel(page).locator('[aria-busy="true"]')).toHaveCount(1);
  await expect(tablist(page).getByRole('tab')).toHaveCount(3);
  await expect(table(page)).toHaveCount(0);
  const skeleton = await box(card(page));
  mode = 'fail';
  release();

  await expect(panel(page).getByRole('alert')).toHaveText('Something went wrong.', { timeout: 20_000 });
  expect(failures).toBe(4);
  await expect(loadMore(page)).toHaveCount(0);
  near((await box(card(page))).height, 704, 'error card at its 704 minimum');
  mode = 'pass';
  await panel(page).getByRole('button', { name: 'Retry' }).click();

  await expectRows(page, allPage1);
  await expect(panel(page).getByRole('alert')).toHaveCount(0);
  // The skeleton has a first page's height: the card does not move when the rows arrive.
  near((await box(card(page))).height, skeleton.height, 'skeleton as high as a first page');
});

test('shows "No transactions yet" in the card before the dataset begins, with no table and no "Load More"', async ({
  page,
}) => {
  await moveBackendClock(page, '2021-12-31T10:00:00Z');
  await openTransactions(page);

  await expect(panel(page).getByText('No transactions yet')).toBeVisible();
  await expect(table(page)).toHaveCount(0);
  await expect(loadMore(page)).toHaveCount(0);
  const cardBox = await box(card(page));
  near(cardBox.height, 704, 'empty card at its 704 minimum');
  const message = await box(panel(page).getByText('No transactions yet'));
  expect(Math.abs(message.y + message.height / 2 - (cardBox.y + cardBox.height / 2))).toBeLessThanOrEqual(1);
});

test('keeps the rows when "Load More" fails, shows the message above the button, then adds the page once', async ({
  page,
}) => {
  await openTransactions(page);
  let failing = true;
  await page.route(
    (url) => isList(url) && url.searchParams.has('cursor'),
    (route) =>
      failing ? route.fulfill({ status: 500, json: { message: 'Internal server error' } }) : route.continue(),
  );
  await loadMore(page).focus();
  await page.keyboard.press('Enter');

  const status = panel(page).getByRole('status');
  await expect(status).toHaveText('Something went wrong.', { timeout: 20_000 });
  await expectRows(page, allPage1);
  await expect(loadMore(page)).toBeFocused();
  await expect(loadMore(page)).not.toHaveAttribute('aria-busy');
  expect((await box(status)).y + (await box(status)).height).toBeLessThanOrEqual((await box(loadMore(page))).y);
  failing = false;
  await page.keyboard.press('Enter');

  await expect(bodyRows(page)).toHaveCount(20);
  await expectRows(page, [...allPage1, ...allPage2]);
  await expect(status).toHaveText('');
});

/** The right edge of the page: the window less a classic scrollbar's gutter (#101). */
const pageRight = (page: Page) => page.evaluate(() => document.body.getBoundingClientRect().right);
const scrollWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);
const near = (actual: number, expected: number, what: string, tolerance = 0.5) =>
  expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;
const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x - 0.5 &&
  inner.y >= outer.y - 0.5 &&
  inner.x + inner.width <= outer.x + outer.width + 0.5 &&
  inner.y + inner.height <= outer.y + outer.height + 0.5;

/** The box of each cell's own text in a row (all its lines), and the icon's box. */
const cellTexts = (row: Locator) =>
  row.evaluate((element) => {
    const cells = [...element.querySelectorAll('td')];
    const item = cells[0]!.querySelector('span > span:last-child')!;
    const icon = cells[0]!.querySelector('[role="img"]')!.getBoundingClientRect();
    return {
      icon: { x: icon.x, y: icon.y, width: icon.width, height: icon.height },
      // The item's own text, then each other cell's.
      texts: [item, ...cells.slice(1)].map((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const { x, y, width, height } = range.getBoundingClientRect();
        const rects = [...range.getClientRects()];
        return {
          x,
          y,
          width,
          height,
          firstLineCentre: rects[0]!.y + rects[0]!.height / 2,
          lines: new Set(rects.map((rect) => Math.round(rect.y))).size,
        };
      }),
    };
  });

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

/** The column centres of the Shop Name, Date and Payment Method texts as fractions of the row (task 020 References). */
const centres = [(250 + 192 / 2) / 1048, (250 + 192 + 258 / 2) / 1048, (250 + 192 + 258 + 216 / 2) / 1048];

/**
 * AC18: the card, the header row, the rows, the columns, "Load More" and the page's end where 107 places them, x from
 * the page's right edge (#94, #101).
 */
async function expectTableLayout(page: Page, rowCount = 10) {
  const right = await pageRight(page);
  const cardBox = await box(card(page));
  near(cardBox.x, 304, 'card x');
  near(cardBox.y, 208, 'card y');
  near(cardBox.width, right - 32 - 304, 'card width');
  const tableBox = await box(table(page));
  near(tableBox.x, cardBox.x + 28, 'rows 28 inside the card');
  near(tableBox.width, cardBox.width - 56, 'rows 56 narrower than the card');
  const header = await box(headerRow(page));
  near(header.y, cardBox.y + 24, 'header 24 under the card top');
  near(header.height, 40, 'header row: 24 line, 16 to the divider');
  const headerTexts = await headerRow(page).evaluate((element) =>
    [...element.querySelectorAll('th')].map((cell) => {
      const range = document.createRange();
      range.selectNodeContents(cell);
      const { x, width } = range.getBoundingClientRect();
      return { x, width };
    }),
  );
  near(headerTexts[0]!.x, tableBox.x + 8, 'Items header 8 into the row');
  for (const [index, fraction] of centres.entries()) {
    const { x, width } = headerTexts[index + 1]!;
    near(x + width / 2, tableBox.x + tableBox.width * fraction, `header ${index + 1} centre`, 1);
  }
  near(headerTexts[4]!.x + headerTexts[4]!.width, tableBox.x + tableBox.width, 'Amount header at the row end', 1);

  await expect(bodyRows(page)).toHaveCount(rowCount);
  let rowBottom = header.y + header.height;
  for (let index = 0; index < rowCount; index += 1) {
    const row = bodyRows(page).nth(index);
    const rowBox = await box(row);
    near(rowBox.y, rowBottom, `row ${index + 1} y`);
    near(rowBox.height, 72, `row ${index + 1} height: one line`);
    const { icon, texts } = await cellTexts(row);
    near(icon.x, tableBox.x + 8, `row ${index + 1} icon x`);
    near(icon.y, rowBox.y + 24, `row ${index + 1} icon y`);
    near(icon.width, 24, `row ${index + 1} icon size`);
    near(texts[0]!.x, icon.x + 24 + 16, `row ${index + 1} item 16 after the icon`);
    for (const [column, fraction] of centres.entries()) {
      const text = texts[column + 1]!;
      near(text.x + text.width / 2, tableBox.x + tableBox.width * fraction, `row ${index + 1} column ${column + 2}`, 1);
    }
    near(texts[4]!.x + texts[4]!.width, tableBox.x + tableBox.width, `row ${index + 1} amount at the row end`, 1);
    for (const text of texts) {
      expect(text.lines, `row ${index + 1}: one line`).toBe(1);
      near(text.y + text.height / 2, rowBox.y + 36, `row ${index + 1} text centred on the row`, 1);
    }
    rowBottom = rowBox.y + rowBox.height;
  }

  const button = await box(loadMore(page));
  near(button.width, 192, 'Load More width');
  near(button.height, 48, 'Load More height');
  near(button.x + button.width / 2, cardBox.x + cardBox.width / 2, 'Load More centred');
  near(button.y, rowBottom + 32, 'Load More 32 under the last row');
  near(cardBox.y + cardBox.height, button.y + button.height + 56, 'card 56 under Load More');
  near(cardBox.height, 24 + 40 + rowCount * 72 + 32 + 48 + 32 + 24, 'card height');
  // The page ends 32 under the card where it scrolls (#111); a taller window ends at its bottom.
  const { pageEnd, windowHeight } = await page.evaluate(() => ({
    pageEnd: document.documentElement.scrollHeight - window.scrollY,
    windowHeight: window.innerHeight,
  }));
  near(pageEnd, Math.max(windowHeight, cardBox.y + cardBox.height + 32), 'page end 32 under the card');
  return { cardBox, tableBox };
}

// T25: AC18, 107's layout at 1440x1024, wider at 1920 and 2560, the same at 1280 (#94, #101, #111).
test('places the card, the rows, the columns and "Load More" where 107 does, wider at 1920 and 2560, the same at 1280', async ({
  page,
}) => {
  await openTransactions(page);
  // The title's line box and the tabs, 24 under it.
  const title = await box(section(page).getByRole('heading', { level: 2 }));
  near(title.y, 104, 'title line box y');
  near(title.height, 32, 'title line box height');
  const tabs = await box(tablist(page));
  near(tabs.y, 160, 'tabs 24 under the title');
  near(tabs.height, 32, 'tabs height');
  near(tabs.x, 304, 'tabs x');
  await expectTableLayout(page);
  expect(await scrollWidth(page)).toBe(Math.round(await pageRight(page)));

  let width = 0;
  for (const [viewportWidth, height] of [
    [1440, 1024],
    [1920, 1080],
    [2560, 1440],
  ] as const) {
    await page.setViewportSize({ width: viewportWidth, height });
    const { tableBox } = await expectTableLayout(page);
    expect(tableBox.width, `${viewportWidth}: rows wider`).toBeGreaterThan(width);
    width = tableBox.width;
  }

  await page.setViewportSize({ width: 1280, height: 1024 });
  for (const name of ['All', 'Revenue', 'Expenses'] as const) {
    await tab(page, name).click();
    await waitForPanel(page);
    await expect(table(page)).toHaveAccessibleName(name);
    await expectTableLayout(page);
    expect(await scrollWidth(page), `${name} at 1280: no horizontal scroll`).toBe(Math.round(await pageRight(page)));
  }
});

/** The demo's first page of All with long texts on its first two rows and $1,000,000,000.00 on the third (AC19). */
async function routeLongTexts(page: Page) {
  const words =
    'Annual premium subscription renewal for the professional design and collaboration suite with extended cloud storage plan';
  const shopWords =
    'The Grand Central Department Store and Shopping Arcade of the Greater Metropolitan Area and Its Surrounding District Ltd';
  const noSpace = 'Annualpremiumsubscriptionrenewal'.repeat(4).slice(0, 120);
  const shopNoSpace = 'GrandCentralDepartmentStoreArcade'.repeat(4).slice(0, 120);
  await page.route(
    (url) => isList(url) && url.searchParams.get('tab') === 'all' && !url.searchParams.has('cursor'),
    async (route) => {
      const response = await route.fetch();
      const body = (await response.json()) as { transactions: Record<string, unknown>[]; nextCursor: string };
      body.transactions[0] = { ...body.transactions[0], item: words, shopName: shopWords };
      body.transactions[1] = { ...body.transactions[1], item: noSpace, shopName: shopNoSpace };
      body.transactions[2] = { ...body.transactions[2], amount: { cents: 100_000_000_000, currency: 'USD' } };
      await route.fulfill({ response, json: body });
    },
  );
}

// T25: AC19, long texts wrap inside their columns and the row grows; the amount stays on one line (#106, #108 b,
// #111 a, #115 b).
for (const [width, height] of [
  [1440, 1024],
  [1280, 1024],
] as const) {
  test(`wraps a 120-character item and shop and keeps $1,000,000,000.00 on one line at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await routeLongTexts(page);
    await openTransactions(page);
    const cardBox = await box(card(page));

    for (const index of [0, 1, 2]) {
      const row = bodyRows(page).nth(index);
      const rowBox = await box(row);
      const { icon, texts } = await cellTexts(row);
      const parts = [icon, ...texts];
      for (const [a, first] of parts.entries()) {
        expect(inside(first, cardBox), `row ${index + 1} part ${a} inside the card`).toBe(true);
        expect(inside(first, rowBox), `row ${index + 1} part ${a} inside its row`).toBe(true);
        for (const second of parts.slice(a + 1)) {
          expect(overlaps(first, second), `row ${index + 1}: parts overlap`).toBe(false);
        }
      }
      // Every cell's first line on the row's first 24 px line.
      for (const text of texts) near(text.firstLineCentre, rowBox.y + 36, `row ${index + 1} first line at the top`, 1);
      expect(texts[4]!.lines, `row ${index + 1}: the amount on one line`).toBe(1);
      if (index < 2) {
        expect(texts[0]!.lines, `row ${index + 1}: the item wraps`).toBeGreaterThan(1);
        expect(texts[1]!.lines, `row ${index + 1}: the shop wraps`).toBeGreaterThan(1);
        expect(rowBox.height, `row ${index + 1} grows`).toBeGreaterThan(72);
      }
    }
    await expect(bodyRows(page).nth(2).locator('td').last()).toHaveText('-$1,000,000,000.00');
    expect(await overflowCount(card(page)), 'nothing scrolls inside the card').toBe(0);
    expect(await scrollWidth(page), 'no horizontal scroll').toBe(Math.round(await pageRight(page)));
  });
}

// T25: AC20, each tab takes its own height; the first pages are the same height, so nothing above the button moves
// (#117 c).
for (const [width, height] of [
  [1440, 1024],
  [1280, 1024],
] as const) {
  test(`keeps the title, the tabs, the header row, "Load More" and the page end in place across tabs at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await openTransactions(page);
    const pageEnd = () => page.evaluate(() => document.documentElement.scrollHeight);
    // In page coordinates: Playwright scrolls "Load More" into view to click it.
    const onPage = async (locator: Locator) => {
      const viewportBox = await box(locator);
      return { ...viewportBox, y: viewportBox.y + (await page.evaluate(() => window.scrollY)) };
    };
    const places = async () => ({
      title: await onPage(section(page).getByRole('heading', { level: 2 })),
      tabs: await onPage(tablist(page)),
      header: await onPage(headerRow(page)),
      button: await onPage(loadMore(page)),
      end: await pageEnd(),
    });
    const onAll = await places();

    for (const name of ['Revenue', 'Expenses', 'All'] as const) {
      await tab(page, name).click();
      await waitForPanel(page);
      await expect(table(page)).toHaveAccessibleName(name);
      expect(await places(), name).toEqual(onAll);
    }

    await loadMore(page).click();
    await expect(bodyRows(page)).toHaveCount(20);
    const after = await places();
    expect(after.button.y).toBeGreaterThan(onAll.button.y);
    expect(after.end).toBeGreaterThan(onAll.end);

    await tab(page, 'Revenue').click();
    await expect(table(page)).toHaveAccessibleName('Revenue');
    await expectRows(page, revenuePage1);
    expect(await places()).toEqual(onAll);
    await tab(page, 'All').click();
    await expect(table(page)).toHaveAccessibleName('All');
    await expectRows(page, allPage1);
    expect(await places()).toEqual(onAll);
  });
}

// T26: AC16, the keyboard: the Tab order, the ring on the tab, the panel, "Load More" and the focused new row; none
// after a click (#87, #112, #117 a).
test('tabs from the search field to the tab, the panel and "Load More" with the ring, then out; Shift+Tab goes back', async ({
  page,
}) => {
  await openTransactions(page);
  await expect(table(page).locator('tbody a, tbody button, tbody input, tbody [tabindex]')).toHaveCount(0);

  await search(page).focus();
  await page.keyboard.press('Tab');
  await expect(tab(page, 'All')).toBeFocused();
  await expectRing(page, tab(page, 'All'));
  await page.keyboard.press('Tab');
  await expect(panel(page)).toBeFocused();
  await expectRing(page, panel(page));
  await page.keyboard.press('Tab');
  await expect(loadMore(page)).toBeFocused();
  await expectRing(page, loadMore(page));
  await page.keyboard.press('Tab');
  expect(await main(page).evaluate((element) => element.contains(document.activeElement))).toBe(false);

  await loadMore(page).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(panel(page)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(tab(page, 'All')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(search(page)).toBeFocused();

  // "Load More" by keyboard: focus on the first new row, with the ring, the page not scrolled by the move.
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
  await expect(table(page).locator('tbody [tabindex]')).toHaveCount(1);
  await expect(table(page).locator('tbody [tabindex="-1"]')).toHaveCount(1);

  // By mouse (after a click on the empty sidebar, so no keyboard focus is left): the next page's first row, no ring.
  await page.mouse.click(140, 600);
  await loadMore(page).click();
  await expect(bodyRows(page)).toHaveCount(30);
  const clickedRow = bodyRows(page).nth(20);
  await expect(clickedRow).toBeFocused();
  expect(await clickedRow.evaluate((node) => node.matches(':focus-visible'))).toBe(false);
  expect(await computed(clickedRow, 'outline-style')).toBe('none');

  // A click on a tab and on a row: no ring.
  await tab(page, 'Revenue').click();
  await expect(tab(page, 'Revenue')).toBeFocused();
  expect(await tab(page, 'Revenue').evaluate((node) => node.matches(':focus-visible'))).toBe(false);
  await waitForPanel(page);
  await bodyRows(page).first().click();
  expect(await panel(page).evaluate((node) => node.matches(':focus-visible'))).toBe(false);
  expect(await computed(panel(page), 'outline-style')).toBe('none');
});

// Task 032 T7: AC5. Income in green and expenses in red, by the direction as sent, on every tab and in the rows
// "Load More" adds (#132, #134 a).
test('shows income amounts in green and expense amounts in red on every tab, the rows "Load More" adds included', async ({
  page,
}) => {
  await openTransactions(page);
  const amounts = bodyRows(page).locator('td:last-child');
  const seen: Record<string, { income: number; expense: number }> = {};

  for (const name of ['All', 'Revenue', 'Expenses'] as const) {
    await tab(page, name).click();
    await waitForPanel(page);
    await expect(bodyRows(page)).toHaveCount(10);
    await loadMore(page).click();
    await expect.poll(() => bodyRows(page).count()).toBeGreaterThan(10);
    seen[name] = await expectSignedColours(amounts, name);
  }

  expect(seen.All!.income).toBeGreaterThan(0);
  expect(seen.All!.expense).toBeGreaterThan(0);
  expect(seen.Revenue!.expense).toBe(0);
  expect(seen.Revenue!.income).toBeGreaterThan(10);
  expect(seen.Expenses!.income).toBe(0);
  expect(seen.Expenses!.expense).toBeGreaterThan(10);
});
