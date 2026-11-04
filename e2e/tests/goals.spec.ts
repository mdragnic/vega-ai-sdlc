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
const categoryCards = (page: Page) => categories(page).locator(':scope > div').last().locator(':scope > div');
const selector = (page: Page) => goals(page).getByRole('combobox', { name: 'Savings Goal' });
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

// T25: AC1 and AC2, the first login's Goals page (US-16 criteria 1 and 2; #11, #18, #30, #58, #60, #105 a).
test('opens Goals from the sidebar with October’s goal, and the Saving Summary and category cards empty', async ({
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

  const white = await tokenColor(page, '--color-white');
  await expect(categoryCards(page)).toHaveCount(6);
  for (const card of [savingSummaryCard(page), ...(await categoryCards(page).all())]) {
    await expect(card).toHaveText('');
    expect(await computed(card, 'background-color')).toBe(white);
    expect(await card.locator('a, button, input, select, textarea, [tabindex]').count()).toBe(0);
  }
});

// T26: AC3 and AC4, the one list and a picked month (US-16 criteria 4 to 6; #30, #60, #123 a).
test('lists 58 months from Oct, 2026 to Jan, 2022, and shows March 2026 and December 2025 when picked', async ({
  page,
}) => {
  await openGoals(page);
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
    await expect(goals(page).getByRole('alert')).toHaveText('Something went wrong.', { timeout: 15_000 });
    expect((await box(savingsGoalCard(page))).height).toBe(292);
    route.pass();
    await goals(page).getByRole('button', { name: 'Retry' }).click();

    await expectCard(page, 'Oct, 2026', '$16,250.00', '$20,000.00');
    await expect(goals(page).getByRole('alert')).toHaveCount(0);
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
  for (const [index, card] of (await categoryCards(page).all()).entries()) {
    const cell = await box(card);
    const [row, column] = [Math.floor(index / 3), index % 3];
    near(cell.x, content.x + column * (cardWidth + 24), `category ${index + 1} x`);
    near(cell.y, categoriesTop + row * (104 + 16), `category ${index + 1} y`);
    near(cell.width, cardWidth, `category ${index + 1} width`);
    near(cell.height, 104, `category ${index + 1} height`);
  }
  expect(await scrollWidth(page), 'no horizontal scroll').toBe(Math.round(right));
  return parts;
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
    const cards = [...document.querySelectorAll('main section')]
      .at(-1)!
      .querySelectorAll(':scope > div:last-child > div');
    return {
      pageEnd: document.documentElement.scrollHeight,
      lastBottom: cards[cards.length - 1]!.getBoundingClientRect().bottom + window.scrollY,
    };
  });
  near(pageEnd, lastBottom + 32, 'page end 32 under the last card', 1);
});
