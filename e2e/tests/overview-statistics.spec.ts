import type { Browser, Locator, Page, Route } from '@playwright/test';

import { FRONTEND_URL } from '../constants';
import { expect, test } from '../fixtures';
import { box, computed, expectRing, newUser, signUp, tokenColor, waitForRecentTransactions, within2 } from '../helpers';

const region = (page: Page, name: string) => page.getByRole('main').getByRole('region', { name });
const statistics = (page: Page) => region(page, 'Statistics');
/** The white card of a section: the element after its title row. */
const card = (section: Locator) => section.locator(':scope > div').last();
const control = (page: Page) => statistics(page).getByRole('combobox', { name: 'Statistics' });
const legend = (page: Page) => statistics(page).getByRole('list');
const table = (page: Page) =>
  statistics(page).getByRole('table', { name: 'Expenses per day, this week and last week' });
/** The chart's SVG: the sibling after the hidden table. */
const plot = (page: Page) => table(page).locator('xpath=following-sibling::*[local-name()="svg"]');
const bars = (page: Page) => plot(page).locator('path');
/** DataState's root in a section after a Retry, which gives it tabindex="-1". */
const dataStateRoot = (section: Locator) => section.locator('[tabindex="-1"]');
/** DataState's root around the chart: the parent of the chart's own box. */
const chartRoot = (page: Page) => table(page).locator('xpath=../..');
const recentPanel = (page: Page) => region(page, 'Recent Transaction').getByRole('tabpanel');

const moveBackendClock = async (page: Page, now: string) =>
  expect((await page.request.put('/api/test/clock', { data: { now } })).ok()).toBe(true);

/** Signs up a new user at the backend's clock and opens Overview once every widget shows its content. */
async function openOverview(page: Page) {
  await signUp(page.request);
  await page.goto('/overview');
  await waitForRecentTransactions(page);
  await expect(page.getByRole('main').locator('[aria-busy="true"]')).toHaveCount(0);
}

/** The hidden table as text: a row per day, the label, then Last week and This week. */
const tableRows = (page: Page) =>
  table(page)
    .getByRole('row')
    .evaluateAll((rows) => rows.map((row) => [...row.children].map((cell) => cell.textContent)));

type Row = [label: string, lastWeek: string, thisWeek: string];
const header: Row = ['', 'Last week', 'This week'];

/** A first login's week on Thu 22 Oct 2026 in Belgrade (demo-data.md, "What a first login shows"; AC1). */
const firstLogin: Row[] = [
  ['19 Mon', '$58.80', '$10.64'],
  ['20 Tue', '$10.64', '$24.64'],
  ['21 Wed', '$20.16', '$17.64'],
  ['22 Thu', '$322.00', '$266.00'],
  ['23 Fri', '$14.78', ''],
  ['24 Sat', '$188.16', ''],
  ['25 Sun', '$147.84', ''],
];
/** Mon 19 to Sun 25 Oct with every day drawn (AC4). */
const oct19to25Values = ['$10.64', '$24.64', '$17.64', '$266.00', '$14.78', '$21.28', '$10.64'];
const fullWeek: Row[] = firstLogin.map(([label, lastWeek], index) => [label, lastWeek, oct19to25Values[index]!]);

/** The same backend session in another browser zone. */
async function inZone(browser: Browser, page: Page, timezoneId: string) {
  const context = await browser.newContext({
    baseURL: FRONTEND_URL,
    timezoneId,
    storageState: await page.context().storageState(),
  });
  const zonePage = await context.newPage();
  await zonePage.goto('/overview');
  await expect(table(zonePage)).toBeAttached();
  return { zonePage, close: () => context.close() };
}

// T18: AC1, AC5, AC15, the first login's card (#20, #55, #91, #113 b; demo-data.md).
test('shows the first login’s week: the labels, the values, the bars in proportion to $400 and the y labels', async ({
  page,
}) => {
  await openOverview(page);

  await expect(control(page)).toHaveText('Weekly Comparison');
  await expect(legend(page).getByRole('listitem')).toHaveText(['This week', 'Last week']);
  expect(await tableRows(page)).toEqual([header, ...firstLogin]);
  await expect(plot(page)).toHaveAttribute('aria-hidden', 'true');
  await expect(plot(page).locator(':scope > svg text')).toHaveText(firstLogin.map(([label]) => label));
  await expect(plot(page).locator(':scope > g > text')).toHaveText(['$0', '$100', '$200', '$300', '$400']);
  await expect(plot(page).locator(':scope > g > line')).toHaveCount(5);

  // 7 gray bars and 4 teal ones, Monday to Thursday; each as high as its value over $400 of the plot.
  const gray = await tokenColor(page, '--color-gray-05');
  const teal = await tokenColor(page, '--color-primary');
  const fills = await bars(page).evaluateAll((paths) => paths.map((path) => getComputedStyle(path).fill));
  expect(fills).toEqual([gray, teal, gray, teal, gray, teal, gray, teal, gray, gray, gray]);
  const lines = await plot(page).locator(':scope > g > line').all();
  const zero = await box(lines[0]!);
  const top = await box(lines[4]!);
  const plotHeight = zero.y - top.y;
  const cents = [5_880, 1_064, 1_064, 2_464, 2_016, 1_764, 32_200, 26_600, 1_478, 18_816, 14_784];
  for (const [index, bar] of (await bars(page).all()).entries()) {
    within2((await box(bar)).height, (cents[index]! / 40_000) * plotHeight, `bar ${index + 1} height`);
  }
});

// T18: AC8, no interaction in the chart (#20).
test('changes nothing and shows no tooltip on a hover or a click on a bar; nothing in the chart is focusable', async ({
  page,
}) => {
  await openOverview(page);
  const before = await statistics(page).innerHTML();

  await bars(page).nth(7).hover();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await bars(page).nth(6).click({ force: true });

  expect(await statistics(page).innerHTML()).toBe(before);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(page).toHaveURL(`${FRONTEND_URL}/overview`);
  const chart = table(page).locator('xpath=..');
  await expect(chart.locator('a, button, input, select, textarea, [tabindex]')).toHaveCount(0);
  expect(
    await bars(page)
      .first()
      .evaluate((path) => getComputedStyle(path).cursor),
  ).toBe('auto');
});

// T18: AC7, the one comparison, by mouse and by keyboard, the ring with the keyboard only (#20, #60, #87, #90 a).
test('opens "Weekly Comparison" with its one option by mouse and keyboard; the ring with the keyboard only', async ({
  page,
}) => {
  await openOverview(page);
  const requests: string[] = [];
  page.on('request', (sent) => requests.push(sent.url()));

  await control(page).click();
  const options = page.getByRole('listbox').getByRole('option');
  await expect(options).toHaveText(['Weekly Comparison']);
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  await options.first().click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(control(page)).toBeFocused();
  expect(await computed(control(page), 'outline-style')).toBe('none');

  await recentPanel(page).focus();
  await page.keyboard.press('Tab');
  await expect(control(page)).toBeFocused();
  await expectRing(page, control(page));
  for (const key of ['Enter', 'Space', 'ArrowDown']) {
    await page.keyboard.press(key);
    await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(control(page)).toBeFocused();
    await expectRing(page, control(page));
  }

  await expect(control(page)).toHaveText('Weekly Comparison');
  expect(await tableRows(page)).toEqual([header, ...firstLogin]);
  expect(requests.filter((url) => url.includes('/api/'))).toEqual([]);
});

// T18: AC15, the Tab order (#87, #112).
test('tabs from Recent Transaction’s panel to the control, then out of the page content; Shift+Tab goes back', async ({
  page,
}) => {
  await openOverview(page);

  await recentPanel(page).focus();
  await page.keyboard.press('Tab');
  await expect(control(page)).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.querySelector('main')!.contains(document.activeElement))).toBe(false);

  await control(page).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(recentPanel(page)).toBeFocused();
});

// T19: AC3, the midnight of 22 Oct in Belgrade (UTC+2) against New York (UTC-4) (#54, #55, #80).
test('draws Friday’s $14.78 at 2026-10-22T22:00:00Z in Belgrade, and no Friday bar in New York', async ({
  page,
  browser,
}) => {
  await moveBackendClock(page, '2026-10-22T22:00:00Z');
  await openOverview(page);

  expect(await tableRows(page)).toEqual([
    header,
    ...firstLogin.slice(0, 4),
    ['23 Fri', '$14.78', '$14.78'],
    ...firstLogin.slice(5),
  ]);

  const newYork = await inZone(browser, page, 'America/New_York');
  expect(await tableRows(newYork.zonePage)).toEqual([header, ...firstLogin]);
  await newYork.close();
});

// T19: AC4, Belgrade's Monday 26 Oct starts at 2026-10-25T23:00:00Z, after it leaves summer time (#20, #54, #84).
test('draws 19 to 25 Oct at 2026-10-25T22:59:59Z in Belgrade, then 26 Oct to 1 Nov at 23:00:00Z; New York stays on 19 to 25 Oct', async ({
  page,
  browser,
}) => {
  await moveBackendClock(page, '2026-10-25T22:59:59Z');
  await openOverview(page);
  expect(await tableRows(page)).toEqual([header, ...fullWeek]);
  await expect(plot(page).locator(':scope > g > text')).toHaveText(['$0', '$100', '$200', '$300', '$400']);

  await moveBackendClock(page, '2026-10-25T23:00:00Z');
  await openOverview(page);
  const labels = ['26 Mon', '27 Tue', '28 Wed', '29 Thu', '30 Fri', '31 Sat', '01 Sun'];
  expect(await tableRows(page)).toEqual([
    header,
    ...labels.map((label, index): Row => [label, oct19to25Values[index]!, index === 0 ? '$28.00' : '']),
  ]);
  await expect(plot(page).locator(':scope > g > text')).toHaveText(['$0', '$100', '$200', '$300', '$400']);

  const newYork = await inZone(browser, page, 'America/New_York');
  expect(await tableRows(newYork.zonePage)).toEqual([header, ...fullWeek]);
  await newYork.close();
});

// T20: AC6, every value 0 before the dataset begins (#55, #91 c, #105 a).
test('shows the header row and "No expenses this week or last week" before the dataset begins, the card 260', async ({
  page,
}) => {
  await moveBackendClock(page, '2021-12-31T10:00:00Z');
  await openOverview(page);

  await expect(statistics(page).getByText('No expenses this week or last week')).toBeVisible();
  await expect(table(page)).toHaveCount(0);
  await expect(control(page)).toHaveText('Weekly Comparison');
  await expect(legend(page)).toBeVisible();
  expect((await box(card(statistics(page)))).height).toBe(260);
  // Centered in the chart's box under the header row.
  const cardBox = await box(card(statistics(page)));
  const message = await box(statistics(page).getByText('No expenses this week or last week'));
  within2(message.y + message.height / 2, cardBox.y + 48 + 94, 'message centered in the chart box');
});

/** Holds the requests of `pattern`, then fails or lets them through. */
async function controlRoute(page: Page, pattern: string) {
  const state = { mode: 'hold' as 'hold' | 'fail' | 'pass', held: [] as Route[] };
  await page.route(pattern, async (route) => {
    if (state.mode === 'hold') state.held.push(route);
    else if (state.mode === 'fail') await route.fulfill({ status: 500, json: { message: 'Internal server error' } });
    else await route.continue();
  });
  return {
    fail: async () => {
      state.mode = 'fail';
      for (const route of state.held.splice(0)) {
        await route.fulfill({ status: 500, json: { message: 'Internal server error' } });
      }
    },
    pass: () => {
      state.mode = 'pass';
    },
  };
}

const isBodyFocused = (page: Page) => page.evaluate(() => document.activeElement === document.body);

// T21: AC12, AC13: the skeleton and the error state under the header row; a keyboard Retry keeps focus in the widget
// with the ring (#6, #87, #88, #105 a; follow-up 2 of the task 016 gate).
test('shows the skeleton, the error state, and after a keyboard Retry keeps focus in Statistics with the ring', async ({
  page,
}) => {
  await signUp(page.request);
  const route = await controlRoute(page, '**/api/statistics/weekly-comparison');
  await page.goto('/overview');

  const busy = statistics(page).locator('[aria-busy="true"]');
  await expect(busy).toBeVisible();
  await expect(control(page)).toHaveText('Weekly Comparison');
  await expect(legend(page)).toBeVisible();
  await waitForRecentTransactions(page);
  expect((await box(card(statistics(page)))).height).toBe(260);
  expect(await box(busy)).toMatchObject({ height: 188 });

  await route.fail();
  await expect(statistics(page).getByRole('alert')).toHaveText('Something went wrong.', { timeout: 15_000 });
  expect((await box(card(statistics(page)))).height).toBe(260);
  await control(page).click();
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
  await page.keyboard.press('Escape');

  route.pass();
  await recentPanel(page).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(statistics(page).getByRole('button', { name: 'Retry' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(dataStateRoot(statistics(page))).toHaveCount(1);
  await expect(dataStateRoot(statistics(page))).toBeFocused();
  expect(await isBodyFocused(page)).toBe(false);
  expect(await tableRows(page)).toEqual([header, ...firstLogin]);
  await expect(dataStateRoot(statistics(page))).toBeFocused();
  await expectRing(page, dataStateRoot(statistics(page)));
});

test('keeps focus in Upcoming Bill with the ring after a keyboard Retry', async ({ page }) => {
  await signUp(page.request);
  const route = await controlRoute(page, '**/api/bills/upcoming');
  await page.goto('/overview');
  const bills = region(page, 'Upcoming Bill');

  await route.fail();
  await expect(bills.getByRole('alert')).toHaveText('Something went wrong.', { timeout: 15_000 });
  route.pass();
  await bills.getByRole('link', { name: 'View All' }).focus();
  await page.keyboard.press('Tab');
  await expect(bills.getByRole('button', { name: 'Retry' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(dataStateRoot(bills)).toBeFocused();
  expect(await isBodyFocused(page)).toBe(false);
  await expect(bills.getByRole('listitem')).toHaveCount(2);
  await expect(dataStateRoot(bills)).toBeFocused();
  await expectRing(page, dataStateRoot(bills));
});

test('moves focus to Statistics’ root with no ring after a click on Retry', async ({ page }) => {
  await signUp(page.request);
  const route = await controlRoute(page, '**/api/statistics/weekly-comparison');
  await page.goto('/overview');
  await route.fail();
  await expect(statistics(page).getByRole('alert')).toHaveText('Something went wrong.', { timeout: 15_000 });
  route.pass();

  await statistics(page).getByRole('button', { name: 'Retry' }).click();

  await expect(table(page)).toBeAttached();
  await expect(dataStateRoot(statistics(page))).toBeFocused();
  expect(await dataStateRoot(statistics(page)).evaluate((node) => node.matches(':focus-visible'))).toBe(false);
  expect(await computed(dataStateRoot(statistics(page)), 'outline-style')).toBe('none');
});

/** The window's return, as TanStack Query hears it: a visibilitychange on the window refetches the stale queries. */
const windowRegainsFocus = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));

// #114 (c), task 017 gate: whenever the focused Retry leaves, for any reason, focus moves to the widget's root, never
// the page body; the ring only when the focus came from the keyboard (#87).
test('moves focus to Statistics’ root with the ring when a refetch on window focus replaces Retry focused by Tab', async ({
  page,
}) => {
  await signUp(page.request);
  const route = await controlRoute(page, '**/api/statistics/weekly-comparison');
  await page.goto('/overview');
  await route.fail();
  await expect(statistics(page).getByRole('alert')).toHaveText('Something went wrong.', { timeout: 15_000 });
  await control(page).focus();
  await page.keyboard.press('Tab');
  await expect(statistics(page).getByRole('button', { name: 'Retry' })).toBeFocused();
  route.pass();

  await windowRegainsFocus(page);

  await expect(table(page)).toBeAttached();
  expect(await tableRows(page)).toEqual([header, ...firstLogin]);
  await expect(dataStateRoot(statistics(page))).toBeFocused();
  expect(await isBodyFocused(page)).toBe(false);
  await expectRing(page, dataStateRoot(statistics(page)));
});

test('moves focus to Statistics’ root with no ring when a refetch on window focus replaces Retry focused by a click', async ({
  page,
}) => {
  await signUp(page.request);
  const route = await controlRoute(page, '**/api/statistics/weekly-comparison');
  await page.goto('/overview');
  await route.fail();
  await expect(statistics(page).getByRole('alert')).toHaveText('Something went wrong.', { timeout: 15_000 });
  // A clicked Retry that fails again: its new Retry has the focus, by script after a click, so with no ring.
  await statistics(page).getByRole('button', { name: 'Retry' }).click();
  await expect(statistics(page).getByRole('alert')).toHaveCount(0);
  await expect(statistics(page).getByRole('alert')).toHaveText('Something went wrong.', { timeout: 15_000 });
  await expect(statistics(page).getByRole('button', { name: 'Retry' })).toBeFocused();
  route.pass();

  await windowRegainsFocus(page);

  await expect(table(page)).toBeAttached();
  await expect(dataStateRoot(statistics(page))).toBeFocused();
  expect(await isBodyFocused(page)).toBe(false);
  expect(await dataStateRoot(statistics(page)).evaluate((node) => node.matches(':focus-visible'))).toBe(false);
  expect(await computed(dataStateRoot(statistics(page)), 'outline-style')).toBe('none');
});

// T22: AC14, every /api response the browser receives carries no-store (follow-up 1 of the task 016 gate).
test('receives Cache-Control: no-store on every /api response while signing up and opening Overview', async ({
  page,
}) => {
  const answers: [string, string | undefined][] = [];
  page.on('response', (response) => {
    const { pathname } = new URL(response.url());
    if (pathname.startsWith('/api/')) answers.push([pathname, response.headers()['cache-control']]);
  });
  const user = newUser();

  await page.goto('/sign-up');
  await page.getByRole('textbox', { name: 'Name' }).fill(user.fullName);
  await page.getByRole('textbox', { name: 'Email Address' }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/overview`);
  await waitForRecentTransactions(page);
  await expect(table(page)).toBeAttached();

  expect(answers.map(([pathname]) => pathname)).toEqual(
    expect.arrayContaining([
      '/api/auth/me',
      '/api/auth/signup',
      '/api/calendar/today',
      '/api/accounts',
      '/api/savings-goals/current',
      '/api/bills/upcoming',
      '/api/transactions/recent',
      '/api/statistics/weekly-comparison',
    ]),
  );
  expect(answers.filter(([, cacheControl]) => cacheControl !== 'no-store')).toEqual([]);
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

/** Each given side of a box within half a pixel: column widths can be fractional at wider sizes. */
function expectNear(actual: Box, expected: Partial<Box>, what: string) {
  for (const [side, value] of Object.entries(expected)) {
    expect(actual[side as keyof Box], `${what} ${side}`).toBeCloseTo(value, 0);
  }
}

/** The box of an element's own text. */
const textBox = (locator: Locator) =>
  locator.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const { x, y, width, height } = range.getBoundingClientRect();
    return { x, y, width, height };
  });

/** The card and the parts of its header row and its chart, measured on the page. */
async function cardParts(page: Page) {
  const cardBox = await box(card(statistics(page)));
  const content = { x: cardBox.x + 24, y: cardBox.y + 24, width: cardBox.width - 48, height: cardBox.height - 48 };
  const xLabels = await plot(page).locator(':scope > svg text').all();
  return {
    cardBox,
    content,
    control: await box(control(page)),
    text: await textBox(control(page).locator('span').first()),
    chevron: await box(control(page).locator('svg')),
    legend: await box(legend(page)),
    legendText: await textBox(legend(page).getByRole('listitem').last()),
    root: await box(chartRoot(page)),
    plot: await box(plot(page)),
    labelStep: (await box(xLabels[1]!)).x - (await box(xLabels[0]!)).x,
  };
}

/** AC16: the header row and the chart at the same offsets from the card's top at every width (#93 a, #113 a). */
async function expectHeaderRowAndChart(page: Page) {
  const parts = await cardParts(page);
  const { content } = parts;
  expectNear(parts.control, { x: content.x, y: content.y, height: 24 }, 'the control');
  within2(parts.text.x, content.x, 'the control text from the content’s left edge');
  within2(parts.chevron.x, parts.text.x + parts.text.width + 12, 'the chevron 12 after the text');
  expectNear(parts.chevron, { y: content.y, width: 24, height: 24 }, 'the chevron');
  within2(parts.legend.x + parts.legend.width, content.x + content.width, 'the legend at the content’s right edge');
  within2(parts.legend.y + parts.legend.height / 2, content.y + 12, 'the legend centered on the row');
  const chartBox = { x: content.x, y: content.y + 24, width: content.width, height: 188 };
  expectNear(parts.root, chartBox, 'the chart box');
  expectNear(parts.plot, chartBox, 'the plot');
  // Nothing overlaps or leaves the content box; no scroll sideways on the page.
  expect(overlaps(parts.control, parts.legend)).toBe(false);
  for (const [name, part] of Object.entries({ control: parts.control, legend: parts.legend, root: parts.root })) {
    expect(inside(part, content), `${name} inside the content box`).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(Math.round(await pageRight(page)));
  return parts;
}

// T23: AC16, the card at 1440, 1920 and 2560 (#93 a, #94, #101).
test('places the card, its header row and its chart where 104 does at 1440x1024, wider apart at 1920 and 2560', async ({
  page,
}) => {
  await openOverview(page);
  const shift = 1440 - (await pageRight(page));
  const growth = (await box(card(region(page, 'Upcoming Bill')))).height - 232;
  const at1440 = await expectHeaderRowAndChart(page);
  within2(at1440.cardBox.x, 680 - shift / 3, 'card x');
  expect(at1440.cardBox.y).toBe(448 + growth);
  within2(at1440.cardBox.width, 728 - (2 * shift) / 3, 'card width');
  expect(at1440.cardBox.height).toBe(260);
  within2(at1440.text.x, 704 - shift / 3, 'the control text x');

  let step = at1440.labelStep;
  for (const [width, height] of [
    [1920, 1080],
    [2560, 1440],
  ] as const) {
    await page.setViewportSize({ width, height });
    await waitForRecentTransactions(page);
    const wider = await expectHeaderRowAndChart(page);
    expect(wider.cardBox.height, `${width}: card height`).toBe(260);
    expect(wider.labelStep, `${width}: groups wider apart`).toBeGreaterThan(step);
    step = wider.labelStep;
  }
});

// T23: AC16 at 1280, the card stretched with grid rows 2 and 3 (#112, #113 a).
test('keeps the header row and the chart at the card’s top at 1280x1024, the extra height empty below', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1024 });
  await openOverview(page);

  const parts = await expectHeaderRowAndChart(page);
  expect(parts.cardBox.height).toBeGreaterThan(260);
  // The chart's box ends 236 under the card's top; the rest of the card is empty.
  expect(parts.root.y + parts.root.height).toBeCloseTo(parts.cardBox.y + 24 + 24 + 188, 0);
  expect(parts.root.y + parts.root.height).toBeLessThan(parts.cardBox.y + parts.cardBox.height - 24);
  const recent = await box(card(region(page, 'Recent Transaction')));
  const expenses = await box(card(region(page, 'Expenses Breakdown')));
  expect(recent.y + recent.height).toBe(expenses.y + expenses.height);
});
