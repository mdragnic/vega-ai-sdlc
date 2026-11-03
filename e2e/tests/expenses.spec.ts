import type { Browser, Locator, Page, Request, Route } from '@playwright/test';

import { FRONTEND_URL, TIME_ZONE } from '../constants';
import { expect, test } from '../fixtures';
import { box, computed, expectRing, signUp, tokenColor, waitForRecentTransactions } from '../helpers';

const SOFT_HYPHEN = '­';
const NEW_YORK = 'America/New_York';
const main = (page: Page) => page.getByRole('main');
const region = (page: Page, name: string) => main(page).getByRole('region', { name });
const comparison = (page: Page) => region(page, 'Expenses Comparison');
const breakdown = (page: Page) => region(page, 'Expenses Breakdown');
/** The chart's white card: the section's element after its title row. */
const chartCard = (page: Page) => comparison(page).locator(':scope > div').last();
const control = (page: Page) => comparison(page).getByRole('combobox', { name: 'Expenses Comparison' });
const legend = (page: Page) => comparison(page).getByRole('list');
const table = (page: Page) =>
  comparison(page).getByRole('table', { name: 'Expenses per month, this year and last year' });
/** The chart's SVG: the sibling after the hidden table. */
const plot = (page: Page) => table(page).locator('xpath=following-sibling::*[local-name()="svg"]');
const bars = (page: Page) => plot(page).locator('path');
/** The cards: the items of the section's outermost list. */
const cards = (page: Page) => breakdown(page).getByRole('list').first().locator(':scope > li');
/** DataState's root in a section after a Retry, which gives it tabindex="-1". */
const dataStateRoot = (section: Locator) => section.locator('[tabindex="-1"]');
const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const headerDate = (page: Page) => page.getByRole('banner').locator('time');
const search = (page: Page) => page.getByRole('searchbox', { name: 'Search' });
const overviewBreakdown = (page: Page) => region(page, 'Expenses Breakdown');

const moveBackendClock = async (page: Page, now: string) =>
  expect((await page.request.put('/api/test/clock', { data: { now } })).ok()).toBe(true);

const isExpensesRequest = (request: Request) => new URL(request.url()).pathname.startsWith('/api/expenses');

/** Waits until both widgets show their content: no skeleton left, the six cards. */
async function waitForExpenses(page: Page) {
  await expect(headerDate(page)).toBeVisible();
  await expect(cards(page)).toHaveCount(6);
  await expect(main(page).locator('[aria-busy="true"]')).toHaveCount(0);
}

/** Signs up a new user at the backend's clock and opens Expenses once both widgets show their content. */
async function openExpenses(page: Page) {
  await signUp(page.request);
  await page.goto('/expenses');
  await waitForExpenses(page);
}

/** The hidden table as text: a row per month, the label, then Last year and This year. */
const tableRows = (page: Page) =>
  table(page)
    .getByRole('row')
    .evaluateAll((rows) => rows.map((row) => [...row.children].map((cell) => cell.textContent)));

type Row = [label: string, lastYear: string, thisYear: string];
const header: Row = ['', 'Last year', 'This year'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const dollars = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** The rows of a chart: last year's cents and this year's (shorter: empty after it). */
const rows = (lastYear: number[], thisYear: number[]): Row[] =>
  MONTHS.map((label, index) => [
    label,
    dollars(lastYear[index]!),
    thisYear[index] === undefined ? '' : dollars(thisYear[index]),
  ]);

// Checked against demo-dataset.json in the zone with a script in the session scratchpad (task 024 References).
const year2025 = [
  199_240, 165_261, 179_972, 174_445, 197_844, 247_912, 193_421, 191_231, 180_894, 198_295, 183_411, 234_036,
];
const year2026ToToday = [206_616, 171_383, 186_636, 180_909, 204_616, 255_026, 200_588, 198_312, 187_595, 189_380];
const year2026 = [...year2026ToToday.slice(0, 9), 205_636, 190_204, 242_704];
const zeros = MONTHS.map(() => 0);

/** A first login's chart on Thu 22 Oct 2026 in Belgrade (AC3). */
const firstLoginRows = rows(year2025, year2026ToToday);

type CardShown = {
  name: string;
  total: string;
  percentage: string;
  arrow: string | null;
  compare: string;
  items: [name: string, amount: string, date: string, dateTime: string][];
  empty: string | null;
};

/** What each card shows: the header's name (soft hyphens left out), total, percentage, arrow and comparison text, and
 * the body's items or its empty message. */
async function cardsShown(page: Page): Promise<CardShown[]> {
  const red = await tokenColor(page, '--color-special-red');
  const green = await tokenColor(page, '--color-special-green');
  return cards(page).evaluateAll(
    (elements, [up, down, soft]) =>
      elements.map((cell) => {
        const [head, body] = [...cell.firstElementChild!.children];
        const [name, total, percentage, compare] = [...head!.querySelectorAll('p')];
        const arrow = percentage!.querySelector('svg');
        const color = arrow === null ? null : getComputedStyle(arrow).color;
        return {
          name: name!.textContent.replaceAll(soft, ''),
          total: total!.textContent,
          percentage: percentage!.textContent,
          arrow: color === up ? 'up' : color === down ? 'down' : color,
          compare: compare!.textContent,
          items: [...body!.querySelectorAll('li')].map((item) => {
            const [itemName, amount, date] = [...item.querySelectorAll('p')];
            return [
              itemName!.textContent,
              amount!.textContent,
              date!.textContent,
              item.querySelector('time')!.dateTime,
            ];
          }),
          empty: body!.querySelector(':scope > p')?.textContent ?? null,
        };
      }),
    [red, green, SOFT_HYPHEN] as const,
  );
}

const card = (
  name: string,
  total: string,
  percentage: string,
  arrow: 'up' | 'down' | null,
  items: CardShown['items'],
): CardShown => ({
  name,
  total,
  percentage,
  arrow,
  compare: 'Compare to last month',
  items,
  empty: items.length === 0 ? 'No expenses this month' : null,
});
const item = (name: string, amount: string, date: string, iso: string): CardShown['items'][number] => [
  name,
  amount,
  date,
  `${iso}T12:00:00.000Z`,
];

/** A first login's six cards (AC11, AC12): task 018's headers, the 2 most recent Complete expenses of October. */
const firstLoginCards: CardShown[] = [
  card('Housing', '$252.00', '17%', 'down', [
    item('Parking', '$20.16', '14 Oct, 2026', '2026-10-14'),
    item('House Rent', '$231.84', '1 Oct, 2026', '2026-10-01'),
  ]),
  card('Food', '$510.04', '7%', 'up', [
    item('Pizza', '$24.64', '20 Oct, 2026', '2026-10-20'),
    item('Restaurant bill', '$147.84', '18 Oct, 2026', '2026-10-18'),
  ]),
  card('Transportation', '$53.20', '32%', 'down', [
    item('Taxi fare', '$10.64', '19 Oct, 2026', '2026-10-19'),
    item('Taxi fare', '$10.64', '13 Oct, 2026', '2026-10-13'),
  ]),
  card('Entertainment', '$282.24', '16%', 'up', [
    item('Movie ticket', '$17.64', '21 Oct, 2026', '2026-10-21'),
    item('GTR 5', '$188.16', '17 Oct, 2026', '2026-10-17'),
  ]),
  card('Shopping', '$658.00', '14%', 'up', [
    item('Jeans', '$266.00', '22 Oct, 2026', '2026-10-22'),
    item('Shirt', '$322.00', '15 Oct, 2026', '2026-10-15'),
  ]),
  card('Others', '$138.32', '31%', 'down', [
    item('Donation', '$31.92', '11 Oct, 2026', '2026-10-11'),
    item('Loan installment', '$106.40', '10 Oct, 2026', '2026-10-10'),
  ]),
];

/** 1 Nov 2026 in Belgrade (AC14): Housing's one item, the other five $0.00, 100% down, with no item. */
const novemberCards: CardShown[] = [
  card('Housing', '$270.48', '1%', 'down', [item('House Rent', '$270.48', '1 Nov, 2026', '2026-11-01')]),
  ...['Food', 'Transportation', 'Entertainment', 'Shopping', 'Others'].map((name) =>
    card(name, '$0.00', '100%', 'down', []),
  ),
];

type OverviewShown = [name: string, total: string, percentage: string, arrow: string | null];

/** What Overview's six items show: the name, the total, the percentage line (its `*` dropped) and the arrow. */
async function overviewShown(page: Page): Promise<OverviewShown[]> {
  const red = await tokenColor(page, '--color-special-red');
  const green = await tokenColor(page, '--color-special-green');
  return overviewBreakdown(page)
    .getByRole('list')
    .getByRole('listitem')
    .evaluateAll(
      (elements, [up, down, soft]) =>
        elements.map((element) => {
          const [name, total, change] = [...element.querySelectorAll('p')];
          const arrow = change!.querySelector('svg');
          const color = arrow === null ? null : getComputedStyle(arrow).color;
          return [
            name!.textContent.replaceAll(soft, ''),
            total!.textContent,
            change!.textContent,
            color === up ? 'up' : color === down ? 'down' : color,
          ] as OverviewShown;
        }),
      [red, green, SOFT_HYPHEN] as const,
    );
}

/** The cards' headers as Overview shows them: the percentage with its `*` (none without a change). */
const asOverview = (shown: CardShown[]): OverviewShown[] =>
  shown.map(({ name, total, percentage, arrow }) => [name, total, percentage === '' ? '' : `${percentage}*`, arrow]);

/** The same backend session in another browser zone. */
async function inZone(browser: Browser, page: Page, timezoneId: string) {
  const context = await browser.newContext({
    baseURL: FRONTEND_URL,
    timezoneId,
    storageState: await page.context().storageState(),
  });
  const zonePage = await context.newPage();
  return { zonePage, close: () => context.close() };
}

/** The raw breakdown body as the backend sends it in `zone`, read with the page's session. */
async function breakdownBody(page: Page, zone: string) {
  const response = await page.request.get('/api/expenses/breakdown', { headers: { 'X-Time-Zone': zone } });
  expect(response.status()).toBe(200);
  return (await response.json()) as {
    categories: {
      category: string;
      total: { cents: number };
      change: { percent: number; direction: string | null } | null;
      recent: { item: string; amount: { cents: number }; occurredAt: string }[];
    }[];
  };
}

// T21: AC1 to AC3, AC9 to AC12, from the sidebar and from Overview's Housing arrow; the requests (#10, #21, #29, #55).
test('opens Expenses from the sidebar and from Overview’s Housing arrow with the chart and the six cards of a first login', async ({
  page,
}) => {
  await signUp(page.request);
  const sent: { path: string; zone: string | undefined }[] = [];
  page.on('request', (request) => {
    if (isExpensesRequest(request)) {
      sent.push({ path: new URL(request.url()).pathname, zone: request.headers()['x-time-zone'] });
    }
  });
  await page.goto('/overview');
  await waitForRecentTransactions(page);

  await sidebar(page).getByRole('link', { name: 'Expenses' }).click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/expenses`);
  await waitForExpenses(page);
  await expect(sidebar(page).locator('[aria-current="page"]')).toHaveText('Expenses');
  await expect(headerDate(page)).toHaveText('22 Oct, 2026');
  await expect(page.getByRole('banner').getByText(/^Hello /)).toHaveCount(0);
  await expect(main(page).getByRole('heading', { level: 2 })).toHaveText(['Expenses Comparison', 'Expenses Breakdown']);

  // AC2: the header row.
  await expect(control(page)).toHaveText('Monthly Comparison');
  await expect(legend(page).getByRole('listitem')).toHaveText(['This year', 'Last year']);
  const teal = await tokenColor(page, '--color-primary');
  const gray = await tokenColor(page, '--color-gray-05');
  const swatches = await legend(page)
    .locator('li > span')
    .evaluateAll((spans) => spans.map((span) => getComputedStyle(span).backgroundColor));
  expect(swatches).toEqual([teal, gray]);

  // AC3: 12 groups Jan to Dec, 12 gray bars and 10 teal ones to October, the axis $0 to $4k on 5 lines.
  expect(await tableRows(page)).toEqual([header, ...firstLoginRows]);
  await expect(plot(page)).toHaveAttribute('aria-hidden', 'true');
  await expect(plot(page).locator(':scope > svg text')).toHaveText(MONTHS);
  await expect(plot(page).locator(':scope > g > text')).toHaveText(['$0', '$1k', '$2k', '$3k', '$4k']);
  await expect(plot(page).locator(':scope > g > line')).toHaveCount(5);
  const fills = await bars(page).evaluateAll((paths) => paths.map((path) => getComputedStyle(path).fill));
  expect(fills).toEqual([...Array.from({ length: 10 }, () => [gray, teal]).flat(), gray, gray]);
  const lines = await plot(page).locator(':scope > g > line').all();
  const plotHeight = (await box(lines[0]!)).y - (await box(lines[4]!)).y;
  const cents = [...year2025.slice(0, 10).flatMap((last, index) => [last, year2026ToToday[index]!]), 183_411, 234_036];
  for (const [index, bar] of (await bars(page).all()).entries()) {
    expect(Math.abs((await box(bar)).height - (cents[index]! / 400_000) * plotHeight)).toBeLessThanOrEqual(1);
  }

  // AC10 to AC12: the six cards in order with their headers and items.
  expect(await cardsShown(page)).toEqual(firstLoginCards);

  // From Overview's Housing arrow (#21).
  await sidebar(page).getByRole('link', { name: 'Overview' }).click();
  await waitForRecentTransactions(page);
  await overviewBreakdown(page).getByRole('link', { name: 'Housing expenses', exact: true }).click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/expenses`);
  await waitForExpenses(page);
  expect(await cardsShown(page)).toEqual(firstLoginCards);
  expect(await tableRows(page)).toEqual([header, ...firstLoginRows]);

  // Only the two expenses paths, each with the browser's zone.
  expect([...new Set(sent.map(({ path }) => path))].toSorted()).toEqual([
    '/api/expenses/breakdown',
    '/api/expenses/monthly-comparison',
  ]);
  expect(sent.every(({ zone }) => zone === TIME_ZONE)).toBe(true);
});

// T21: AC9, AC20, nothing reacts on a hover or a click; nothing is focusable in the chart or the cards (#29).
test('changes nothing, shows no tooltip and sends nothing on a hover or a click on a bar, a card or an item', async ({
  page,
}) => {
  await openExpenses(page);
  const sent: string[] = [];
  page.on('request', (request) => sent.push(request.url()));
  const before = await main(page).innerHTML();

  await bars(page).nth(11).hover();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await bars(page).nth(10).click({ force: true });
  for (const index of [0, 4]) {
    await cards(page).nth(index).hover();
    await cards(page).nth(index).click();
    await cards(page).nth(index).locator('li').first().click();
    await cards(page).nth(index).locator('li').first().hover();
  }

  expect(await main(page).innerHTML()).toBe(before);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(page).toHaveURL(`${FRONTEND_URL}/expenses`);
  expect(sent).toEqual([]);
  await expect(breakdown(page).locator('a, button, input, select, textarea, [tabindex]')).toHaveCount(0);
  await expect(table(page).locator('xpath=..').locator('a, button, input, select, textarea, [tabindex]')).toHaveCount(
    0,
  );
  for (const element of [cards(page).first(), cards(page).first().locator('li').first(), bars(page).first()]) {
    expect(await computed(element, 'cursor')).toBe('auto');
  }
  // No hover style: the card's background and shadow stay as they are under the pointer.
  const firstCard = cards(page).first().locator(':scope > div');
  const look = async () => [await computed(firstCard, 'background-color'), await computed(firstCard, 'box-shadow')];
  await page.mouse.move(5, 5);
  const resting = await look();
  await firstCard.hover();
  expect(await look()).toEqual(resting);
});

// T22: AC13 to AC15, AC26, Overview and Expenses agree with the one breakdown body; Overview never shows the items.
async function expectBothPagesAgree(page: Page, zone: string, expected: CardShown[]) {
  const body = await breakdownBody(page, zone);
  await page.goto('/overview');
  await waitForRecentTransactions(page);
  await expect(overviewBreakdown(page).getByRole('list').getByRole('listitem')).toHaveCount(6);
  const overview = await overviewShown(page);
  const overviewText = (await overviewBreakdown(page).textContent()) ?? '';
  const totals = new Set(body.categories.map(({ total }) => total.cents));
  for (const recent of body.categories.flatMap((each) => each.recent)) {
    expect(overviewText, `Overview shows no item: ${recent.item}`).not.toContain(recent.item);
    // An item's amount shows on Overview only where it is also a category's total (1 Nov: the House Rent alone).
    if (!totals.has(recent.amount.cents)) expect(overviewText).not.toContain(dollars(recent.amount.cents));
  }
  await expect(overviewBreakdown(page).locator('time')).toHaveCount(0);

  await overviewBreakdown(page).getByRole('link', { name: 'Housing expenses', exact: true }).click();
  await waitForExpenses(page);
  const shown = await cardsShown(page);
  expect(shown).toEqual(expected);
  expect(overview).toEqual(asOverview(shown));
  // Both screens show the body as sent.
  expect(shown.map(({ total }) => total)).toEqual(body.categories.map(({ total }) => dollars(total.cents)));
  expect(shown.map(({ items }) => items.map(([name]) => name))).toEqual(
    body.categories.map(({ recent }) => recent.map(({ item: name }) => name)),
  );
}

test('shows Overview’s totals and changes on the cards at the fixed clock and at 1 Nov in Belgrade and New York', async ({
  page,
  browser,
}) => {
  await signUp(page.request);
  await expectBothPagesAgree(page, TIME_ZONE, firstLoginCards);

  // 2026-10-31T23:00:00Z: 00:00 on 1 Nov in Belgrade, 19:00 on 31 Oct in New York.
  await moveBackendClock(page, '2026-10-31T23:00:00Z');
  await signUp(page.request);
  await expectBothPagesAgree(page, TIME_ZONE, novemberCards);
  // AC14: Housing's one item at the body's top with no divider; "No expenses this month" centred in the others.
  const housingItem = cards(page).first().locator('li');
  await expect(housingItem).toHaveCount(1);
  expect(await computed(housingItem, 'border-bottom-width')).toBe('0px');
  const housingBody = await box(cards(page).first().locator(':scope > div > div').last());
  const itemBox = await box(housingItem);
  expect(itemBox.y).toBe(housingBody.y);
  for (const index of [1, 2, 3, 4, 5]) {
    const body = await box(cards(page).nth(index).locator(':scope > div > div').last());
    const message = await box(cards(page).nth(index).getByText('No expenses this month'));
    expect(Math.abs(message.x + message.width / 2 - (body.x + body.width / 2))).toBeLessThanOrEqual(1);
    expect(Math.abs(message.y + message.height / 2 - (body.y + (body.height - 8) / 2))).toBeLessThanOrEqual(1);
    expect((await box(cards(page).nth(index))).height).toBe(238);
  }

  const newYork = await inZone(browser, page, NEW_YORK);
  const october = await breakdownBody(newYork.zonePage, NEW_YORK);
  expect(october.categories.map(({ total }) => total.cents)).toEqual([27_216, 56_424, 7_448, 29_988, 68_600, 15_960]);
  await expectBothPagesAgree(newYork.zonePage, NEW_YORK, [
    card('Housing', '$272.16', '10%', 'down', [
      item('Parking', '$20.16', '27 Oct, 2026', '2026-10-27'),
      item('Parking', '$20.16', '14 Oct, 2026', '2026-10-14'),
    ]),
    card('Food', '$564.24', '19%', 'up', [
      item('Biriyani', '$14.78', '31 Oct, 2026', '2026-10-31'),
      item('Pizza', '$24.64', '28 Oct, 2026', '2026-10-28'),
    ]),
    card('Transportation', '$74.48', '5%', 'down', [
      item('Taxi fare', '$10.64', '29 Oct, 2026', '2026-10-29'),
      item('Taxi fare', '$10.64', '25 Oct, 2026', '2026-10-25'),
    ]),
    card('Entertainment', '$299.88', '24%', 'up', [
      item('Movie ticket', '$17.64', '30 Oct, 2026', '2026-10-30'),
      item('Movie ticket', '$17.64', '21 Oct, 2026', '2026-10-21'),
    ]),
    card('Shopping', '$686.00', '19%', 'up', [
      item('Polo shirt', '$28.00', '26 Oct, 2026', '2026-10-26'),
      item('Jeans', '$266.00', '22 Oct, 2026', '2026-10-22'),
    ]),
    card('Others', '$159.60', '21%', 'down', [
      item('Gift', '$21.28', '24 Oct, 2026', '2026-10-24'),
      item('Donation', '$31.92', '11 Oct, 2026', '2026-10-11'),
    ]),
  ]);
  await newYork.close();
});

test('shows Overview’s totals with no change and the six $0.00 on the cards before and at the start of the dataset', async ({
  page,
}) => {
  // AC15: last month $0.00 on 15 Jan 2022: the totals with an empty percentage line and "Compare to last month".
  await moveBackendClock(page, '2022-01-15T10:00:00Z');
  await signUp(page.request);
  await expectBothPagesAgree(page, TIME_ZONE, [
    card('Housing', '$237.50', '', null, [
      item('Parking', '$19.00', '14 Jan, 2022', '2022-01-14'),
      item('House Rent', '$218.50', '1 Jan, 2022', '2022-01-01'),
    ]),
    card('Food', '$273.79', '', null, [
      item('Pizza', '$20.90', '8 Jan, 2022', '2022-01-08'),
      item('Biriyani', '$12.54', '5 Jan, 2022', '2022-01-05'),
    ]),
    card('Transportation', '$36.11', '', null, [
      item('Taxi fare', '$9.03', '13 Jan, 2022', '2022-01-13'),
      item('Metro Card bill', '$18.05', '7 Jan, 2022', '2022-01-07'),
    ]),
    card('Entertainment', '$74.10', '', null, [
      item('iTunes', '$57.00', '12 Jan, 2022', '2022-01-12'),
      item('Movie ticket', '$17.10', '6 Jan, 2022', '2022-01-06'),
    ]),
    card('Shopping', '$305.91', '', null, [
      item('Shirt', '$251.28', '15 Jan, 2022', '2022-01-15'),
      item('Keyboard', '$32.78', '9 Jan, 2022', '2022-01-09'),
    ]),
    card('Others', '$111.15', '', null, [
      item('Donation', '$25.65', '11 Jan, 2022', '2022-01-11'),
      item('Loan installment', '$85.50', '10 Jan, 2022', '2022-01-10'),
    ]),
  ]);
  // The empty percentage line keeps its 24 height, so "Compare to last month" stays where it is with a change.
  const percentage = cards(page).first().locator('p').nth(2);
  expect((await box(percentage)).height).toBe(24);
  await expect(breakdown(page).getByText('compared to last month')).toHaveCount(0);

  await moveBackendClock(page, '2021-12-31T10:00:00Z');
  await signUp(page.request);
  await expectBothPagesAgree(
    page,
    TIME_ZONE,
    ['Housing', 'Food', 'Transportation', 'Entertainment', 'Shopping', 'Others'].map((name) =>
      card(name, '$0.00', '', null, []),
    ),
  );
});

// T23: AC5, AC7, the chart's months at the month and year edges per zone, and the empty states (#54, #55, #91 c).
test('shows the chart’s months at 1 Nov and 1 Jan in Belgrade and New York', async ({ page, browser }) => {
  await moveBackendClock(page, '2026-10-31T23:00:00Z');
  await openExpenses(page);
  expect(await tableRows(page)).toEqual([header, ...rows(year2025, [...year2026.slice(0, 10), 27_048])]);
  const newYork = await inZone(browser, page, NEW_YORK);
  await newYork.zonePage.goto('/expenses');
  await waitForExpenses(newYork.zonePage);
  expect(await tableRows(newYork.zonePage)).toEqual([header, ...rows(year2025, year2026.slice(0, 10))]);
  await newYork.close();

  // 2026-12-31T23:00:00Z: 00:00 on 1 Jan 2027 in Belgrade, 18:00 on 31 Dec in New York.
  await moveBackendClock(page, '2026-12-31T23:00:00Z');
  await openExpenses(page);
  expect(await tableRows(page)).toEqual([header, ...rows(year2026, [26_680])]);
  await expect(plot(page).locator(':scope > g > text')).toHaveText(['$0', '$1k', '$2k', '$3k', '$4k']);
  const nextYork = await inZone(browser, page, NEW_YORK);
  await nextYork.zonePage.goto('/expenses');
  await waitForExpenses(nextYork.zonePage);
  expect(await tableRows(nextYork.zonePage)).toEqual([header, ...rows(year2025, year2026)]);
  await nextYork.close();
});

test('shows "No expenses this year or last year" in the 260 card, and no gray bar when last year is all 0', async ({
  page,
}) => {
  await moveBackendClock(page, '2021-12-31T10:00:00Z');
  await openExpenses(page);
  await expect(comparison(page).getByText('No expenses this year or last year')).toBeVisible();
  await expect(table(page)).toHaveCount(0);
  await expect(control(page)).toHaveText('Monthly Comparison');
  await expect(legend(page)).toBeVisible();
  const cardBox = await box(chartCard(page));
  expect(cardBox.height).toBe(260);
  const message = await box(comparison(page).getByText('No expenses this year or last year'));
  expect(Math.abs(message.y + message.height / 2 - (cardBox.y + 48 + 94))).toBeLessThanOrEqual(2);

  await moveBackendClock(page, '2022-01-15T10:00:00Z');
  await openExpenses(page);
  expect(await tableRows(page)).toEqual([header, ...rows(zeros, [103_856])]);
  const teal = await tokenColor(page, '--color-primary');
  const fills = await bars(page).evaluateAll((paths) => paths.map((path) => getComputedStyle(path).fill));
  expect(fills).toEqual([teal]);
  await expect(plot(page).locator(':scope > g > text')).toHaveText(['$0', '$500', '$1k', '$1.5k', '$2k']);
});

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

// T24: AC19, each widget's skeleton at its size, its error state with the other widget working, and a keyboard Retry
// that keeps focus in the widget with the ring (#6, #87, #88, #114, #116).
test('shows the chart’s skeleton at 260 and its error state, the cards working; a keyboard Retry keeps focus there', async ({
  page,
}) => {
  await signUp(page.request);
  const route = await controlRoute(page, '**/api/expenses/monthly-comparison');
  await page.goto('/expenses');

  await expect(cards(page)).toHaveCount(6);
  const busy = comparison(page).locator('[aria-busy="true"]');
  await expect(busy).toBeVisible();
  expect((await box(chartCard(page))).height).toBe(260);
  expect((await box(busy)).height).toBe(188);
  await expect(control(page)).toHaveText('Monthly Comparison');

  await route.fail();
  await expect(comparison(page).getByRole('alert')).toHaveText('Something went wrong.', { timeout: 15_000 });
  expect((await box(chartCard(page))).height).toBe(260);
  expect(await cardsShown(page)).toEqual(firstLoginCards);

  await control(page).focus();
  await page.keyboard.press('Tab');
  await expect(comparison(page).getByRole('button', { name: 'Retry' })).toBeFocused();
  route.pass();
  await page.keyboard.press('Enter');

  await expect(table(page).getByRole('row')).toHaveCount(13);
  expect(await tableRows(page)).toEqual([header, ...firstLoginRows]);
  await expect(dataStateRoot(comparison(page))).toBeFocused();
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
  await expectRing(page, dataStateRoot(comparison(page)));
});

test('shows six skeleton cards at 238 and the cards’ error state in one card, the chart working; Retry loads them', async ({
  page,
}) => {
  await signUp(page.request);
  const route = await controlRoute(page, '**/api/expenses/breakdown');
  await page.goto('/expenses');

  await expect(table(page)).toHaveCount(1);
  const busy = breakdown(page).locator('[aria-busy="true"]');
  await expect(busy).toBeVisible();
  // DataState's hidden wrapper, the cards' grid, then the six skeleton cards.
  const skeletonCards = busy.locator(':scope > div > div > div');
  await expect(skeletonCards).toHaveCount(6);
  for (const index of [0, 1, 2, 3, 4, 5]) expect((await box(skeletonCards.nth(index))).height).toBe(238);
  expect((await box(busy)).height).toBe(238 + 24 + 238);

  await route.fail();
  const alert = breakdown(page).getByRole('alert');
  await expect(alert).toHaveText('Something went wrong.', { timeout: 15_000 });
  // One white card across the grid's width, 238 high.
  const errorCard = breakdown(page).locator(':scope > div').last();
  const errorBox = await box(errorCard);
  expect(errorBox.height).toBe(238);
  expect(errorBox.width).toBe((await box(chartCard(page))).width);
  expect(await computed(errorCard, 'background-color')).toBe(await tokenColor(page, '--color-white'));
  expect(await tableRows(page)).toEqual([header, ...firstLoginRows]);

  await control(page).focus();
  await page.keyboard.press('Tab');
  await expect(breakdown(page).getByRole('button', { name: 'Retry' })).toBeFocused();
  route.pass();
  await page.keyboard.press('Enter');

  await expect(cards(page)).toHaveCount(6);
  expect(await cardsShown(page)).toEqual(firstLoginCards);
  await expect(dataStateRoot(breakdown(page))).toBeFocused();
  await expectRing(page, dataStateRoot(breakdown(page)));
});

// T25: AC8, AC20, the control and the Tab order (#29, #60, #87, #90 a).
test('opens "Monthly Comparison" by mouse and keyboard with one option; Tab goes from the search field to it and out', async ({
  page,
}) => {
  await openExpenses(page);
  const sent: string[] = [];
  page.on('request', (request) => sent.push(request.url()));

  await control(page).click();
  const option = page.getByRole('option', { name: 'Monthly Comparison' });
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(option).toHaveAttribute('aria-selected', 'true');
  await option.click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(control(page)).toHaveText('Monthly Comparison');
  // No ring after a pointer choice: Radix focuses the trigger by script, and the ring is hidden for it (#87).
  expect(await computed(control(page), 'outline-style')).toBe('none');

  for (const key of ['Enter', ' ', 'ArrowDown']) {
    await control(page).focus();
    await page.keyboard.press(key);
    await expect(page.getByRole('option')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(control(page)).toBeFocused();
  }
  expect(sent).toEqual([]);
  expect(await tableRows(page)).toEqual([header, ...firstLoginRows]);

  await search(page).focus();
  await page.keyboard.press('Tab');
  await expect(control(page)).toBeFocused();
  await expectRing(page, control(page));
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.querySelector('main')!.contains(document.activeElement))).toBe(false);
  await page.keyboard.press('Shift+Tab');
  await expect(control(page)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(search(page)).toBeFocused();
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

/** The parts of each card: the card, its header and body, the tile, the two blocks, every text with its line count,
 * the percentage's arrow, and each item with its texts and its divider. */
const cardParts = (page: Page) =>
  cards(page).evaluateAll((cells) =>
    cells.map((cell) => {
      // An element's own box, and the box of its text with the number of lines it takes. Methods, as the page runs
      // this function alone (no helper from the test's scope reaches it).
      const measure = {
        own(this: void, node: Element) {
          const { x, y, width, height } = node.getBoundingClientRect();
          return { x, y, width, height };
        },
        text(this: void, node: Element) {
          const range = document.createRange();
          range.selectNodeContents(node);
          const { x, y, width, height } = range.getBoundingClientRect();
          // The lines of its text only: an icon in the line (the percentage's arrow) has a box of its own.
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
          const lineTops = new Set<number>();
          for (let textNode = walker.nextNode(); textNode !== null; textNode = walker.nextNode()) {
            const textRange = document.createRange();
            textRange.selectNodeContents(textNode);
            for (const line of textRange.getClientRects()) lineTops.add(Math.round(line.y));
          }
          return { x, y, width, height, lines: lineTops.size };
        },
      };
      const { own, text } = measure;
      const cardElement = cell.firstElementChild!;
      const [head, body] = [...cardElement.children];
      const [tile, textArea] = [...head!.children];
      const [left, right] = [...textArea!.children];
      const [name, total, percentage, compare] = [...head!.querySelectorAll('p')];
      const arrow = percentage!.querySelector('svg');
      return {
        card: own(cardElement),
        header: own(head!),
        body: own(body!),
        tile: own(tile!),
        left: own(left!),
        right: own(right!),
        name: text(name!),
        total: text(total!),
        percentage: text(percentage!),
        arrow: arrow === null ? null : own(arrow),
        compare: text(compare!),
        items: [...body!.querySelectorAll('li')].map((element) => {
          const [itemName, amount, date] = [...element.querySelectorAll('p')];
          const style = getComputedStyle(element);
          return {
            box: own(element),
            name: text(itemName!),
            amount: text(amount!),
            date: text(date!),
            divider: [style.borderBottomWidth, style.borderBottomColor],
          };
        }),
      };
    }),
  );

/**
 * AC22: the titles, the chart card, its header row, and the cards with their headers, tiles, texts, arrows, items and
 * dividers where References measures them on 109 (the header row 8 lower, #93 a), x from the page's right edge (#94,
 * #101). `sideBySide` says per card whether its header's right block is beside its left block (1440 and wider with the
 * demo data) or under it (1280, a long total); `asDrawn` (the demo data) checks the 109 heights: the 78 header, the
 * 238 card, an item every 76. With any data nothing overlaps and nothing leaves its card (AC23).
 */
async function expectLayout(
  page: Page,
  { sideBySide, asDrawn }: { sideBySide: (card: number) => boolean; asDrawn: boolean },
) {
  const right = await pageRight(page);
  const content = { x: 304, right: right - 32 };
  const width = content.right - content.x;
  const titles = main(page).getByRole('heading', { level: 2 });
  near((await box(titles.first())).x, 304, 'first title x');
  near((await box(titles.first())).y, 104, 'first title y');
  const chart = await box(chartCard(page));
  near(chart.x, 304, 'chart card x');
  near(chart.y, 152, 'chart card y');
  near(chart.width, width, 'chart card width');
  near(chart.height, 260, 'chart card height');
  const controlBox = await box(control(page));
  near(controlBox.x, chart.x + 24, 'control x');
  near(controlBox.y, chart.y + 24, 'control y (8 lower than 109, #93 a)');
  const legendBox = await box(legend(page));
  near(legendBox.x + legendBox.width, chart.x + chart.width - 24, 'legend right edge');
  near((await box(titles.nth(1))).y, chart.y + 260 + 32, 'second title y');

  const parts = await cardParts(page);
  const gray06 = await tokenColor(page, '--color-gray-06');
  const cardWidth = (width - 48) / 3;
  let rowTop = chart.y + 260 + 32 + 32 + 16;
  for (const row of [0, 1]) {
    const rowCards = parts.slice(row * 3, row * 3 + 3);
    const rowHeight = Math.max(...rowCards.map((each) => each.card.height));
    for (const [column, each] of rowCards.entries()) {
      const index = row * 3 + column;
      const what = `card ${index + 1}`;
      near(each.card.x, content.x + column * (cardWidth + 24), `${what} x`);
      near(each.card.y, rowTop, `${what} y`);
      near(each.card.width, cardWidth, `${what} width`);
      near(each.card.height, rowHeight, `${what} stretched to its row`);
      expect(each.card.height, `${what} at least 238`).toBeGreaterThanOrEqual(237.5);
      // The header: 78 at least, the tile 24 in and centred while the blocks are side by side.
      near(each.header.y, each.card.y, `${what} header y`);
      near(each.tile.x, each.card.x + 24, `${what} tile x`);
      expect(each.tile).toMatchObject({ width: 40, height: 48 });
      near(each.left.x, each.tile.x + 40 + 16, `${what} text 16 after the tile`);
      near(each.right.x + each.right.width, each.card.x + each.card.width - 24, `${what} right block at the edge`);
      if (each.arrow)
        near(each.arrow.x + each.arrow.width, each.card.x + each.card.width - 24, `${what} arrow at the edge`);
      if (sideBySide(index)) {
        near(each.header.height, 78, `${what} header 78`);
        near(each.tile.y, each.card.y + 15, `${what} tile centred`);
        near(each.left.y, each.card.y + 15, `${what} left block centred`);
        near(each.right.y, each.left.y + 8, `${what} right block 8 lower`);
        near(each.right.y + each.right.height, each.left.y + each.left.height, `${what} blocks end level`);
        expect(each.compare.x - (each.total.x + each.total.width), `${what} 8 after the total`).toBeGreaterThanOrEqual(
          7.5,
        );
        near(each.body.y, each.card.y + 78, `${what} body under the header`);
        if (asDrawn) near(each.card.height, 238, `${what} 238`);
      } else {
        expect(each.right.y, `${what} right block under the left`).toBeGreaterThanOrEqual(
          each.left.y + each.left.height + 7.5,
        );
        expect(each.header.height, `${what} header grows`).toBeGreaterThan(78);
      }
      for (const text of [each.name, each.total, each.percentage, each.compare]) {
        if (text.width > 0) expect(text.lines, `${what}: header texts on one line`).toBe(1);
      }
      // The items: one every 76 from the body's top as drawn, the divider under every item but the last.
      let itemTop = each.body.y;
      for (const [position, line] of each.items.entries()) {
        const which = `${what} item ${position + 1}`;
        near(line.box.y, itemTop, `${which} y`);
        if (asDrawn) near(line.box.height, 76, `${which} 76`);
        near(line.name.x, each.card.x + 24, `${which} name x`);
        near(line.amount.x + line.amount.width, each.card.x + each.card.width - 24, `${which} amount at the edge`, 1);
        near(line.date.x + line.date.width, each.card.x + each.card.width - 24, `${which} date at the edge`, 1);
        const divided = position < each.items.length - 1;
        const contentMiddle = line.box.y + (line.box.height - (divided ? 1 : 0)) / 2;
        near(line.name.y + line.name.height / 2, contentMiddle, `${which} name centred`, 1);
        expect(line.amount.lines, `${which} amount on one line`).toBe(1);
        expect(line.divider, `${which} divider`).toEqual(divided ? ['1px', gray06] : ['0px', expect.any(String)]);
        itemTop += line.box.height;
      }
      if (asDrawn && each.items.length === 2) near(each.body.height, 160, `${what} body 160`);
      // Nothing overlaps and nothing leaves the card.
      const shown = [
        each.tile,
        each.name,
        each.total,
        ...(each.percentage.width > 0 ? [each.percentage] : []),
        each.compare,
        ...each.items.flatMap((line) => [line.name, line.amount, line.date]),
      ];
      for (const [a, first] of shown.entries()) {
        expect(inside(first, each.card), `${what}: part ${a} inside the card`).toBe(true);
        for (const second of shown.slice(a + 1)) expect(overlaps(first, second), `${what}: parts overlap`).toBe(false);
      }
    }
    rowTop += rowHeight + 24;
  }
  expect(await scrollWidth(page), 'no horizontal scroll').toBe(Math.round(right));
  return parts;
}

// T26: AC22, 109's layout at 1440x1024 with no scroll, wider at 1920 and 2560, the right blocks under at 1280 (#94,
// #101, #106).
test('places the chart card and the cards where 109 does at 1440, wider at 1920 and 2560, the right blocks under at 1280', async ({
  page,
}) => {
  await openExpenses(page);
  await expectLayout(page, { sideBySide: () => true, asDrawn: true });
  expect(await page.evaluate(() => document.documentElement.scrollHeight), 'no vertical scroll at 1440x1024').toBe(
    1024,
  );

  let width = 0;
  for (const [viewportWidth, height] of [
    [1920, 1080],
    [2560, 1440],
  ] as const) {
    await page.setViewportSize({ width: viewportWidth, height });
    const parts = await expectLayout(page, { sideBySide: () => true, asDrawn: true });
    expect(parts[0]!.card.width, `${viewportWidth}: cards wider`).toBeGreaterThan(width);
    width = parts[0]!.card.width;
    near((await box(chartCard(page))).height, 260, `${viewportWidth}: the chart card 260`);
  }

  await page.setViewportSize({ width: 1280, height: 1024 });
  await expectLayout(page, { sideBySide: () => false, asDrawn: true });
});

/** The long data of AC23: 120-character item names in words and with no space, a $1,000,000,000.00 total and item. */
async function routeLongData(page: Page) {
  const words = 'Annual premium subscription renewal for the whole family '.repeat(3).slice(0, 120);
  const noSpace = 'Annualpremiumsubscriptionrenewalforthewholefamily'.repeat(3).slice(0, 120);
  await page.route('**/api/expenses/breakdown', async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as {
      categories: { total: { cents: number }; recent: { item: string; amount: { cents: number } }[] }[];
    };
    body.categories[0]!.total.cents = 100_000_000_000;
    body.categories[0]!.recent[0]!.item = words;
    body.categories[0]!.recent[0]!.amount.cents = 100_000_000_000;
    body.categories[1]!.recent[0]!.item = noSpace;
    await route.fulfill({ response, json: body });
  });
}

// T26: AC23, long names wrap inside their column, the amounts and the total stay on one line, the card grows and its
// row stretches (#106, #108 b, #111 a, #113 a, #115 b).
for (const [width, height] of [
  [1440, 1024],
  [1280, 1024],
] as const) {
  test(`wraps 120-character item names and keeps $1,000,000,000.00 whole at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await routeLongData(page);
    await openExpenses(page);

    const parts = await expectLayout(page, {
      // At 1440 only the $1,000,000,000.00 total (Housing) moves its right block under; at 1280 every card does.
      sideBySide: (index) => width === 1440 && index !== 0,
      asDrawn: false,
    });
    const [housing, food, transportation] = parts;
    for (const [index, each] of [housing!, food!].entries()) {
      expect(each.items[0]!.name.lines, `card ${index + 1}: the long name wraps`).toBeGreaterThan(1);
      expect(each.items[0]!.box.height, `card ${index + 1}: the item grows`).toBeGreaterThan(76);
      expect(each.card.height, `card ${index + 1} grows`).toBeGreaterThan(238);
    }
    expect(housing!.total.lines, 'the $1,000,000,000.00 total on one line').toBe(1);
    expect(housing!.items[0]!.amount.lines, 'the $1,000,000,000.00 amount on one line').toBe(1);
    await expect(cards(page).first().locator('p').nth(1)).toHaveText('$1,000,000,000.00');
    // The row's third card stretches with it; its extra height empty under its body.
    near(transportation!.card.height, housing!.card.height, 'Transportation stretched with its row');
    expect(transportation!.body.y + transportation!.body.height).toBeLessThan(
      transportation!.card.y + transportation!.card.height - 1,
    );
    const overflowing = await breakdown(page).evaluate(
      (root) =>
        [root, ...root.querySelectorAll('*')].filter(
          (node) =>
            (node.clientWidth > 1 && node.scrollWidth > node.clientWidth + 1) ||
            (node.clientHeight > 1 && node.scrollHeight > node.clientHeight + 1),
        ).length,
    );
    expect(overflowing, 'nothing scrolls inside a card').toBe(0);
  });
}

// T27: AC21, the two regions in Chromium's accessibility tree (#113 b, #115 b).
test('exposes the control, the legend, the chart’s table and the six cards with their changes and items', async ({
  page,
}) => {
  await openExpenses(page);

  await expect(comparison(page)).toMatchAriaSnapshot(`
    - region "Expenses Comparison":
      - heading "Expenses Comparison" [level=2]
      - combobox "Expenses Comparison": Monthly Comparison
      - list:
        - listitem: This year
        - listitem: Last year
      - table "Expenses per month, this year and last year":
        - caption: Expenses per month, this year and last year
        - rowgroup:
          - row "Last year This year":
            - cell
            - columnheader "Last year"
            - columnheader "This year"
        - rowgroup:
          - row "Jan $1,992.40 $2,066.16":
            - rowheader "Jan"
            - cell "$1,992.40"
            - cell "$2,066.16"
          - row /Feb/
          - row /Mar/
          - row /Apr/
          - row /May/
          - row /Jun/
          - row /Jul/
          - row /Aug/
          - row /Sep/
          - row "Oct $1,982.95 $1,893.80":
            - rowheader "Oct"
            - cell "$1,982.95"
            - cell "$1,893.80"
          - row "Nov $1,834.11":
            - rowheader "Nov"
            - cell "$1,834.11"
            - cell
          - row "Dec $2,340.36":
            - rowheader "Dec"
            - cell "$2,340.36"
            - cell
  `);
  await expect(breakdown(page)).toMatchAriaSnapshot(`
    - region "Expenses Breakdown":
      - heading "Expenses Breakdown" [level=2]
      - list:
        - listitem "Housing":
          - heading "Housing" [level=3]
          - paragraph: $252.00
          - text: down 17% compared to last month
          - list:
            - listitem:
              - paragraph: Parking
              - paragraph: $20.16
              - paragraph:
                - time: 14 Oct, 2026
            - listitem:
              - paragraph: House Rent
              - paragraph: $231.84
              - paragraph:
                - time: 1 Oct, 2026
        - listitem "Food":
          - heading "Food" [level=3]
          - paragraph: $510.04
          - text: up 7% compared to last month
          - list:
            - listitem:
              - paragraph: Pizza
              - paragraph: $24.64
              - paragraph:
                - time: 20 Oct, 2026
            - listitem:
              - paragraph: Restaurant bill
              - paragraph: $147.84
              - paragraph:
                - time: 18 Oct, 2026
        - listitem "Transportation":
          - heading "Transportation" [level=3]
          - paragraph: $53.20
          - text: down 32% compared to last month
          - list:
            - listitem:
              - paragraph: Taxi fare
              - paragraph: $10.64
              - paragraph:
                - time: 19 Oct, 2026
            - listitem:
              - paragraph: Taxi fare
              - paragraph: $10.64
              - paragraph:
                - time: 13 Oct, 2026
        - listitem "Entertainment":
          - heading "Entertainment" [level=3]
          - paragraph: $282.24
          - text: up 16% compared to last month
          - list:
            - listitem:
              - paragraph: Movie ticket
              - paragraph: $17.64
              - paragraph:
                - time: 21 Oct, 2026
            - listitem:
              - paragraph: GTR 5
              - paragraph: $188.16
              - paragraph:
                - time: 17 Oct, 2026
        - listitem "Shopping":
          - heading "Shopping" [level=3]
          - paragraph: $658.00
          - text: up 14% compared to last month
          - list:
            - listitem:
              - paragraph: Jeans
              - paragraph: $266.00
              - paragraph:
                - time: 22 Oct, 2026
            - listitem:
              - paragraph: Shirt
              - paragraph: $322.00
              - paragraph:
                - time: 15 Oct, 2026
        - listitem "Others":
          - heading "Others" [level=3]
          - paragraph: $138.32
          - text: down 31% compared to last month
          - list:
            - listitem:
              - paragraph: Donation
              - paragraph: $31.92
              - paragraph:
                - time: 11 Oct, 2026
            - listitem:
              - paragraph: Loan installment
              - paragraph: $106.40
              - paragraph:
                - time: 10 Oct, 2026
  `);
  const tree = JSON.stringify(await breakdown(page).ariaSnapshot());
  expect(tree).not.toContain(SOFT_HYPHEN);
  expect(tree).not.toContain('Compare to last month');
  expect(tree).not.toMatch(/\d%\*/);
});
