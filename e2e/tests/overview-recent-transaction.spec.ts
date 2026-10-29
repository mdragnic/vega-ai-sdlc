import type { Locator, Page, Route } from '@playwright/test';

import { FRONTEND_URL } from '../constants';
import { expect, test } from '../fixtures';
import { box, computed, expectRing, signUp, tokenColor, waitForRecentTransactions, within2 } from '../helpers';

const region = (page: Page, name: string) => page.getByRole('main').getByRole('region', { name });
const recent = (page: Page) => region(page, 'Recent Transaction');
/** The white card of a section: the element after its title row. */
const card = (section: Locator) => section.locator(':scope > div').last();
const tablist = (page: Page) => recent(page).getByRole('tablist', { name: 'Recent Transaction' });
const tab = (page: Page, name: 'All' | 'Revenue' | 'Expenses') => tablist(page).getByRole('tab', { name });
const panel = (page: Page) => recent(page).getByRole('tabpanel');
/** The selected tab's rows: the hidden lists are out of the accessibility tree. */
const rows = (page: Page) => panel(page).getByRole('listitem');
const viewAll = (page: Page) => recent(page).getByRole('link', { name: 'View All' });

const moveBackendClock = async (page: Page, now: string) =>
  expect((await page.request.put('/api/test/clock', { data: { now } })).ok()).toBe(true);

/** Signs up a new user at the backend's clock and opens Overview once every widget shows its content. */
async function openOverview(page: Page) {
  await signUp(page.request);
  await page.goto('/overview');
  await waitForRecentTransactions(page);
  await expect(page.getByRole('main').locator('[aria-busy="true"]')).toHaveCount(0);
}

/** A row as text: the icon's name, the item, the shop, the amount and the date. */
type Row = [icon: string, item: string, shop: string, amount: string, date: string];

async function expectRows(page: Page, expected: Row[]) {
  await expect(rows(page)).toHaveCount(expected.length);
  for (const [index, [icon, item, shop, amount, date]] of expected.entries()) {
    const row = rows(page).nth(index);
    await expect(row.getByRole('img')).toHaveAccessibleName(icon);
    await expect(row.locator('p, time')).toHaveText([item, shop, amount, date]);
    await expect(row.locator('p, time').nth(0)).toBeVisible();
  }
}

/** A first login's All and Expenses tabs on 22 Oct 2026 (demo-data.md; AC1). */
const firstLoginAll: Row[] = [
  ['Shopping', 'Jeans', 'Denim House', '-$266.00', '22 Oct, 2026'],
  ['Entertainment', 'Movie ticket', 'Inox', '-$17.64', '21 Oct, 2026'],
  ['Food', 'Pizza', 'Pizza Hit', '-$24.64', '20 Oct, 2026'],
  ['Transportation', 'Taxi fare', 'Uber', '-$10.64', '19 Oct, 2026'],
  ['Food', 'Restaurant bill', 'Spice Garden', '-$147.84', '18 Oct, 2026'],
];
const freelance = (date: string): Row => ['Income', 'Freelance payment', 'Bright Studio', '+$179.20', date];
/** A first login's Revenue tab (AC2). */
const firstLoginRevenue: Row[] = [
  freelance('17 Oct, 2026'),
  ['Income', 'Dividend', 'AB Bank Ltd', '+$84.00', '15 Oct, 2026'],
  freelance('10 Oct, 2026'),
  freelance('3 Oct, 2026'),
  ['Income', 'Design project', 'Acme Ltd.', '+$784.00', '1 Oct, 2026'],
];

/** The tab's style: its text color and its underline. */
async function tabStyle(page: Page, name: 'All' | 'Revenue' | 'Expenses') {
  const element = tab(page, name);
  return {
    color: await computed(element, 'color'),
    underline: await computed(element, 'border-bottom-color'),
    weight: await computed(element, 'font-weight'),
  };
}

async function expectSelected(page: Page, name: 'All' | 'Revenue' | 'Expenses') {
  const teal = await tokenColor(page, '--color-primary');
  const secondary = await tokenColor(page, '--color-secondary');
  for (const each of ['All', 'Revenue', 'Expenses'] as const) {
    await expect(tab(page, each)).toHaveAttribute('aria-selected', String(each === name));
    const style = await tabStyle(page, each);
    if (each === name) expect(style).toEqual({ color: teal, underline: teal, weight: '700' });
    else expect(style).toMatchObject({ color: secondary, weight: '600' });
  }
  await expect(panel(page)).toHaveAccessibleName(name);
}

/** The divider under each row: its bottom border width, style and color. */
const borders = (page: Page) =>
  rows(page).evaluateAll((items) =>
    items.map((item) => {
      const style = getComputedStyle(item);
      return { width: style.borderBottomWidth, style: style.borderBottomStyle, color: style.borderBottomColor };
    }),
  );

// T13: AC1, AC2, AC13: the first login's tabs by mouse and keyboard, the ring, nothing focusable in the rows.
test('shows each tab’s latest 5, newest first, with the active style on the selected tab', async ({ page }) => {
  await openOverview(page);

  await expectSelected(page, 'All');
  await expectRows(page, firstLoginAll);
  await expect(recent(page).getByRole('heading', { level: 2 })).toHaveText('Recent Transaction');
  await expect(viewAll(page).locator('svg')).toBeVisible();
  // A Gray/06 divider under each row but the last.
  const gray06 = await tokenColor(page, '--color-gray-06');
  const divider = { width: '1px', style: 'solid', color: gray06 };
  expect(await borders(page)).toEqual([divider, divider, divider, divider, expect.objectContaining({ width: '0px' })]);

  await tab(page, 'Revenue').click();
  await expectSelected(page, 'Revenue');
  await expectRows(page, firstLoginRevenue);
  await tab(page, 'Expenses').click();
  await expectSelected(page, 'Expenses');
  await expectRows(page, firstLoginAll);
  await tab(page, 'All').click();
  await expectSelected(page, 'All');
  await expectRows(page, firstLoginAll);
  // Only the selected tab's list is in the accessibility tree; the others are in the DOM, invisible.
  await expect(panel(page).getByRole('list')).toHaveCount(1);
  await expect(panel(page).locator('ul')).toHaveCount(3);
  await expect(panel(page).locator('[aria-hidden="true"] ul')).toHaveCount(2);
  // Each tab's cell: the parent of its list. The selected one is visible, the others hidden.
  const cells = await panel(page).locator('ul').locator('..').all();
  const cellStates = await Promise.all(
    cells.map(async (cell) => [await cell.getAttribute('aria-hidden'), await computed(cell, 'visibility')]),
  );
  expect(cellStates).toEqual([
    [null, 'visible'],
    ['true', 'hidden'],
    ['true', 'hidden'],
  ]);
});

test('tabs from "View All" to the selected tab and the panel with the ring, then on; Shift+Tab goes back', async ({
  page,
}) => {
  await openOverview(page);
  await expect(card(recent(page)).locator('li a, li button, li input, li [tabindex]')).toHaveCount(0);

  await viewAll(page).focus();
  await page.keyboard.press('Tab');
  await expect(tab(page, 'All')).toBeFocused();
  await expectRing(page, tab(page, 'All'));
  // Inside the tablist: Right, Left (wrapping), End and Home select and activate.
  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'Revenue')).toBeFocused();
  await expectSelected(page, 'Revenue');
  await expectRows(page, firstLoginRevenue);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(tab(page, 'Expenses')).toBeFocused();
  await expectSelected(page, 'Expenses');
  await page.keyboard.press('Home');
  await expectSelected(page, 'All');
  await page.keyboard.press('End');
  await expectSelected(page, 'Expenses');
  await expectRing(page, tab(page, 'Expenses'));

  // One tab stop in the tablist: the selected tab, then the panel, then the next card's first focusable element, the
  // "Weekly Comparison" control (task 017), then Expenses Breakdown's first right arrow (task 018).
  const statisticsControl = region(page, 'Statistics').getByRole('combobox', { name: 'Statistics' });
  await page.keyboard.press('Tab');
  await expect(panel(page)).toBeFocused();
  await expectRing(page, panel(page));
  await page.keyboard.press('Tab');
  await expect(statisticsControl).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(region(page, 'Expenses Breakdown').getByRole('link', { name: 'Housing expenses' })).toBeFocused();

  await statisticsControl.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(panel(page)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(tab(page, 'Expenses')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(viewAll(page)).toBeFocused();
});

test('shows no ring after a click on a tab or in the panel', async ({ page }) => {
  await openOverview(page);

  await tab(page, 'Revenue').click();
  await expect(tab(page, 'Revenue')).toBeFocused();
  expect(await tab(page, 'Revenue').evaluate((node) => node.matches(':focus-visible'))).toBe(false);
  expect(await computed(tab(page, 'Revenue'), 'outline-style')).toBe('none');

  await rows(page).nth(1).click();
  await expect(panel(page)).toBeFocused();
  expect(await panel(page).evaluate((node) => node.matches(':focus-visible'))).toBe(false);
  expect(await computed(panel(page), 'outline-style')).toBe('none');
  // A click in a row does nothing else.
  await expect(page).toHaveURL(`${FRONTEND_URL}/overview`);
});

// T14: AC4, today from the backend's clock in the browser's zone (#53, #54, #80).
test('lists 24 Oct in Belgrade and up to 23 Oct in New York at 2026-10-23T22:30:00Z', async ({ page, browser }) => {
  await moveBackendClock(page, '2026-10-23T22:30:00Z');
  await openOverview(page);
  await expectRows(page, [
    ['Others', 'Gift', 'Gift Corner', '-$21.28', '24 Oct, 2026'],
    freelance('24 Oct, 2026'),
    ['Food', 'Biriyani', 'Hajir Biriyani', '-$14.78', '23 Oct, 2026'],
    firstLoginAll[0]!,
    firstLoginAll[1]!,
  ]);
  await tab(page, 'Revenue').click();
  await expect(rows(page).first().locator('p, time')).toHaveText([
    'Freelance payment',
    'Bright Studio',
    '+$179.20',
    '24 Oct, 2026',
  ]);

  const newYork = await browser.newContext({
    baseURL: FRONTEND_URL,
    timezoneId: 'America/New_York',
    storageState: await page.context().storageState(),
  });
  const nyPage = await newYork.newPage();
  await nyPage.goto('/overview');
  await waitForRecentTransactions(nyPage);
  await expectRows(nyPage, [
    ['Food', 'Biriyani', 'Hajir Biriyani', '-$14.78', '23 Oct, 2026'],
    ...firstLoginAll.slice(0, 4),
  ]);
  await tab(nyPage, 'Revenue').click();
  await expectRows(nyPage, firstLoginRevenue);
  await newYork.close();
});

/** A transaction late on 22 Oct in UTC, which is 23 Oct in Belgrade. */
const lateTransaction = {
  item: 'Late dinner',
  shopName: 'Spice Garden',
  category: 'food',
  direction: 'expense',
  occurredAt: '2026-10-22T23:30:00.000Z',
  amount: { cents: 4_200, currency: 'USD' },
};

const answerLate = (route: Route) =>
  route.fulfill({ json: { all: [lateTransaction], revenue: [], expenses: [lateTransaction] } });

// T15: AC5, the date in the browser's zone (#11, #54).
test('shows a transaction at 2026-10-22T23:30:00Z on 23 Oct in Belgrade and on 22 Oct in New York', async ({
  page,
  browser,
}) => {
  await page.route('**/api/transactions/recent', answerLate);
  await openOverview(page);
  await expectRows(page, [['Food', 'Late dinner', 'Spice Garden', '-$42.00', '23 Oct, 2026']]);
  await expect(rows(page).locator('time')).toHaveAttribute('datetime', '2026-10-22T23:30:00.000Z');

  const newYork = await browser.newContext({
    baseURL: FRONTEND_URL,
    timezoneId: 'America/New_York',
    storageState: await page.context().storageState(),
  });
  const nyPage = await newYork.newPage();
  await nyPage.route('**/api/transactions/recent', answerLate);
  await nyPage.goto('/overview');
  await expectRows(nyPage, [['Food', 'Late dinner', 'Spice Garden', '-$42.00', '22 Oct, 2026']]);
  await newYork.close();
});

// T16: AC6, before the dataset begins: the tabs and the empty message at the card's height from the grid (#6, #105 a).
test('shows the tabs and "No transactions yet" before the dataset begins', async ({ page }) => {
  await moveBackendClock(page, '2021-12-31T10:00:00Z');
  await openOverview(page);

  await expect(panel(page).getByText('No transactions yet')).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  await expect(tablist(page).getByRole('tab')).toHaveCount(3);
  await expectSelected(page, 'All');
  await tab(page, 'Revenue').click();
  await expect(panel(page).getByText('No transactions yet')).toBeVisible();
  const recentCard = await box(card(recent(page)));
  const expenses = await box(card(region(page, 'Expenses Breakdown')));
  expect(recentCard.y + recentCard.height).toBe(expenses.y + expenses.height);
  // Centered in the panel under the tabs.
  const message = await box(panel(page).getByText('No transactions yet'));
  const panelBox = await box(panel(page));
  within2(message.y + message.height / 2, panelBox.y + panelBox.height / 2, 'message centered in the panel');
});

// T17: AC7, "View All" opens Transactions (#49).
test('opens Transactions from "View All"', async ({ page }) => {
  await openOverview(page);

  await viewAll(page).click();

  await expect(page).toHaveURL(`${FRONTEND_URL}/transactions`);
  await expect(page.getByRole('navigation', { name: 'Main' }).locator('a[aria-current="page"]')).toHaveText(
    'Transactions',
  );
});

// T18: AC11: the tabs with the skeleton, the error state after the retries, and Retry (#6, #88, #105 a).
test('shows the tabs and the skeleton while loading, the error state after the retries, and the rows after Retry', async ({
  page,
}) => {
  await signUp(page.request);
  let mode: 'hold' | 'fail' | 'pass' = 'hold';
  const held: Route[] = [];
  await page.route('**/api/transactions/recent', async (route) => {
    if (mode === 'hold') held.push(route);
    else if (mode === 'fail') await route.fulfill({ status: 500, json: { message: 'Internal server error' } });
    else await route.continue();
  });

  await page.goto('/overview');
  const busy = panel(page).locator('[aria-busy="true"]');
  await expect(busy).toBeVisible();
  await expect(tablist(page).getByRole('tab')).toHaveCount(3);
  await expect(rows(page)).toHaveCount(0);
  await expect(region(page, 'Total Balance').getByText('$130,254.67')).toBeVisible();
  await expect(region(page, 'Upcoming Bill').getByRole('listitem')).toHaveCount(2);
  // The skeleton inside the card's content box, the card ending with Expenses Breakdown. DataState's busy root fills
  // the panel, so measure the skeleton itself (task 017).
  const skeleton = await box(busy.locator(':scope > [aria-hidden="true"]'));
  const cardBox = await box(card(recent(page)));
  const expenses = await box(card(region(page, 'Expenses Breakdown')));
  expect(skeleton.y + skeleton.height).toBeLessThanOrEqual(cardBox.y + cardBox.height - 24);
  expect(cardBox.y + cardBox.height).toBe(expenses.y + expenses.height);

  mode = 'fail';
  for (const route of held.splice(0)) await route.fulfill({ status: 500, json: { message: 'Internal server error' } });
  await expect(panel(page).getByRole('alert')).toHaveText('Something went wrong.', { timeout: 15_000 });
  await expect(busy).toHaveCount(0);
  await expect(tablist(page).getByRole('tab')).toHaveCount(3);
  await expect(viewAll(page)).toBeVisible();

  mode = 'pass';
  await panel(page).getByRole('button', { name: 'Retry' }).click();
  await expectRows(page, firstLoginAll);
  await expect(panel(page).getByRole('alert')).toHaveCount(0);
});

/** The right edge of the page: the window less a classic scrollbar's gutter (#101). */
const pageRight = (page: Page) => page.evaluate(() => document.body.getBoundingClientRect().right);

type Box = { x: number; y: number; width: number; height: number };
const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x - 0.5 &&
  inner.y >= outer.y - 0.5 &&
  inner.x + inner.width <= outer.x + outer.width + 0.5 &&
  inner.y + inner.height <= outer.y + outer.height + 0.5;
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;

/** The box of an element's own text. */
const textBox = (locator: Locator) =>
  locator.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const { x, y, width, height } = range.getBoundingClientRect();
    return { x, y, width, height };
  });

/** The card's content box: the card inset 24. */
async function contentBox(page: Page): Promise<Box> {
  const cardBox = await box(card(recent(page)));
  return { x: cardBox.x + 24, y: cardBox.y + 24, width: cardBox.width - 48, height: cardBox.height - 48 };
}

type Parts = { tile: Box; item: Box; shop: Box; amount: Box; date: Box };

/**
 * The parts of each row of the selected tab: the tile, the item, the shop, the amount and the date, as the boxes of
 * their text (for overlaps and cuts) and of their elements, their line boxes (for positions).
 */
async function rowParts(page: Page) {
  const parts: ({ row: number; lines: Omit<Parts, 'tile'> } & Parts)[] = [];
  for (const [row, element] of (await rows(page).all()).entries()) {
    const [item, shop, amount] = await element.locator('p').all();
    const date = element.locator('time');
    parts.push({
      row,
      tile: await box(element.getByRole('img')),
      item: await textBox(item!),
      shop: await textBox(shop!),
      amount: await textBox(amount!),
      date: await textBox(date),
      lines: { item: await box(item!), shop: await box(shop!), amount: await box(amount!), date: await box(date) },
    });
  }
  return parts;
}

/** A card's box on the page, not in the window, so a scroll does not change it. */
async function pageBox(locator: Locator): Promise<Box> {
  const { x, y, width, height } = await box(locator);
  return { x, y: y + (await locator.page().evaluate(() => window.scrollY)), width, height };
}

/** Rows 2 and 3 of the grid, and the page's end. */
async function gridBoxes(page: Page) {
  return {
    recent: await pageBox(card(recent(page))),
    statistics: await pageBox(card(region(page, 'Statistics'))),
    expenses: await pageBox(card(region(page, 'Expenses Breakdown'))),
    scrollHeight: await page.evaluate(() => document.documentElement.scrollHeight),
  };
}

async function expectNothingOverlapsOrIsCut(page: Page) {
  const content = await contentBox(page);
  const all = (await rowParts(page)).flatMap(({ row, lines: _lines, ...parts }) =>
    Object.entries(parts).map(([name, part]) => [`row ${row + 1} ${name}`, part] as const),
  );
  for (const [name, part] of all) expect(inside(part, content), `${name} inside the content box`).toBe(true);
  for (const [i, [nameA, a]] of all.entries()) {
    for (const [nameB, b] of all.slice(i + 1)) expect(overlaps(a, b), `${nameA} and ${nameB}`).toBe(false);
  }
  for (const text of await rows(page).locator('p, time').all()) {
    expect(await text.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  }
  // No scroll inside the card, none sideways on the page; the card ends with Expenses Breakdown.
  const cardElement = card(recent(page));
  expect(await cardElement.evaluate((node) => node.scrollHeight <= node.clientHeight)).toBe(true);
  expect(await cardElement.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(Math.round(await pageRight(page)));
  const grid = await gridBoxes(page);
  expect(grid.recent.y + grid.recent.height).toBe(grid.expenses.y + grid.expenses.height);
}

/** Each row on one line, as drawn: the amount and the date at the content's right edge, beside the text. */
async function expectRowsOnOneLine(page: Page) {
  const content = await contentBox(page);
  for (const { row, tile, item, shop, amount, date } of await rowParts(page)) {
    const name = `row ${row + 1}`;
    within2(amount.x + amount.width, content.x + content.width, `${name} amount right edge`);
    within2(date.x + date.width, content.x + content.width, `${name} date right edge`);
    within2(amount.y, item.y, `${name} amount on the item's line`);
    within2(date.y, shop.y, `${name} date on the shop's line`);
    expect(item.x, `${name} text 16 after the tile`).toBeGreaterThanOrEqual(tile.x + 40 + 16);
    expect(amount.x, `${name} amount right of the text`).toBeGreaterThan(
      Math.max(item.x + item.width, shop.x + shop.width) + 15.5,
    );
  }
}

const allTabs = ['All', 'Revenue', 'Expenses'] as const;

// T19: AC14, AC16 at 1440: 104's card box and rows, every row on one line on every tab (#94, #101).
test('places the card and its rows where 104 does at 1440x1024, on every tab', async ({ page }) => {
  await openOverview(page);
  const shift = 1440 - (await pageRight(page));
  const column = 352 - shift / 3;
  const growth = (await box(card(region(page, 'Upcoming Bill')))).height - 232;
  expect(growth).toBeGreaterThan(0);

  for (const name of allTabs) {
    await tab(page, name).click();
    const grid = await gridBoxes(page);
    expect({ x: grid.recent.x, y: grid.recent.y, width: grid.recent.width }).toEqual({
      x: 304,
      y: 448 + growth,
      width: column,
    });
    expect(grid.statistics.height).toBe(260);
    expect(grid.expenses.height).toBe(212);
    expect(grid.recent.y + grid.recent.height).toBe(grid.expenses.y + grid.expenses.height);
    // The tabs at the content's top-left; the rows from 12 under them, one every 88, the tiles 24 into each row.
    const top = grid.recent.y;
    expect(await box(tablist(page))).toMatchObject({ x: 328, y: top + 24, height: 32 });
    const parts = await rowParts(page);
    expect(parts).toHaveLength(5);
    for (const { row, tile, lines } of parts) {
      const at = `${name} row ${row + 1}`;
      expect(tile, `${at} tile`).toEqual({ x: 328, y: top + 92 + row * 88, width: 40, height: 40 });
      // The item over the shop from x 384, as high as the tile; the amount over the date at the right.
      expect(lines.item, `${at} item`).toMatchObject({ x: 384, y: tile.y, height: 24 });
      expect(lines.shop, `${at} shop`).toMatchObject({ x: 384, y: tile.y + 24, height: 16 });
      expect(lines.amount, `${at} amount`).toMatchObject({ y: tile.y, height: 24 });
      expect(lines.date, `${at} date`).toMatchObject({ y: tile.y + 24, height: 16 });
      within2(lines.amount.x + lines.amount.width, 632 - shift / 3, `${at} amount right edge`);
    }
    // The rows at the top: the last one ends 24 + 12 above the card's bottom at the most.
    const lastRow = await box(rows(page).last());
    expect(lastRow.y + lastRow.height).toBe(top + 92 - 24 + 5 * 88);
    expect(lastRow.y + lastRow.height).toBeLessThanOrEqual(grid.recent.y + grid.recent.height - 24);
    await expectRowsOnOneLine(page);
    await expectNothingOverlapsOrIsCut(page);
  }
});

// T19: AC14 at wider sizes: the rows wider, each on one line (#94).
for (const [width, height] of [
  [1920, 1080],
  [2560, 1440],
] as const) {
  test(`keeps each row on one line at ${width}x${height}, on every tab`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openOverview(page);

    for (const name of allTabs) {
      await tab(page, name).click();
      const grid = await gridBoxes(page);
      within2(grid.recent.width, ((await pageRight(page)) - 32 - 304 - 48) / 3, 'card width');
      expect(grid.statistics.height).toBe(260);
      expect(grid.expenses.height).toBe(212);
      const [first] = await rowParts(page);
      expect(first!.tile).toMatchObject({ x: 328, y: grid.recent.y + 92 });
      await expectRowsOnOneLine(page);
      await expectNothingOverlapsOrIsCut(page);
    }
  });
}

// T19: AC14, AC15 at 1280: the rows that do not fit wrap, and switching tabs moves nothing (#106, #111 a, #112 a).
test('wraps the rows at 1280x1024 with nothing overlapping or cut, and switching tabs moves nothing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1024 });
  await openOverview(page);
  const before = await gridBoxes(page);

  for (const name of ['All', 'Revenue', 'Expenses', 'All'] as const) {
    await tab(page, name).click();
    await expectSelected(page, name);
    expect(await gridBoxes(page), `${name}: the card, Statistics, Expenses Breakdown and the page end`).toEqual(before);
    // The selected tab's rows at the top of the panel.
    expect((await box(rows(page).first())).y).toBe((await box(panel(page))).y);
    await expectNothingOverlapsOrIsCut(page);
  }
  // The card is Revenue's height: its rows fill the card's content, and four of them wrap.
  await tab(page, 'Revenue').click();
  const revenueList = await box(panel(page).getByRole('list'));
  expect(before.recent.y + before.recent.height).toBe(revenueList.y + revenueList.height + 24);
  // Statistics and Expenses Breakdown stretch with grid rows 2 and 3.
  expect(before.statistics.height).toBeGreaterThan(260);
  expect(before.expenses.height).toBeGreaterThan(212);
  const wrapped = [];
  for (const { row, item, amount } of await rowParts(page)) if (amount.y > item.y + item.height) wrapped.push(row + 1);
  expect(wrapped).toEqual([1, 3, 4, 5]);
  // A wrapped row: the amount column 12 under the text, right-aligned at the content's edge; the row grows by it.
  const content = await contentBox(page);
  const [first] = await rowParts(page);
  expect(first!.lines.amount.y).toBe(first!.lines.shop.y + 16 + 12);
  within2(first!.lines.amount.x + first!.lines.amount.width, content.x + content.width, 'wrapped amount');
  expect((await box(rows(page).first())).height).toBe(88 + 12 + 40);
});

// T19: AC14 with a 120-character item and shop and the largest amount at 1440 (Marko's notes, #111 a).
test('wraps a 120-character item and shop and $1,000,000,000.00 at 1440x1024 with nothing overlapping or cut', async ({
  page,
}) => {
  const item = `Jeans ${'with a very long description '.repeat(5)}`.slice(0, 120);
  const shopName = `Denim House ${'Flagship Store on the Main Street '.repeat(4)}`.slice(0, 120);
  expect([item.length, shopName.length]).toEqual([120, 120]);
  const long = {
    item,
    shopName,
    category: 'shopping',
    direction: 'expense',
    occurredAt: '2026-10-22T12:00:00.000Z',
    amount: { cents: 100_000_000_000, currency: 'USD' },
  };
  await page.route('**/api/transactions/recent', (route) =>
    route.fulfill({ json: { all: [long, long, long, long, long], revenue: [], expenses: [long] } }),
  );
  await openOverview(page);

  await expect(rows(page).first().getByText('-$1,000,000,000.00')).toBeVisible();
  const [first] = await rowParts(page);
  expect(first!.item.height, 'the item wraps').toBeGreaterThan(24);
  expect(first!.shop.height, 'the shop wraps').toBeGreaterThan(16);
  expect(first!.amount.y, 'the amount under the shop').toBeGreaterThanOrEqual(first!.shop.y + first!.shop.height);
  within2(first!.amount.x + first!.amount.width, (await contentBox(page)).x + (await contentBox(page)).width, 'amount');
  await expectNothingOverlapsOrIsCut(page);
  // Grid rows 2 and 3 grow with the card; Statistics and Expenses Breakdown stretch.
  const grid = await gridBoxes(page);
  expect(grid.statistics.height).toBeGreaterThan(260);
  expect(grid.expenses.height).toBeGreaterThan(212);
  await tab(page, 'Revenue').click();
  await expect(panel(page).getByText('No transactions yet')).toBeVisible();
  expect(await gridBoxes(page)).toEqual(grid);
});
