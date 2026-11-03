import type { Locator, Page, Request, Route } from '@playwright/test';

import { FRONTEND_URL } from '../constants';
import { expect, test } from '../fixtures';
import { box, computed, signUp, tokenColor } from '../helpers';

const main = (page: Page) => page.getByRole('main');
const section = (page: Page) => main(page).getByRole('region', { name: 'Upcoming Bills' });
/** The white card: the section's element after its title row. */
const card = (page: Page) => section(page).locator(':scope > div').last();
const table = (page: Page) => section(page).getByRole('table', { name: 'Upcoming Bills' });
const bodyRows = (page: Page) => table(page).locator('tbody > tr');
const headerRow = (page: Page) => table(page).locator('thead > tr');
const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const headerDate = (page: Page) => page.getByRole('banner').locator('time');
const search = (page: Page) => page.getByRole('searchbox', { name: 'Search' });
const overviewBills = (page: Page) => main(page).getByRole('region', { name: 'Upcoming Bill' });

const moveBackendClock = async (page: Page, now: string) =>
  expect((await page.request.put('/api/test/clock', { data: { now } })).ok()).toBe(true);

const isBillsRequest = (request: Request) => new URL(request.url()).pathname === '/api/bills/upcoming';

/** The demo description, the backend's (demo-data.md, Bills). */
const description =
  'For advanced security and more flexible controls, the Professional plan helps you scale design processes company-wide.';

/** Waits until the card shows its content: the table's rows, the empty message or the error state. */
async function waitForCard(page: Page) {
  await expect(card(page)).toBeVisible();
  await expect(card(page).locator('[aria-busy="true"]')).toHaveCount(0);
}

/** Signs up a new user at the backend's clock and opens Bills once its content shows. */
async function openBills(page: Page) {
  await signUp(page.request);
  await page.goto('/bills');
  await expect(headerDate(page)).toBeVisible();
  await waitForCard(page);
}

/** A bill row as shown: the due date's box and value, the logo's name, the title, the description, the last charge
 * and its value, and the amount. */
type Row = {
  dueDate: string;
  box: string;
  logo: string;
  title: string;
  description: string;
  lastCharge: string;
  lastChargeDate: string;
  amount: string;
};

const rowsShown = (page: Page): Promise<Row[]> =>
  bodyRows(page).evaluateAll((rows) =>
    rows.map((row) => {
      const cells = [...row.querySelectorAll('td')];
      const [title, text] = [...cells[2]!.querySelectorAll('p')];
      const lastCharge = cells[3]!.querySelector('time')!;
      return {
        dueDate: cells[0]!.querySelector('time')!.dateTime,
        box: cells[0]!.textContent ?? '',
        logo: cells[1]!.querySelector('img')!.alt,
        title: title!.textContent ?? '',
        description: text!.textContent ?? '',
        lastCharge: lastCharge.textContent ?? '',
        lastChargeDate: lastCharge.dateTime,
        amount: cells[4]!.textContent ?? '',
      };
    }),
  );

const figma = (year: number): Row => ({
  dueDate: `${year}-05-15`,
  box: 'May15',
  logo: 'Figma',
  title: 'Figma - Yearly Plan',
  description,
  lastCharge: `14 May, ${year - 1}`,
  lastChargeDate: `${year - 1}-05-14`,
  amount: '$150.00',
});
const adobe = (year: number): Row => ({
  dueDate: `${year}-06-16`,
  box: 'Jun16',
  logo: 'Adobe',
  title: 'Adobe Inc - Yearly Plan',
  description,
  lastCharge: `17 Jun, ${year - 1}`,
  lastChargeDate: `${year - 1}-06-17`,
  amount: '$559.00',
});

async function expectRows(page: Page, expected: Row[]) {
  await expect(bodyRows(page)).toHaveCount(expected.length);
  expect(await rowsShown(page)).toEqual(expected);
}

/** The divider under each row: its bottom border's width and color. */
const dividers = (page: Page) =>
  bodyRows(page).evaluateAll((rows) =>
    rows.map((row) => {
      const style = getComputedStyle(row);
      return [style.borderBottomWidth, style.borderBottomColor];
    }),
  );

// T13: AC1 to AC4, from the sidebar and from Overview's "View All"; the request's zone (#10, #11, #28, #41, #48, #88).
test('opens from the sidebar and "View All" and lists the 4 demo bills in 108’s table with the logos as drawn', async ({
  page,
}) => {
  await signUp(page.request);
  const zones: (string | undefined)[] = [];
  page.on('request', (request) => {
    if (isBillsRequest(request)) zones.push(request.headers()['x-time-zone']);
  });
  await page.goto('/overview');
  await expect(headerDate(page)).toHaveText('22 Oct, 2026');

  await sidebar(page).getByRole('link', { name: 'Bills' }).click();

  await expect(page).toHaveURL(`${FRONTEND_URL}/bills`);
  await waitForCard(page);
  await expect(section(page).getByRole('heading', { level: 2 })).toHaveText('Upcoming Bills');
  await expect(sidebar(page).locator('a[aria-current="page"]')).toHaveText('Bills');
  await expect(headerDate(page)).toHaveText('22 Oct, 2026');
  await expect(page.getByRole('banner').getByText(/^Hello /)).toHaveCount(0);
  await expect(table(page).getByRole('columnheader')).toHaveText([
    'Due Date',
    'Logo',
    'Item Description',
    'Last Charge',
    'Amount',
  ]);
  await expectRows(page, [figma(2027), adobe(2027), figma(2028), adobe(2028)]);
  const gray06 = await tokenColor(page, '--color-gray-06');
  const shownDividers = await dividers(page);
  expect(shownDividers.slice(0, 3)).toEqual([
    ['1px', gray06],
    ['1px', gray06],
    ['1px', gray06],
  ]);
  expect(shownDividers[3]![0], 'no divider under the last row').toBe('0px');
  // The exported components at their own size, named by the biller.
  for (const [index, name, height] of [
    [0, 'Figma', 40],
    [1, 'Adobe', 32],
  ] as const) {
    const logo = bodyRows(page).nth(index).getByRole('img', { name });
    await expect(logo).toBeVisible();
    expect(await box(logo)).toMatchObject({ width: 120, height });
    expect(await logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth)).toBe(120);
  }
  expect(zones.length).toBeGreaterThan(0);
  expect(new Set(zones)).toEqual(new Set(['Europe/Belgrade']));

  // From Overview's Upcoming Bill "View All" (#48).
  await sidebar(page).getByRole('link', { name: 'Overview' }).click();
  await overviewBills(page).getByRole('link', { name: 'View All' }).click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/bills`);
  await expectRows(page, [figma(2027), adobe(2027), figma(2028), adobe(2028)]);
});

type AXNode = {
  nodeId: string;
  ignored: boolean;
  role?: { value?: string };
  name?: { value?: string };
  childIds?: string[];
};

/**
 * The roles and names under the node named `name` with `role` in Chromium's own accessibility tree (over CDP), the
 * ignored nodes skipped. Playwright's role locators, jsdom and the MCP snapshots compute roles from the DOM; this reads
 * what Chromium exposes.
 */
async function chromiumTree(page: Page, role: string, name: string) {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as { nodes: AXNode[] };
  await cdp.detach();
  const byId = new Map(nodes.map((node) => [node.nodeId, node]));
  const root = nodes.find((node) => !node.ignored && node.role?.value === role && node.name?.value === name);
  const found: { role: string; name: string }[] = [];
  const walk = (node: AXNode) => {
    for (const child of (node.childIds ?? []).map((id) => byId.get(id)).filter((each) => each !== undefined)) {
      if (!child.ignored) found.push({ role: child.role?.value ?? '', name: child.name?.value ?? '' });
      walk(child);
    }
  };
  if (root) walk(root);
  return { found: root !== undefined, descendants: found };
}

// T13: AC14 in Chromium's accessibility tree: the table's grid and subgrid layout keeps its table semantics (code
// review: the DOM-based checks would not see them dropped).
test('exposes the table, its rows, column headers, cells, logos and dates in Chromium’s accessibility tree', async ({
  page,
}) => {
  await openBills(page);
  await expect(bodyRows(page)).toHaveCount(4);

  const tree = await chromiumTree(page, 'table', 'Upcoming Bills');

  expect(tree.found, 'a table named "Upcoming Bills"').toBe(true);
  const named = (role: string) => tree.descendants.filter((node) => node.role === role).map((node) => node.name);
  expect(named('columnheader')).toEqual(['Due Date', 'Logo', 'Item Description', 'Last Charge', 'Amount']);
  expect(named('row')).toHaveLength(5);
  expect(named('cell')).toHaveLength(20);
  expect(named('image')).toEqual(['Figma', 'Adobe', 'Figma', 'Adobe']);
  expect(named('time')).toHaveLength(8);
});

/** One bill row as both pages show it: the due date, the logo's name, the title, the last charge date, the amount. */
type SharedRow = { dueDate: string; logo: string; title: string; lastChargeDate: string; amount: string };

const overviewRowsShown = (page: Page): Promise<SharedRow[]> =>
  overviewBills(page)
    .getByRole('listitem')
    .evaluateAll((items) =>
      items.map((item) => {
        const [due, lastCharge] = [...item.querySelectorAll('time')];
        const logo = item.querySelector('[role="img"], img')!;
        return {
          dueDate: due!.dateTime,
          logo: logo.getAttribute('aria-label') ?? logo.getAttribute('alt') ?? '',
          title: item.querySelector('p')!.textContent ?? '',
          lastChargeDate: lastCharge!.dateTime,
          amount: item.querySelector(':scope > div > span')!.textContent ?? '',
        };
      }),
    );

const asShared = (rows: Row[]): SharedRow[] =>
  rows.map(({ dueDate, logo, title, lastChargeDate, amount }) => ({ dueDate, logo, title, lastChargeDate, amount }));

/** Overview's rows, then Bills' first two in the same app, and the API body's first two, at the backend's clock. */
async function expectSameFirstTwo(page: Page, zone: string, expectedBillRows: number) {
  await page.goto('/overview');
  await expect(overviewBills(page).getByRole('listitem').first()).toBeVisible();
  const fromOverview = await overviewRowsShown(page);
  await overviewBills(page).getByRole('link', { name: 'View All' }).click();
  await waitForCard(page);
  await expect(bodyRows(page)).toHaveCount(expectedBillRows);
  const fromBills = asShared(await rowsShown(page)).slice(0, 2);
  const response = await page.request.get('/api/bills/upcoming', { headers: { 'X-Time-Zone': zone } });
  const body = (await response.json()) as { bills: { dueDate: string; title: string; lastChargeDate: string }[] };

  expect(fromOverview).toHaveLength(2);
  expect(fromBills).toEqual(fromOverview);
  expect(
    body.bills.slice(0, 2).map(({ dueDate, title, lastChargeDate }) => ({ dueDate, title, lastChargeDate })),
  ).toEqual(fromBills.map(({ dueDate, title, lastChargeDate }) => ({ dueDate, title, lastChargeDate })));
  return fromBills.map((row) => row.dueDate);
}

// T14: AC5 and AC7, Overview's two rows are Bills' first two, at three clocks and in two zones (#28, #41, #54, #80).
test('shows Overview’s two rows as Bills’ first two at the fixed clock and on 15 May 2027', async ({ page }) => {
  await signUp(page.request);
  expect(await expectSameFirstTwo(page, 'Europe/Belgrade', 4)).toEqual(['2027-05-15', '2027-06-16']);

  await moveBackendClock(page, '2027-05-15T10:00:00Z');
  await signUp(page.request);
  expect(await expectSameFirstTwo(page, 'Europe/Belgrade', 4)).toEqual(['2027-05-15', '2027-06-16']);
});

test('answers 16 May in Belgrade and 15 May in New York at 2027-05-15T22:30:00Z, on both pages alike', async ({
  page,
  browser,
}) => {
  await moveBackendClock(page, '2027-05-15T22:30:00Z');
  await signUp(page.request);
  expect(await expectSameFirstTwo(page, 'Europe/Belgrade', 3)).toEqual(['2027-06-16', '2028-05-15']);
  await expectRows(page, [adobe(2027), figma(2028), adobe(2028)]);

  const newYork = await browser.newContext({
    baseURL: FRONTEND_URL,
    timezoneId: 'America/New_York',
    storageState: await page.context().storageState(),
  });
  const nyPage = await newYork.newPage();
  expect(await expectSameFirstTwo(nyPage, 'America/New_York', 4)).toEqual(['2027-05-15', '2027-06-16']);
  await expectRows(nyPage, [figma(2027), adobe(2027), figma(2028), adobe(2028)]);
  await newYork.close();
});

// T15: AC6, the bill due today shows, and drops off the next day (#28, #41, #53).
test('lists the bill due today first, and drops it the next day', async ({ page }) => {
  await moveBackendClock(page, '2027-05-15T10:00:00Z');
  await openBills(page);
  await expectRows(page, [figma(2027), adobe(2027), figma(2028), adobe(2028)]);

  // Signed up again at the next day's clock, so the session is valid then.
  await moveBackendClock(page, '2027-05-16T10:00:00Z');
  await openBills(page);
  await expectRows(page, [adobe(2027), figma(2028), adobe(2028)]);
});

// T16: AC8, one bill and none (US-14 States; #6, #111 b).
test('shows one bill at the card’s top with no divider, then "No upcoming bills" in the 420 card', async ({ page }) => {
  await moveBackendClock(page, '2028-06-01T10:00:00Z');
  await openBills(page);
  await expectRows(page, [adobe(2028)]);
  expect((await dividers(page))[0]![0]).toBe('0px');
  const cardBox = await box(card(page));
  // At the card's top: the header 24 under it, 48 high, then the row.
  expect((await box(bodyRows(page).first())).y).toBe(cardBox.y + 24 + 48);
  expect(cardBox.height).toBe(420);

  await moveBackendClock(page, '2028-06-17T10:00:00Z');
  await openBills(page);
  const empty = card(page).getByText('No upcoming bills', { exact: true });
  await expect(empty).toBeVisible();
  await expect(section(page).getByRole('table')).toHaveCount(0);
  await expect(section(page).getByRole('heading', { level: 2 })).toHaveText('Upcoming Bills');
  const emptyCard = await box(card(page));
  expect(emptyCard.height).toBe(420);
  // Centred in the card.
  const message = await box(empty);
  expect(Math.abs(message.y + message.height / 2 - (emptyCard.y + emptyCard.height / 2))).toBeLessThanOrEqual(1);
  expect(Math.abs(message.x + message.width / 2 - (emptyCard.x + emptyCard.width / 2))).toBeLessThanOrEqual(1);
});

// T17: AC12, the skeleton, the error state after the retries, Retry by mouse and by keyboard (#6, #88, #114).
test('shows the 420 skeleton while the bills load, the error state after the retries, and the rows after Retry', async ({
  page,
}) => {
  await signUp(page.request);
  let mode: 'hold' | 'fail' | 'pass' = 'hold';
  const held: Route[] = [];
  await page.route('**/api/bills/upcoming', async (route) => {
    if (mode === 'hold') held.push(route);
    else if (mode === 'fail') await route.fulfill({ status: 500, json: { message: 'Internal server error' } });
    else await route.continue();
  });

  await page.goto('/bills');
  const busy = card(page).locator('[aria-busy="true"]');
  await expect(busy).toBeVisible();
  expect((await box(card(page))).height).toBe(420);
  await expect(section(page).getByRole('table')).toHaveCount(0);
  const skeleton = await box(busy.locator(':scope > [aria-hidden="true"]'));
  const cardBox = await box(card(page));
  expect(skeleton.height).toBe(420);
  expect(skeleton.y).toBe(cardBox.y);

  mode = 'fail';
  for (const route of held.splice(0)) await route.fulfill({ status: 500, json: { message: 'Internal server error' } });
  await expect(card(page).getByRole('alert')).toHaveText('Something went wrong.', { timeout: 15_000 });
  await expect(busy).toHaveCount(0);
  expect((await box(card(page))).height).toBe(420);

  mode = 'pass';
  await card(page).getByRole('button', { name: 'Retry' }).click();
  await expectRows(page, [figma(2027), adobe(2027), figma(2028), adobe(2028)]);
  await expect(card(page).getByRole('alert')).toHaveCount(0);
});

test('keeps focus in the card after a keyboard Retry, never the page body (#114)', async ({ page }) => {
  await signUp(page.request);
  let pass = false;
  await page.route('**/api/bills/upcoming', async (route) => {
    if (pass) await route.continue();
    else await route.fulfill({ status: 500, json: { message: 'Internal server error' } });
  });
  await page.goto('/bills');
  const retry = card(page).getByRole('button', { name: 'Retry' });
  await expect(retry).toBeVisible({ timeout: 15_000 });

  pass = true;
  await retry.focus();
  await page.keyboard.press('Enter');

  await expect(bodyRows(page)).toHaveCount(4);
  expect(await card(page).evaluate((element) => element.contains(document.activeElement))).toBe(true);
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
});

// T18: AC13, no bill actions: Tab leaves the content, a hover changes nothing, a click does nothing (#28).
test('has nothing to tab to, hover or click in the card', async ({ page }) => {
  await openBills(page);
  await expect(card(page).locator('a, button, input, select, textarea, [tabindex]')).toHaveCount(0);

  await search(page).focus();
  await page.keyboard.press('Tab');
  expect(await main(page).evaluate((element) => element.contains(document.activeElement))).toBe(false);

  // Away from the rows first, so the screenshot shows no hover.
  await page.mouse.move(5, 1000);
  const before = await card(page).screenshot({ animations: 'disabled' });
  const sent: string[] = [];
  page.on('request', (request) => sent.push(request.url()));
  for (const index of [0, 1, 2, 3]) {
    const row = bodyRows(page).nth(index);
    await row.hover();
    expect(await computed(row, 'cursor')).toBe('auto');
    for (const cell of await row.locator('td').all()) expect(await computed(cell, 'cursor')).toBe('auto');
    expect(await card(page).screenshot({ animations: 'disabled' })).toEqual(before);
    await row.click();
    await row.getByRole('img').click();
  }
  await page.waitForTimeout(300);

  await expect(page).toHaveURL(`${FRONTEND_URL}/bills`);
  expect(sent).toEqual([]);
});

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

/** The right edge of the page: the window less a classic scrollbar's gutter (#101). */
const pageRight = (page: Page) => page.evaluate(() => document.body.getBoundingClientRect().right);
const scrollWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);

/** Each part of a row: the date box, the logo, the title, the description and the last charge texts (with their line
 * counts), the description cell and the amount box. */
const rowParts = async (row: Locator) => {
  const [date, logo, textCell, titlePart, descriptionPart, lastChargePart, amountPart] = await row.evaluate(
    (element) => {
      const cells = [...element.querySelectorAll('td')];
      const [titleText, descriptionText] = [...cells[2]!.querySelectorAll('p')];
      // Each part's own box, and the box of its text with the number of lines it takes.
      return [
        cells[0]!.querySelector('time')!,
        cells[1]!.querySelector('img')!,
        cells[2]!,
        titleText!,
        descriptionText!,
        cells[3]!.querySelector('time')!,
        cells[4]!.querySelector('span')!,
      ].map((node) => {
        const own = node.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(node);
        const text = range.getBoundingClientRect();
        return {
          box: { x: own.x, y: own.y, width: own.width, height: own.height },
          text: {
            x: text.x,
            y: text.y,
            width: text.width,
            height: text.height,
            lines: new Set([...range.getClientRects()].map((line) => Math.round(line.y))).size,
          },
        };
      });
    },
  );
  return {
    date: date!.box,
    logo: logo!.box,
    textCell: textCell!.box,
    title: titlePart!.text,
    description: descriptionPart!.text,
    lastCharge: lastChargePart!.text,
    amount: amountPart!.box,
    amountText: amountPart!.text,
  };
};

/** The header labels' own text boxes. */
const headerTexts = (page: Page) =>
  headerRow(page).evaluate((element) =>
    [...element.querySelectorAll('th')].map((cell) => {
      const range = document.createRange();
      range.selectNodeContents(cell);
      const { x, y, width, height } = range.getBoundingClientRect();
      return { x, y, width, height };
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

/** 108's column proportions left of the Amount column (task 023 References). */
const proportions = [112, 185, 277, 364].map((width) => width / 938);

/**
 * AC16: the card, the header row, the rows, the dividers and the columns where 108 places them, x from the page's
 * right edge (#94, #101); each row 32 above and below its tallest cell, every part centred on the row.
 */
async function expectTableLayout(page: Page, rowCount: number) {
  const right = await pageRight(page);
  const cardBox = await box(card(page));
  near(cardBox.x, 304, 'card x');
  near(cardBox.y, 152, 'card y');
  near(cardBox.width, right - 32 - 304, 'card width: to the content’s right edge');
  const title = await box(section(page).getByRole('heading', { level: 2 }));
  near(title.y, 104, 'title line box y');
  near(title.height, 32, 'title line box height');
  const tableBox = await box(table(page));
  near(tableBox.x, cardBox.x + 24, 'rows 24 inside the card');
  near(tableBox.width, cardBox.width - 48, 'rows 48 narrower than the card');
  const header = await box(headerRow(page));
  near(header.y, cardBox.y + 24, 'header 24 under the card top');
  near(header.height, 48, 'header row: the 24 line, 24 to the divider’s edge');

  // The columns: the Amount column as wide as its widest box, the rest in 108's proportions. A box is at least 108
  // (AmountBox's minimum) and widens with its amount: `$559.00` with the 16 insets makes about 110.8 (task 004).
  const amountWidths = await bodyRows(page).evaluateAll((rows) =>
    rows.map((row) => row.querySelector('td:last-child > span')!.getBoundingClientRect().width),
  );
  for (const amountWidth of amountWidths) expect(amountWidth).toBeGreaterThanOrEqual(108);
  const amountColumn = Math.max(...amountWidths);
  const rest = tableBox.width - amountColumn;
  const starts = [0, ...proportions.map((_, index) => proportions.slice(0, index + 1).reduce((a, b) => a + b, 0))].map(
    (fraction) => tableBox.x + fraction * rest,
  );
  const lastChargeCentre = (starts[3]! + starts[4]!) / 2;
  const amountCentre = tableBox.x + tableBox.width - amountColumn / 2;
  const labels = await headerTexts(page);
  near(labels[0]!.x, tableBox.x, 'Due Date header at the row’s start');
  near(labels[1]!.x, starts[1]!, 'Logo header at its column', 1);
  near(labels[2]!.x, starts[2]!, 'Item Description header at its column', 1);
  near(labels[3]!.x + labels[3]!.width / 2, lastChargeCentre, 'Last Charge header centred', 1);
  near(labels[4]!.x + labels[4]!.width / 2, amountCentre, 'Amount header centred on the box', 1);
  for (const label of labels) near(label.y + label.height / 2, header.y + 12, 'header label on the first 24 line', 1);

  await expect(bodyRows(page)).toHaveCount(rowCount);
  let rowTop = header.y + header.height;
  for (let index = 0; index < rowCount; index += 1) {
    const row = bodyRows(page).nth(index);
    const rowBox = await box(row);
    const parts = await rowParts(row);
    const what = `row ${index + 1}`;
    near(rowBox.y, rowTop, `${what} y`);
    // 32 above and below the tallest cell: the text block or the 80 high date box.
    near(rowBox.height, 64 + Math.max(parts.textCell.height, 80), `${what} height`);
    near(parts.textCell.height, 24 + 8 + 22 * parts.description.lines, `${what} text block: title, 8, description`);
    expect(parts.title.lines, `${what} title on one line`).toBe(1);
    const middle = rowBox.y + 32 + (rowBox.height - 64) / 2;
    expect(parts.date).toMatchObject({ width: 72, height: 80 });
    near(parts.date.x, tableBox.x, `${what} date box at the row’s start`);
    near(parts.logo.x, starts[1]!, `${what} logo at its column`, 1);
    near(parts.title.x, starts[2]!, `${what} title at its column`, 1);
    near(parts.description.x, starts[2]!, `${what} description at its column`, 1);
    near(parts.lastCharge.x + parts.lastCharge.width / 2, lastChargeCentre, `${what} last charge centred`, 1);
    near(parts.amount.height, 48, `${what} amount box height`);
    near(parts.amount.x + parts.amount.width, tableBox.x + tableBox.width, `${what} amount box at the row’s end`);
    for (const [name, part] of Object.entries({
      date: parts.date,
      logo: parts.logo,
      text: parts.textCell,
      lastCharge: parts.lastCharge,
      amount: parts.amount,
    })) {
      near(part.y + part.height / 2, middle, `${what} ${name} centred on the row`, 1);
    }
    rowTop = rowBox.y + rowBox.height;
  }
  near(cardBox.y + cardBox.height, rowTop + 24, 'card 24 under the last row');
  // The page ends 32 under the card where it scrolls (#111); a taller window ends at its bottom.
  const { pageEnd, windowHeight } = await page.evaluate(() => ({
    pageEnd: document.documentElement.scrollHeight - window.scrollY,
    windowHeight: window.innerHeight,
  }));
  near(pageEnd, Math.max(windowHeight, cardBox.y + cardBox.height + 32), 'page end');
  expect(await scrollWidth(page), 'no horizontal scroll').toBe(Math.round(right));
  return { cardBox, tableBox };
}

// T19: AC16, 108's layout at 1440x1024 (every demo row 162, the description on 108's three lines, no scroll), wider at
// 1920 and 2560, the same rules at 1280 (#94, #101).
test('places the card, the header, the rows and the columns where 108 does, wider at 1920 and 2560, the same at 1280', async ({
  page,
}) => {
  await openBills(page);
  const { cardBox } = await expectTableLayout(page, 4);
  near(cardBox.height, 744, 'card with 4 rows of 162');
  for (const index of [0, 1, 2, 3]) {
    const parts = await rowParts(bodyRows(page).nth(index));
    expect(parts.description.lines, `row ${index + 1}: the description on 108’s three lines`).toBe(3);
    near((await box(bodyRows(page).nth(index))).height, 162, `row ${index + 1} 162 high`);
  }
  expect(await page.evaluate(() => document.documentElement.scrollHeight), 'no vertical scroll at 1440x1024').toBe(
    1024,
  );
  const gray06 = await tokenColor(page, '--color-gray-06');
  expect(await computed(headerRow(page), 'border-bottom-color')).toBe(gray06);
  expect(await computed(headerRow(page), 'border-bottom-width')).toBe('1px');

  let width = 0;
  for (const [viewportWidth, height] of [
    [1920, 1080],
    [2560, 1440],
  ] as const) {
    await page.setViewportSize({ width: viewportWidth, height });
    const { tableBox } = await expectTableLayout(page, 4);
    expect(tableBox.width, `${viewportWidth}: rows wider`).toBeGreaterThan(width);
    width = tableBox.width;
  }

  await page.setViewportSize({ width: 1280, height: 1024 });
  await expectTableLayout(page, 4);
});

/** The long data of AC17: a 120-character title and description in words with $1,000,000,000.00, the same with no
 * space, then the demo's first bill. */
async function routeLongData(page: Page) {
  const words = `Figma - ${'Organization Plan with every seat '.repeat(4)}`.slice(0, 120);
  const noSpace = 'FigmaOrganizationPlanWithEverySeat'.repeat(4).slice(0, 120);
  await page.route('**/api/bills/upcoming', async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { bills: Record<string, unknown>[] };
    const billion = { cents: 100_000_000_000, currency: 'USD' };
    body.bills = [
      { ...body.bills[0], title: words, description: words, amount: billion },
      { ...body.bills[1], title: noSpace, description: noSpace, amount: billion },
      body.bills[2]!,
    ];
    await route.fulfill({ response, json: body });
  });
}

// T19: AC17, long texts wrap inside their columns and the row grows; the boxes and the logo keep their sizes; the
// amount stays on one line (#106, #108 b, #111 a, #115 b).
for (const [width, height] of [
  [1440, 1024],
  [1280, 1024],
] as const) {
  test(`wraps a 120-character title and description and keeps $1,000,000,000.00 on one line at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await routeLongData(page);
    await openBills(page);
    const cardBox = await box(card(page));
    const content = { x: cardBox.x + 24, y: cardBox.y + 24, width: cardBox.width - 48, height: cardBox.height - 48 };
    await expect(bodyRows(page)).toHaveCount(3);

    const labels = await headerTexts(page);
    for (const [a, first] of labels.entries()) {
      expect(inside(first, content), `header ${a + 1} inside the card`).toBe(true);
      for (const second of labels.slice(a + 1)) expect(overlaps(first, second), 'header labels overlap').toBe(false);
    }
    for (const index of [0, 1, 2]) {
      const row = bodyRows(page).nth(index);
      const rowBox = await box(row);
      const parts = await rowParts(row);
      const what = `row ${index + 1}`;
      const shown = [parts.date, parts.logo, parts.title, parts.description, parts.lastCharge, parts.amount];
      for (const [a, first] of shown.entries()) {
        expect(inside(first, content), `${what} part ${a} inside the card`).toBe(true);
        expect(inside(first, rowBox), `${what} part ${a} inside its row`).toBe(true);
        for (const second of shown.slice(a + 1)) expect(overlaps(first, second), `${what}: parts overlap`).toBe(false);
      }
      // At least 16 between two columns' texts and boxes, left to right.
      const inOrder = [parts.date, parts.logo, parts.textCell, parts.lastCharge, parts.amount];
      for (const [a, left] of inOrder.slice(0, -1).entries()) {
        expect(inOrder[a + 1]!.x - (left.x + left.width), `${what}: space after part ${a}`).toBeGreaterThanOrEqual(
          15.5,
        );
      }
      expect(parts.date).toMatchObject({ width: 72, height: 80 });
      expect(parts.logo.width, `${what} logo at its own width`).toBe(120);
      expect(parts.amountText.lines, `${what}: the amount on one line`).toBe(1);
      if (index < 2) {
        expect(parts.title.lines, `${what}: the title wraps`).toBeGreaterThan(1);
        expect(parts.description.lines, `${what}: the description wraps`).toBeGreaterThan(1);
        expect(rowBox.height, `${what} grows`).toBeGreaterThan(162);
        await expect(row.locator('td').last()).toHaveText('$1,000,000,000.00');
      }
    }
    expect(await overflowCount(card(page)), 'nothing scrolls inside the card').toBe(0);
    expect(await scrollWidth(page), 'no horizontal scroll').toBe(Math.round(await pageRight(page)));
  });
}
