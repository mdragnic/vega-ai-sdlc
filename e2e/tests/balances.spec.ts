import type { Locator, Page, Route } from '@playwright/test';

import { FRONTEND_URL } from '../constants';
import { expect, test } from '../fixtures';
import { box, computed, expectNoRingOnMouseFocus, expectRing, signUp, tokenColor, within2 } from '../helpers';

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const activeItem = (page: Page) => sidebar(page).locator('a[aria-current="page"]');
const balances = (page: Page) => page.getByRole('main').getByRole('region', { name: 'Balances' });
/** The section's content: the grid, the skeleton row, or the white card of the error and empty states. */
const content = (page: Page) => balances(page).locator(':scope > div').last();
const grid = (page: Page) => balances(page).getByRole('list');
/** Every cell of the grid, the hidden Add Accounts cell too. */
const cells = (page: Page) => grid(page).locator(':scope > li');
/** The account cards, as assistive technology lists them. */
const cards = (page: Page) => grid(page).getByRole('listitem');
const details = (page: Page) => balances(page).getByRole('link', { name: 'Details' });
const search = (page: Page) => page.getByRole('searchbox', { name: 'Search' });
const totalBalance = (page: Page) => page.getByRole('main').getByRole('region', { name: 'Total Balance' });
/** DataState's root after a Retry, which gives it tabindex="-1". */
const dataStateRoot = (page: Page) => balances(page).locator('[tabindex="-1"]');
const isBodyFocused = (page: Page) => page.evaluate(() => document.activeElement === document.body);
const mainHasFocus = (page: Page) =>
  page.evaluate(() => document.querySelector('main')!.contains(document.activeElement));

/** A first login's five cards on 22 Oct 2026 (demo-data.md; AC2). */
const firstLogin = [
  {
    type: 'Credit Card',
    bankName: 'Master Card',
    logo: 'Mastercard',
    number: '**** **** **** 2598',
    balance: '$21,019.18',
  },
  { type: 'Checking', bankName: 'AB Bank Ltd', logo: 'VISA', number: '**** **** **** 7310', balance: '$33,362.48' },
  { type: 'Savings', bankName: 'Brac Bank Ltd.', logo: null, number: '**** **** **** 4421', balance: '$27,356.80' },
  { type: 'Investment', bankName: 'AB Bank Ltd', logo: null, number: '**** **** **** 6652', balance: '$29,503.00' },
  { type: 'Loan', bankName: 'City Bank Ltd.', logo: null, number: '**** **** **** 9083', balance: '$19,013.21' },
];

/** The full numbers stored for every user (demo-data.md), never sent (#25). */
const fullNumbers = [
  '3388455688602598',
  '6934566990127310',
  '1334568868014421',
  '6984568662016652',
  '3634568966019083',
];

/** A 100-character Bank Name in words, and one with no space (#26). */
const longNameInWords =
  'The First Community Cooperative Savings and Commercial Bank of Greater Dhaka and Chittagong Division';
const longNameNoSpace =
  'InternationalcommercialandcooperativesavingsbankInternationalcommercialandcooperativesavingsbankInte';

/** Waits until Balances shows its cards and the Add Accounts cell. */
async function waitForCards(page: Page, count = 5) {
  await expect(cards(page)).toHaveCount(count);
  await expect(cells(page)).toHaveCount(count + 1);
  await expect(page.getByRole('main').locator('[aria-busy="true"]')).toHaveCount(0);
}

/** Signs up a new user and opens Balances once its cards show. */
async function openBalances(page: Page) {
  await signUp(page.request);
  await page.goto('/balances');
  await waitForCards(page);
}

/** What each card shows: the type, the Bank Name, the logo's name, the number, the balance and the two labels. */
const shown = (page: Page) =>
  cards(page).evaluateAll((elements) =>
    elements.map((card) => ({
      type: card.querySelector('h3')!.textContent,
      bankName: card.querySelector('h3 + div > p')!.textContent,
      logo: card.querySelector('img')?.getAttribute('alt') ?? null,
      number: card.querySelectorAll('dd')[0]!.textContent,
      balance: card.querySelectorAll('dd')[1]!.textContent,
      labels: [...card.querySelectorAll('dt')].map((label) => label.textContent),
    })),
  );

const withLabels = (expected: typeof firstLogin) =>
  expected.map((card) => ({ ...card, labels: ['Account Number', 'Total amount'] }));

/**
 * Answers `GET /api/accounts` with the real response changed by `change` (the backend's ids, masks and balances
 * kept), for a long Bank Name or more accounts.
 */
async function changeAccounts(page: Page, change: (body: AccountsBody) => AccountsBody) {
  await page.route('**/api/accounts', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: change((await response.json()) as AccountsBody) });
  });
}

type AccountsBody = {
  totalBalance: { cents: number; currency: string };
  accounts: { id: number; bankName: string; maskedNumber: string; [key: string]: unknown }[];
};

/** The demo body with the account at `index` given `bankName`. */
const renamed = (index: number, bankName: string) => (body: AccountsBody) => ({
  ...body,
  accounts: body.accounts.map((account, at) => (at === index ? { ...account, bankName } : account)),
});

/** The demo body with `count` accounts: the five and copies of the first ones with new ids and numbers. */
const withAccounts = (count: number) => (body: AccountsBody) => ({
  ...body,
  accounts: Array.from({ length: count }, (_, index) => {
    const account = body.accounts[index % body.accounts.length]!;
    return index < body.accounts.length
      ? account
      : { ...account, id: 1_000_000 + index, maskedNumber: `**** **** **** ${String(1000 + index)}` };
  }),
});

// T16: AC1, AC2, AC6 and AC7, a first login's Balances from the sidebar and from Overview, and the request
// (#10, #11, #24, #25, #57; demo-data.md).
test('shows a first login’s five cards from the sidebar and from Overview’s "All Accounts", with the date only', async ({
  page,
}) => {
  await signUp(page.request);
  // Each answer's zone and body, read as it arrives; awaited at the end, so none is checked half-read.
  const answered: Promise<{ zone: string | undefined; text: string }>[] = [];
  page.on('response', (response) => {
    if (new URL(response.url()).pathname !== '/api/accounts') return;
    answered.push(response.text().then((text) => ({ zone: response.request().headers()['x-time-zone'], text })));
  });
  await page.goto('/overview');
  await expect(totalBalance(page).getByText('$130,254.67')).toBeVisible();
  // Overview's slides: each account's number and balance.
  const slides = await totalBalance(page)
    .locator('[role="group"]')
    .evaluateAll((groups) =>
      groups
        .map((group) => ({
          name: group.getAttribute('aria-label') ?? '',
          lines: [...group.querySelectorAll('p')].map((p) => p.textContent),
        }))
        .toSorted((a, b) => a.name.localeCompare(b.name))
        .map(({ lines }) => [lines[2], lines[3]]),
    );

  await sidebar(page).getByRole('link', { name: 'Balances' }).click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/balances`);
  await waitForCards(page);
  await expect(balances(page).getByRole('heading', { level: 2 })).toHaveText('Balances');
  await expect(activeItem(page)).toHaveText('Balances');
  await expect(page.getByRole('banner').locator('time')).toHaveText('22 Oct, 2026');
  await expect(page.getByRole('banner').getByText(/^Hello /)).toHaveCount(0);
  expect(await shown(page)).toEqual(withLabels(firstLogin));
  expect(slides).toEqual(firstLogin.map((card) => [card.number, card.balance]));
  await expect(cells(page).last()).toContainText('Add AccountsEdit Accounts');

  await page.goto('/overview');
  await totalBalance(page).getByRole('link', { name: 'All Accounts' }).click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/balances`);
  await waitForCards(page);
  expect(await shown(page)).toEqual(withLabels(firstLogin));

  expect(answered.length).toBeGreaterThan(0);
  for (const { zone, text } of await Promise.all(answered)) {
    expect(zone).toBe('Europe/Belgrade');
    const body = JSON.parse(text) as AccountsBody;
    expect(body.accounts.map((account) => account.bankName)).toEqual(firstLogin.map((card) => card.bankName));
    for (const number of fullNumbers) {
      expect(text).not.toContain(number);
      expect(text).not.toContain(number.slice(0, 12));
    }
  }
});

// T17: AC4, "Details" opens the account's Account Details without a page load, Balances active (#47, #50).
test('opens /balances/<id> from each "Details" with no page load, Balances active, and comes back', async ({
  page,
}) => {
  // Another user first, so this user's account ids are never their positions in the list, even in a fresh database.
  await signUp(page.request);
  await signUp(page.request);
  const answered = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/accounts');
  await page.goto('/balances');
  const ids = ((await (await answered).json()) as AccountsBody).accounts.map((account) => account.id);
  await waitForCards(page);
  let loads = 0;
  page.on('load', () => (loads += 1));

  for (const [index, id] of ids.entries()) {
    await details(page).nth(index).click();
    await expect(page).toHaveURL(`${FRONTEND_URL}/balances/${id}`);
    await expect(activeItem(page)).toHaveText('Balances');
    await expect(page.getByRole('main')).toBeEmpty();
    await page.goBack();
    await expect(page).toHaveURL(`${FRONTEND_URL}/balances`);
    await waitForCards(page);
  }
  expect(loads).toBe(0);

  await details(page).last().focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(`${FRONTEND_URL}/balances/${ids.at(-1)}`);
  expect(loads).toBe(0);
});

// T17: AC5, "Remove", "Add Accounts" and "Edit Accounts" are drawn and do nothing (#22, #23).
test('does nothing on "Remove", "Add Accounts" and "Edit Accounts": no request, no dialog, no focus, no pointer', async ({
  page,
}) => {
  await openBalances(page);
  const requests: string[] = [];
  page.on('request', (sent) => requests.push(sent.url()));
  const before = await balances(page).innerHTML();
  const targets = [
    cards(page).first().getByText('Remove', { exact: true }),
    balances(page).getByText('Add Accounts', { exact: true }),
    balances(page).getByText('Edit Accounts', { exact: true }),
  ];

  for (const target of targets) {
    const color = await computed(target, 'color');
    const background = await computed(target, 'background-color');
    expect(await computed(target, 'cursor')).toBe('default');
    await target.hover();
    expect(await computed(target, 'color')).toBe(color);
    expect(await computed(target, 'background-color')).toBe(background);
    await target.click();
    await expect(page).toHaveURL(`${FRONTEND_URL}/balances`);
    expect(await isBodyFocused(page)).toBe(true);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(
      await target.evaluate((node) => node.closest('a, button, [tabindex], [role]') === null && node.tabIndex === -1),
    ).toBe(true);
    expect(await target.evaluate((node) => node.closest('[aria-hidden="true"]') !== null)).toBe(true);
  }
  // Give a request a moment to start, if a click had sent one.
  await page.waitForTimeout(300);
  expect(requests.filter((url) => url.includes('/api/'))).toEqual([]);
  expect(await balances(page).innerHTML()).toBe(before);
  await expect(balances(page).getByRole('button')).toHaveCount(0);
});

// T17: AC10, the keyboard: the search field, the five "Details" in card order, then out; the ring with the keyboard
// only (#87).
test('tabs from the search field through the five "Details" with the ring and out; Shift+Tab goes back', async ({
  page,
}) => {
  await openBalances(page);
  const links = await details(page).all();
  const descriptions = firstLogin.map((card) => `${card.type} ${card.bankName}`);

  await search(page).focus();
  for (const [index, link] of links.entries()) {
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    await expect(link).toHaveAccessibleName('Details');
    await expect(link).toHaveAccessibleDescription(descriptions[index]!);
    await expectRing(page, link);
  }
  await page.keyboard.press('Tab');
  expect(await mainHasFocus(page)).toBe(false);

  for (const link of links.toReversed()) {
    await page.keyboard.press('Shift+Tab');
    await expect(link).toBeFocused();
    await expectRing(page, link);
  }
  await page.keyboard.press('Shift+Tab');
  await expect(search(page)).toBeFocused();

  await expectNoRingOnMouseFocus(page, links[1]!);
});

/** The right edge of the page: the window less a classic scrollbar's gutter (#101). */
const pageRight = (page: Page) => page.evaluate(() => document.body.getBoundingClientRect().right);

/** The three equal columns of the content area, from x 304 to 32 from the page's right edge, 24 apart (#94). */
async function columns(page: Page) {
  const right = await pageRight(page);
  const width = (right - 32 - 304 - 2 * 24) / 3;
  return { width, x: [0, 1, 2].map((index) => 304 + index * (width + 24)) };
}

type Box = { x: number; y: number; width: number; height: number };
const near = (actual: number, expected: number, what: string) =>
  expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(0.5);
const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x - 0.5 &&
  inner.y >= outer.y - 0.5 &&
  inner.x + inner.width <= outer.x + outer.width + 0.5 &&
  inner.y + inner.height <= outer.y + outer.height + 0.5;
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;

/** The box of an element's own text, all its lines, up to an icon in it ("Details" and its chevron). */
const textBox = (locator: Locator) =>
  locator.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const icon = element.querySelector('svg');
    if (icon !== null) range.setEndBefore(icon);
    const { x, y, width, height } = range.getBoundingClientRect();
    return { x, y, width, height };
  });

/** The right end of each line of an element's text. */
const lineRights = (locator: Locator) =>
  locator.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const lines = new Map<number, number>();
    for (const { y, right } of range.getClientRects()) {
      const top = Math.round(y);
      lines.set(top, Math.max(lines.get(top) ?? 0, right));
    }
    return [...lines.values()];
  });

/** How many elements in `locator`, itself included, hold content wider than their box. */
const overflowCount = (locator: Locator) =>
  locator.evaluate(
    (root) =>
      [root, ...root.querySelectorAll('*')].filter(
        (node) => node.clientWidth > 1 && node.scrollWidth > node.clientWidth + 1,
      ).length,
  );

/** One card's parts, measured on the page: element boxes, the text's own boxes and the Bank Name's lines. */
async function cardParts(cell: Locator) {
  const type = cell.locator('h3');
  const header = type.locator('..');
  const bank = cell.locator('h3 + div');
  const bankName = bank.locator('p');
  const logo = bank.locator('img');
  const link = cell.getByRole('link');
  return {
    card: await box(cell.locator(':scope > div')),
    header: await box(header),
    divider: {
      width: await computed(header, 'border-bottom-width'),
      color: await computed(header, 'border-bottom-color'),
    },
    type: await box(type),
    typeText: await textBox(type),
    bank: await box(bank),
    bankName: await box(bankName),
    bankNameText: await textBox(bankName),
    bankNameLineRights: await lineRights(bankName),
    logo: (await logo.count()) === 0 ? null : await box(logo),
    number: await box(cell.locator('dd').nth(0)),
    numberLabel: await box(cell.locator('dt').nth(0)),
    balance: await box(cell.locator('dd').nth(1)),
    balanceText: await textBox(cell.locator('dd').nth(1)),
    balanceLabel: await box(cell.locator('dt').nth(1)),
    remove: await box(cell.getByText('Remove', { exact: true })),
    details: await box(link),
    detailsText: await textBox(link),
    chevron: await box(link.locator('svg')),
    overflowing: await overflowCount(cell),
  };
}

type CardParts = Awaited<ReturnType<typeof cardParts>>;

/** AC13: one card's parts where References measures them, from the card's top T and its content box (inset 24). */
function expectCardLayout(parts: CardParts, what: string, divider: string) {
  const { card } = parts;
  const left = card.x + 24;
  const right = card.x + card.width - 24;
  const t = card.y;
  near(parts.header.x, left, `${what}: header x`);
  near(parts.header.width, card.width - 48, `${what}: header width`);
  near(parts.header.y, t + 24, `${what}: header y`);
  near(parts.header.height, 44, `${what}: header and divider`);
  expect(parts.divider, `${what}: divider`).toEqual({ width: '1px', color: divider });
  near(parts.type.x, left, `${what}: type x`);
  near(parts.typeText.y + parts.typeText.height / 2, t + 40, `${what}: type centred on the 32px row`);
  near(parts.bankName.y, t + 32, `${what}: Bank Name y`);
  near(parts.bankName.height, 16, `${what}: Bank Name height`);
  if (parts.logo === null) {
    near(parts.bankName.x + parts.bankName.width, right, `${what}: Bank Name right`);
  } else {
    near(parts.logo.x, right - 48, `${what}: logo x`);
    near(parts.logo.y, t + 24, `${what}: logo y`);
    expect([parts.logo.width, parts.logo.height], `${what}: logo size`).toEqual([48, 32]);
    near(parts.bankName.x + parts.bankName.width, right - 48 - 4, `${what}: Bank Name right`);
  }
  for (const [name, part, y, height] of [
    ['number', parts.number, 84, 28],
    ['"Account Number"', parts.numberLabel, 116, 20],
    ['balance', parts.balance, 152, 28],
    ['"Total amount"', parts.balanceLabel, 184, 20],
  ] as const) {
    near(part.x, left, `${what}: ${name} x`);
    near(part.y, t + y, `${what}: ${name} y`);
    near(part.height, height, `${what}: ${name} height`);
  }
  near(parts.remove.x, left, `${what}: Remove x`);
  near(parts.remove.y, t + 234, `${what}: Remove y`);
  near(parts.remove.height, 24, `${what}: Remove height`);
  near(parts.details.x + parts.details.width, right, `${what}: Details right`);
  near(parts.details.y, t + 228, `${what}: Details y`);
  near(parts.details.height, 36, `${what}: Details height`);
  within2(parts.details.width, 110, `${what}: Details width`);
  within2(parts.detailsText.x - parts.details.x, 20, `${what}: Details text inset`);
  near(parts.chevron.width, 16, `${what}: chevron width`);
  near(parts.chevron.y, t + 238, `${what}: chevron y`);
  near(parts.details.x + parts.details.width - (parts.chevron.x + parts.chevron.width), 20, `${what}: chevron inset`);
  within2(parts.chevron.x - (parts.detailsText.x + parts.detailsText.width), 8, `${what}: text to chevron`);
  near(card.height, 288, `${what}: card height`);
  expect(parts.overflowing, `${what}: nothing overflows`).toBe(0);
}

/** AC13: the title, the grid, every card and the Add Accounts group where References measures them. */
async function expectPageLayout(page: Page, cardCount = 5) {
  const { width, x } = await columns(page);
  const title = await box(balances(page).getByRole('heading', { level: 2 }));
  expect(title).toMatchObject({ x: 304, y: 104, height: 32 });
  const divider = await tokenColor(page, '--color-gray-06');
  const all = await cells(page).all();
  for (const [index, cell] of all.entries()) {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const cellBox = await box(cell);
    near(cellBox.x, x[column]!, `cell ${index + 1} x`);
    near(cellBox.width, width, `cell ${index + 1} width`);
    near(cellBox.y, 152 + row * (288 + 32), `cell ${index + 1} y`);
    near(cellBox.height, 288, `cell ${index + 1} height`);
    if (index < cardCount) expectCardLayout(await cardParts(cell), `card ${index + 1}`, divider);
  }
  // The Add Accounts group: the 208x48 button and "Edit Accounts" 16 under it, centred both ways.
  const cell = await box(all.at(-1)!);
  const button = await box(cells(page).last().getByText('Add Accounts', { exact: true }));
  const edit = await box(cells(page).last().getByText('Edit Accounts', { exact: true }));
  expect(button).toMatchObject({ width: 208, height: 48 });
  near(button.x + button.width / 2, cell.x + cell.width / 2, 'Add Accounts centre x');
  near(edit.x + edit.width / 2, cell.x + cell.width / 2, 'Edit Accounts centre x');
  near(edit.y, button.y + 48 + 16, 'Edit Accounts y');
  near(edit.height, 24, 'Edit Accounts height');
  near((button.y + edit.y + edit.height) / 2, cell.y + cell.height / 2, 'group centre y');
  return { width };
}

const scrollWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);
const scrolls = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollHeight > document.documentElement.clientHeight);

// T18: AC13, 105's layout at 1440x1024 (with the e2e browser's scrollbar), wider at 1920 and 2560, nothing wrapped
// at 1280 (#94, #101, #115 b).
test('places the title, the cards and their parts where 105 does at 1440x1024, wider at 1920 and 2560, unwrapped at 1280', async ({
  page,
}) => {
  await openBalances(page);
  const at1440 = await expectPageLayout(page);
  expect(await scrolls(page)).toBe(false);

  let width = at1440.width;
  for (const [viewportWidth, height] of [
    [1920, 1080],
    [2560, 1440],
  ] as const) {
    await page.setViewportSize({ width: viewportWidth, height });
    await waitForCards(page);
    const wider = await expectPageLayout(page);
    expect(wider.width, `${viewportWidth}: cards wider`).toBeGreaterThan(width);
    width = wider.width;
  }

  await page.setViewportSize({ width: 1280, height: 1024 });
  await waitForCards(page);
  await expectPageLayout(page);
  expect(await scrollWidth(page)).toBe(Math.round(await pageRight(page)));
  expect(await scrolls(page)).toBe(false);
});

/** AC14: the header row of a long Bank Name: under the type, right-aligned, wrapped inside the room left of its logo. */
function expectNameUnderType(parts: CardParts, what: string) {
  const { card } = parts;
  const cardContent = { x: card.x + 24, y: card.y + 24, width: card.width - 48, height: card.height - 48 };
  // The type keeps its place on the 32px row, as in the cards beside it; the name and logo start under that row.
  near(parts.typeText.y + parts.typeText.height / 2, card.y + 40, `${what}: type centred on the 32px row`);
  near(parts.bank.y, card.y + 24 + 32, `${what}: name and logo under the type's row`);
  expect(parts.bankNameText.y, `${what}: the name under the type`).toBeGreaterThanOrEqual(
    parts.type.y + parts.type.height - 0.5,
  );
  near(parts.bank.x + parts.bank.width, cardContent.x + cardContent.width, `${what}: name and logo right-aligned`);
  expect(parts.bankNameLineRights.length, `${what}: the name wraps`).toBeGreaterThan(1);
  for (const lineRight of parts.bankNameLineRights) {
    expect(Math.abs(lineRight - (parts.bankName.x + parts.bankName.width)), `${what}: line right-aligned`).toBeLessThan(
      1,
    );
  }
  const { logo } = parts;
  if (logo === null) {
    near(parts.bankName.x + parts.bankName.width, cardContent.x + cardContent.width, `${what}: name right-aligned`);
  } else {
    near(logo.x, parts.bankName.x + parts.bankName.width + 4, `${what}: logo 4 after the name`);
    near(logo.y + 16, parts.bankName.y + parts.bankName.height / 2, `${what}: logo centred on the name`);
    expect(overlaps(parts.typeText, logo), `${what}: type and logo overlap`).toBe(false);
    expect(overlaps(parts.bankNameText, logo), `${what}: name and logo overlap`).toBe(false);
    expect(inside(logo, cardContent), `${what}: logo inside the card`).toBe(true);
  }
  near(parts.header.y + parts.header.height, parts.bank.y + parts.bank.height + 12, `${what}: divider 12 under`);
  near(parts.number.y, parts.header.y + parts.header.height + 16, `${what}: number 16 under the divider`);
  for (const [name, part] of Object.entries({
    type: parts.typeText,
    name: parts.bankNameText,
    balance: parts.balanceText,
    details: parts.details,
  })) {
    expect(inside(part, cardContent), `${what}: ${name} inside the card`).toBe(true);
  }
  expect(overlaps(parts.typeText, parts.bankNameText), `${what}: type and name overlap`).toBe(false);
  expect(parts.overflowing, `${what}: nothing overflows`).toBe(0);
}

/** The cards of a row: one height, each bottom row at its card's bottom (as #107). */
async function expectRowStretched(page: Page, row: number[], height: number) {
  for (const index of row) {
    const parts = await cardParts(cells(page).nth(index));
    near(parts.card.height, height, `card ${index + 1} height`);
    near(parts.details.y + 36, parts.card.y + parts.card.height - 24, `card ${index + 1}: Details at the bottom`);
    near(parts.remove.y + 24 + 6, parts.card.y + parts.card.height - 24, `card ${index + 1}: Remove at the bottom`);
  }
}

// T19: AC14, a 100-character Bank Name in words at 1440 and 1280, and with no space (#106, #108 b, #111 a, #115 b).
for (const viewportWidth of [1440, 1280]) {
  test(`moves a 100-character Bank Name under the type at ${viewportWidth}, wrapped, the row stretched`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewportWidth, height: 1024 });
    await signUp(page.request);
    await changeAccounts(page, renamed(1, longNameInWords));
    await page.goto('/balances');
    await waitForCards(page);

    const checking = await cardParts(cells(page).nth(1));
    expectNameUnderType(checking, 'Checking');
    expect(checking.card.height).toBeGreaterThan(288);
    await expect(cards(page).nth(1).locator('h3 + div > p')).toHaveText(longNameInWords);
    expect(await computed(cards(page).nth(1).locator('h3 + div > p'), 'hyphens')).toBe('auto');
    await expectRowStretched(page, [0, 1, 2], checking.card.height);
    // Row 2 keeps its 288, the Add Accounts group centred in its cell.
    const { x } = await columns(page);
    near((await box(cells(page).nth(3))).y, checking.card.y + checking.card.height + 32, 'row 2 y');
    near((await box(cells(page).nth(3))).height, 288, 'row 2 height');
    near((await box(cells(page).last())).x, x[2]!, 'Add Accounts cell x');
    expect(await scrollWidth(page)).toBe(Math.round(await pageRight(page)));
  });
}

test('keeps the Add Accounts group centred in a cell stretched by a long Bank Name on Loan, at 1440', async ({
  page,
}) => {
  await signUp(page.request);
  await changeAccounts(page, renamed(4, longNameInWords));
  await page.goto('/balances');
  await waitForCards(page);

  const loan = await cardParts(cells(page).nth(4));
  expectNameUnderType(loan, 'Loan');
  await expectRowStretched(page, [3, 4], loan.card.height);
  const cell = await box(cells(page).last());
  near(cell.height, loan.card.height, 'Add Accounts cell height');
  const button = await box(cells(page).last().getByText('Add Accounts', { exact: true }));
  const edit = await box(cells(page).last().getByText('Edit Accounts', { exact: true }));
  near((button.y + edit.y + edit.height) / 2, cell.y + cell.height / 2, 'group centre y');
});

test('breaks a 100-character Bank Name with no space inside its room at 1280, nothing leaving the card', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1024 });
  await signUp(page.request);
  await changeAccounts(page, renamed(1, longNameNoSpace));
  await page.goto('/balances');
  await waitForCards(page);

  expectNameUnderType(await cardParts(cells(page).nth(1)), 'Checking');
  await expect(cards(page).nth(1).locator('h3 + div > p')).toHaveText(longNameNoSpace);
  expect(await computed(cards(page).nth(1).locator('h3 + div > p'), 'overflow-wrap')).toBe('anywhere');
  expect(await scrollWidth(page)).toBe(Math.round(await pageRight(page)));
});

// T19: AC3 and AC15, 6 and 8 accounts (#24, #111).
test('puts the Add Accounts cell alone in row 3 with 6 accounts, 288 high, in the first column', async ({ page }) => {
  await signUp(page.request);
  await changeAccounts(page, withAccounts(6));
  await page.goto('/balances');
  await waitForCards(page, 6);

  const { x } = await columns(page);
  const cell = await box(cells(page).last());
  near(cell.x, x[0]!, 'Add Accounts cell x');
  near(cell.y, 152 + 2 * (288 + 32), 'Add Accounts cell y');
  near(cell.height, 288, 'Add Accounts cell height');
  await expect(cells(page).last()).toContainText('Add AccountsEdit Accounts');
});

test('lays out 8 accounts in three rows; the page scrolls and the last row ends 32 above its end', async ({ page }) => {
  await signUp(page.request);
  await changeAccounts(page, withAccounts(8));
  await page.goto('/balances');
  await waitForCards(page, 8);

  await expectPageLayout(page, 8);
  expect(await scrolls(page)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const end = await page.evaluate(() => {
    const last = document.querySelector('main ul > li:last-child')!.getBoundingClientRect();
    return { lastBottom: last.bottom + window.scrollY, pageHeight: document.documentElement.scrollHeight };
  });
  near(end.lastBottom, end.pageHeight - 32, 'last row 32 above the end');
  await expect(cells(page).last()).toContainText('Add Accounts');
});

/** Holds the requests to `pattern`, then fails them or lets them through. */
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

/** The error and empty card: white, across the grid's width, 288 high, with the card's radius and shadow. */
async function expectWhiteCard(page: Page) {
  const contentBox = await box(content(page));
  expect(contentBox).toMatchObject({ x: 304, y: 152, height: 288 });
  near(contentBox.x + contentBox.width, (await pageRight(page)) - 32, 'card right');
  expect(await computed(content(page), 'background-color')).toBe(await tokenColor(page, '--color-white'));
  expect(await computed(content(page), 'border-radius')).toBe('8px');
  expect(await computed(content(page), 'box-shadow')).not.toBe('none');
}

// T20: AC11, the skeleton, the error card and a keyboard Retry (#6, #87, #88, #114).
test('shows three skeleton cards, then the error card, and after a keyboard Retry keeps focus in the region with the ring', async ({
  page,
}) => {
  await signUp(page.request);
  const route = await controlRoute(page, '**/api/accounts');
  await page.goto('/balances');

  const busy = balances(page).locator('[aria-busy="true"]');
  await expect(busy).toBeVisible();
  const { width, x } = await columns(page);
  // DataState's hidden wrapper, the skeleton row, then its three cards.
  const skeletons = busy.locator(':scope > div > div > div');
  await expect(skeletons).toHaveCount(3);
  for (const [index, skeleton] of (await skeletons.all()).entries()) {
    const skeletonBox = await box(skeleton);
    near(skeletonBox.x, x[index]!, `skeleton ${index + 1} x`);
    near(skeletonBox.width, width, `skeleton ${index + 1} width`);
    expect(skeletonBox).toMatchObject({ y: 152, height: 288 });
  }
  expect(await computed(content(page), 'background-color')).toBe('rgba(0, 0, 0, 0)');
  await expect(balances(page).getByText('Add Accounts')).toHaveCount(0);

  await route.fail();
  await expect(balances(page).getByRole('alert')).toHaveText('Something went wrong.', { timeout: 15_000 });
  await expectWhiteCard(page);
  await expect(balances(page).getByText('Add Accounts')).toHaveCount(0);

  await search(page).focus();
  await page.keyboard.press('Tab');
  await expect(balances(page).getByRole('button', { name: 'Retry' })).toBeFocused();
  route.pass();
  await page.keyboard.press('Enter');

  await waitForCards(page);
  expect(await shown(page)).toEqual(withLabels(firstLogin));
  await expect(dataStateRoot(page)).toBeFocused();
  expect(await isBodyFocused(page)).toBe(false);
  await expectRing(page, dataStateRoot(page));
  await page.keyboard.press('Tab');
  await expect(details(page).first()).toBeFocused();
});

// T20: AC12, no accounts (#116 a).
test('shows "No accounts yet" in one white card across the grid, 288 high, with no Add Accounts cell', async ({
  page,
}) => {
  await signUp(page.request);
  await page.route('**/api/accounts', (route) =>
    route.fulfill({ json: { totalBalance: { cents: 0, currency: 'USD' }, accounts: [] } }),
  );
  await page.goto('/balances');

  await expect(balances(page).getByText('No accounts yet')).toBeVisible();
  await expect(balances(page).getByRole('heading', { level: 2 })).toHaveText('Balances');
  await expectWhiteCard(page);
  await expect(balances(page).getByRole('list')).toHaveCount(0);
  await expect(balances(page).getByText('Add Accounts')).toHaveCount(0);
  await expect(balances(page).getByText('Edit Accounts')).toHaveCount(0);
});
