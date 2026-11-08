import type { Locator, Page, Request, Route } from '@playwright/test';

import { FRONTEND_URL } from '../constants';
import { expect, test } from '../fixtures';
import { afterQueuedTimers, box, computed, expectRing, signUp, tokenColor, type User } from '../helpers';

const main = (page: Page) => page.getByRole('main');
const region = (page: Page, name: string) => main(page).getByRole('region', { name, exact: true });
const goals = (page: Page) => region(page, 'Goals');
const categories = (page: Page) => region(page, 'Expenses Goals by Category');
const cards = (page: Page) => categories(page).getByRole('listitem');
/** The card headed by a category's clean name. */
const cardOf = (page: Page, name: string) =>
  cards(page).filter({ has: page.getByRole('heading', { level: 3, name, exact: true }) });
const adjustOf = (page: Page, name: string) => cardOf(page, name).getByRole('button', { name: 'Adjust', exact: true });
/** A card's parts as drawn: the tile, the name (with soft hyphens) and the amount line. */
const tileOf = (card: Locator) => card.locator('span[aria-hidden="true"]').first();
const nameOf = (card: Locator) => card.locator('p').first();
const amountOf = (card: Locator) => card.locator('p').nth(1);
const meter = (page: Page) => goals(page).getByRole('meter', { name: 'Target vs Achievement' });
const dialog = (page: Page) => page.getByRole('dialog');
const targetField = (page: Page) => dialog(page).getByRole('textbox', { name: 'Target Amounts' });
const saveButton = (page: Page) => dialog(page).getByRole('button', { name: 'Save' });
const closeButton = (page: Page) => dialog(page).getByRole('button', { name: 'Close' });
const overlayOf = (popup: Locator) => popup.locator('xpath=preceding-sibling::*[1]');

const NAMES = ['Housing', 'Food', 'Transportation', 'Entertainment', 'Shopping', 'Others'];
const usd = (cents: number) => ({ cents, currency: 'USD' });

const near = (actual: number, expected: number, what: string, tolerance = 0.5) =>
  expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);

/** Signs up a new user at the backend's clock and opens Goals once the six cards show. */
async function openGoals(page: Page): Promise<User> {
  const user = await signUp(page.request);
  await page.goto('/goals');
  await expect(cards(page).getByRole('button', { name: 'Adjust', exact: true })).toHaveCount(6);
  return user;
}

/** Each card's amount line, in the designed order. */
const amounts = (page: Page) => cards(page).locator('p:nth-of-type(2)');

/** The API requests the page sends from now on, as `METHOD path?query`. */
function apiRequests(page: Page): string[] {
  const sent: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) sent.push(`${request.method()} ${url.pathname}${url.search}`);
  });
  return sent;
}

/** The `PUT /api/category-limits` requests the page sends, from now on. */
function limitPuts(page: Page): Request[] {
  const puts: Request[] = [];
  page.on('request', (request) => {
    if (request.method() === 'PUT' && new URL(request.url()).pathname === '/api/category-limits') puts.push(request);
  });
  return puts;
}

/** Opens a category's popup with its "Adjust". */
async function openLimit(page: Page, name: string) {
  await adjustOf(page, name).click();
  await expect(page.getByRole('dialog', { name: `Adjust limit for ${name}` })).toBeVisible();
  // Ready for a press outside it: Radix listens from a zero-delay timer queued before focus reaches the first field.
  await expect(targetField(page)).toBeFocused();
  await afterQueuedTimers(page);
}

/** Saves a limit in the open popup and waits for it to close. */
async function saveLimit(page: Page, text: string) {
  await targetField(page).fill(text);
  await saveButton(page).click();
  await expect(dialog(page)).toBeHidden();
}

// T23: AC1 and AC2, the first login's six cards (US-16 criteria 7 and 8; #32, #56, #61).
test('shows the six categories in order with their tiles, $250.00 and "Adjust", and no spending', async ({ page }) => {
  const sent = apiRequests(page);
  await openGoals(page);
  await expect(meter(page)).toBeVisible();

  await expect(cards(page)).toHaveCount(6);
  await expect(categories(page).getByRole('heading', { level: 3 })).toHaveText(NAMES);
  await expect(amounts(page)).toHaveText(Array(6).fill('$250.00'));
  const gray06 = await tokenColor(page, '--color-gray-06');
  const secondary = await tokenColor(page, '--color-secondary');
  for (const card of await cards(page).all()) {
    const tile = tileOf(card);
    const tileBox = await box(tile);
    expect([tileBox.width, tileBox.height]).toEqual([40, 48]);
    expect(await computed(tile, 'background-color')).toBe(gray06);
    expect(await computed(tile, 'color')).toBe(secondary);
    await expect(tile.locator('svg')).toHaveCount(1);
  }
  // No spending, comparison, percentage or warning, though four categories spent more than $250.00 (demo-data.md).
  await expect(categories(page)).not.toContainText(/%|spent|over|left|exceed|\$252|\$510|\$282|\$658/i);
  await expect(categories(page).getByRole('meter')).toHaveCount(0);

  expect(sent.filter((request) => request.includes('/category-limits'))).toEqual(['GET /api/category-limits']);
  expect(sent.filter((request) => /\/api\/(expenses|transactions|statistics)/.test(request))).toEqual([]);
});

// T24: AC3, AC4 and AC5, popup 110.2: its box, the dim, each way to close, the save (US-16 criterion 10, US-17).
test('opens 110.2 for Food over the content area, closes it each way, saves 300.5 and keeps it after a reload', async ({
  page,
}) => {
  const user = await openGoals(page);
  const puts = limitPuts(page);

  await openLimit(page, 'Food');
  await expect(targetField(page)).toHaveValue('250');
  await expect(targetField(page)).toBeFocused();
  await expect(dialog(page).getByRole('textbox')).toHaveCount(1);
  await expect(saveButton(page)).toBeVisible();
  await expect(closeButton(page)).toBeVisible();
  // Only the content area is dimmed: right of the sidebar, below the header (#35).
  const overlay = overlayOf(dialog(page));
  const overlayBox = await box(overlay);
  expect({ x: overlayBox.x, y: overlayBox.y }).toEqual({ x: 280, y: 88 });
  expect(await computed(overlay, 'background-color')).toBe(await tokenColor(page, '--color-default-black-15'));
  // Task 005's one-field panel, 488x280, its top edge at y 276, centred on the content area (#90 c).
  const panel = await box(dialog(page));
  expect([panel.y, panel.width, panel.height]).toEqual([276, 488, 280]);
  near(panel.x + panel.width / 2, overlayBox.x + overlayBox.width / 2, 'panel centre', 1);
  // The page is blocked: a click on the sidebar does nothing.
  await page.mouse.click(140, 300);
  await expect(dialog(page)).toBeVisible();
  await expect(page).toHaveURL(`${FRONTEND_URL}/goals`);

  for (const close of [
    () => page.keyboard.press('Escape'),
    () => closeButton(page).click(),
    () => page.mouse.click(1300, 990),
  ]) {
    await targetField(page).fill('999');
    await close();
    await expect(dialog(page)).toBeHidden();
    await expect(adjustOf(page, 'Food')).toBeFocused();
    await openLimit(page, 'Food');
    await expect(targetField(page)).toHaveValue('250');
  }
  expect(puts).toHaveLength(0);

  await saveLimit(page, '300.5');

  expect(puts).toHaveLength(1);
  expect(puts[0]!.postDataJSON()).toEqual({ category: 'food', limit: usd(30_050) });
  expect(puts[0]!.headers()['x-expected-user']).toBe(user.email);
  await expect(amounts(page)).toHaveText(['$250.00', '$300.50', '$250.00', '$250.00', '$250.00', '$250.00']);
  await expect(adjustOf(page, 'Food')).toBeFocused();

  await page.reload();
  await expect(amounts(page)).toHaveText(['$250.00', '$300.50', '$250.00', '$250.00', '$250.00', '$250.00']);
});

// T25: AC9 and AC10, each user's own limits; the write guard and a category outside the six (#39, #119).
test('keeps another user’s limits apart, refuses another user’s email and a category outside the six', async ({
  page,
  browser,
}) => {
  // The second user signs up first, in a context of their own, so IDs never equal positions.
  const otherContext = await browser.newContext({ timezoneId: 'Europe/Belgrade' });
  const otherPage = await otherContext.newPage();
  const other = await signUp(otherPage.request);
  const user = await openGoals(page);
  await openLimit(page, 'Food');
  await saveLimit(page, '300.5');
  await expect(amountOf(cardOf(page, 'Food'))).toHaveText('$300.50');

  await otherPage.goto('/goals');
  await expect(amounts(otherPage)).toHaveText(Array(6).fill('$250.00'));
  await otherContext.close();

  const asOther = await page.request.put('/api/category-limits', {
    headers: { 'X-Expected-User': other.email },
    data: { category: 'housing', limit: usd(1) },
  });
  expect(asOther.status()).toBe(409);
  const bills = await page.request.put('/api/category-limits', {
    headers: { 'X-Expected-User': user.email },
    data: { category: 'bills', limit: usd(30_050) },
  });
  expect(bills.status()).toBe(400);
  expect(await bills.json()).toEqual({
    message: 'Validation failed',
    fieldErrors: { category: 'Enter a valid category' },
  });

  await page.reload();
  await expect(amounts(page)).toHaveText(['$250.00', '$300.50', '$250.00', '$250.00', '$250.00', '$250.00']);
  const read = await page.request.get('/api/category-limits');
  expect(((await read.json()) as { limits: { category: string }[] }).limits.map((entry) => entry.category)).toEqual([
    'housing',
    'food',
    'transportation',
    'entertainment',
    'shopping',
    'others',
  ]);
});

// T26: AC8, the Target rules, one request while saving, a 500 (US-17 criteria 6, 7 and 10; #6, #31, #64, #108 a).
test('shows each broken rule under the field, sends one request while saving, and a 500 above Save', async ({
  page,
}) => {
  await openGoals(page);
  const puts = limitPuts(page);
  await openLimit(page, 'Shopping');

  for (const [text, message] of [
    ['', 'Target Amount is required'],
    ['.', 'Target Amount is required'],
    ['0', 'Target Amount must be greater than $0.00'],
    ['1000000000.01', 'Target Amount must be at most $1,000,000,000.00'],
  ] as const) {
    await targetField(page).fill(text);
    await saveButton(page).click();
    await expect(dialog(page).getByText(message, { exact: true })).toBeVisible();
    await expect(targetField(page)).toHaveAccessibleDescription(message);
  }
  expect(puts).toHaveLength(0);
  // Typed characters per #64: no letters, comma, minus or third decimal.
  await targetField(page).fill('');
  await targetField(page).pressSequentially('1a2,3-4.567');
  await expect(targetField(page)).toHaveValue('1234.56');

  const held: Route[] = [];
  await page.route('**/api/category-limits', async (route) => {
    if (route.request().method() === 'PUT') held.push(route);
    else await route.continue();
  });
  await targetField(page).fill('400');
  await saveButton(page).click();
  await expect(saveButton(page)).toHaveAttribute('aria-busy', 'true');
  await expect(saveButton(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(saveButton(page)).toBeFocused();
  await saveButton(page).click({ force: true });
  await targetField(page).press('Enter');
  await expect.poll(() => held.length).toBe(1);
  expect(puts).toHaveLength(1);

  await held[0]!.fulfill({ status: 500, json: { message: 'Internal server error' } });

  await expect(dialog(page).getByRole('alert')).toHaveText('Something went wrong.');
  await expect(targetField(page)).toHaveValue('400');
  await expect(saveButton(page)).not.toHaveAttribute('aria-disabled');
  await page.unroute('**/api/category-limits');
  await saveButton(page).click();
  await expect(dialog(page)).toBeHidden();
  await expect(amountOf(cardOf(page, 'Shopping'))).toHaveText('$400.00');
});

/** Picks a month in a Goals selector with the mouse; the open list hides the page, so the option is found on it. */
async function pick(page: Page, selector: 'Savings Goal' | 'Saving Summary', label: string) {
  const combobox = goals(page).getByRole('combobox', { name: selector, exact: true });
  await combobox.click();
  await page.getByRole('option', { name: label, exact: true }).click();
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(combobox).toHaveText(label);
}

// T27: AC6 and AC7, after a save only the limits are asked for; the months never change the cards (#32).
test('asks only for the limits after a save, and keeps the cards when either selector picks another month', async ({
  page,
}) => {
  await openGoals(page);
  await expect(meter(page)).toBeVisible();
  await expect(goals(page).getByRole('table')).toBeAttached();
  const sent = apiRequests(page);

  await openLimit(page, 'Entertainment');
  await saveLimit(page, '275');
  await expect(amountOf(cardOf(page, 'Entertainment'))).toHaveText('$275.00');
  await expect.poll(() => sent.filter((request) => request === 'GET /api/category-limits').length).toBe(1);
  await page.waitForTimeout(300);
  expect(sent).toEqual(['PUT /api/category-limits', 'GET /api/category-limits']);

  sent.length = 0;
  await pick(page, 'Savings Goal', 'Mar, 2026');
  await pick(page, 'Saving Summary', 'Mar, 2026');
  await page.waitForTimeout(300);
  expect(sent.filter((request) => request.includes('/category-limits'))).toEqual([]);
  await expect(amounts(page)).toHaveText(['$250.00', '$250.00', '$250.00', '$275.00', '$250.00', '$250.00']);

  await page.reload();
  await expect(amounts(page)).toHaveText(['$250.00', '$250.00', '$250.00', '$275.00', '$250.00', '$250.00']);
  expect(sent.filter((request) => request.includes('/category-limits'))).toEqual(['GET /api/category-limits']);
});

// T28: AC15, the keyboard path to the six "Adjust" and through the popup, the ring on keyboard focus only (#35, #87).
test('tabs to the six "Adjust" in order with the ring, opens the popup by keys, and shows no ring on a click', async ({
  page,
}) => {
  await openGoals(page);
  await expect(goals(page).getByRole('table')).toBeAttached();

  await goals(page).getByRole('combobox', { name: 'Saving Summary', exact: true }).focus();
  for (const name of NAMES) {
    await page.keyboard.press('Tab');
    await expect(adjustOf(page, name)).toBeFocused();
    await expectRing(page, adjustOf(page, name));
    await expect(adjustOf(page, name)).toHaveAccessibleDescription(name);
  }

  await adjustOf(page, 'Housing').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Adjust limit for Housing' })).toBeVisible();
  await expect(targetField(page)).toBeFocused();
  for (const next of [saveButton(page), closeButton(page)]) {
    await page.keyboard.press('Tab');
    await expect(next).toBeFocused();
  }
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(adjustOf(page, 'Housing')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(targetField(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();

  // A mouse press focuses "Adjust" with no ring, once a click elsewhere has taken the keyboard's focus away.
  const others = await box(cardOf(page, 'Others'));
  await page.mouse.click(others.x + 10, others.y + 10);
  const button = await box(adjustOf(page, 'Shopping'));
  await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2);
  await page.mouse.down();
  await expect(adjustOf(page, 'Shopping')).toBeFocused();
  expect(await adjustOf(page, 'Shopping').evaluate((node) => node.matches(':focus-visible'))).toBe(false);
  expect(await computed(adjustOf(page, 'Shopping'), 'outline-style')).toBe('none');
  await page.mouse.move(5, 5);
  await page.mouse.up();
});

// T29: AC14, the states (#6, #88, #89, #105 a, #114, #116).
test('shows six skeleton cards at 104, then the error card across the grid, the rest working, and Retry loads', async ({
  page,
}) => {
  await signUp(page.request);
  const state = { mode: 'hold' as 'hold' | 'fail' | 'pass', held: [] as Route[] };
  await page.route('**/api/category-limits', async (route) => {
    if (route.request().method() !== 'GET' || state.mode === 'pass') await route.continue();
    else if (state.mode === 'hold') state.held.push(route);
    else await route.fulfill({ status: 500, json: { message: 'Internal server error' } });
  });
  await page.goto('/goals');

  const busy = categories(page).locator('[aria-busy="true"]');
  await expect(busy).toBeVisible();
  await expect(categories(page).getByRole('button')).toHaveCount(0);
  // DataState's hidden wrapper, the grid, then the six cards.
  const skeletonCards = busy.locator(':scope > div > div > div');
  await expect(skeletonCards).toHaveCount(6);
  for (const card of await skeletonCards.all()) expect((await box(card)).height).toBe(104);
  await expect(meter(page)).toBeVisible();

  state.mode = 'fail';
  for (const route of state.held.splice(0))
    await route.fulfill({ status: 500, json: { message: 'Internal server error' } });
  await expect(categories(page).getByRole('alert')).toHaveText('Something went wrong.', { timeout: 15_000 });
  const errorCard = categories(page).locator(':scope > div').last();
  const errorBox = await box(errorCard);
  expect(errorBox.height).toBeGreaterThanOrEqual(224);
  const goalsCard = await box(goals(page).locator(':scope > div').last().locator(':scope > div').first());
  const summaryCard = await box(goals(page).locator(':scope > div').last().locator(':scope > div').nth(1));
  near(errorBox.x, goalsCard.x, 'error card from the grid’s left');
  near(errorBox.x + errorBox.width, summaryCard.x + summaryCard.width, 'error card to the grid’s right');
  expect(await computed(errorCard, 'background-color')).toBe(await tokenColor(page, '--color-white'));
  await expect(goals(page).getByRole('button', { name: 'Adjust Goal' })).toBeEnabled();

  state.mode = 'pass';
  await categories(page).getByRole('button', { name: 'Retry' }).click();
  await expect(amounts(page)).toHaveText(Array(6).fill('$250.00'));
  await expect(categories(page).getByRole('alert')).toHaveCount(0);
});

// T29, AC14 (#105 a; task 027 code review): the skeleton cards as high as the loaded cards with the demo limits, at
// 1440 (104) and at 1280 (152, the page 1265 wide with headless Chromium's classic scrollbar: "Adjust" under the text).
for (const width of [1440, 1280]) {
  test(`keeps the skeleton cards as high as the loaded cards at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1024 });
    await signUp(page.request);
    const held: Route[] = [];
    await page.route('**/api/category-limits', async (route) => {
      if (route.request().method() === 'GET' && held.length === 0) held.push(route);
      else await route.continue();
    });
    await page.goto('/goals');
    const skeletonCards = categories(page).locator('[aria-busy="true"] > div > div > div');
    await expect(skeletonCards).toHaveCount(6);
    const skeleton = await Promise.all((await skeletonCards.all()).map(async (card) => (await box(card)).height));

    await held[0]!.continue();
    await expect(amounts(page)).toHaveText(Array(6).fill('$250.00'));
    const loaded = await Promise.all((await cards(page).all()).map(async (card) => (await box(card)).height));

    expect(skeleton).toEqual(loaded);
    expect(loaded).toEqual(Array(6).fill(width === 1440 ? 104 : 152));
  });
}

// T18 in the browser, AC13 (#125 a; task 027 code review): "No limit set" in the amount's place keeps the text column's
// 52, so the card's name is level with its row's names.
test('shows "No limit set" for a category without a row, its name level with the row’s', async ({ page }) => {
  await signUp(page.request);
  await page.route('**/api/category-limits', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch();
    const body = (await response.json()) as { limits: { category: string; limit: unknown }[] };
    await route.fulfill({
      response,
      json: { limits: body.limits.map((entry) => (entry.category === 'food' ? { ...entry, limit: null } : entry)) },
    });
  });
  await page.goto('/goals');
  await expect(cardOf(page, 'Food').getByText('No limit set', { exact: true })).toBeVisible();

  const nameTops = await Promise.all(
    ['Housing', 'Food', 'Transportation'].map(async (name) => (await box(nameOf(cardOf(page, name)))).y),
  );
  expect(nameTops[1]).toBe(nameTops[0]);
  expect(nameTops[2]).toBe(nameTops[0]);
  near((await box(cardOf(page, 'Food'))).height, 104, 'Food 104 high');
  expect(await computed(cardOf(page, 'Food').getByText('No limit set'), 'color')).toBe(
    await tokenColor(page, '--color-gray-01'),
  );
  expect(await computed(cardOf(page, 'Food').getByText('No limit set'), 'font-size')).toBe('14px');
});

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;
const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x - 0.5 &&
  inner.y >= outer.y - 0.5 &&
  inner.x + inner.width <= outer.x + outer.width + 0.5 &&
  inner.y + inner.height <= outer.y + outer.height + 0.5;

/** A card's boxes: the card, the tile, the name, the amount and "Adjust". */
async function cardBoxes(card: Locator) {
  return {
    card: await box(card),
    tile: await box(tileOf(card)),
    name: await box(nameOf(card)),
    amount: await box(amountOf(card)),
    adjust: await box(card.getByRole('button', { name: 'Adjust', exact: true })),
  };
}

/**
 * AC17: in each card nothing overlaps or leaves it; the tile 24 from the left; "Adjust" at the right edge, beside the
 * text or under it, right-aligned and 16 below; each name on one line; a row's cards one height; no horizontal scroll.
 * Returns whether each card has "Adjust" under its text.
 */
async function expectCards(page: Page) {
  const wrapped: boolean[] = [];
  const all = await Promise.all((await cards(page).all()).map(cardBoxes));
  for (const [index, parts] of all.entries()) {
    const what = NAMES[index]!;
    const shown = [parts.tile, parts.name, parts.amount, parts.adjust];
    for (const [a, first] of shown.entries()) {
      expect(inside(first, parts.card), `${what}: part ${a} inside the card`).toBe(true);
      for (const second of shown.slice(a + 1)) expect(overlaps(first, second), `${what}: parts overlap`).toBe(false);
    }
    near(parts.tile.x, parts.card.x + 24, `${what}: tile 24 in`);
    near(parts.name.x, parts.tile.x + 40 + 16, `${what}: text 16 after the tile`);
    near(parts.adjust.x + parts.adjust.width, parts.card.x + parts.card.width - 24, `${what}: Adjust at the right`);
    near(parts.adjust.height, 36, `${what}: Adjust 36 high`);
    // No name breaks: one 24 line.
    near(parts.name.height, 24, `${what}: the name on one line`);
    const under = parts.adjust.y >= parts.amount.y + parts.amount.height - 0.5;
    if (under) near(parts.adjust.y, parts.amount.y + parts.amount.height + 16, `${what}: Adjust 16 under the text`);
    else
      expect(parts.adjust.x - (parts.amount.x + parts.amount.width), `${what}: 16 at least`).toBeGreaterThanOrEqual(
        15.5,
      );
    wrapped.push(under);
  }
  for (const row of [all.slice(0, 3), all.slice(3)]) {
    for (const parts of row) near(parts.card.height, row[0]!.card.height, 'one height per row');
  }
  const right = await page.evaluate(() => document.body.getBoundingClientRect().right);
  expect(await page.evaluate(() => document.documentElement.scrollWidth), 'no horizontal scroll').toBe(
    Math.round(right),
  );
  return { wrapped, boxes: all };
}

// T30: AC17, 110's places at 1440x1024, wider at 1920 and 2560, "Adjust" under the text at 1280 and with a long limit.
test('places each card’s parts where 110 does, keeps them wider, and moves "Adjust" under the text where it must', async ({
  page,
}) => {
  await openGoals(page);

  const at1440 = await expectCards(page);
  expect(at1440.wrapped).toEqual([false, false, false, false, false, false]);
  for (const [index, parts] of at1440.boxes.entries()) {
    const what = NAMES[index]!;
    near(parts.card.height, 104, `${what}: 104 high`);
    // 110: the tile 28 from the top, the text's two lines 52 high centred, "Adjust" 34 from the top, 99 wide.
    near(parts.tile.y, parts.card.y + 28, `${what}: tile 28 down`);
    near(parts.name.y, parts.card.y + 26, `${what}: name line 26 down`);
    near(parts.amount.y, parts.name.y + 24 + 4, `${what}: amount 4 under the name`);
    near(parts.adjust.y, parts.card.y + 34, `${what}: Adjust 34 down`);
    // 110's 99 less 1, as "Adjust Goal"'s 142 less 2 (task 025): the label in Inter 14 (about 42) and the 8 to the
    // pencil on the 4px grid, measured about 7 to 9; the 16 at the sides as measured (#65).
    near(parts.adjust.width, 98, `${what}: Adjust 98 wide`, 0.5);
  }
  const adjust = adjustOf(page, 'Housing');
  expect([await computed(adjust, 'padding-left'), await computed(adjust, 'padding-right')]).toEqual(['15px', '15px']);
  expect(await computed(adjust, 'border-left-width')).toBe('1px');
  expect(await page.evaluate(() => document.documentElement.scrollHeight), 'no scroll at 1440x1024').toBe(1024);
  // "Adjust Goal" keeps its 20 at the sides (task 025): 140 wide.
  near((await box(goals(page).getByRole('button', { name: 'Adjust Goal' }))).width, 140, 'Adjust Goal 140 wide', 1);

  for (const [width, height] of [
    [1920, 1080],
    [2560, 1440],
  ] as const) {
    await page.setViewportSize({ width, height });
    const wider = await expectCards(page);
    expect(wider.wrapped, `${width}: nothing wraps`).toEqual([false, false, false, false, false, false]);
    for (const parts of wider.boxes) near(parts.card.height, 104, `${width}: 104 high`);
  }

  // Headless Chromium keeps a classic scrollbar's 15 px, so the page is 1265 wide: every "Adjust" under its text (#101).
  await page.setViewportSize({ width: 1280, height: 1024 });
  const at1280 = await expectCards(page);
  expect(at1280.wrapped).toEqual([true, true, true, true, true, true]);
  for (const parts of at1280.boxes) expect(parts.card.height).toBeGreaterThan(104);

  await page.setViewportSize({ width: 1440, height: 1024 });
  await openLimit(page, 'Transportation');
  await saveLimit(page, '1000000000');
  await expect(amountOf(cardOf(page, 'Transportation'))).toHaveText('$1,000,000,000.00');
  const long = await expectCards(page);
  expect(long.wrapped).toEqual([false, false, true, false, false, false]);
  expect(long.boxes[2]!.card.height).toBeGreaterThan(104);
  near(long.boxes[0]!.card.height, long.boxes[2]!.card.height, 'Housing as tall as Transportation');
  near(long.boxes[3]!.card.height, 104, 'the second row 104');

  // A short window: the page scrolls and ends 32 under the last card (#111).
  await page.setViewportSize({ width: 1440, height: 600 });
  const { pageEnd, lastBottom } = await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const items = [...document.querySelectorAll('main section')].at(-1)!.querySelectorAll('li');
    return {
      pageEnd: document.documentElement.scrollHeight,
      lastBottom: items[items.length - 1]!.getBoundingClientRect().bottom + window.scrollY,
    };
  });
  near(pageEnd, lastBottom + 32, 'page end 32 under the last card', 1);
});
