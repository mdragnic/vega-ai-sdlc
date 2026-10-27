import type { Locator, Page, Route } from '@playwright/test';

import { FRONTEND_URL } from '../constants';
import { expect, test } from '../fixtures';
import {
  box,
  computed,
  expectBillAmountsUnderText,
  signUp,
  tokenColor,
  waitForRecentTransactions,
  within2,
} from '../helpers';

const region = (page: Page, name: string) => page.getByRole('main').getByRole('region', { name });
const bills = (page: Page) => region(page, 'Upcoming Bill');
/** The white card of a section: the element after its title row. */
const card = (section: Locator) => section.locator(':scope > div').last();
const rows = (page: Page) => bills(page).getByRole('listitem');
const viewAll = (page: Page) => bills(page).getByRole('link', { name: 'View All' });

const moveBackendClock = async (page: Page, now: string) =>
  expect((await page.request.put('/api/test/clock', { data: { now } })).ok()).toBe(true);

/**
 * Signs up a new user at the backend's clock and opens Overview with its bills, and its recent transactions, so the
 * page end has its place (task 016).
 */
async function openOverview(page: Page) {
  await signUp(page.request);
  await page.goto('/overview');
  await expect(rows(page).first()).toBeVisible();
  await waitForRecentTransactions(page);
}

/** A row as text: the date box, the title, "Last Charge - …" and the amount. */
type Row = { date: string; title: string; lastCharge: string; amount: string; logo: string };

async function expectRows(page: Page, expected: Row[]) {
  await expect(rows(page)).toHaveCount(expected.length);
  for (const [index, row] of expected.entries()) {
    const item = rows(page).nth(index);
    await expect(item.locator('time').first()).toHaveText(row.date.replace(' ', ''));
    await expect(item.getByText(row.title, { exact: true })).toBeVisible();
    await expect(item.getByText(row.lastCharge, { exact: true })).toBeVisible();
    await expect(item.getByText(row.amount, { exact: true })).toBeVisible();
    await expect(item.getByRole('img', { name: row.logo })).toBeVisible();
  }
}

const figma = (year: number): Row => ({
  date: 'May 15',
  title: 'Figma - Yearly Plan',
  lastCharge: `Last Charge - 14 May, ${year - 1}`,
  amount: '$150.00',
  logo: 'Figma',
});
const adobe = (year: number): Row => ({
  date: 'Jun 16',
  title: 'Adobe Inc - Yearly Plan',
  lastCharge: `Last Charge - 17 Jun, ${year - 1}`,
  amount: '$559.00',
  logo: 'Adobe',
});

/** The due dates of the rows, from their date boxes' `time` values. */
const dueDates = (page: Page) =>
  rows(page).evaluateAll((items) => items.map((item) => item.querySelector('time')!.dateTime));

/** The divider above each row: its top border width and color. */
const borders = (page: Page) =>
  rows(page).evaluateAll((items) =>
    items.map((item) => {
      const style = getComputedStyle(item);
      return { width: style.borderTopWidth, style: style.borderTopStyle, color: style.borderTopColor };
    }),
  );

// T12: AC1, AC2, AC12: the first login's card (#11, #12, #28, #88, demo-data.md).
test('shows the next 2 demo bills soonest first, with the logos, the divider and no tab stop in the rows', async ({
  page,
}) => {
  await openOverview(page);

  await expectRows(page, [figma(2027), adobe(2027)]);
  expect(await dueDates(page)).toEqual(['2027-05-15', '2027-06-16']);
  await expect(bills(page).getByRole('list')).toHaveCount(1);
  await expect(bills(page).getByRole('heading', { level: 2 })).toHaveText('Upcoming Bill');
  await expect(viewAll(page)).toBeVisible();
  await expect(viewAll(page).locator('svg')).toBeVisible();
  // One divider, Gray/06, between the rows.
  const gray06 = await tokenColor(page, '--color-gray-06');
  const [firstBorder, secondBorder] = await borders(page);
  expect(firstBorder).toMatchObject({ width: '0px', style: 'none' });
  expect(secondBorder).toEqual({ width: '1px', style: 'solid', color: gray06 });
  // The Figma wordmark in Gray/01, the Adobe logo as an image, both 16 high.
  const [figmaLogo, adobeLogo] = [rows(page).nth(0).getByRole('img'), rows(page).nth(1).getByRole('img')];
  expect(await computed(figmaLogo, 'color')).toBe(await tokenColor(page, '--color-gray-01'));
  expect((await box(figmaLogo)).height).toBe(16);
  within2((await box(figmaLogo)).width, 44.8, 'Figma wordmark width');
  expect(await box(adobeLogo)).toMatchObject({ width: 60, height: 16 });
  // Nothing in the card takes focus: Tab goes from the Goals pencil to "View All".
  await expect(card(bills(page)).locator('a, button, input, select, textarea, [tabindex]')).toHaveCount(0);
  await region(page, 'Goals').getByRole('button', { name: 'Edit savings goal' }).focus();
  await page.keyboard.press('Tab');
  await expect(viewAll(page)).toBeFocused();
});

// T13: AC3, a bill due today shows and drops off the next day (#28, #41, #53).
test('shows the bill due today, and drops it the next day', async ({ page }) => {
  await moveBackendClock(page, '2027-05-15T10:00:00Z');
  await openOverview(page);
  await expectRows(page, [figma(2027), adobe(2027)]);
  expect(await dueDates(page)).toEqual(['2027-05-15', '2027-06-16']);

  // Signed up again at the next day's clock, so the session is valid then.
  await moveBackendClock(page, '2027-05-16T10:00:00Z');
  await openOverview(page);
  await expectRows(page, [adobe(2027), figma(2028)]);
  expect(await dueDates(page)).toEqual(['2027-06-16', '2028-05-15']);
});

// T14: AC4, today from the backend's clock in the browser's zone (#54, #80).
test('answers 16 May in Belgrade and 15 May in New York at 2027-05-15T22:30:00Z', async ({ page, browser }) => {
  await moveBackendClock(page, '2027-05-15T22:30:00Z');
  await openOverview(page);
  await expectRows(page, [adobe(2027), figma(2028)]);
  expect(await dueDates(page)).toEqual(['2027-06-16', '2028-05-15']);

  const newYork = await browser.newContext({
    baseURL: FRONTEND_URL,
    timezoneId: 'America/New_York',
    storageState: await page.context().storageState(),
  });
  const nyPage = await newYork.newPage();
  await nyPage.goto('/overview');
  await expectRows(nyPage, [figma(2027), adobe(2027)]);
  expect(await dueDates(nyPage)).toEqual(['2027-05-15', '2027-06-16']);
  await newYork.close();
});

// T15: AC5, one bill and none (US-07 States; #6, #105 a, #111 b).
test('shows one bill at the top with no divider, then "No upcoming bills" at the 232 minimum', async ({ page }) => {
  await moveBackendClock(page, '2028-06-01T10:00:00Z');
  await openOverview(page);
  await expectRows(page, [adobe(2028)]);
  expect((await borders(page))[0]).toMatchObject({ width: '0px', style: 'none' });
  // At the top of the card's content box: 32 under the card top.
  expect((await box(rows(page).first())).y).toBe((await box(card(bills(page)))).y + 32);

  await moveBackendClock(page, '2028-06-17T10:00:00Z');
  await signUp(page.request);
  await page.goto('/overview');
  await expect(card(bills(page)).getByText('No upcoming bills')).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  await expect(bills(page).getByRole('heading', { level: 2 })).toHaveText('Upcoming Bill');
  await expect(viewAll(page)).toBeVisible();
  // The 232 minimum: nothing else grows the top row at 1440 (#105 a).
  expect((await box(card(bills(page)))).height).toBe(232);
});

// T16: AC6, "View All" opens Bills in the shell (#48).
test('opens Bills from "View All"', async ({ page }) => {
  await openOverview(page);

  await viewAll(page).click();

  await expect(page).toHaveURL(`${FRONTEND_URL}/bills`);
  await expect(page.getByRole('navigation', { name: 'Main' }).locator('a[aria-current="page"]')).toHaveText('Bills');
});

// T17: AC10: the skeleton, the error state after the retries, and Retry (#6, #88, #105 a).
test('shows the skeleton while the bills load, the error state after the retries, and the bills after Retry', async ({
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

  await page.goto('/overview');
  const busy = card(bills(page)).locator('[aria-busy="true"]');
  await expect(busy).toBeVisible();
  expect((await box(card(bills(page)))).height).toBe(232);
  await expect(rows(page)).toHaveCount(0);
  await expect(region(page, 'Total Balance').getByText('$130,254.67')).toBeVisible();
  await expect(region(page, 'Goals').getByRole('button', { name: 'Edit savings goal' })).toBeVisible();
  // The skeleton inside the card's content box.
  const skeleton = await box(busy);
  const cardBox = await box(card(bills(page)));
  expect(skeleton.y + skeleton.height).toBeLessThanOrEqual(cardBox.y + cardBox.height - 28);

  mode = 'fail';
  for (const route of held.splice(0)) await route.fulfill({ status: 500, json: { message: 'Internal server error' } });
  await expect(bills(page).getByRole('alert')).toHaveText('Something went wrong.', { timeout: 15_000 });
  await expect(busy).toHaveCount(0);
  expect((await box(card(bills(page)))).height).toBe(232);
  await expect(viewAll(page)).toBeVisible();

  mode = 'pass';
  await bills(page).getByRole('button', { name: 'Retry' }).click();
  await expectRows(page, [figma(2027), adobe(2027)]);
  await expect(bills(page).getByRole('alert')).toHaveCount(0);
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

/** The card's content box: the card inset 24 at the sides, 32 at the top and 28 at the bottom. */
async function contentBox(page: Page): Promise<Box> {
  const cardBox = await box(card(bills(page)));
  return { x: cardBox.x + 24, y: cardBox.y + 32, width: cardBox.width - 48, height: cardBox.height - 60 };
}

/** The parts of each row: the date box, the logo, the title, the last charge and the amount box. */
async function rowParts(page: Page) {
  const parts: { row: number; date: Box; logo: Box; title: Box; lastCharge: Box; amount: Box }[] = [];
  for (const [row, item] of (await rows(page).all()).entries()) {
    const [title, lastCharge] = await item.locator('p').all();
    parts.push({
      row,
      date: await box(item.locator('time').first()),
      logo: await box(item.getByRole('img')),
      title: await textBox(title!),
      lastCharge: await textBox(lastCharge!),
      amount: await box(item.locator('time').first().locator('xpath=following-sibling::div[1]/span')),
    });
  }
  return parts;
}

async function expectNothingOverlapsOrIsCut(page: Page) {
  const content = await contentBox(page);
  const all = (await rowParts(page)).flatMap(({ row, ...parts }) =>
    Object.entries(parts).map(([name, part]) => [`row ${row + 1} ${name}`, part] as const),
  );
  for (const [name, part] of all) expect(inside(part, content), `${name} inside the content box`).toBe(true);
  for (const [i, [nameA, a]] of all.entries()) {
    for (const [nameB, b] of all.slice(i + 1)) expect(overlaps(a, b), `${nameA} and ${nameB}`).toBe(false);
  }
  for (const text of await card(bills(page)).locator('p, li > div > span').all()) {
    expect(await text.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  }
  const heights = await Promise.all(
    ['Total Balance', 'Goals', 'Upcoming Bill'].map(async (name) => (await box(card(region(page, name)))).height),
  );
  expect(new Set(heights).size, `top row heights ${heights.join(', ')}`).toBe(1);
  expect(heights[0]).toBeGreaterThanOrEqual(232);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(Math.round(await pageRight(page)));
}

/** Each row on one line, as drawn: the amount box at the content's right edge, centered on the date box. */
async function expectRowsOnOneLine(page: Page) {
  const content = await contentBox(page);
  for (const { row, date, title, lastCharge, amount } of await rowParts(page)) {
    within2(amount.x + amount.width, content.x + content.width, `row ${row + 1} amount right edge`);
    within2(amount.y + amount.height / 2, date.y + date.height / 2, `row ${row + 1} amount centered on the date box`);
    expect(amount.x, `row ${row + 1} amount right of the text`).toBeGreaterThan(
      Math.max(title.x + title.width, lastCharge.x + lastCharge.width) + 15.5,
    );
  }
}

// T18: AC13 at 1440: 104's card box, the rows per #111 a, measured from the page's right edge (#101).
test('places the Upcoming Bill card at 1440x1024 and wraps the demo amounts under the text (#111 a)', async ({
  page,
}) => {
  await openOverview(page);
  const shift = 1440 - (await pageRight(page));
  const column = 352 - shift / 3;
  const cardBox = await box(card(bills(page)));

  expect({ x: cardBox.x, y: cardBox.y, width: cardBox.width }).toEqual({
    x: 304 + 2 * (column + 24),
    y: 144,
    width: column,
  });
  const content = await contentBox(page);
  const [first, second] = await rowParts(page);
  // Row 1: the date box 32 under the card top, the text column 12 after it from the box top, the amount box 12 under
  // the text at the right; then the divider 20 under the row, and row 2 20 under the divider.
  expect(first!.date).toEqual({ x: content.x, y: 176, width: 44, height: 64 });
  expect(first!.logo).toMatchObject({ x: content.x + 56, y: 176, height: 16 });
  const firstRow = await box(rows(page).nth(0));
  const secondRow = await box(rows(page).nth(1));
  expect(first!.amount).toMatchObject({ y: 176 + 64 + 12, height: 40 });
  expect(firstRow.y + firstRow.height).toBe(first!.amount.y + 40);
  expect(secondRow.y).toBe(firstRow.y + firstRow.height + 20);
  expect(second!.date.y).toBe(secondRow.y + 1 + 20);
  // The card ends 28 under the last row; the top row grows with it.
  expect(cardBox.y + cardBox.height).toBe(secondRow.y + secondRow.height + 28);
  expect(cardBox.height).toBeGreaterThan(232);
  await expectBillAmountsUnderText(page);
  await expectNothingOverlapsOrIsCut(page);
});

// T18: AC13 at wider sizes: each row on one line, the card 232 high (#94).
for (const [width, height] of [
  [1920, 1080],
  [2560, 1440],
] as const) {
  test(`keeps each row on one line at ${width}x${height}, the amount box at the right, the card 232 high`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await openOverview(page);
    const cardBox = await box(card(bills(page)));

    within2(cardBox.width, ((await pageRight(page)) - 32 - 304 - 48) / 3, 'card width');
    expect(cardBox.height).toBe(232);
    const [first, second] = await rowParts(page);
    expect(first!.date.y).toBe(176);
    expect(second!.date.y).toBe(176 + 64 + 20 + 1 + 20);
    within2(first!.amount.y, 176 + 12, 'row 1 amount y');
    await expectRowsOnOneLine(page);
    await expectNothingOverlapsOrIsCut(page);
  });
}

// T18: AC13 at 1280: the narrow columns (#94, #101, #106, #111 a).
test('wraps the rows at 1280x1024 with nothing overlapping or cut', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1024 });
  await openOverview(page);

  await expectBillAmountsUnderText(page);
  await expectNothingOverlapsOrIsCut(page);
});

// T18: AC13 with a 120-character title and the largest amount at 1440 (#111 a).
test('wraps a 120-character title and $1,000,000,000.00 at 1440x1024 with nothing overlapping or cut', async ({
  page,
}) => {
  const title = `Figma - ${'Organization Plan with every seat '.repeat(4)}`.slice(0, 120);
  expect(title).toHaveLength(120);
  await page.route('**/api/bills/upcoming', (route) =>
    route.fulfill({
      json: {
        bills: [
          {
            title,
            logo: 'figma',
            dueDate: '2027-05-15',
            lastChargeDate: '2026-05-14',
            amount: { cents: 100_000_000_000, currency: 'USD' },
          },
          {
            title: 'Adobe Inc - Yearly Plan',
            logo: 'adobe',
            dueDate: '2027-06-16',
            lastChargeDate: '2026-06-17',
            amount: { cents: 55_900, currency: 'USD' },
          },
        ],
      },
    }),
  );
  await openOverview(page);

  await expect(rows(page).first().getByText('$1,000,000,000.00')).toBeVisible();
  const [first] = await rowParts(page);
  expect(first!.title.height, 'the title wraps').toBeGreaterThan(24);
  await expectBillAmountsUnderText(page);
  await expectNothingOverlapsOrIsCut(page);
});

/** The bottom of the last cards in the page, and the page's scroll height. */
async function pageEnd(page: Page) {
  const [recent, expenses] = await Promise.all(
    ['Recent Transaction', 'Expenses Breakdown'].map(async (name) => box(card(region(page, name)))),
  );
  const scrollY = await page.evaluate(() => window.scrollY);
  return {
    recentBottom: recent!.y + recent!.height + scrollY,
    expensesBottom: expenses!.y + expenses!.height + scrollY,
    scrollHeight: await page.evaluate(() => document.documentElement.scrollHeight),
  };
}

// T18: AC15, the page's bottom inset where Overview scrolls (#111; task 003's note).
for (const [width, height] of [
  [1440, 1024],
  [1280, 1024],
] as const) {
  test(`ends the last cards 32 above the end of the page at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openOverview(page);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

    const end = await pageEnd(page);
    expect(end.scrollHeight).toBeGreaterThan(height);
    expect(end.recentBottom).toBe(end.expensesBottom);
    expect(end.scrollHeight - end.expensesBottom).toBe(32);
    // Scrolled to the end, the cards stop 32 above the window's bottom.
    expect(await page.evaluate(() => window.scrollY)).toBe(end.scrollHeight - height);
    const expenses = await box(card(region(page, 'Expenses Breakdown')));
    expect(height - (expenses.y + expenses.height)).toBe(32);
  });
}

test('does not scroll at 1920x1080, where the page fits', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openOverview(page);

  const end = await pageEnd(page);
  expect(end.expensesBottom).toBe(992);
  expect(end.scrollHeight).toBe(1080);
});
