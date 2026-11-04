import type { Locator, Page, Request, Route } from '@playwright/test';

import { FRONTEND_URL, TIME_ZONE } from '../constants';
import { expect, test } from '../fixtures';
import { box, computed, expectRing, signUp, tokenColor, type User } from '../helpers';

const NEW_YORK = 'America/New_York';
const main = (page: Page) => page.getByRole('main');
const region = (page: Page, name: string) => main(page).getByRole('region', { name, exact: true });
const goals = (page: Page) => region(page, 'Goals');
const categories = (page: Page) => region(page, 'Expenses Goals by Category');
/** The top row: the section's element after its title row; its two cards. */
const topRow = (page: Page) => goals(page).locator(':scope > div').last();
const savingsGoalCard = (page: Page) => topRow(page).locator(':scope > div').first();
const savingSummaryCard = (page: Page) => topRow(page).locator(':scope > div').nth(1);
/** Task 027: the six category cards, each a list item (`GoalItemList`). */
const categoryCards = (page: Page) => categories(page).getByRole('listitem');
const selector = (page: Page) => goals(page).getByRole('combobox', { name: 'Savings Goal' });
/** Task 026: the Saving Summary's selector and its chart's hidden table. */
const summarySelector = (page: Page) => goals(page).getByRole('combobox', { name: 'Saving Summary', exact: true });
const CHART_TITLE = 'Savings per day, this month and the same period last month';
const chartTable = (page: Page) => savingSummaryCard(page).getByRole('table', { name: CHART_TITLE, exact: true });
const adjustButton = (page: Page) => goals(page).getByRole('button', { name: 'Adjust Goal' });
const meter = (page: Page) => goals(page).getByRole('meter', { name: 'Target vs Achievement' });
const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const search = (page: Page) => page.getByRole('searchbox', { name: 'Search' });
const dialog = (page: Page) => page.getByRole('dialog');
const targetField = (page: Page) => dialog(page).getByRole('textbox', { name: 'Target Amounts' });
const presentField = (page: Page) => dialog(page).getByRole('textbox', { name: 'Present Amounts' });
const saveButton = (page: Page) => dialog(page).getByRole('button', { name: 'Save' });
const closeButton = (page: Page) => dialog(page).getByRole('button', { name: 'Close' });
const overlayOf = (popup: Locator) => popup.locator('xpath=preceding-sibling::*[1]');
/** The amount after a term ("Target Achieved", "This month Target") in a section. */
const amountOf = (section: Locator, term: string) =>
  section.getByRole('term').filter({ hasText: term }).locator('xpath=following-sibling::dd[1]');

const usd = (cents: number) => ({ cents, currency: 'USD' });

/**
 * The Savings Goal card's height with the demo goal: 110's 292 and 1 px, as the divider is 11 px under the period box on
 * the PNG and its token on the 4px grid 12 (#65, as Overview's Goals card); the 292 minimum holds in the other states.
 */
const CARD_HEIGHT = 293;
const unavailable = 'This month is not available. Reload the page to see the months you can choose.';

const moveBackendClock = async (page: Page, now: string) =>
  expect((await page.request.put('/api/test/clock', { data: { now } })).ok()).toBe(true);

const near = (actual: number, expected: number, what: string, tolerance = 0.5) =>
  expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);

/** Signs up a new user at the backend's clock and opens Goals once the card shows its goal. */
async function openGoals(page: Page): Promise<User> {
  const user = await signUp(page.request);
  await page.goto('/goals');
  await expect(meter(page)).toBeVisible();
  return user;
}

/** The card's amounts and the selector's month. */
async function expectCard(page: Page, month: string, achieved: string, target: string) {
  await expect(selector(page)).toHaveText(month);
  await expect(amountOf(goals(page), 'Target Achieved')).toHaveText(achieved);
  await expect(amountOf(goals(page), 'This month Target')).toHaveText(target);
}

/**
 * Picks a month with the mouse. The open list hides the page from assistive technology, so the option is found on the
 * page, and the selector is read again once the list has closed.
 */
async function pick(page: Page, label: string) {
  await selector(page).click();
  await page.getByRole('option', { name: label, exact: true }).click();
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(selector(page)).toHaveText(label);
}

/** The labels of the open list's options, in order. */
async function optionLabels(page: Page) {
  await selector(page).click();
  await expect(page.getByRole('listbox')).toBeVisible();
  const labels = await page.getByRole('option').allTextContents();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toBeHidden();
  return labels;
}

/** The `PUT /api/savings-goals` requests the page sends, from now on. */
function goalPuts(page: Page): Request[] {
  const puts: Request[] = [];
  page.on('request', (request) => {
    if (request.method() === 'PUT' && new URL(request.url()).pathname === '/api/savings-goals') puts.push(request);
  });
  return puts;
}

/** Opens the popup with "Adjust Goal" and waits for it to show, named by the month. */
async function openPopup(page: Page, month: string) {
  await adjustButton(page).click();
  await expect(page.getByRole('dialog', { name: `Adjust goal for ${month}` })).toBeVisible();
}

/** Saves Target and Present in the open popup and waits for it to close. */
async function save(page: Page, target: string, present: string) {
  await targetField(page).fill(target);
  await presentField(page).fill(present);
  await saveButton(page).click();
  await expect(dialog(page)).toBeHidden();
}

// T25: AC1 and AC2, the first login's Goals page (US-16 criteria 1 and 2; #11, #18, #30, #58, #60, #105 a). Task 026:
// the Saving Summary card is filled. Task 027 fills the category cards: this test keeps the section's title and its six
// white cards; their content is goals-category-limits.spec.ts's.
test('opens Goals from the sidebar with October’s goal, the Saving Summary and six white category cards', async ({
  page,
}) => {
  await signUp(page.request);
  await page.goto('/overview');
  await sidebar(page).getByRole('link', { name: 'Goals' }).click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/goals`);

  await expect(sidebar(page).locator('[aria-current="page"]')).toHaveText('Goals');
  await expect(main(page).getByRole('heading', { level: 2 })).toHaveText(['Goals', 'Expenses Goals by Category']);
  await expect(savingsGoalCard(page).getByRole('heading', { level: 3 })).toHaveText('Savings Goal');
  await expectCard(page, 'Oct, 2026', '$16,250.00', '$20,000.00');
  await expect(meter(page)).toHaveAttribute('aria-valuenow', '0.8125');
  await expect(meter(page).locator('text')).toHaveText(['$0', '$16.2k', '$20k']);
  await expect(adjustButton(page)).toBeVisible();

  await expect(savingSummaryCard(page).getByRole('heading', { level: 3 })).toHaveText('Saving Summary');
  await expect(chartTable(page)).toBeAttached();
  const white = await tokenColor(page, '--color-white');
  expect(await computed(savingSummaryCard(page), 'background-color')).toBe(white);
  await expect(categoryCards(page)).toHaveCount(6);
  for (const card of await categoryCards(page).all()) {
    expect(await computed(card.locator(':scope > div'), 'background-color')).toBe(white);
  }
});

// T26: AC3 and AC4, the one list and a picked month (US-16 criteria 4 to 6; #30, #60, #123 a).
test('lists 58 months from Oct, 2026 to Jan, 2022, and shows March 2026 and December 2025 when picked', async ({
  page,
}) => {
  await openGoals(page);
  // Task 026: the first load also asks for the Saving Summary once, before the picks are recorded.
  await expect(chartTable(page)).toBeAttached();
  const monthReads: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/') && request.method() === 'GET') monthReads.push(`${url.pathname}${url.search}`);
  });

  await selector(page).click();
  await expect(page.getByRole('listbox')).toHaveCount(1);
  const labels = await page.getByRole('option').allTextContents();
  expect(labels).toHaveLength(58);
  expect(labels.slice(0, 2)).toEqual(['Oct, 2026', 'Sep, 2026']);
  expect(labels.at(-1)).toBe('Jan, 2022');
  await expect(page.getByRole('option', { name: 'Oct, 2026' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('option', { name: 'Nov, 2026' })).toHaveCount(0);
  await page.getByRole('option', { name: 'Mar, 2026' }).click();
  await expect(selector(page)).toHaveText('Mar, 2026');

  await expectCard(page, 'Mar, 2026', '$11,000.00', '$20,000.00');
  await expect(meter(page)).toHaveAttribute('aria-valuenow', '0.55');
  await expect(meter(page).locator('text')).toHaveText(['$0', '$11k', '$20k']);

  await pick(page, 'Dec, 2025');
  await expectCard(page, 'Dec, 2025', '$21,000.00', '$20,000.00');
  await expect(meter(page)).toHaveAttribute('aria-valuenow', '1');
  expect(monthReads).toEqual(['/api/savings-goals?month=2026-03', '/api/savings-goals?month=2025-12']);
});

// T27: AC5, the current month from the backend's clock in the browser's zone (#54, #60, #80).
test('starts the list at Nov, 2026 in Belgrade and Oct, 2026 in New York at 2026-10-31T23:30:00Z', async ({
  page,
  browser,
}) => {
  await signUp(page.request);
  await moveBackendClock(page, '2026-10-31T23:30:00Z');
  await page.goto('/goals');

  await expectCard(page, 'Nov, 2026', '$17,000.00', '$20,000.00');
  const belgrade = await optionLabels(page);
  expect([belgrade.length, belgrade[0], belgrade.at(-1)]).toEqual([59, 'Nov, 2026', 'Jan, 2022']);

  const newYork = await browser.newContext({
    baseURL: FRONTEND_URL,
    timezoneId: NEW_YORK,
    storageState: await page.context().storageState(),
  });
  const nyPage = await newYork.newPage();
  await nyPage.goto('/goals');
  await expectCard(nyPage, 'Oct, 2026', '$16,250.00', '$20,000.00');
  const ny = await optionLabels(nyPage);
  expect([ny.length, ny[0], ny.at(-1)]).toEqual([58, 'Oct, 2026', 'Jan, 2022']);
  await newYork.close();
});

// T28: AC6 and AC8, the earliest month with no data, and a month with no goal (#58, #69, #71, #85, #123 a).
test('lists Dec, 2021 alone before the dataset; in Jan 2029 shows no goal and creates it', async ({ page }) => {
  // Signed up after the clock moves, so the session is valid at that clock (30 days, #14).
  await moveBackendClock(page, '2021-12-31T10:00:00Z');
  await signUp(page.request);
  await page.goto('/goals');
  await expect(goals(page).getByText('No goal for this month')).toBeVisible();
  expect(await optionLabels(page)).toEqual(['Dec, 2021']);

  await moveBackendClock(page, '2029-01-15T10:00:00Z');
  await signUp(page.request);
  await page.goto('/goals');
  await expect(selector(page)).toHaveText('Jan, 2029');
  await expect(goals(page).getByText('No goal for this month')).toBeVisible();
  await expect(savingsGoalCard(page)).toHaveText('Savings GoalJan, 2029No goal for this monthAdjust Goal');
  await expect(meter(page)).toHaveCount(0);
  const labels = await optionLabels(page);
  expect([labels.length, labels[0], labels.at(-1)]).toEqual([85, 'Jan, 2029', 'Jan, 2022']);

  await openPopup(page, 'Jan, 2029');
  await expect(targetField(page)).toHaveValue('');
  await expect(presentField(page)).toHaveValue('');
  await expect(presentField(page)).toHaveAttribute('placeholder', 'Write present amount here');
  await saveButton(page).click();
  await expect(targetField(page)).toHaveAccessibleDescription('Target Amount is required');
  await save(page, '500', '');

  await expectCard(page, 'Jan, 2029', '$0.00', '$500.00');
  await page.reload();
  await pick(page, 'Dec, 2028');
  await pick(page, 'Jan, 2029');
  await expectCard(page, 'Jan, 2029', '$0.00', '$500.00');
});

// T29: AC9 to AC11, popup 110.1 on a past month: the box, the dim, closing, and the save (#31, #35, #58 d, #90 c, #119).
test('opens 110.1 for Mar, 2026 over the content area, closes it each way, and saves the month', async ({ page }) => {
  const user = await openGoals(page);
  const puts = goalPuts(page);
  await pick(page, 'Mar, 2026');
  await expectCard(page, 'Mar, 2026', '$11,000.00', '$20,000.00');

  await openPopup(page, 'Mar, 2026');
  await expect(targetField(page)).toHaveValue('20000');
  await expect(presentField(page)).toHaveValue('11000');
  await expect(targetField(page)).toBeFocused();
  // Only the content area is dimmed: right of the sidebar, below the header (#35).
  const overlay = overlayOf(dialog(page));
  const overlayBox = await box(overlay);
  expect({ x: overlayBox.x, y: overlayBox.y }).toEqual({ x: 280, y: 88 });
  expect(await computed(overlay, 'background-color')).toBe(await tokenColor(page, '--color-default-black-15'));
  // The panel of 104.1, its top edge at y 276, centred on the content area (#90 c).
  const panel = await box(dialog(page));
  expect(panel.y).toBe(276);
  expect(panel.width).toBe(488);
  near(panel.x + panel.width / 2, overlayBox.x + overlayBox.width / 2, 'panel centre', 1);
  await page.mouse.click(140, 300);
  await expect(dialog(page)).toBeVisible();
  await expect(page).toHaveURL(`${FRONTEND_URL}/goals`);

  for (const close of [
    () => page.keyboard.press('Escape'),
    () => closeButton(page).click(),
    () => page.mouse.click(1300, 990),
  ]) {
    await targetField(page).fill('99');
    await close();
    await expect(dialog(page)).toBeHidden();
    await expect(adjustButton(page)).toBeFocused();
    await openPopup(page, 'Mar, 2026');
    await expect(targetField(page)).toHaveValue('20000');
  }
  expect(puts).toHaveLength(0);

  await save(page, '25000.5', '12000');

  expect(puts).toHaveLength(1);
  expect(puts[0]!.postDataJSON()).toEqual({ month: '2026-03', target: usd(2_500_050), present: usd(1_200_000) });
  expect(puts[0]!.headers()['x-time-zone']).toBe(TIME_ZONE);
  expect(puts[0]!.headers()['x-expected-user']).toBe(user.email);
  await expectCard(page, 'Mar, 2026', '$12,000.00', '$25,000.50');

  await page.reload();
  await expectCard(page, 'Oct, 2026', '$16,250.00', '$20,000.00');
  await pick(page, 'Mar, 2026');
  await expectCard(page, 'Mar, 2026', '$12,000.00', '$25,000.50');
});

// T30: AC12, Overview after a save on Goals (#58; Marko's notes).
test('keeps Overview on October after a September save, and shows a current month save there', async ({ page }) => {
  await openGoals(page);
  const overviewGoals = () => region(page, 'Goals');

  await pick(page, 'Sep, 2026');
  await openPopup(page, 'Sep, 2026');
  await save(page, '30000', '17000');
  await expectCard(page, 'Sep, 2026', '$17,000.00', '$30,000.00');
  await sidebar(page).getByRole('link', { name: 'Overview' }).click();
  await expect(amountOf(overviewGoals(), 'Target Achieved')).toHaveText('$16,250.00');
  await expect(overviewGoals().getByText('Oct, 2026')).toBeVisible();
  await page.reload();
  await expect(amountOf(overviewGoals(), 'Target Achieved')).toHaveText('$16,250.00');
  await expect(amountOf(overviewGoals(), 'This month Target')).toHaveText('$20,000.00');

  await sidebar(page).getByRole('link', { name: 'Goals' }).click();
  await expectCard(page, 'Oct, 2026', '$16,250.00', '$20,000.00');
  await openPopup(page, 'Oct, 2026');
  await save(page, '40000', '18000');
  await sidebar(page).getByRole('link', { name: 'Overview' }).click();
  await expect(amountOf(overviewGoals(), 'Target Achieved')).toHaveText('$18,000.00');
  await expect(amountOf(overviewGoals(), 'This month Target')).toHaveText('$40,000.00');
});

// T31: AC13 and AC16, the popup's rules and failures on Goals, and a refused future month (#6, #97 a, #108 a, #123 b).
test('shows each broken rule, one request while saving and a 500; a PUT for Nov, 2026 answers 409', async ({
  page,
}) => {
  const user = await openGoals(page);
  const puts = goalPuts(page);
  await pick(page, 'Mar, 2026');
  await openPopup(page, 'Mar, 2026');

  for (const [target, present, field, message] of [
    ['', '11000', 'target', 'Target Amount is required'],
    ['0', '11000', 'target', 'Target Amount must be greater than $0.00'],
    ['1000000000.01', '11000', 'target', 'Target Amount must be at most $1,000,000,000.00'],
    ['20000', '1000000000.01', 'present', 'Present Amount must be at most $1,000,000,000.00'],
  ] as const) {
    await targetField(page).fill(target);
    await presentField(page).fill(present);
    await saveButton(page).click();
    const input = field === 'target' ? targetField(page) : presentField(page);
    await expect(input).toHaveAccessibleDescription(message);
    // The form moves focus to the field with the error (react-hook-form, once more on a timer): typing before it has
    // would land in that field.
    await expect(input).toBeFocused();
  }
  expect(puts).toHaveLength(0);

  const held: Route[] = [];
  await page.route('**/api/savings-goals', async (route) => {
    if (route.request().method() === 'PUT') held.push(route);
    else await route.continue();
  });
  await targetField(page).fill('30000');
  await presentField(page).fill('11000');
  await saveButton(page).click();
  await expect(saveButton(page)).toHaveAttribute('aria-busy', 'true');
  await expect(saveButton(page)).toBeFocused();
  await saveButton(page).click({ force: true });
  await expect.poll(() => held.length).toBe(1);
  await held[0]!.fulfill({ status: 500, json: { message: 'Internal server error' } });
  await expect(dialog(page).getByRole('alert')).toHaveText('Something went wrong.');
  await expect(targetField(page)).toHaveValue('30000');
  expect(puts).toHaveLength(1);
  await page.unroute('**/api/savings-goals');
  await page.keyboard.press('Escape');

  const refused = await page.request.put('/api/savings-goals', {
    headers: { 'X-Time-Zone': TIME_ZONE, 'X-Expected-User': user.email },
    data: { month: '2026-11', target: usd(100), present: usd(0) },
  });
  expect([refused.status(), await refused.json()]).toEqual([409, { message: unavailable }]);
  // November, read once it is the current month, is still the demo goal.
  await moveBackendClock(page, '2026-11-15T10:00:00Z');
  const november = await page.request.get('/api/savings-goals?month=2026-11', {
    headers: { 'X-Time-Zone': TIME_ZONE },
  });
  expect(await november.json()).toEqual({
    month: '2026-11',
    goal: { target: usd(2_000_000), present: usd(1_700_000), progress: 0.85 },
  });
});

// T32: AC20, the keyboard path, with the ring on keyboard focus only (#35, #87).
test('tabs to the selector and "Adjust Goal" with the ring, picks a month by keys, and opens the popup on Target', async ({
  page,
}) => {
  await openGoals(page);

  await search(page).focus();
  await page.keyboard.press('Tab');
  await expect(selector(page)).toBeFocused();
  await expectRing(page, selector(page));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toBeVisible();
  // Radix focuses the selected option once the open list is placed; an arrow pressed before that is lost (as
  // account-details-edit.spec.ts waits).
  await expect(page.getByRole('option', { name: 'Oct, 2026', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: 'Sep, 2026', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(selector(page)).toHaveText('Sep, 2026');
  await expect(selector(page)).toBeFocused();
  await expectCard(page, 'Sep, 2026', '$15,500.00', '$20,000.00');

  await page.keyboard.press('Tab');
  await expect(adjustButton(page)).toBeFocused();
  await expectRing(page, adjustButton(page));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Adjust goal for Sep, 2026' })).toBeVisible();
  await expect(targetField(page)).toBeFocused();
  for (const next of [presentField(page), saveButton(page), closeButton(page)]) {
    await page.keyboard.press('Tab');
    await expect(next).toBeFocused();
  }
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(adjustButton(page)).toBeFocused();
  await page.keyboard.press('Space');
  await expect(targetField(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();

  // A mouse press focuses "Adjust Goal" with no ring, once a click elsewhere has taken the keyboard's focus away.
  const summaryBox = await box(savingSummaryCard(page));
  await page.mouse.click(summaryBox.x + 20, summaryBox.y + 20);
  await expect(adjustButton(page)).not.toBeFocused();
  const buttonBox = await box(adjustButton(page));
  await page.mouse.move(buttonBox.x + buttonBox.width / 2, buttonBox.y + buttonBox.height / 2);
  await page.mouse.down();
  await expect(adjustButton(page)).toBeFocused();
  expect(await adjustButton(page).evaluate((node) => node.matches(':focus-visible'))).toBe(false);
  expect(await computed(adjustButton(page), 'outline-style')).toBe('none');
  await page.mouse.move(5, 5);
  await page.mouse.up();
});

/** A route that holds GET requests, then answers 500 to each (`fail`), then lets them through (`pass`). */
async function controlRoute(page: Page, matches: (url: URL) => boolean) {
  const state = { mode: 'hold' as 'hold' | 'fail' | 'pass', held: [] as Route[] };
  await page.route(matches, async (route) => {
    if (route.request().method() !== 'GET' || state.mode === 'pass') await route.continue();
    else if (state.mode === 'hold') state.held.push(route);
    else await route.fulfill({ status: 500, json: { message: 'Internal server error' } });
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

// T33: AC19, the states at the card's 292 (#6, #88, #89, #114).
for (const [what, matches] of [
  ['the months', (url: URL) => url.pathname === '/api/savings-goals/months'],
  ['the month’s goal', (url: URL) => url.pathname === '/api/savings-goals' && url.searchParams.has('month')],
] as const) {
  test(`shows the skeleton at 292 while ${what} load, the error state after they fail, and Retry loads the card`, async ({
    page,
  }) => {
    await signUp(page.request);
    const route = await controlRoute(page, matches);
    await page.goto('/goals');

    const busy = savingsGoalCard(page).locator('[aria-busy="true"]');
    await expect(busy).toBeVisible();
    expect((await box(savingsGoalCard(page))).height).toBe(292);
    await expect(savingsGoalCard(page).getByRole('heading', { level: 3 })).toHaveText('Savings Goal');
    await expect(adjustButton(page)).toHaveCount(0);
    await expect(selector(page)).toHaveCount(what === 'the months' ? 0 : 1);
    await expect(categoryCards(page)).toHaveCount(6);

    await route.fail();
    // Task 026: the Saving Summary card shows its own error state when the months fail, so the card is named.
    await expect(savingsGoalCard(page).getByRole('alert')).toHaveText('Something went wrong.', { timeout: 15_000 });
    expect((await box(savingsGoalCard(page))).height).toBe(292);
    route.pass();
    await savingsGoalCard(page).getByRole('button', { name: 'Retry' }).click();

    await expectCard(page, 'Oct, 2026', '$16,250.00', '$20,000.00');
    await expect(savingsGoalCard(page).getByRole('alert')).toHaveCount(0);
  });
}

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

/** The Savings Goal card's parts: the title, the selector, the two amounts, the meter and "Adjust Goal". */
async function cardParts(page: Page) {
  return {
    card: await box(savingsGoalCard(page)),
    title: await box(savingsGoalCard(page).getByRole('heading', { level: 3 })),
    selector: await box(selector(page)),
    terms: await Promise.all((await goals(page).getByRole('term').all()).map(box)),
    amounts: await Promise.all((await goals(page).getByRole('definition').all()).map(box)),
    meter: await box(meter(page)),
    adjust: await box(adjustButton(page)),
  };
}

/**
 * AC21: the two top cards one height, in 368 : 712 of the content less the 24 between them; the category cards on
 * 110's grid; in the Savings Goal card nothing overlaps or leaves the card, the amounts at the left, the gauge at the
 * right edge, "Adjust Goal" centred; no horizontal scroll (#94, #101, #108 b).
 */
async function expectLayout(page: Page) {
  const right = await pageRight(page);
  const content = { x: 304, right: right - 32 };
  const width = content.right - content.x;
  const parts = await cardParts(page);
  const summary = await box(savingSummaryCard(page));
  near(parts.card.x, 304, 'Savings Goal x');
  near(parts.card.y, 152, 'Savings Goal y');
  near(parts.card.width, ((width - 24) * 368) / 1080, 'Savings Goal width', 1);
  near(summary.x, parts.card.x + parts.card.width + 24, 'Saving Summary x', 1);
  near(summary.x + summary.width, content.right, 'Saving Summary right edge', 1);
  near(summary.height, parts.card.height, 'one top row height');
  expect(parts.card.height).toBeGreaterThanOrEqual(291.5);
  const shown = [parts.title, parts.selector, ...parts.terms, ...parts.amounts, parts.meter, parts.adjust];
  for (const [a, first] of shown.entries()) {
    expect(inside(first, parts.card), `part ${a} inside the card`).toBe(true);
    for (const second of shown.slice(a + 1)) expect(overlaps(first, second), `parts ${a} overlap`).toBe(false);
  }
  near(parts.title.x, parts.card.x + 24, 'title 24 in');
  near(parts.selector.x + parts.selector.width, parts.card.x + parts.card.width - 24, 'selector at the right edge');
  // The labels 28 right of the content edge, after the 24px icon and its 4 (110: x 356.5 at 1440).
  near(parts.terms[0]!.x, parts.card.x + 24 + 28, 'amounts at the left', 1);
  near(parts.adjust.x + parts.adjust.width / 2, parts.card.x + parts.card.width / 2, 'Adjust Goal centred', 1);
  near(parts.adjust.y + parts.adjust.height, parts.card.y + parts.card.height - 24, 'Adjust Goal 24 over the end');

  const categoriesTop = parts.card.y + parts.card.height + 32 + 32 + 16;
  const cardWidth = (width - 48) / 3;
  const categoryBoxes = await Promise.all((await categoryCards(page).all()).map(box));
  expect(categoryBoxes).toHaveLength(6);
  // Task 027: the cards are filled, so a row grows where its "Adjust" moves under the text (1280, #108 b); each row's
  // cards one height, at least 104, the second row 16 under the first. The callers check 104 where nothing wraps.
  const rowHeights = [categoryBoxes[0]!.height, categoryBoxes[3]!.height];
  for (const [index, cell] of categoryBoxes.entries()) {
    const [row, column] = [Math.floor(index / 3), index % 3];
    near(cell.x, content.x + column * (cardWidth + 24), `category ${index + 1} x`);
    near(cell.y, categoriesTop + (row === 0 ? 0 : rowHeights[0]! + 16), `category ${index + 1} y`);
    near(cell.width, cardWidth, `category ${index + 1} width`);
    near(cell.height, rowHeights[row]!, `category ${index + 1} height: one per row`);
    expect(cell.height, `category ${index + 1} at least 104`).toBeGreaterThanOrEqual(103.5);
  }
  expect(await scrollWidth(page), 'no horizontal scroll').toBe(Math.round(right));
  return { ...parts, categoryHeights: rowHeights };
}

// T34: AC21, 110's boxes at 1440x1024, wider at 1920 and 2560, #108 b at 1280 and with long amounts, the bottom inset.
test('places the cards where 110 does at 1440, keeps 368 : 712 wider, and wraps at 1280 and with long amounts', async ({
  page,
}) => {
  await openGoals(page);
  const at1440 = await expectLayout(page);
  // 368 wide with no scrollbar gutter (110); headless Chromium keeps a classic one's 15 px, so the split is checked
  // from the page's right edge in expectLayout (#101).
  near(at1440.card.height, CARD_HEIGHT, 'Savings Goal height at 1440');
  expect(at1440.categoryHeights, 'the category cards 104 at 1440').toEqual([104, 104]);
  // 110's 142 less 2: the label in Inter 14 (76) and the 8 to the pencil on the 4px grid, measured about 9 (#65).
  near(at1440.adjust.width, 140, 'Adjust Goal 140 wide', 1);
  near(at1440.adjust.height, 36, 'Adjust Goal 36 high');
  // The amounts and the gauge side by side, the gauge in the right half.
  expect(at1440.meter.y, 'gauge beside the amounts').toBeLessThan(at1440.amounts[1]!.y);
  expect(at1440.meter.x).toBeGreaterThan(at1440.card.x + at1440.card.width / 2);
  expect(await page.evaluate(() => document.documentElement.scrollHeight), 'no scroll at 1440x1024').toBe(1024);

  for (const [width, height] of [
    [1920, 1080],
    [2560, 1440],
  ] as const) {
    await page.setViewportSize({ width, height });
    const parts = await expectLayout(page);
    near(parts.card.height, CARD_HEIGHT, `${width}: height unchanged`);
    expect(parts.categoryHeights, `${width}: the category cards 104`).toEqual([104, 104]);
    expect(parts.meter.x, `${width}: the gauge at the right`).toBeGreaterThan(parts.card.x + parts.card.width / 2);
  }

  await page.setViewportSize({ width: 1280, height: 1024 });
  const at1280 = await expectLayout(page);
  expect(at1280.meter.y, '1280: the gauge under the amounts').toBeGreaterThan(at1280.amounts[1]!.y);

  await page.setViewportSize({ width: 1440, height: 1024 });
  await openPopup(page, 'Oct, 2026');
  await save(page, '1000000000', '1000000000');
  await expect(amountOf(goals(page), 'Target Achieved')).toHaveText('$1,000,000,000.00');
  const long = await expectLayout(page);
  expect(long.card.height, 'the card grows with long amounts').toBeGreaterThan(CARD_HEIGHT);

  // A short window: the page scrolls and ends 32 under the last card (#111).
  await page.setViewportSize({ width: 1440, height: 600 });
  const { pageEnd, lastBottom } = await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    // Task 027: the category cards are list items.
    const cards = [...document.querySelectorAll('main section')].at(-1)!.querySelectorAll('li');
    return {
      pageEnd: document.documentElement.scrollHeight,
      lastBottom: cards[cards.length - 1]!.getBoundingClientRect().bottom + window.scrollY,
    };
  });
  near(pageEnd, lastBottom + 32, 'page end 32 under the last card', 1);
});

// Task 026: the Saving Summary chart (US-16 criteria 3 to 6, 12 and 13; #42, #55, #59, #68, #72, #124).
const yLabels = (page: Page) => savingSummaryCard(page).locator('svg text[text-anchor="end"]');
const xLabels = (page: Page) => savingSummaryCard(page).locator('svg text[text-anchor="middle"]');
const gridLines = (page: Page) => savingSummaryCard(page).locator('svg line');
/** The lines' paths, in the nested SVG of the plot (the selector's chevron is a path too). */
const linePaths = (page: Page) => savingSummaryCard(page).locator('svg[preserveAspectRatio="none"] path');

/** The hidden table's body rows: the day, this month's amount and the month before's. */
async function chartRows(page: Page): Promise<string[][]> {
  await expect(chartTable(page)).toBeAttached();
  return chartTable(page)
    .locator('tbody tr')
    .evaluateAll((rows) => rows.map((row) => [...row.children].map((cell) => cell.textContent ?? '')));
}

/** Picks a month in the Saving Summary selector with the mouse, the list read from the page (it hides the rest). */
async function pickSummary(page: Page, label: string) {
  await summarySelector(page).click();
  await page.getByRole('option', { name: label, exact: true }).click();
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(summarySelector(page)).toHaveText(label);
}

/** The GET requests to the API from now on, as `path?query`. */
function apiReads(page: Page): string[] {
  const reads: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/') && request.method() === 'GET') reads.push(`${url.pathname}${url.search}`);
  });
  return reads;
}

const octoberTicks = ['-$300', '-$150', '$0', '$150', '$300', '$450', '$600'];

// T19: AC1 and AC2, the first login's Saving Summary (#11, #42, #55, #57, #59, #68, #84, #113 b, #124 a, b).
test('shows October’s Saving Summary: the plain selector, the legend, the axis and every day in the table', async ({
  page,
}) => {
  await openGoals(page);

  await expect(savingSummaryCard(page).getByRole('heading', { level: 3 })).toHaveText('Saving Summary');
  await expect(summarySelector(page)).toHaveText('Oct, 2026');
  const legend = savingSummaryCard(page).getByRole('listitem');
  await expect(legend).toHaveText(['This month', 'Same period last month']);
  const swatches = legend.locator('span');
  expect(await computed(swatches.first(), 'background-color')).toBe(await tokenColor(page, '--color-primary'));
  expect(await computed(swatches.last(), 'background-color')).toBe(await tokenColor(page, '--color-gray-05'));
  await expect(yLabels(page)).toHaveText(octoberTicks);
  await expect(xLabels(page)).toHaveText(['01 Oct', '05 Oct', '10 Oct', '15 Oct', '20 Oct', '25 Oct', '30 Oct']);
  await expect(gridLines(page)).toHaveCount(7);

  const rows = await chartRows(page);
  expect(rows).toHaveLength(31);
  expect(rows[0]).toEqual(['01 Oct', '$552.16', '$526.40']);
  expect(rows[1]).toEqual(['02 Oct', '-$28.00', '-$23.52']);
  expect(rows[2]).toEqual(['03 Oct', '$168.56', '$168.00']);
  expect(rows[3]).toEqual(['04 Oct', '-$283.36', '-$244.72']);
  expect(rows[15]).toEqual(['16 Oct', '-$14.78', '-$12.77']);
  expect(rows[21]).toEqual(['22 Oct', '-$266.00', '-$223.44']);
  expect(rows.slice(22).map((row) => row[1])).toEqual(Array.from({ length: 9 }, () => ''));
  expect(rows[29]).toEqual(['30 Oct', '', '-$14.28']);
  expect(rows[30]).toEqual(['31 Oct', '', '']);
  expect(rows.slice(0, 30).every((row) => row[2] !== '')).toBe(true);

  // The drawing is hidden from assistive technology and holds nothing focusable; the colors are tokens.
  for (const svg of await savingSummaryCard(page).locator(':scope svg[aria-hidden="true"]').all()) {
    expect(await svg.locator('a, button, [tabindex]').count()).toBe(0);
  }
  const dashed = linePaths(page).and(page.locator('[stroke-dasharray]'));
  expect(await computed(dashed, 'stroke')).toBe(await tokenColor(page, '--color-gray-05'));
  expect(await computed(dashed, 'stroke-width')).toBe('2px');
  const line = linePaths(page).last();
  expect(await computed(line, 'stroke')).toBe(await tokenColor(page, '--color-primary'));
  expect(await computed(line, 'stroke-width')).toBe('2px');
  expect(await computed(line, 'vector-effect')).toBe('non-scaling-stroke');
});

// T20: AC3 to AC5, the one list, picked months and the other selector (#30, #60, #68, #91, #123 a, #124 a, c).
test('lists the same 58 months in the Saving Summary selector; picks change only the chart, one request each', async ({
  page,
}) => {
  await signUp(page.request);
  const reads = apiReads(page);
  await page.goto('/goals');
  await expect(meter(page)).toBeVisible();
  await expect(chartTable(page)).toBeAttached();
  expect(reads.filter((read) => read.startsWith('/api/savings-goals/months'))).toHaveLength(1);
  expect(reads.filter((read) => read.startsWith('/api/saving-summary'))).toEqual(['/api/saving-summary?month=2026-10']);

  await summarySelector(page).click();
  await expect(page.getByRole('listbox')).toHaveCount(1);
  const summaryLabels = await page.getByRole('option').allTextContents();
  await expect(page.getByRole('option', { name: 'Oct, 2026', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toBeHidden();
  expect(summaryLabels).toEqual(await optionLabels(page));
  expect([summaryLabels.length, summaryLabels[0], summaryLabels.at(-1)]).toEqual([58, 'Oct, 2026', 'Jan, 2022']);

  const before = reads.length;
  await pickSummary(page, 'Mar, 2026');
  await expect.poll(async () => (await chartRows(page))[0]).toEqual(['01 Mar', '$526.40', '$539.28']);
  const march = await chartRows(page);
  expect(march).toHaveLength(31);
  expect(march[27]).toEqual(['28 Mar', '$21.28', '$23.52']);
  expect(march.slice(28).map((row) => row[2])).toEqual(['', '', '']);
  expect(march[30]).toEqual(['31 Mar', '-$14.11', '']);
  await expect(yLabels(page)).toHaveText(octoberTicks);
  await expectCard(page, 'Oct, 2026', '$16,250.00', '$20,000.00');
  expect(reads.slice(before)).toEqual(['/api/saving-summary?month=2026-03']);

  const cardHeight = (await box(savingSummaryCard(page))).height;
  await pickSummary(page, 'Dec, 2025');
  await expect(yLabels(page)).toHaveText(['-$375', '-$250', '-$125', '$0', '$125', '$250', '$375', '$500']);
  await pickSummary(page, 'Jun, 2022');
  await expect(yLabels(page)).toHaveText([
    '-$625',
    '-$500',
    '-$375',
    '-$250',
    '-$125',
    '$0',
    '$125',
    '$250',
    '$375',
    '$500',
  ]);
  expect((await chartRows(page))[16]).toEqual(['17 Jun', '-$574.20', '$0.00']);
  // Spread evenly over the chart's fixed height: 150 / 9 apart, the card's height unchanged (#124 c).
  const centres = await Promise.all(
    (await yLabels(page).all()).map(async (label) => {
      const each = await box(label);
      return each.y + each.height / 2;
    }),
  );
  centres.slice(1).forEach((centre, index) => near(centres[index]! - centre, 150 / 9, `label ${index + 1} spacing`));
  near((await box(savingSummaryCard(page))).height, cardHeight, 'the card’s height unchanged');

  const beforeGoalPick = reads.length;
  const juneTable = await chartRows(page);
  await pick(page, 'Mar, 2026');
  await expectCard(page, 'Mar, 2026', '$11,000.00', '$20,000.00');
  expect(reads.slice(beforeGoalPick)).toEqual(['/api/savings-goals?month=2026-03']);
  await expect(summarySelector(page)).toHaveText('Jun, 2022');
  expect(await chartRows(page)).toEqual(juneTable);
});

// T21: AC6, the midnight in Belgrade and New York (#54, #55, #57, #80).
test('shows Nov, 2026 with one dot in Belgrade and October’s 31 days in New York at 2026-10-31T23:30:00Z', async ({
  page,
  browser,
}) => {
  await signUp(page.request);
  await moveBackendClock(page, '2026-10-31T23:30:00Z');
  await page.goto('/goals');

  await expect(summarySelector(page)).toHaveText('Nov, 2026');
  await expect.poll(async () => (await chartRows(page))[0]).toEqual(['01 Nov', '$513.52', '$552.16']);
  const belgrade = await chartRows(page);
  expect(belgrade).toHaveLength(30);
  expect(belgrade.slice(1).every((row) => row[1] === '' && row[2] !== '')).toBe(true);
  const dot = linePaths(page).last();
  expect(await dot.getAttribute('d')).toMatch(/^M0,[\d.]+h0$/);
  expect(await computed(dot, 'stroke-linecap')).toBe('round');
  // Not designed: drawn at a marker's 8px, the 2px cap alone being a speck.
  expect(await computed(dot, 'stroke-width')).toBe('8px');
  // The dashed line and the dot: no fill under a lone point.
  await expect(linePaths(page)).toHaveCount(2);

  const newYork = await browser.newContext({
    baseURL: FRONTEND_URL,
    timezoneId: NEW_YORK,
    storageState: await page.context().storageState(),
  });
  const nyPage = await newYork.newPage();
  await nyPage.goto('/goals');
  await expect(summarySelector(nyPage)).toHaveText('Oct, 2026');
  await expect(chartTable(nyPage)).toBeAttached();
  const ny = await chartRows(nyPage);
  expect(ny).toHaveLength(31);
  expect(ny.every((row) => row[1] !== '')).toBe(true);
  expect(ny[24]).toEqual(['25 Oct', '-$10.64', '-$11.20']);
  expect(ny[30]).toEqual(['31 Oct', '-$14.78', '']);
  await newYork.close();
});

// T22: AC9, every value $0 before the dataset: the empty state (#6, #55, #124 e).
test('shows "No savings this month or last month" for Dec, 2021, the header row as always', async ({ page }) => {
  // Signed up after the clock moves, so the session is valid at that clock (30 days, #14).
  await moveBackendClock(page, '2021-12-31T10:00:00Z');
  await signUp(page.request);
  await page.goto('/goals');

  await expect(savingSummaryCard(page).getByText('No savings this month or last month')).toBeVisible();
  await expect(summarySelector(page)).toHaveText('Dec, 2021');
  await expect(savingSummaryCard(page).getByRole('listitem')).toHaveText(['This month', 'Same period last month']);
  await expect(chartTable(page)).toHaveCount(0);
  expect((await box(savingSummaryCard(page))).height).toBeGreaterThanOrEqual(292);
});

// T23: AC13, a goal save asks for no summary and leaves the chart (#59).
test('asks for no Saving Summary when a goal is saved, and keeps the chart', async ({ page }) => {
  await openGoals(page);
  await expect(chartTable(page)).toBeAttached();
  const before = await chartRows(page);
  const reads = apiReads(page);

  // The save asks for the goal queries again (task 014); the months' answer is the last thing it waits for.
  const refetched = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/savings-goals/months',
  );
  await openPopup(page, 'Oct, 2026');
  await save(page, '25000', '17000');
  await expectCard(page, 'Oct, 2026', '$17,000.00', '$25,000.00');
  await refetched;

  expect(reads.filter((read) => read.startsWith('/api/saving-summary'))).toEqual([]);
  expect(await chartRows(page)).toEqual(before);
});

// T24: AC14, the states in the chart's box (#6, #88, #89, #105 a, #114).
for (const [what, matches] of [
  ['the months', (url: URL) => url.pathname === '/api/savings-goals/months'],
  ['the summary', (url: URL) => url.pathname === '/api/saving-summary'],
] as const) {
  test(`shows the Saving Summary skeleton at 292 while ${what} load, the error state after they fail, and Retry`, async ({
    page,
  }) => {
    await signUp(page.request);
    const route = await controlRoute(page, matches);
    await page.goto('/goals');

    const busy = savingSummaryCard(page).locator('[aria-busy="true"]');
    await expect(busy).toBeVisible();
    expect((await box(savingSummaryCard(page))).height).toBeGreaterThanOrEqual(292);
    await expect(savingSummaryCard(page).getByRole('heading', { level: 3 })).toHaveText('Saving Summary');
    await expect(savingSummaryCard(page).getByRole('listitem')).toHaveText(['This month', 'Same period last month']);
    await expect(summarySelector(page)).toHaveCount(what === 'the months' ? 0 : 1);
    // While the months load, a block holds the selector's place beside the title (not designed).
    const placeholder = savingSummaryCard(page).locator('h3 + [aria-hidden="true"]');
    await expect(placeholder).toHaveCount(what === 'the months' ? 1 : 0);
    if (what === 'the months') {
      const block = await box(placeholder);
      const title = await box(savingSummaryCard(page).getByRole('heading', { level: 3 }));
      near(block.x, title.x + title.width + 32, 'the placeholder 32 after the title', 1);
      near(block.height, 16, 'the placeholder 16 high');
    }
    await expect(categoryCards(page)).toHaveCount(6);
    if (what === 'the summary') await expectCard(page, 'Oct, 2026', '$16,250.00', '$20,000.00');

    await route.fail();
    await expect(savingSummaryCard(page).getByRole('alert')).toHaveText('Something went wrong.', { timeout: 15_000 });
    route.pass();
    await savingSummaryCard(page).getByRole('button', { name: 'Retry' }).click();

    await expect(chartTable(page)).toBeAttached();
    await expect(summarySelector(page)).toHaveText('Oct, 2026');
    await expect(savingSummaryCard(page).getByRole('alert')).toHaveCount(0);
    await expect(yLabels(page)).toHaveText(octoberTicks);
  });
}

// T25: AC15, the keyboard path across the top row, the ring on keyboard focus only (#87).
test('tabs to the Saving Summary selector after "Adjust Goal" with the ring, and picks a month by keys', async ({
  page,
}) => {
  await openGoals(page);
  await expect(chartTable(page)).toBeAttached();

  await search(page).focus();
  for (const next of [selector(page), adjustButton(page), summarySelector(page)]) {
    await page.keyboard.press('Tab');
    await expect(next).toBeFocused();
    await expectRing(page, next);
  }
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toBeVisible();
  // Radix focuses the selected option once the open list is placed; an arrow pressed before that is lost.
  await expect(page.getByRole('option', { name: 'Oct, 2026', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: 'Sep, 2026', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(summarySelector(page)).toHaveText('Sep, 2026');
  await expect(summarySelector(page)).toBeFocused();
  await expect.poll(async () => (await chartRows(page))[0]?.slice(0, 2)).toEqual(['01 Sep', '$526.40']);
  await expectCard(page, 'Oct, 2026', '$16,250.00', '$20,000.00');

  // Nothing in the chart takes focus: the next Tab leaves the card.
  await page.keyboard.press('Tab');
  expect(await savingSummaryCard(page).evaluate((card) => card.contains(document.activeElement))).toBe(false);

  // A mouse pick leaves the focus on the selector with no ring.
  await pickSummary(page, 'Aug, 2026');
  await expect(summarySelector(page)).toBeFocused();
  expect(await computed(summarySelector(page), 'outline-style')).toBe('none');
});

/** The Saving Summary card's parts and its chart's drawing, as boxes. */
async function summaryParts(page: Page) {
  const card = await box(savingSummaryCard(page));
  const content = { x: card.x + 24, right: card.x + card.width - 24 };
  const header = [
    await box(savingSummaryCard(page).getByRole('heading', { level: 3 })),
    await box(summarySelector(page)),
    await box(savingSummaryCard(page).getByRole('list')),
  ];
  const labels = await Promise.all([...(await yLabels(page).all()), ...(await xLabels(page).all())].map(box));
  const lines = await Promise.all((await gridLines(page).all()).map(box));
  const xs = await Promise.all((await xLabels(page).all()).map(box));
  return { card, content, header, labels, lines, xs };
}

/**
 * AC16: the Saving Summary card's insides at any width: the title on the Savings Goal title's line, the y labels
 * right-aligned 48 in, the top tick 37.5 under the 32 header row and the lowest 150 under it, the plot from 72 to the
 * content's right edge, the grid lines and labels on days 1, 5 ... 30, nothing overlapping or past the card.
 */
async function expectSummaryLayout(page: Page, dayCount = 31) {
  const { card, content, header, labels, lines, xs } = await summaryParts(page);
  const chartTop = header[0]!.y + header[0]!.height / 2 + 16;
  near(header[0]!.x, content.x, 'title 24 in');
  const goalTitle = await box(savingsGoalCard(page).getByRole('heading', { level: 3 }));
  near(header[0]!.y, goalTitle.y, 'the title on the Savings Goal title’s line');
  for (const [a, first] of [...header, ...labels].entries()) {
    expect(inside(first, card), `part ${a} inside the card`).toBe(true);
  }
  for (const [a, first] of header.entries()) {
    for (const second of header.slice(a + 1)) expect(overlaps(first, second), `header parts ${a} overlap`).toBe(false);
  }
  const ys = await Promise.all((await yLabels(page).all()).map(box));
  for (const label of ys) near(label.x + label.width, content.x + 48, 'y label right-aligned at 48', 1);
  near(ys.at(-1)!.y + ys.at(-1)!.height / 2, chartTop + 37.5, 'top tick 37.5 under the header row', 1.5);
  near(ys[0]!.y + ys[0]!.height / 2, chartTop + 187.5, 'lowest tick 150 under the top', 1.5);
  const plot = { x: content.x + 72, width: content.right - content.x - 72 };
  const days = [1, 5, 10, 15, 20, 25, 30].filter((day) => day <= dayCount);
  lines.forEach((line, index) => {
    const x = plot.x + ((days[index]! - 1) / (dayCount - 1)) * plot.width;
    near(line.x + line.width / 2, x, `grid line ${days[index]}`, 1);
    near(xs[index]!.x + xs[index]!.width / 2, x, `x label ${days[index]} on its line`, 1);
    near(line.y, chartTop + 37.5, 'grid from the top tick', 1);
    near(line.y + line.height, chartTop + 187.5, 'grid to the lowest tick', 1);
  });
  for (const [a, first] of xs.entries()) {
    for (const second of xs.slice(a + 1)) expect(overlaps(first, second), `x labels ${a} overlap`).toBe(false);
  }
  return { card, chartTop };
}

// T26: AC5 and AC16, the boxes at 1440, wider, at 1280, with long amounts, and June 2022 at 1280 (#94, #108 b, #113 a).
test('places the Saving Summary where 110 does, widens the plot, wraps at 1280 and keeps the chart at the top', async ({
  page,
}) => {
  await openGoals(page);
  await expect(chartTable(page)).toBeAttached();
  const at1440 = await expectSummaryLayout(page);
  near(at1440.card.height, CARD_HEIGHT, 'one top row height');
  near(at1440.chartTop, at1440.card.y + 20 + 32, 'the chart under the 32 header row, 20 in');
  expect(await page.evaluate(() => document.documentElement.scrollHeight), 'no scroll at 1440x1024').toBe(1024);

  for (const [width, height] of [
    [1920, 1080],
    [2560, 1440],
  ] as const) {
    await page.setViewportSize({ width, height });
    const wider = await expectSummaryLayout(page);
    near(wider.card.height, CARD_HEIGHT, `${width}: height unchanged`);
    expect(await scrollWidth(page), `${width}: no horizontal scroll`).toBe(Math.round(await pageRight(page)));
  }

  await page.setViewportSize({ width: 1280, height: 1024 });
  const at1280 = await expectSummaryLayout(page);
  const goalCard = await box(savingsGoalCard(page));
  near(at1280.card.height, goalCard.height, '1280: one top row height');
  // The chart stays at the top of the taller card, the extra height below (#113 a).
  near(at1280.chartTop, at1280.card.y + 20 + 32, '1280: the chart under the header row');
  expect(await scrollWidth(page), '1280: no horizontal scroll').toBe(Math.round(await pageRight(page)));
  await pickSummary(page, 'Jun, 2022');
  await expect(yLabels(page)).toHaveCount(10);
  await expectSummaryLayout(page, 30);

  await page.setViewportSize({ width: 1440, height: 1024 });
  await pickSummary(page, 'Oct, 2026');
  await openPopup(page, 'Oct, 2026');
  await save(page, '1000000000', '1000000000');
  await expect(amountOf(goals(page), 'Target Achieved')).toHaveText('$1,000,000,000.00');
  const long = await expectSummaryLayout(page);
  expect(long.card.height, 'the card stretches with the Savings Goal card').toBeGreaterThan(CARD_HEIGHT);
  near(long.card.height, (await box(savingsGoalCard(page))).height, 'one top row height with long amounts');
  near(long.chartTop, long.card.y + 20 + 32, 'the chart at the top of the taller card');
});
