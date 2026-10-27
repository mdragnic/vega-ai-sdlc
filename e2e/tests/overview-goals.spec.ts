import type { Locator, Page, Request, Route } from '@playwright/test';

import { FRONTEND_URL, TIME_ZONE } from '../constants';
import { expect, test } from '../fixtures';
import {
  box,
  computed,
  expectBillAmountsUnderText,
  expectNoRingOnMouseFocus,
  expectRing,
  newUser,
  signUp,
  tokenColor,
  within2,
} from '../helpers';

const region = (page: Page, name: string) => page.getByRole('main').getByRole('region', { name });
const goals = (page: Page) => region(page, 'Goals');
/** The white card of a section: the element after its title row. */
const card = (section: Locator) => section.locator(':scope > div').last();
const pencil = (page: Page) => goals(page).getByRole('button', { name: 'Edit savings goal' });
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Edit savings goal' });
const targetField = (page: Page) => dialog(page).getByRole('textbox', { name: 'Target Amounts' });
const presentField = (page: Page) => dialog(page).getByRole('textbox', { name: 'Present Amounts' });
const saveButton = (page: Page) => dialog(page).getByRole('button', { name: 'Save' });
const closeButton = (page: Page) => dialog(page).getByRole('button', { name: 'Close' });
const meter = (page: Page) => goals(page).getByRole('meter', { name: 'Target vs Achievement' });
const overlayOf = (popup: Locator) => popup.locator('xpath=preceding-sibling::*[1]');
/** The amount after a term ("Target Achieved", "This month Target"). */
const amountOf = (page: Page, term: string) =>
  goals(page).getByRole('term').filter({ hasText: term }).locator('xpath=following-sibling::dd[1]');

const moveBackendClock = async (page: Page, now: string) =>
  expect((await page.request.put('/api/test/clock', { data: { now } })).ok()).toBe(true);

/** Signs up a new user and opens Overview with the demo goal, and the bills, so the top row has its height (#111 a). */
async function openOverview(page: Page) {
  await signUp(page.request);
  await page.goto('/overview');
  await expect(meter(page)).toBeVisible();
  await expect(region(page, 'Upcoming Bill').getByRole('listitem')).toHaveCount(2);
}

/** The `PUT /api/savings-goals` requests the page sends, from now on. */
function goalPuts(page: Page): Request[] {
  const puts: Request[] = [];
  page.on('request', (request) => {
    if (request.method() === 'PUT' && new URL(request.url()).pathname === '/api/savings-goals') puts.push(request);
  });
  return puts;
}

const usd = (cents: number) => ({ cents, currency: 'USD' });

async function expectDemoCard(page: Page, target: string, present: string, month: string) {
  await expect(card(goals(page))).toContainText(`${target}${month}`);
  await expect(amountOf(page, 'Target Achieved')).toHaveText(present);
  await expect(amountOf(page, 'This month Target')).toHaveText(target);
}

// T22: the first login's Goals card (AC1, AC2; #11, #18, #58, demo-data.md).
test('shows the demo goal of Oct 2026 with the pencil, the amounts and the gauge', async ({ page }) => {
  await openOverview(page);

  await expectDemoCard(page, '$20,000.00', '$16,250.00', 'Oct, 2026');
  await expect(pencil(page)).toBeVisible();
  await expect(goals(page).getByRole('term')).toHaveText(['Target Achieved', 'This month Target']);
  for (const term of await goals(page).getByRole('term').all()) {
    await expect(term.locator('svg')).toHaveAttribute('aria-hidden', 'true');
    await expect(term.locator('svg')).toBeVisible();
  }
  await expect(meter(page)).toHaveAttribute('aria-valuenow', '0.8125');
  await expect(meter(page).locator('text')).toHaveText(['$0', '$16.2k', '$20k']);
});

// T23: AC3, the month from the backend's clock in the browser's zone (#54, #58, #80).
test('shows November in Belgrade and October in New York at 2026-10-31T23:30:00Z', async ({ page, browser }) => {
  await signUp(page.request);
  await moveBackendClock(page, '2026-10-31T23:30:00Z');

  await page.goto('/overview');
  await expectDemoCard(page, '$20,000.00', '$17,000.00', 'Nov, 2026');

  const newYork = await browser.newContext({
    baseURL: FRONTEND_URL,
    timezoneId: 'America/New_York',
    storageState: await page.context().storageState(),
  });
  const nyPage = await newYork.newPage();
  await nyPage.goto('/overview');
  await expectDemoCard(nyPage, '$20,000.00', '$16,250.00', 'Oct, 2026');
  await newYork.close();
});

// T24: AC4, AC5, AC6, AC12: the popup over the content area, closing it, and a save (#11, #31, #35, #64, #84, #90).
test('opens the popup over the content area, closes it each way, and saves a goal', async ({ page }) => {
  await openOverview(page);
  const puts = goalPuts(page);

  await pencil(page).click();
  await expect(dialog(page)).toBeVisible();
  await expect(targetField(page)).toHaveValue('20000');
  await expect(presentField(page)).toHaveValue('16250');
  await expect(targetField(page)).toBeFocused();
  await expect(closeButton(page)).toBeVisible();
  // The `$` shows before both prefilled values (#64).
  await expect(targetField(page).locator('..')).toHaveText('$');
  await expect(presentField(page).locator('..')).toHaveText('$');
  // Only the content area is dimmed: right of the sidebar, below the header (#35).
  const overlay = overlayOf(dialog(page));
  const overlayBox = await box(overlay);
  expect({ x: overlayBox.x, y: overlayBox.y }).toEqual({ x: 280, y: 88 });
  expect(await computed(overlay, 'background-color')).toBe(await tokenColor(page, '--color-default-black-15'));
  // The panel's top edge at y 276, centered on the content area (#90 c).
  const panel = await box(dialog(page));
  expect(panel.y).toBe(276);
  within2(panel.x + panel.width / 2, overlayBox.x + overlayBox.width / 2, 'panel center');

  // The sidebar is blocked: a click there does nothing.
  await page.mouse.click(140, 300);
  await expect(dialog(page)).toBeVisible();
  await expect(page).toHaveURL(`${FRONTEND_URL}/overview`);

  for (const close of [
    () => page.keyboard.press('Escape'),
    () => closeButton(page).click(),
    () => page.mouse.click(1300, 990),
  ]) {
    await targetField(page).fill('99');
    await close();
    await expect(dialog(page)).toBeHidden();
    await expect(pencil(page)).toBeFocused();
    await pencil(page).click();
    await expect(targetField(page)).toHaveValue('20000');
  }
  expect(puts).toHaveLength(0);

  await targetField(page).fill('25000.5');
  await presentField(page).fill('');
  await saveButton(page).click();

  await expect(dialog(page)).toBeHidden();
  expect(puts).toHaveLength(1);
  expect(puts[0]!.postDataJSON()).toEqual({ month: '2026-10', target: usd(2_500_050), present: usd(0) });
  expect(puts[0]!.headers()['x-time-zone']).toBe(TIME_ZONE);
  await expectDemoCard(page, '$25,000.50', '$0.00', 'Oct, 2026');
  await expect(meter(page).locator('text')).toHaveText(['$0', '$0', '$25k']);

  await page.reload();
  await expectDemoCard(page, '$25,000.50', '$0.00', 'Oct, 2026');
  await pencil(page).click();
  await expect(targetField(page)).toHaveValue('25000.50');
  await expect(presentField(page)).toHaveValue('0');
});

// T25: AC7, AC8: rejected text never stands; a broken rule sends nothing (#64, #87, #108 a).
test('rejects typed and pasted characters, and shows each broken rule under its field', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openOverview(page);
  const puts = goalPuts(page);
  await pencil(page).click();

  for (const field of [targetField(page), presentField(page)]) {
    await field.fill('');
    await field.pressSequentially('12a,$ -5.255.');
    await expect(field).toHaveValue('125.25');
    for (const text of ['1,000', '12.345', '$5', '-5', 'abc', '1 000']) {
      await page.evaluate((value) => navigator.clipboard.writeText(value), text);
      await page.keyboard.press('ControlOrMeta+V');
      await expect(field).toHaveValue('125.25');
    }
  }

  const red = await tokenColor(page, '--color-special-red');
  for (const [target, present, field, message] of [
    ['', '16250', 'target', 'Target Amount is required'],
    ['.', '16250', 'target', 'Target Amount is required'],
    ['0', '16250', 'target', 'Target Amount must be greater than $0.00'],
    ['1000000000.01', '16250', 'target', 'Target Amount must be at most $1,000,000,000.00'],
    ['20000', '1000000000.01', 'present', 'Present Amount must be at most $1,000,000,000.00'],
  ] as const) {
    await targetField(page).fill(target);
    await presentField(page).fill(present);
    await saveButton(page).click();

    const input = field === 'target' ? targetField(page) : presentField(page);
    await expect(input).toHaveAccessibleDescription(message);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog(page).getByText(message)).toBeVisible();
    expect(await computed(input.locator('..'), 'border-top-color')).toBe(red);
  }
  expect(puts).toHaveLength(0);
});

// T26: AC9: one request while it runs, then the server error above Save (#6, #97 a).
test('sends one request while saving, with Save disabled and its spinner, then shows a 500 above Save', async ({
  page,
}) => {
  await openOverview(page);
  const puts = goalPuts(page);
  const held: Route[] = [];
  await page.route('**/api/savings-goals', async (route) => {
    if (route.request().method() === 'PUT') held.push(route);
    else await route.continue();
  });
  await pencil(page).click();
  await targetField(page).fill('30000');

  await saveButton(page).click();
  await expect(saveButton(page)).toHaveAttribute('aria-busy', 'true');
  await expect(saveButton(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(saveButton(page)).toBeFocused();
  // Playwright waits for an aria-disabled button to become enabled; a user's click does not wait.
  await saveButton(page).click({ force: true });
  await targetField(page).press('Enter');
  await expect.poll(() => held.length).toBe(1);
  expect(puts).toHaveLength(1);

  await held[0]!.fulfill({ status: 500, json: { message: 'Internal server error' } });
  await expect(dialog(page).getByRole('alert')).toHaveText('Something went wrong.');
  await expect(targetField(page)).toHaveValue('30000');
  await expect(saveButton(page)).not.toHaveAttribute('aria-disabled', 'true');
  const alertBox = await box(dialog(page).getByRole('alert'));
  expect(alertBox.y + alertBox.height).toBeLessThanOrEqual((await box(saveButton(page))).y);
});

// T27: AC10: a month with no goal (the demo goals end in Dec 2028), and creating one (#58, #69, #71, #85, #108 c).
test('shows "No goal for this month" in Jan 2029 and creates the month’s goal', async ({ page }) => {
  // Signed up after the clock moves: a session from 2026 would have expired by 2029 (30 days, #14).
  await moveBackendClock(page, '2029-01-15T10:00:00Z');
  await signUp(page.request);
  await page.goto('/overview');

  await expect(goals(page).getByText('No goal for this month')).toBeVisible();
  await expect(card(goals(page))).toHaveText('Jan, 2029No goal for this month');
  await expect(meter(page)).toHaveCount(0);
  await pencil(page).click();
  await expect(targetField(page)).toHaveValue('');
  await expect(presentField(page)).toHaveValue('');
  await expect(presentField(page)).toHaveAttribute('placeholder', 'Write present amount here');
  // An empty Target shows the `$` alone; an empty Present its placeholder alone (#69, #71, #90 b).
  await expect(targetField(page).locator('..').locator('[aria-hidden="true"]')).toBeVisible();
  await expect(presentField(page).locator('..').locator('[aria-hidden="true"]')).toBeHidden();

  await saveButton(page).click();
  await expect(targetField(page)).toHaveAccessibleDescription('Target Amount is required');
  await targetField(page).fill('500');
  await saveButton(page).click();

  await expect(dialog(page)).toBeHidden();
  await expectDemoCard(page, '$500.00', '$0.00', 'Jan, 2029');
  await page.reload();
  await expectDemoCard(page, '$500.00', '$0.00', 'Jan, 2029');
});

// T28: AC17: another tab switches the user; this tab keeps nothing of the earlier user (#3, #39).
test('closes the popup and shows the new user’s goal when another tab signs in someone else', async ({
  page,
  context,
}) => {
  await signUp(page.request);
  const saved = await page.request.put('/api/savings-goals', {
    headers: { 'X-Time-Zone': TIME_ZONE },
    data: { month: '2026-10', target: usd(3_000_000), present: usd(1_625_000) },
  });
  expect(saved.status()).toBe(200);
  await page.goto('/overview');
  await expectDemoCard(page, '$30,000.00', '$16,250.00', 'Oct, 2026');
  await pencil(page).click();
  await targetField(page).fill('45000');

  const second = await context.newPage();
  expect((await second.request.post('/api/auth/logout')).status()).toBe(204);
  const signedUp = await second.request.post('/api/auth/signup', { data: { ...newUser(), fullName: 'Ada Lovelace' } });
  expect(signedUp.status()).toBe(201);
  await second.close();
  await page.bringToFront();
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));

  await expect(dialog(page)).toBeHidden();
  await expect(page.getByText('Hello Ada')).toBeVisible();
  await expectDemoCard(page, '$20,000.00', '$16,250.00', 'Oct, 2026');
  await expect(page.getByText('$30,000.00')).toHaveCount(0);
  await pencil(page).click();
  await expect(targetField(page)).toHaveValue('20000');
});

// T29: AC19: keyboard use and the focus ring (#35, #87).
test('reaches the pencil by Tab with the teal ring, and tabs through the popup', async ({ page }) => {
  await openOverview(page);

  await region(page, 'Total Balance').getByRole('button', { name: 'Next' }).focus();
  await page.keyboard.press('Tab');
  await expect(pencil(page)).toBeFocused();
  await expectRing(page, pencil(page));

  await page.keyboard.press('Enter');
  await expect(targetField(page)).toBeFocused();
  for (const next of [presentField(page), saveButton(page), closeButton(page), targetField(page)]) {
    await page.keyboard.press('Tab');
    await expect(next).toBeFocused();
  }
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(pencil(page)).toBeFocused();
  await page.keyboard.press('Space');
  await expect(targetField(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(pencil(page)).toBeFocused();

  // A mouse press elsewhere takes focus away; a mouse press on the pencil focuses it with no ring.
  await page.mouse.click(700, 40);
  await expect(pencil(page)).not.toBeFocused();
  await expectNoRingOnMouseFocus(page, pencil(page));
});

// T30: AC18: the skeleton, the error state after the retries, and Retry (#6, #88, #105 a).
test('shows the skeleton while the goal loads, the error state after the retries, and the goal after Retry', async ({
  page,
}) => {
  await signUp(page.request);
  let mode: 'hold' | 'fail' | 'pass' = 'hold';
  const held: Route[] = [];
  await page.route('**/api/savings-goals/current', async (route) => {
    if (mode === 'hold') held.push(route);
    else if (mode === 'fail') await route.fulfill({ status: 500, json: { message: 'Internal server error' } });
    else await route.continue();
  });
  // The demo bills grow the top row at 1440 (#111 a, task 015): held while the 232 minimum is checked.
  const heldBills: Route[] = [];
  await page.route('**/api/bills/upcoming', (route) => heldBills.push(route));

  await page.goto('/overview');
  const busy = goals(page).locator('[aria-busy="true"]');
  await expect(busy).toBeVisible();
  expect((await box(card(goals(page)))).height).toBe(232);
  await expect(pencil(page)).toHaveCount(0);
  await expect(region(page, 'Total Balance').getByText('$130,254.67')).toBeVisible();

  mode = 'fail';
  for (const route of held.splice(0)) await route.fulfill({ status: 500, json: { message: 'Internal server error' } });
  await expect(goals(page).getByRole('alert')).toHaveText('Something went wrong.', { timeout: 15_000 });
  await expect(busy).toHaveCount(0);
  expect((await box(card(goals(page)))).height).toBe(232);
  await expect(region(page, 'Upcoming Bill').getByRole('link', { name: 'View All' })).toBeVisible();

  mode = 'pass';
  for (const route of heldBills.splice(0)) await route.continue();
  await page.unroute('**/api/bills/upcoming');
  await goals(page).getByRole('button', { name: 'Retry' }).click();
  await expectDemoCard(page, '$20,000.00', '$16,250.00', 'Oct, 2026');
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
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The box of an element's own text, not of its element or of an icon inside it. */
const textBox = (locator: Locator) =>
  locator.evaluate((element) => {
    const texts = [...element.childNodes].filter(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
    );
    const range = document.createRange();
    range.setStartBefore(texts[0]!);
    range.setEndAfter(texts.at(-1)!);
    const { x, y, width, height } = range.getBoundingClientRect();
    return { x, y, width, height };
  });

/** The parts of the Goals card that must not overlap: texts, icons, the pencil and the gauge. */
async function cardParts(page: Page): Promise<[string, Box][]> {
  const content = card(goals(page));
  const parts: [string, Box][] = [
    ['target', await textBox(content.locator('p').first())],
    ['pencil', await box(pencil(page))],
    ['month', await textBox(content.getByText(/^[A-Z][a-z]{2}, \d{4}$/))],
    ['gauge', await box(meter(page).locator('svg'))],
    ['caption', await textBox(meter(page).locator('p'))],
  ];
  for (const [index, term] of (await goals(page).getByRole('term').all()).entries()) {
    parts.push([`icon ${index + 1}`, await box(term.locator('svg'))]);
    parts.push([`label ${index + 1}`, await textBox(term)]);
    parts.push([`amount ${index + 1}`, await textBox(term.locator('xpath=following-sibling::dd[1]'))]);
  }
  return parts;
}

/** The Goals card's content box: the card inset 24 at the sides and 20 at the top and the bottom. */
async function contentBox(page: Page): Promise<Box> {
  const cardBox = await box(card(goals(page)));
  return { x: cardBox.x + 24, y: cardBox.y + 20, width: cardBox.width - 48, height: cardBox.height - 40 };
}

async function expectNothingOverlapsOrIsCut(page: Page) {
  const content = await contentBox(page);
  const cardBox = await box(card(goals(page)));
  const parts = await cardParts(page);
  for (const [name, part] of parts) expect(inside(part, content), `${name} inside the content box`).toBe(true);
  for (const [i, [nameA, a]] of parts.entries()) {
    for (const [nameB, b] of parts.slice(i + 1)) {
      if (nameA === 'gauge' && nameB === 'caption') continue;
      expect(overlaps(a, b), `${nameA} and ${nameB}`).toBe(false);
    }
  }
  // The gauge's labels are drawn in its SVG and may reach past the arc: inside the card, over no other text.
  for (const label of await meter(page).locator('text').all()) {
    const labelBox = await box(label);
    expect(inside(labelBox, cardBox), `gauge label ${await label.textContent()} inside the card`).toBe(true);
    for (const [name, part] of parts.filter(([partName]) => !['gauge', 'caption'].includes(partName))) {
      expect(overlaps(labelBox, part), `gauge label and ${name}`).toBe(false);
    }
  }
  for (const text of [card(goals(page)).locator('p').first(), ...(await card(goals(page)).locator('dd').all())]) {
    expect(await text.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  }
  const heights = await Promise.all(
    ['Total Balance', 'Goals', 'Upcoming Bill'].map(async (name) => (await box(card(region(page, name)))).height),
  );
  expect(new Set(heights).size, `top row heights ${heights.join(', ')}`).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(Math.round(await pageRight(page)));
}

// T31 at 1440: 104's boxes, measured from the page's right edge where a classic scrollbar takes 15px (#101).
test('places the Goals card and its content where 104 does at 1440x1024', async ({ page }) => {
  await openOverview(page);
  const shift = 1440 - (await pageRight(page));
  const cardBox = await box(card(goals(page)));
  const column = 352 - shift / 3;

  // The top row grows with the Upcoming Bill rows at 1440 (#111 a, task 015); the Goals content stays at the top.
  await expectBillAmountsUnderText(page);
  const topRow = (await box(card(region(page, 'Upcoming Bill')))).height;
  expect(topRow).toBeGreaterThan(232);
  expect(cardBox).toEqual({ x: 304 + column + 24, y: 144, width: column, height: topRow });
  const right = cardBox.x + cardBox.width - 24;
  // The header row 164 to 196: the pencil box 12 after the Target, the month at the right.
  const target = await textBox(card(goals(page)).locator('p').first());
  const pencilBox = await box(pencil(page));
  expect(pencilBox).toMatchObject({ y: 164, width: 32, height: 32 });
  within2(target.x, cardBox.x + 24, 'Target x');
  within2(pencilBox.x, target.x + target.width + 12, 'pencil x');
  const month = await textBox(card(goals(page)).getByText('Oct, 2026'));
  within2(month.x + month.width, right, 'month right edge');
  expect(await computed(pencil(page), 'background-color')).toBe(await tokenColor(page, '--color-gray-06'));
  // 104: the icons at x 704 (y 234 and 302), the labels 4 after them, the gauge's arc x 872 to 1000 from y 228.
  const icons = await goals(page).getByRole('term').locator('svg').all();
  for (const [index, icon] of icons.entries()) {
    const iconBox = await box(icon);
    within2(iconBox.x, cardBox.x + 24, `icon ${index + 1} x`);
    within2(iconBox.y, [234, 302][index]!, `icon ${index + 1} y`);
  }
  const gauge = await box(meter(page).locator('svg'));
  expect({ width: gauge.width, height: gauge.height }).toEqual({ width: 128, height: 92 });
  within2(gauge.x + gauge.width, right - 8, 'gauge right edge');
  within2(gauge.y, 228, 'gauge top');
  await expectNothingOverlapsOrIsCut(page);
});

// T31: AC20 at other sizes (#94, #106, #108 b).
for (const [width, height] of [
  [1920, 1080],
  [2560, 1440],
] as const) {
  test(`stretches the Goals card with its column at ${width}x${height}, the gauge at the right edge`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await openOverview(page);
    const cardBox = await box(card(goals(page)));
    const right = await pageRight(page);

    within2(cardBox.width, (right - 32 - 304 - 48) / 3, 'card width');
    expect(cardBox.height).toBe(232);
    within2((await box(meter(page).locator('svg'))).x + 128, cardBox.x + cardBox.width - 32, 'gauge right edge');
    within2((await box(goals(page).getByRole('term').first().locator('svg'))).x, cardBox.x + 24, 'icons at the left');
    await expectNothingOverlapsOrIsCut(page);
  });
}

test('moves the month and the gauge under at 1280x1024, nothing overlapping or cut (#108 b)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1024 });
  await openOverview(page);

  const target = await box(pencil(page));
  const month = await textBox(card(goals(page)).getByText('Oct, 2026'));
  const gauge = await box(meter(page).locator('svg'));
  const lastAmount = await textBox(goals(page).locator('dd').last());
  const content = await contentBox(page);
  expect(month.y, 'month under the Target row').toBeGreaterThanOrEqual(target.y + target.height);
  within2(month.x + month.width, content.x + content.width, 'month right-aligned');
  expect(gauge.y, 'gauge under the amounts').toBeGreaterThanOrEqual(lastAmount.y + lastAmount.height);
  within2(gauge.x + gauge.width, content.x + content.width - 8, 'gauge right-aligned');
  expect((await box(card(goals(page)))).height).toBeGreaterThan(232);
  await expectNothingOverlapsOrIsCut(page);
});

test('lays out a Target and a Present of $1,000,000,000.00 at 1440x1024 with nothing overlapping or cut', async ({
  page,
}) => {
  await openOverview(page);
  await pencil(page).click();
  await targetField(page).fill('1000000000');
  await presentField(page).fill('1000000000');
  await saveButton(page).click();
  await expect(dialog(page)).toBeHidden();

  await expect(goals(page).getByText('$1,000,000,000.00')).toHaveCount(3);
  const content = await contentBox(page);
  const month = await textBox(card(goals(page)).getByText('Oct, 2026'));
  expect(month.y).toBeGreaterThanOrEqual((await box(pencil(page))).y + 32);
  within2(month.x + month.width, content.x + content.width, 'month right-aligned');
  const gauge = await box(meter(page).locator('svg'));
  expect(gauge.y).toBeGreaterThan((await textBox(goals(page).locator('dd').last())).y);
  await expectNothingOverlapsOrIsCut(page);
});
