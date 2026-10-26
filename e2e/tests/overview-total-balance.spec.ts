import type { Locator, Page, Route } from '@playwright/test';

import { FRONTEND_URL } from '../constants';
import { expect, test } from '../fixtures';
import { box, computed, expectRing, signUp, tokenColor } from '../helpers';

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const region = (page: Page, name: string) => page.getByRole('main').getByRole('region', { name });
const totalBalance = (page: Page) => region(page, 'Total Balance');
const slide = (page: Page) => totalBalance(page).getByRole('group', { name: /^Account \d+ of \d+$/ });
const previousButton = (page: Page) => totalBalance(page).getByRole('button', { name: 'Previous' });
const nextButton = (page: Page) => totalBalance(page).getByRole('button', { name: 'Next' });
const allAccounts = (page: Page) => totalBalance(page).getByRole('link', { name: 'All Accounts' });
/** The white card of a section: the element after its title row. */
const card = (section: Locator) => section.locator(':scope > div').last();

/** The 5 demo accounts on 22 Oct 2026 (demo-data.md; AC1, AC2). */
const demoSlides = [
  { type: 'Credit Card', number: '**** **** **** 2598', balance: '$21,019.18', logo: 'Mastercard' },
  { type: 'Checking', number: '**** **** **** 7310', balance: '$33,362.48', logo: 'VISA' },
  { type: 'Savings', number: '**** **** **** 4421', balance: '$27,356.80', logo: null },
  { type: 'Investment', number: '**** **** **** 6652', balance: '$29,503.00', logo: null },
  { type: 'Loan', number: '**** **** **** 9083', balance: '$19,013.21', logo: null },
] as const;

/** The full numbers stored for every user (demo-data.md), never sent (#25). */
const fullNumbers = [
  '3388455688602598',
  '6934566990127310',
  '1334568868014421',
  '6984568662016652',
  '3634568966019083',
];

/** Signs up a new user and opens Overview with its data. */
async function openOverview(page: Page) {
  await signUp(page.request);
  await page.goto('/overview');
  await expect(totalBalance(page).getByText('$130,254.67')).toBeVisible();
}

async function expectSlide(page: Page, index: number) {
  const expected = demoSlides[index]!;
  const group = totalBalance(page).getByRole('group', { name: `Account ${index + 1} of 5` });
  await expect(group).toBeVisible();
  await expect(group.locator('p')).toHaveText(['Account Type', expected.type, expected.number, expected.balance]);
  await expect(group.getByRole('img')).toHaveCount(expected.logo === null ? 0 : 1);
  if (expected.logo !== null) await expect(group.getByRole('img', { name: expected.logo })).toBeVisible();
}

const moveBackendClock = async (page: Page, now: string) =>
  expect((await page.request.put('/api/test/clock', { data: { now } })).ok()).toBe(true);

/** The right edge of the page: the window less a classic scrollbar's gutter (#101). */
const pageRight = (page: Page) => page.evaluate(() => document.body.getBoundingClientRect().right);

/** The three equal columns of the content area, from x 304 to 32 from the page's right edge, 24 apart (#94). */
async function columns(page: Page) {
  const right = await pageRight(page);
  const width = (right - 32 - 304 - 2 * 24) / 3;
  return { width, x: [0, 1, 2].map((index) => 304 + index * (width + 24)) };
}

const near = (actual: number, expected: number, what: string) =>
  expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(0.5);

// T15: the first login's Total Balance and every slide (AC1, AC2, AC3; #11, #17, #24, #25, #57).
test('shows the total and the 5 accounts in order, with Previous and Next disabled at the ends', async ({ page }) => {
  await openOverview(page);

  await expect(allAccounts(page)).toBeVisible();
  await expectSlide(page, 0);
  await expect(previousButton(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(nextButton(page)).not.toHaveAttribute('aria-disabled', 'true');
  expect(await computed(previousButton(page), 'color')).toBe(await tokenColor(page, '--color-special-bg'));
  expect(await computed(nextButton(page), 'color')).toBe(await tokenColor(page, '--color-default-black'));
  // The round arrow is drawn on every slide.
  await expect(slide(page).locator('svg')).toBeVisible();

  for (const index of [1, 2, 3, 4]) {
    await nextButton(page).click();
    await expectSlide(page, index);
    await expect(totalBalance(page).getByText('$130,254.67')).toBeVisible();
  }
  await expect(nextButton(page)).toHaveAttribute('aria-disabled', 'true');
  expect(await computed(nextButton(page), 'color')).toBe(await tokenColor(page, '--color-special-bg'));
  // Playwright waits for an aria-disabled button to become enabled; a user's click does not wait.
  await nextButton(page).click({ force: true });
  await expectSlide(page, 4);

  await previousButton(page).click();
  await expectSlide(page, 3);
  await expect(previousButton(page)).not.toHaveAttribute('aria-disabled', 'true');
});

// T16: AC7, AC8: the request carries the zone, the answer integer cents with USD and no full number (#25, #54, #96).
test('asks for the accounts with the browser’s zone and gets masked numbers and integer cents', async ({ page }) => {
  await signUp(page.request);
  const answered = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/accounts');

  await page.goto('/overview');
  const response = await answered;

  expect(response.status()).toBe(200);
  expect(response.request().headers()['x-time-zone']).toBe('Europe/Belgrade');
  const text = await response.text();
  const body = JSON.parse(text) as { totalBalance: unknown; accounts: { balance: unknown; maskedNumber: string }[] };
  expect(body.totalBalance).toEqual({ cents: 13_025_467, currency: 'USD' });
  for (const account of body.accounts) {
    expect(account.balance).toEqual({ cents: expect.any(Number), currency: 'USD' });
    expect(Number.isInteger((account.balance as { cents: number }).cents)).toBe(true);
    expect(account.maskedNumber).toMatch(/^\*{4} \*{4} \*{4} \d{4}$/);
  }
  for (const number of fullNumbers) {
    expect(text).not.toContain(number);
    expect(text).not.toContain(number.slice(0, 12));
  }
});

// T17: AC9, Complete transactions dated up to today in the browser's zone (#53, #54, #80).
for (const [zone, total, creditCard] of [
  ['Europe/Belgrade', '$130,239.89', '$21,004.40'],
  ['America/New_York', '$130,254.67', '$21,019.18'],
] as const) {
  test.describe(`in ${zone}`, () => {
    test.use({ timezoneId: zone });

    test(`shows ${total} at 2026-10-22T22:01:00Z`, async ({ page }) => {
      await signUp(page.request);
      await moveBackendClock(page, '2026-10-22T22:01:00Z');

      await page.goto('/overview');

      await expect(totalBalance(page).getByText(total, { exact: true })).toBeVisible();
      await expect(slide(page).getByText(creditCard)).toBeVisible();
    });
  });
}

// T18: AC4, AC5, AC6: keyboard, the round arrow and "All Accounts" (#17, #87).
test('tabs through the card with the teal ring, keeps focus on a disabled Next, and opens Balances', async ({
  page,
}) => {
  await openOverview(page);

  // From the header search, the content comes next: "All Accounts", Previous (also disabled), Next.
  await page.getByRole('searchbox', { name: 'Search' }).focus();
  for (const target of [allAccounts(page), previousButton(page), nextButton(page)]) {
    await page.keyboard.press('Tab');
    await expect(target).toBeFocused();
    await expectRing(page, target);
  }
  await page.keyboard.press('Tab');
  await expect(region(page, 'Upcoming Bill').getByRole('link', { name: 'View All' })).toBeFocused();

  await nextButton(page).focus();
  await page.keyboard.press('Enter');
  await expect(slide(page)).toHaveAccessibleName('Account 2 of 5');
  await page.keyboard.press('Space');
  await expect(slide(page)).toHaveAccessibleName('Account 3 of 5');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(slide(page)).toHaveAccessibleName('Account 5 of 5');
  await expect(nextButton(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(nextButton(page)).toBeFocused();
  await expectRing(page, nextButton(page));
  await expect(slide(page).locator('xpath=ancestor::*[@aria-live="polite"]')).toHaveCount(1);

  // A mouse click shows no ring.
  await previousButton(page).click();
  await expect(previousButton(page)).toBeFocused();
  expect(await previousButton(page).evaluate((node) => node.matches(':focus-visible'))).toBe(false);
  expect(await computed(previousButton(page), 'outline-style')).toBe('none');
  await expect(slide(page)).toHaveAccessibleName('Account 4 of 5');

  // The round arrow is no button or link: a click changes nothing.
  const arrow = slide(page).locator('svg').locator('..');
  await expect(arrow).toHaveAttribute('aria-hidden', 'true');
  expect(await arrow.evaluate((node) => node.closest('a, button') === null && node.tabIndex === -1)).toBe(true);
  await arrow.click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/overview`);
  await expect(slide(page)).toHaveAccessibleName('Account 4 of 5');

  let loads = 0;
  page.on('load', () => (loads += 1));
  await allAccounts(page).click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/balances`);
  await expect(sidebar(page).locator('a[aria-current="page"]')).toHaveText('Balances');
  expect(loads).toBe(0);
});

// T19: AC12: the skeleton, the error state after the retries, and Retry (#6, #88, #105).
test('shows the skeleton while loading, the error state after the retries, and the data after Retry', async ({
  page,
}) => {
  await signUp(page.request);
  let mode: 'hold' | 'fail' | 'pass' = 'hold';
  const held: Route[] = [];
  await page.route('**/api/accounts', async (route) => {
    if (mode === 'hold') held.push(route);
    else if (mode === 'fail') await route.fulfill({ status: 500, json: { message: 'Internal server error' } });
    else await route.continue();
  });

  await page.goto('/overview');
  const busy = totalBalance(page).locator('[aria-busy="true"]');
  await expect(busy).toBeVisible();
  expect((await box(card(totalBalance(page)))).height).toBe(232);
  await expect(allAccounts(page)).toHaveCount(0);
  for (const name of ['Goals', 'Upcoming Bill', 'Recent Transaction', 'Statistics', 'Expenses Breakdown']) {
    await expect(region(page, name)).toBeVisible();
  }

  mode = 'fail';
  for (const route of held.splice(0)) await route.fulfill({ status: 500, json: { message: 'Internal server error' } });
  await expect(totalBalance(page).getByRole('alert')).toHaveText('Something went wrong.', { timeout: 15_000 });
  await expect(busy).toHaveCount(0);
  await expect(region(page, 'Upcoming Bill').getByRole('link', { name: 'View All' })).toBeVisible();

  mode = 'pass';
  await totalBalance(page).getByRole('button', { name: 'Retry' }).click();
  await expect(totalBalance(page).getByText('$130,254.67')).toBeVisible();
  await expectSlide(page, 0);
});

// T20: AC13, AC14: the grid of 104 at 1440 and the full-width grid at other sizes (#93, #94, #101, #105, #106).
for (const [width, height] of [
  [1440, 1024],
  [1920, 1080],
  [2560, 1440],
  [1280, 1024],
] as const) {
  test(`lays out the six sections on three equal columns at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openOverview(page);
    const { width: column, x } = await columns(page);
    const sectionBoxes = Object.fromEntries(
      await Promise.all(
        ['Total Balance', 'Goals', 'Upcoming Bill', 'Recent Transaction', 'Statistics', 'Expenses Breakdown'].map(
          async (name) =>
            [
              name,
              { title: await box(region(page, name).getByRole('heading')), card: await box(card(region(page, name))) },
            ] as const,
        ),
      ),
    );
    const top = sectionBoxes['Total Balance']!.card;

    // Row 1: the titles at y 104, the cards from y 144, one height for the row.
    for (const [index, name] of ['Total Balance', 'Goals', 'Upcoming Bill'].entries()) {
      const { title, card: cardBox } = sectionBoxes[name]!;
      near(title.y, 104, `${name} title y`);
      near(cardBox.x, x[index]!, `${name} x`);
      near(cardBox.width, column, `${name} width`);
      expect(cardBox.y).toBe(144);
      expect(cardBox.height).toBe(top.height);
    }
    // 232 wherever the account card's bottom line fits; below the wrap point the row grows (#106).
    if (width >= 1440) expect(top.height).toBe(232);
    else expect(top.height).toBeGreaterThan(232);

    // Row 2 starts 32 under the top row: titles, then the cards 8 below them.
    const row2 = top.y + top.height + 32;
    const statistics = sectionBoxes.Statistics!;
    const expenses = sectionBoxes['Expenses Breakdown']!;
    const recent = sectionBoxes['Recent Transaction']!;
    near(statistics.title.y, row2, 'Statistics title y');
    near(recent.title.y, row2, 'Recent Transaction title y');
    expect(statistics.card.y).toBe(row2 + 40);
    expect(statistics.card.height).toBe(260);
    near(statistics.card.x, x[1]!, 'Statistics x');
    near(statistics.card.width, 2 * column + 24, 'Statistics width');
    near(expenses.title.y, statistics.card.y + 260 + 32, 'Expenses Breakdown title y');
    expect(expenses.card.y).toBe(statistics.card.y + 260 + 32 + 40);
    expect(expenses.card.height).toBe(212);
    near(expenses.card.x, x[1]!, 'Expenses Breakdown x');
    near(expenses.card.width, 2 * column + 24, 'Expenses Breakdown width');
    near(recent.card.x, x[0]!, 'Recent Transaction x');
    near(recent.card.width, column, 'Recent Transaction width');
    expect(recent.card.y).toBe(row2 + 40);
    expect(recent.card.y + recent.card.height).toBe(expenses.card.y + expenses.card.height);

    // The account card and the control stretch with the card content; Previous at its left, Next at its right.
    const contentX = x[0]! + 24;
    const contentWidth = column - 48;
    const control = await box(previousButton(page).locator('..'));
    near(control.x, contentX, 'control x');
    near(control.width, contentWidth, 'control width');
    near((await box(previousButton(page))).x, contentX, 'Previous x');
    const next = await box(nextButton(page));
    near(next.x + next.width, contentX + contentWidth, 'Next right edge');
    expect(control.height).toBe(20);
    for (let index = 0; index < 5; index += 1) {
      const teal = await box(slide(page));
      near(teal.x, contentX, `slide ${index + 1} x`);
      near(teal.width, contentWidth, `slide ${index + 1} width`);
      if (width >= 1440) expect(teal.height, `slide ${index + 1} height`).toBe(96);
      if (index < 4) await nextButton(page).click();
    }

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(Math.round(await pageRight(page)));
  });
}

// T13 (positions at 1440): 104's boxes, measured from the page's right edge where a classic scrollbar takes 15px (#101).
test('places the cards where 104 does at 1440x1024', async ({ page }) => {
  await openOverview(page);
  const right = await pageRight(page);
  const shift = 1440 - right;

  expect(await box(card(totalBalance(page)))).toEqual({ x: 304, y: 144, width: 352 - shift / 3, height: 232 });
  const teal = await box(slide(page));
  expect(teal).toMatchObject({ x: 328, y: 221, height: 96 });
  expect((await box(previousButton(page).locator('..'))).y).toBe(336);
  expect((await box(card(region(page, 'Expenses Breakdown')))).y + 212).toBe(992);
  expect((await box(card(region(page, 'Recent Transaction')))).y).toBe(448);
});

// T21: AC13: each "View All" opens its page in the shell, without a full page load (#48, #49).
test('opens Bills and Transactions from their "View All"', async ({ page }) => {
  await openOverview(page);
  let loads = 0;
  page.on('load', () => (loads += 1));

  for (const [section, path, item] of [
    ['Upcoming Bill', '/bills', 'Bills'],
    ['Recent Transaction', '/transactions', 'Transactions'],
  ] as const) {
    await region(page, section).getByRole('link', { name: 'View All' }).click();
    await expect(page).toHaveURL(`${FRONTEND_URL}${path}`);
    await expect(sidebar(page).locator('a[aria-current="page"]')).toHaveText(item);
    await sidebar(page).getByRole('link', { name: 'Overview' }).click();
    await expect(totalBalance(page).getByText('$130,254.67')).toBeVisible();
  }
  expect(loads).toBe(0);
});

/** The box of a text node's glyphs, not of its element. */
const textBox = (locator: Locator) =>
  locator.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const { x, y, width, height } = range.getBoundingClientRect();
    return { x, y, width, height };
  });

type Box = { x: number; y: number; width: number; height: number };
const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

// T22: AC14 refined by #106: at 1280 the balance and the round arrow wrap under the number; nothing overlaps or is cut.
test('wraps the balance under the number at 1280x1024, with nothing overlapping or cut', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1024 });
  await openOverview(page);
  const rowHeights = async () =>
    Promise.all(
      ['Total Balance', 'Goals', 'Upcoming Bill'].map(async (name) => (await box(card(region(page, name)))).height),
    );

  for (let index = 0; index < 5; index += 1) {
    await expectSlide(page, index);
    const group = slide(page);
    const teal = await box(group);
    const [caption, type, number, balance] = await Promise.all(
      [0, 1, 2, 3].map((line) => textBox(group.locator('p').nth(line))),
    );
    const arrow = await box(group.locator('svg').locator('..'));
    const parts: [string, Box][] = [
      ['caption', caption!],
      ['type', type!],
      ['number', number!],
      ['balance', balance!],
      ['arrow', arrow],
    ];
    if (await group.getByRole('img').count()) parts.push(['logo', await box(group.getByRole('img'))]);

    // On the next line, right-aligned 16 from the card's right edge.
    expect(balance!.y, `slide ${index + 1}: balance under the number`).toBeGreaterThanOrEqual(
      number!.y + number!.height,
    );
    near(arrow.x + arrow.width, teal.x + teal.width - 16, `slide ${index + 1} arrow right edge`);
    // Fully visible: every part inside the account card, no text wider than its own box.
    for (const [name, part] of parts) expect(inside(part, teal), `slide ${index + 1}: ${name} inside`).toBe(true);
    for (const line of [2, 3]) {
      const element = group.locator('p').nth(line);
      expect(
        await element.evaluate((node) => node.scrollWidth <= node.clientWidth),
        `slide ${index + 1} line ${line}`,
      ).toBe(true);
    }
    // Nothing overlaps.
    for (const [i, [nameA, a]] of parts.entries()) {
      for (const [nameB, b] of parts.slice(i + 1))
        expect(overlaps(a, b), `slide ${index + 1}: ${nameA} and ${nameB}`).toBe(false);
    }
    // The card grows by the wrapped line, the top row with it, one height; the control stays under the card.
    expect(teal.height).toBeGreaterThan(96);
    const heights = await rowHeights();
    expect(new Set(heights).size).toBe(1);
    expect(heights[0]).toBeGreaterThan(232);
    expect((await box(previousButton(page).locator('..'))).y).toBeGreaterThanOrEqual(teal.y + teal.height + 16);

    if (index < 4) await nextButton(page).click();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(Math.round(await pageRight(page)));
});

// T23: AC14 refined by #107: between the wrap points the card keeps the tallest account's height while paging. With the
// demo balances some slides wrap and others fit at pages 1380 to 1410 wide: a 1405 window is a 1390 page with a classic
// scrollbar (#101) and 1405 without, inside that band either way.
test('keeps the teal card’s height and the Next button in place while paging at 1405x1024', async ({ page }) => {
  await page.setViewportSize({ width: 1405, height: 1024 });
  await openOverview(page);
  const measure = async () => ({
    teal: await box(slide(page)),
    card: await box(card(totalBalance(page))),
    next: await box(nextButton(page)),
    arrow: await box(slide(page).locator('svg').locator('..')),
  });
  const first = await measure();

  for (let index = 0; index < 5; index += 1) {
    await expectSlide(page, index);
    const { teal, card: cardBox, next, arrow } = await measure();
    expect(teal.height, `slide ${index + 1} teal card height`).toBe(first.teal.height);
    expect(cardBox.height, `slide ${index + 1} Total Balance card height`).toBe(first.card.height);
    expect(next, `slide ${index + 1} Next box`).toEqual(first.next);
    // The bottom line at the bottom of the card on every slide.
    near(arrow.y + arrow.height, teal.y + teal.height - 16, `slide ${index + 1} round arrow bottom`);
    if (index < 4) await nextButton(page).click();
  }
});
