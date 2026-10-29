import type { Browser, Locator, Page, Route } from '@playwright/test';

import { FRONTEND_URL } from '../constants';
import { expect, test } from '../fixtures';
import {
  box,
  computed,
  expectNoRingOnMouseFocus,
  expectRing,
  signUp,
  tokenColor,
  waitForRecentTransactions,
  within2,
} from '../helpers';

const SOFT_HYPHEN = '­';
const region = (page: Page, name: string) => page.getByRole('main').getByRole('region', { name });
const breakdown = (page: Page) => region(page, 'Expenses Breakdown');
/** The white card of a section: the element after its title row. */
const card = (section: Locator) => section.locator(':scope > div').last();
const list = (page: Page) => breakdown(page).getByRole('list');
const items = (page: Page) => list(page).getByRole('listitem');
const arrowLink = (page: Page, category: string) =>
  breakdown(page).getByRole('link', { name: `${category} expenses`, exact: true });
const weeklyComparison = (page: Page) => region(page, 'Statistics').getByRole('combobox', { name: 'Statistics' });
/** DataState's root in the card after a Retry, which gives it tabindex="-1". */
const dataStateRoot = (page: Page) => breakdown(page).locator('[tabindex="-1"]');
const isBodyFocused = (page: Page) => page.evaluate(() => document.activeElement === document.body);
const mainHasFocus = (page: Page) =>
  page.evaluate(() => document.querySelector('main')!.contains(document.activeElement));

const CATEGORIES = ['Housing', 'Food', 'Transportation', 'Entertainment', 'Shopping', 'Others'];

const moveBackendClock = async (page: Page, now: string) =>
  expect((await page.request.put('/api/test/clock', { data: { now } })).ok()).toBe(true);

/** Waits until Overview shows every widget's content and the six items. */
async function waitForOverview(page: Page) {
  await waitForRecentTransactions(page);
  await expect(items(page)).toHaveCount(6);
  await expect(page.getByRole('main').locator('[aria-busy="true"]')).toHaveCount(0);
}

/** Signs up a new user at the backend's clock and opens Overview once every widget shows its content. */
async function openOverview(page: Page) {
  await signUp(page.request);
  await page.goto('/overview');
  await waitForOverview(page);
}

type Shown = [name: string, total: string, percentage: string, arrow: 'up' | 'down' | null];

/** What each item shows: the name without its soft hyphens, the total, the percentage line, and the small arrow. */
async function shown(page: Page): Promise<Shown[]> {
  const red = await tokenColor(page, '--color-special-red');
  const green = await tokenColor(page, '--color-special-green');
  return items(page).evaluateAll(
    (elements, [up, down, soft]) =>
      elements.map((item) => {
        const [name, total, change] = [...item.querySelectorAll('p')];
        const arrow = change!.querySelector('svg');
        const color = arrow === null ? null : getComputedStyle(arrow).color;
        return [
          name!.textContent.replaceAll(soft, ''),
          total!.textContent,
          change!.textContent,
          color === up ? 'up' : color === down ? 'down' : color,
        ] as Shown;
      }),
    [red, green, SOFT_HYPHEN] as const,
  );
}

/** A first login's card on 22 Oct 2026 in Belgrade: 1 to 22 Oct against all of Sep (demo-data.md; AC1). */
const firstLogin: Shown[] = [
  ['Housing', '$252.00', '17%*', 'down'],
  ['Food', '$510.04', '7%*', 'up'],
  ['Transportation', '$53.20', '32%*', 'down'],
  ['Entertainment', '$282.24', '16%*', 'up'],
  ['Shopping', '$658.00', '14%*', 'up'],
  ['Others', '$138.32', '31%*', 'down'],
];

/** All of October against all of September (task 018 References; AC4). */
const october: Shown[] = [
  ['Housing', '$272.16', '10%*', 'down'],
  ['Food', '$564.24', '19%*', 'up'],
  ['Transportation', '$74.48', '5%*', 'down'],
  ['Entertainment', '$299.88', '24%*', 'up'],
  ['Shopping', '$686.00', '19%*', 'up'],
  ['Others', '$159.60', '21%*', 'down'],
];

/** 1 Nov against all of October: the House Rent of 1 Nov only (AC4). */
const november: Shown[] = [
  ['Housing', '$270.48', '1%*', 'down'],
  ['Food', '$0.00', '100%*', 'down'],
  ['Transportation', '$0.00', '100%*', 'down'],
  ['Entertainment', '$0.00', '100%*', 'down'],
  ['Shopping', '$0.00', '100%*', 'down'],
  ['Others', '$0.00', '100%*', 'down'],
];

/** The same backend session in another browser zone, on Overview. */
async function inZone(browser: Browser, page: Page, timezoneId: string) {
  const context = await browser.newContext({
    baseURL: FRONTEND_URL,
    timezoneId,
    storageState: await page.context().storageState(),
  });
  const zonePage = await context.newPage();
  await zonePage.goto('/overview');
  await expect(items(zonePage)).toHaveCount(6);
  return { zonePage, close: () => context.close() };
}

// T16, T20: AC1, AC11, the first login's card and what a screen reader reads (#21, #56, #61, #115 b; demo-data.md).
test('shows the six categories of a first login, read with their clean names and their changes in words', async ({
  page,
}) => {
  await openOverview(page);

  expect(await shown(page)).toEqual(firstLogin);
  await expect(breakdown(page)).toMatchAriaSnapshot(`
    - region "Expenses Breakdown":
      - heading "Expenses Breakdown" [level=2]
      - paragraph: "*Compare to last month"
      - list:
        - listitem:
          - text: Housing
          - paragraph: $252.00
          - text: down 17% compared to last month
          - link "Housing expenses":
            - /url: /expenses
        - listitem:
          - text: Food
          - paragraph: $510.04
          - text: up 7% compared to last month
          - link "Food expenses":
            - /url: /expenses
        - listitem:
          - text: Transportation
          - paragraph: $53.20
          - text: down 32% compared to last month
          - link "Transportation expenses":
            - /url: /expenses
        - listitem:
          - text: Entertainment
          - paragraph: $282.24
          - text: up 16% compared to last month
          - link "Entertainment expenses":
            - /url: /expenses
        - listitem:
          - text: Shopping
          - paragraph: $658.00
          - text: up 14% compared to last month
          - link "Shopping expenses":
            - /url: /expenses
        - listitem:
          - text: Others
          - paragraph: $138.32
          - text: down 31% compared to last month
          - link "Others expenses":
            - /url: /expenses
  `);
  // No soft hyphen reaches the accessibility tree.
  expect(await breakdown(page).ariaSnapshot()).not.toContain(SOFT_HYPHEN);
});

/** Pixel colors of a screenshot at page points (CSS pixels), decoded in the page. */
async function pixels(page: Page, shot: Buffer, points: [number, number][]): Promise<string[]> {
  return page.evaluate(
    async ([data, at]) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      return at.map(([x, y]) => {
        const [r, g, b] = context.getImageData(x, y, 1, 1).data;
        return `#${[r, g, b].map((value) => value!.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
      });
    },
    [shot.toString('base64'), points] as const,
  );
}

/**
 * Where two screenshots of the same clip differ visibly: the count of pixels with a channel more than 8 of 255 apart,
 * and their bounds (clip pixels). Smaller differences are a glyph rasterized again at a fractional x (up to 5 of 255
 * measured on the category icons of the middle column), not a change anyone can see.
 */
async function changedArea(page: Page, before: Buffer, after: Buffer) {
  return page.evaluate(
    async (shots) => {
      // Decoded in the page: the test has no PNG decoder.
      const [first, second] = (await Promise.all(
        shots.map(async (data) => {
          const image = new Image();
          image.src = `data:image/png;base64,${data}`;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d')!;
          context.drawImage(image, 0, 0);
          return context.getImageData(0, 0, image.width, image.height);
        }),
      )) as [ImageData, ImageData];
      const area = { count: 0, left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
      for (let y = 0; y < first.height; y++) {
        for (let x = 0; x < first.width; x++) {
          const i = (y * first.width + x) * 4;
          const delta = Math.max(...[0, 1, 2, 3].map((k) => Math.abs(first.data[i + k]! - second.data[i + k]!)));
          if (delta <= 8) continue;
          area.count++;
          area.left = Math.min(area.left, x);
          area.top = Math.min(area.top, y);
          area.right = Math.max(area.right, x + 1);
          area.bottom = Math.max(area.bottom, y + 1);
        }
      }
      return area;
    },
    [before.toString('base64'), after.toString('base64')] as const,
  );
}

// T16: AC9, the right arrow's hover, on every item (#21).
test('turns each right arrow teal (Primary at 50%) under the pointer and nothing else in its item', async ({
  page,
}) => {
  await openOverview(page);
  const gray = await tokenColor(page, '--color-gray-03');
  const primary = await tokenColor(page, '--color-primary');
  await page.mouse.move(5, 5);

  for (const [index, name] of CATEGORIES.entries()) {
    const link = arrowLink(page, name);
    const icon = link.locator('svg');
    const item = items(page).nth(index);
    expect(await computed(icon, 'color'), `${name} at rest`).toBe(gray);
    expect(await computed(icon, 'opacity'), `${name} at rest`).toBe('0.5');
    // In view first: hovering an item below the fold would scroll the page under the clip.
    await item.scrollIntoViewIfNeeded();
    const itemBox = await box(item);
    const before = await page.screenshot({ clip: itemBox });

    await link.hover();

    expect(await computed(icon, 'color'), `${name} hovered`).toBe(primary);
    expect(await computed(icon, 'opacity'), `${name} hovered`).toBe('0.5');
    const after = await page.screenshot({ clip: itemBox });
    const linkBox = await box(link);
    // Every changed pixel lies inside the arrow's 24px box (its place in the clip, a pixel either side: the items'
    // x can be fractional).
    const area = await changedArea(page, before, after);
    expect(area.count, `${name}: the arrow changes`).toBeGreaterThan(0);
    const arrowLeft = linkBox.x - itemBox.x;
    const arrowTop = linkBox.y - itemBox.y;
    expect(area.left, `${name}: only the arrow changes (left)`).toBeGreaterThanOrEqual(Math.floor(arrowLeft) - 1);
    expect(area.top, `${name}: only the arrow changes (top)`).toBeGreaterThanOrEqual(Math.floor(arrowTop) - 1);
    expect(area.right, `${name}: only the arrow changes (right)`).toBeLessThanOrEqual(Math.ceil(arrowLeft + 24) + 1);
    expect(area.bottom, `${name}: only the arrow changes (bottom)`).toBeLessThanOrEqual(Math.ceil(arrowTop + 24) + 1);
    await page.mouse.move(5, 5);
    expect(await computed(icon, 'color'), `${name} after`).toBe(gray);
  }
});

// T16: AC10, the right arrow opens Expenses; the rest of an item is not a link (#21).
test('opens Expenses from Housing’s right arrow, the sidebar’s Expenses active, and comes back', async ({ page }) => {
  await openOverview(page);
  const nav = page.getByRole('navigation', { name: 'Main' });

  await items(page).first().getByText('$252.00').click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/overview`);

  await arrowLink(page, 'Housing').click();

  await expect(page).toHaveURL(`${FRONTEND_URL}/expenses`);
  await expect(nav.getByRole('link', { name: 'Expenses' })).toHaveAttribute('aria-current', 'page');
  await page.goBack();
  await expect(page).toHaveURL(`${FRONTEND_URL}/overview`);
  await expect(items(page)).toHaveCount(6);

  await arrowLink(page, 'Others').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(`${FRONTEND_URL}/expenses`);
});

// T16: AC11, the Tab order and the ring with the keyboard only (#87).
test('tabs from "Weekly Comparison" through the six right arrows with the ring and out; Shift+Tab goes back', async ({
  page,
}) => {
  await openOverview(page);

  await weeklyComparison(page).focus();
  for (const name of CATEGORIES) {
    await page.keyboard.press('Tab');
    await expect(arrowLink(page, name)).toBeFocused();
    await expectRing(page, arrowLink(page, name));
  }
  await page.keyboard.press('Tab');
  expect(await mainHasFocus(page)).toBe(false);

  await arrowLink(page, 'Others').focus();
  for (const name of CATEGORIES.toReversed().slice(1)) {
    await page.keyboard.press('Shift+Tab');
    await expect(arrowLink(page, name)).toBeFocused();
  }
  await page.keyboard.press('Shift+Tab');
  await expect(weeklyComparison(page)).toBeFocused();

  for (const name of CATEGORIES) await expectNoRingOnMouseFocus(page, arrowLink(page, name));
});

// T18: AC4, the month change in Belgrade (November from 2026-10-31T23:00:00Z) and New York (from 04:00:00Z on 1 Nov)
// (#54, #80).
test('shows 1 Nov against October at 2026-10-31T23:00:00Z in Belgrade, and still October in New York', async ({
  page,
  browser,
}) => {
  await moveBackendClock(page, '2026-10-31T23:00:00Z');
  await openOverview(page);

  expect(await shown(page)).toEqual(november);

  const newYork = await inZone(browser, page, 'America/New_York');
  expect(await shown(newYork.zonePage)).toEqual(october);
  await newYork.close();
});

// T18: AC5, no change without last month's expenses; the six always shown, the card at 212 (#21, #61, #105 a).
for (const [now, expected] of [
  [
    '2022-01-15T10:00:00Z',
    [
      ['Housing', '$237.50', '', null],
      ['Food', '$273.79', '', null],
      ['Transportation', '$36.11', '', null],
      ['Entertainment', '$74.10', '', null],
      ['Shopping', '$305.91', '', null],
      ['Others', '$111.15', '', null],
    ],
  ],
  ['2021-12-31T10:00:00Z', CATEGORIES.map((name) => [name, '$0.00', '', null])],
] as const) {
  test(`shows the six totals with no percentage and no arrow at ${now}, the card 212 high`, async ({ page }) => {
    await moveBackendClock(page, now);
    await openOverview(page);

    expect(await shown(page)).toEqual(expected);
    await expect(breakdown(page).getByRole('status')).toHaveCount(0);
    expect((await box(card(breakdown(page)))).height).toBe(212);
  });
}

/** A route that holds requests, then answers 500 to each (`fail`), then lets them through (`pass`). */
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

// T19: AC12, the skeleton and the error state at 212; a keyboard Retry keeps focus in the card with the ring (#6, #87,
// #88, #105 a, #114).
test('shows the skeleton and the error state at 212, and after a keyboard Retry keeps focus in the card with the ring', async ({
  page,
}) => {
  await signUp(page.request);
  const route = await controlRoute(page, '**/api/expenses/breakdown');
  await page.goto('/overview');

  const busy = breakdown(page).locator('[aria-busy="true"]');
  await expect(busy).toBeVisible();
  await waitForRecentTransactions(page);
  const cardBox = await box(card(breakdown(page)));
  expect(cardBox.height).toBe(212);
  // The skeleton's grid at the content's top: two rows of 74, 24 apart.
  expect(await box(busy)).toMatchObject({ y: cardBox.y + 20, height: 172 });

  await route.fail();
  await expect(breakdown(page).getByRole('alert')).toHaveText('Something went wrong.', { timeout: 15_000 });
  expect((await box(card(breakdown(page)))).height).toBe(212);
  await weeklyComparison(page).click();
  await expect(page.getByRole('option', { name: 'Weekly Comparison' })).toBeVisible();
  await page.keyboard.press('Escape');

  await weeklyComparison(page).focus();
  await page.keyboard.press('Tab');
  await expect(breakdown(page).getByRole('button', { name: 'Retry' })).toBeFocused();
  route.pass();
  await page.keyboard.press('Enter');

  await expect(items(page)).toHaveCount(6);
  expect(await shown(page)).toEqual(firstLogin);
  await expect(dataStateRoot(page)).toBeFocused();
  expect(await isBodyFocused(page)).toBe(false);
  await expectRing(page, dataStateRoot(page));
  await page.keyboard.press('Tab');
  await expect(arrowLink(page, 'Housing')).toBeFocused();
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

/** The box of an element's own text, all its lines, up to an icon in it (the percentage's small arrow). */
const textBox = (locator: Locator) =>
  locator.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const icon = element.querySelector('svg');
    if (icon !== null) range.setEndBefore(icon);
    const { x, y, width, height } = range.getBoundingClientRect();
    return { x, y, width, height };
  });

/** Each item's parts, measured on the page. */
async function itemParts(page: Page) {
  const parts = [];
  for (const item of await items(page).all()) {
    const lines = item.locator('p');
    parts.push({
      item: await box(item),
      tile: await box(item.locator(':scope > span').first()),
      name: await box(lines.nth(0)),
      nameText: await textBox(lines.nth(0)),
      total: await box(lines.nth(1)),
      totalText: await textBox(lines.nth(1)),
      change: await box(lines.nth(2)),
      changeText: await textBox(lines.nth(2)),
      smallArrow: (await lines.nth(2).locator('svg').count()) > 0 ? await box(lines.nth(2).locator('svg')) : null,
      arrow: await box(item.getByRole('link')),
    });
  }
  return parts;
}

/** The card and its content box (inset 20 at the top and bottom, 24 at the sides). */
async function cardAndContent(page: Page) {
  const cardBox = await box(card(breakdown(page)));
  return {
    cardBox,
    content: { x: cardBox.x + 24, y: cardBox.y + 20, width: cardBox.width - 48, height: cardBox.height - 40 },
  };
}

/** AC14: nothing cut, hidden or overlapping; nothing leaves its item or the content box; no scroll sideways. */
async function expectNothingOverlapsOrLeaves(page: Page) {
  const { content } = await cardAndContent(page);
  for (const [index, parts] of (await itemParts(page)).entries()) {
    const at = CATEGORIES[index]!;
    expect(inside(parts.item, content), `${at} inside the content box`).toBe(true);
    const shownParts = {
      tile: parts.tile,
      name: parts.nameText,
      total: parts.totalText,
      change: parts.changeText,
      arrow: parts.arrow,
    };
    for (const [name, part] of Object.entries(shownParts)) {
      expect(inside(part, parts.item), `${at}: ${name} inside the item`).toBe(true);
    }
    const entries = Object.entries(shownParts).filter(([, part]) => part.width > 0);
    for (const [i, [a, first]] of entries.entries()) {
      for (const [b, second] of entries.slice(i + 1)) {
        expect(overlaps(first, second), `${at}: ${a} and ${b} overlap`).toBe(false);
      }
    }
    if (parts.smallArrow !== null)
      expect(overlaps(parts.smallArrow, parts.arrow), `${at}: the arrows overlap`).toBe(false);
  }
  // Nothing is clipped: no element of the card scrolls or hides overflow.
  expect(
    await card(breakdown(page)).evaluate(
      (element) =>
        // Radix's visually hidden texts (1px, overflow hidden) are left out: they are hidden on purpose.
        [element, ...element.querySelectorAll('*')].filter(
          (node) =>
            node.clientWidth > 1 &&
            node.scrollWidth > node.clientWidth + 1 &&
            getComputedStyle(node).overflow !== 'visible',
        ).length,
    ),
  ).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(Math.round(await pageRight(page)));
}

/**
 * AC13: the items, tiles, text lines and arrows on 104's grid from the card's top: three columns sharing the width,
 * 40 apart, rows of 74, 24 apart; the tile 16 and 8 into its item; the name, total and percentage lines from 16 after
 * the tile; the right arrow 16 from the item's right, centred on the text; the lines in the middle of the gaps.
 */
async function expectGrid(page: Page) {
  const { cardBox, content } = await cardAndContent(page);
  const column = (content.width - 80) / 3;
  const parts = await itemParts(page);
  for (const [index, part] of parts.entries()) {
    const at = CATEGORIES[index]!;
    const x = content.x + (index % 3) * (column + 40);
    const y = content.y + Math.floor(index / 3) * 98;
    within2(part.item.x, x, `${at} item x`);
    within2(part.item.width, column, `${at} item width`);
    expect(part.item.y, `${at} item y`).toBe(y);
    expect(part.item.height, `${at} item height`).toBe(74);
    expect(part.tile, `${at} tile`).toMatchObject({ y: y + 8, width: 40, height: 56 });
    within2(part.tile.x, x + 16, `${at} tile x`);
    within2(part.name.x, x + 72, `${at} name x`);
    expect(part.name, `${at} name`).toMatchObject({ y: y + 8, height: 16 });
    expect(part.total, `${at} total`).toMatchObject({ y: y + 28, height: 20 });
    expect(part.change, `${at} percentage`).toMatchObject({ y: y + 48, height: 20 });
    within2(part.smallArrow!.x, part.changeText.x + part.changeText.width + 8, `${at} small arrow 8 after the text`);
    expect(part.smallArrow, `${at} small arrow`).toMatchObject({ y: y + 50, width: 16, height: 16 });
    within2(part.arrow.x + part.arrow.width, x + column - 16, `${at} right arrow 16 from the right`);
    expect(part.arrow, `${at} right arrow`).toMatchObject({ y: y + 26, width: 24, height: 24 });
  }
  // The lines: the vertical ones 20 after the first and second columns, from the first row's top to the second
  // row's bottom; the horizontal one across the content box, its bottom 12 under the first row.
  await page.evaluate(() => window.scrollTo(0, 0));
  const shot = await page.screenshot({ fullPage: true });
  const lineColor = '#F6F6F6';
  const white = '#FFFFFF';
  const verticals = [0, 1].map((col) => Math.round(content.x + (col + 1) * column + col * 40 + 20));
  const horizontal = content.y + 74 + 11;
  const points: [number, number][] = [];
  for (const x of verticals) {
    for (const y of [content.y, content.y + 37, content.y + 86, content.y + 135, content.y + 171]) {
      points.push([x, y], [x - 1, y], [x + 1, y]);
    }
    points.push([x, content.y + 172]);
  }
  for (const x of [
    content.x,
    Math.round((content.x + verticals[0]!) / 2),
    verticals[0]! + 10,
    content.x + content.width - 1,
  ]) {
    points.push([x, horizontal], [x, horizontal - 1], [x, horizontal + 1]);
  }
  const colors = await pixels(page, shot, points);
  const expected = [
    ...verticals.flatMap(() => [...Array.from({ length: 5 }, () => [lineColor, white, white]).flat(), white]),
    ...Array.from({ length: 4 }, () => [lineColor, white, white]).flat(),
  ];
  expect(colors, 'the lines in the middle of the gaps').toEqual(expected);
  return { cardBox, content, parts };
}

// T17: AC13, the card at 1440 (with the e2e browser's scrollbar), 1920 and 2560 (#94, #101).
test('places the card, its items and its lines where 104 does at 1440x1024, wider apart at 1920 and 2560', async ({
  page,
}) => {
  await openOverview(page);
  const shift = 1440 - (await pageRight(page));
  const growth = (await box(card(region(page, 'Upcoming Bill')))).height - 232;
  const at1440 = await expectGrid(page);
  within2(at1440.cardBox.x, 680 - shift / 3, 'card x');
  // 104 draws it at y 778; Statistics is 2 taller than drawn (#93), so it is 2 lower.
  expect(at1440.cardBox.y).toBe(780 + growth);
  within2(at1440.cardBox.width, 728 - (2 * shift) / 3, 'card width');
  expect(at1440.cardBox.height).toBe(212);
  within2(at1440.parts[0]!.item.x, 704 - shift / 3, 'Housing x');
  await expectNothingOverlapsOrLeaves(page);

  let width = at1440.parts[0]!.item.width;
  for (const [viewportWidth, height] of [
    [1920, 1080],
    [2560, 1440],
  ] as const) {
    await page.setViewportSize({ width: viewportWidth, height });
    await waitForOverview(page);
    const wider = await expectGrid(page);
    expect(wider.cardBox.height, `${viewportWidth}: card height`).toBe(212);
    expect(wider.parts[0]!.item.width, `${viewportWidth}: items wider`).toBeGreaterThan(width);
    width = wider.parts[0]!.item.width;
    await expectNothingOverlapsOrLeaves(page);
  }
});

/** The width of `text` in the name's font, measured in the page. */
const textWidth = (page: Page, name: Locator, text: string) =>
  name.evaluate((element, value) => {
    const probe = document.createElement('span');
    probe.textContent = value;
    probe.style.font = getComputedStyle(element).font;
    probe.style.whiteSpace = 'pre';
    document.body.append(probe);
    const width = probe.getBoundingClientRect().width;
    probe.remove();
    return width;
  }, text);

/**
 * The lines of a name, as wide as what each draws: the text's rectangles grouped by line. Chromium gives the hyphen
 * drawn at a soft hyphen a rectangle of its own at the end of its line.
 */
const lineWidths = (name: Locator) =>
  name.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const lines = new Map<number, { left: number; right: number }>();
    for (const { x, y, width } of range.getClientRects()) {
      const line = lines.get(y) ?? { left: x, right: x + width };
      lines.set(y, { left: Math.min(line.left, x), right: Math.max(line.right, x + width) });
    }
    return [...lines.values()].map(({ left, right }) => right - left);
  });

// T17: AC14 at 1280: the right arrows under the text, two names hyphenated at a soft hyphen (#94, #101, #106, #108 b,
// #111 a, #112, #115 b).
test('moves every right arrow under its text at 1280x1024 and breaks "Transporta-tion" and "Entertain-ment" with a hyphen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1024 });
  await openOverview(page);

  const parts = await itemParts(page);
  for (const [index, part] of parts.entries()) {
    const at = CATEGORIES[index]!;
    expect(part.arrow.y, `${at}: the right arrow under the text`).toBeGreaterThanOrEqual(
      part.change.y + part.change.height,
    );
    within2(
      part.arrow.x + part.arrow.width,
      part.item.x + part.item.width - 16,
      `${at}: the right arrow right-aligned`,
    );
    expect(part.tile.y, `${at}: the tile at the item's top`).toBe(part.item.y + 8);
    expect(part.name.height, `${at}: the name's lines`).toBe(
      ['Transportation', 'Entertainment'].includes(at) ? 32 : 16,
    );
  }

  for (const [index, first, rest] of [
    [2, 'Transporta', 'tion'],
    [3, 'Entertain', 'ment'],
  ] as const) {
    const name = items(page).nth(index).locator('p').first();
    const widths = await lineWidths(name);
    expect(widths, `${first}${rest}: two lines`).toHaveLength(2);
    // The first line ends at the soft hyphen with the hyphen drawn: as wide as its letters and a hyphen, wider than
    // its letters alone; never broken inside a syllable.
    within2(widths[0]!, await textWidth(page, name, `${first}-`), `${first}- width`);
    expect(widths[0]!).toBeGreaterThan((await textWidth(page, name, first)) + 2);
    within2(widths[1]!, await textWidth(page, name, rest), `${rest} width`);
  }

  // The card grows with its items, grid row 3 with it; Recent Transaction ends with Expenses Breakdown.
  const { cardBox } = await cardAndContent(page);
  expect(cardBox.height).toBeGreaterThan(212);
  const recent = await box(card(region(page, 'Recent Transaction')));
  expect(recent.y + recent.height).toBe(cardBox.y + cardBox.height);
  await expectNothingOverlapsOrLeaves(page);
});

// T17: AC14, a $1,000,000,000.00 total at 1440: the arrow under it and the total wrapped inside its column.
test('moves the arrow under a $1,000,000,000.00 total at 1440x1024 and wraps the total inside its column', async ({
  page,
}) => {
  await page.route('**/api/expenses/breakdown', async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { categories: { total: { cents: number } }[] };
    body.categories[4]!.total.cents = 100_000_000_000;
    await route.fulfill({ response, json: body });
  });
  await openOverview(page);

  await expect(items(page).nth(4).getByText('$1,000,000,000.00')).toBeVisible();
  const shopping = (await itemParts(page))[4]!;
  expect(shopping.total.height, 'the total wraps').toBeGreaterThan(20);
  expect(shopping.arrow.y, 'the arrow under the text').toBeGreaterThanOrEqual(
    shopping.change.y + shopping.change.height,
  );
  within2(
    shopping.arrow.x + shopping.arrow.width,
    shopping.item.x + shopping.item.width - 16,
    'the arrow right-aligned',
  );
  expect(shopping.item.height).toBeGreaterThan(74);
  await expectNothingOverlapsOrLeaves(page);
});

// T17: AC15, a card taller than its grid: grid rows 2 and 3 grown by a long transaction name at 1440 (#112, #113 a).
test('keeps the grid and its lines at the card’s top when a long transaction name stretches row 3 at 1440x1024', async ({
  page,
}) => {
  const item = `Jeans ${'with a very long description '.repeat(5)}`.slice(0, 120);
  const long = {
    item,
    shopName: 'Denim House',
    category: 'shopping',
    direction: 'expense',
    occurredAt: '2026-10-22T12:00:00.000Z',
    amount: { cents: 26_600, currency: 'USD' },
  };
  await page.route('**/api/transactions/recent', (route) =>
    route.fulfill({ json: { all: [long, long, long, long, long], revenue: [], expenses: [long] } }),
  );
  await openOverview(page);

  const { cardBox, content } = await expectGrid(page);
  expect(cardBox.height).toBeGreaterThan(212);
  const grid = await box(list(page));
  expect(grid).toMatchObject({ y: content.y, height: 172 });
  expect(grid.y + grid.height).toBeLessThan(cardBox.y + cardBox.height - 20);
  // Nothing is drawn below the grid: the card's white to its bottom.
  await page.evaluate(() => window.scrollTo(0, 0));
  const shot = await page.screenshot({ fullPage: true });
  const below = await pixels(
    page,
    shot,
    [0.1, 0.3, 0.5, 0.7, 0.9].map((share) => [
      Math.round(content.x + share * content.width),
      Math.round((grid.y + grid.height + cardBox.y + cardBox.height) / 2),
    ]),
  );
  expect(below).toEqual(Array.from({ length: 5 }, () => '#FFFFFF'));
});

// T21: AC17, #115 b: the wrapping text of Recent Transaction and Upcoming Bill hyphenates where the browser can, with
// overflow-wrap: anywhere as before; their own wrap tests are in their specs.
test('gives Recent Transaction’s and Upcoming Bill’s wrapping text hyphens: auto beside overflow-wrap: anywhere', async ({
  page,
}) => {
  await openOverview(page);

  const textColumns = [
    region(page, 'Recent Transaction')
      .getByRole('tabpanel')
      .getByRole('listitem')
      .first()
      .locator('p')
      .first()
      .locator('..'),
    region(page, 'Upcoming Bill').getByRole('listitem').first().locator('p').first().locator('..'),
    items(page).first().locator('p').first().locator('..'),
  ];
  for (const column of textColumns) {
    expect(await computed(column, 'hyphens')).toBe('auto');
    expect(await computed(column, 'overflow-wrap')).toBe('anywhere');
  }
});
