import type { APIRequestContext, Locator, Page, Request } from '@playwright/test';

import { TIME_ZONE } from '../constants';
import { expect, test } from '../fixtures';
import {
  afterQueuedTimers,
  box,
  computed,
  control,
  expectRing,
  newUser,
  signUp,
  tokenColor,
  type User,
} from '../helpers';

const ZONE_HEADERS = { 'X-Time-Zone': TIME_ZONE };

const main = (page: Page) => page.getByRole('main');
const region = (page: Page, name: string) => main(page).getByRole('region', { name });
const detailsRegion = (page: Page) => region(page, 'Account Details');
const historyRegion = (page: Page) => region(page, 'Transactions History');
/** A section's white card: the section's last child. */
const cardOf = (section: Locator) => section.locator(':scope > div').last();
const detailsCard = (page: Page) => cardOf(detailsRegion(page));
const historyCard = (page: Page) => cardOf(historyRegion(page));
const editButton = (page: Page) => detailsRegion(page).getByRole('button', { name: 'Edit Details' });
const bankName = (page: Page) => detailsRegion(page).getByRole('textbox', { name: 'Bank Name' });
const branchName = (page: Page) => detailsRegion(page).getByRole('textbox', { name: 'Branch Name' });
/** The select, found also while its open list hides the page from roles (task 005). */
const accountType = (page: Page) => detailsCard(page).locator('button[role="combobox"]');
const saveButton = (page: Page) => detailsRegion(page).getByRole('button', { name: 'Save' });
const cancelButton = (page: Page) => detailsRegion(page).getByRole('button', { name: 'Cancel' });
const loadMore = (page: Page) => historyRegion(page).getByRole('button', { name: 'Load More' });
const search = (page: Page) => page.getByRole('searchbox', { name: 'Search' });
const sidebarLink = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name });
const headerDate = (page: Page) => page.getByRole('banner').locator('time');

type AccountsBody = { accounts: { id: number; accountType: string; bankName: string }[] };

/** The signed-in user's accounts, oldest first (Credit Card, Checking, Savings, Investment, Loan). */
async function accountsOf(request: APIRequestContext): Promise<AccountsBody['accounts']> {
  const response = await request.get('/api/accounts', { headers: ZONE_HEADERS });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as AccountsBody).accounts;
}

/** Waits until both cards show their content: no skeleton left. */
async function waitForCards(page: Page) {
  await expect(editButton(page)).toBeVisible();
  await expect(main(page).locator('[aria-busy="true"]')).toHaveCount(0);
}

/** Opens the signed-in user's account at `index` (Checking by default) once both cards show. */
async function openAccount(page: Page, index = 1) {
  const ids = (await accountsOf(page.request)).map((account) => account.id);
  await page.goto(`/balances/${ids[index]}`);
  await expect(headerDate(page)).toBeVisible();
  await waitForCards(page);
  return ids;
}

/** Each label of the details card with its value, in reading order. */
const readOut = (page: Page) =>
  detailsCard(page).evaluate((card) =>
    [...card.querySelectorAll('dt')].map((term) => [term.textContent, term.nextElementSibling?.textContent]),
  );

/** Every PATCH the page sends, from now on. */
function recordPatches(page: Page) {
  const patches: Request[] = [];
  page.on('request', (request) => {
    if (request.method() === 'PATCH') patches.push(request);
  });
  return patches;
}

/** Picks an Account Type with the mouse. */
async function chooseType(page: Page, label: string) {
  await accountType(page).click();
  await page.getByRole('option', { name: label }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(accountType(page)).toHaveText(label);
}

/** Installs a MutationObserver that records every text added to the page from now on (it survives app navigation). */
const recordAddedText = (page: Page) =>
  page.evaluate(() => {
    const texts: string[] = [];
    (window as unknown as { addedTexts: string[] }).addedTexts = texts;
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) texts.push(node.textContent ?? '');
        if (mutation.type === 'characterData') texts.push(mutation.target.textContent ?? '');
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
const addedTexts = (page: Page) =>
  page.evaluate(() => (window as unknown as { addedTexts: string[] }).addedTexts.join('\n'));

/** The Overview carousel's slide `index` (0-based), its texts and its logo. */
async function slide(page: Page, index: number) {
  const totalBalance = region(page, 'Total Balance');
  await expect(totalBalance.getByRole('group')).toBeVisible();
  for (let step = 0; step < index; step += 1) await totalBalance.getByRole('button', { name: 'Next' }).click();
  const group = totalBalance.getByRole('group', { name: `Account ${index + 1} of 5` });
  await expect(group).toBeVisible();
  return group;
}

/** The Balances card at `index`. */
const balancesCard = (page: Page, index: number) => region(page, 'Balances').getByRole('listitem').nth(index);

/** The Transactions rows as [item, payment method], once the selected tab's table shows. */
async function transactionRows(page: Page) {
  const rows = region(page, 'Recent Transaction').getByRole('tabpanel').locator('tbody > tr');
  await expect(rows.first()).toBeVisible();
  return rows.evaluateAll((elements) =>
    elements.map((row) => {
      const cells = row.querySelectorAll('td');
      return [cells[0]?.textContent, cells[3]?.textContent];
    }),
  );
}
const transactionsTab = (page: Page, name: string) =>
  region(page, 'Recent Transaction').getByRole('tablist').getByRole('tab', { name });

// T23: AC4, AC7, AC13 and AC14: a save through the real stack, then every screen shows the new values (#57).
test('saves Checking’s new names and type, and every screen shows them, never the old ones, also after a reload', async ({
  page,
  request,
}) => {
  // Another user first, so the requester's IDs are not positions.
  await signUp(request);
  const user = await signUp(page.request);
  await page.goto('/overview');
  await expect(await slide(page, 0)).toBeVisible();
  await sidebarLink(page, 'Balances').click();
  await expect(balancesCard(page, 1)).toContainText('Checking');
  await sidebarLink(page, 'Transactions').click();
  expect((await transactionRows(page))[0]).toEqual(['Jeans', 'Checking']);
  await transactionsTab(page, 'Revenue').click();
  await expect.poll(async () => (await transactionRows(page))[0]).toEqual(['Freelance payment', 'Checking']);
  await transactionsTab(page, 'Expenses').click();
  await expect.poll(async () => (await transactionRows(page))[0]).toEqual(['Jeans', 'Checking']);
  await sidebarLink(page, 'Balances').click();
  await balancesCard(page, 1).getByRole('link', { name: 'Details' }).click();
  await waitForCards(page);
  const checkingId = new URL(page.url()).pathname.split('/').at(-1);

  await editButton(page).click();
  await bankName(page).fill('  Nordic Bank  ');
  await branchName(page).fill('Harbour Branch');
  await chooseType(page, 'Savings');
  const patches = recordPatches(page);
  const historyRequests: string[] = [];
  page.on('request', (sent) => {
    if (new URL(sent.url()).pathname.endsWith('/transactions')) historyRequests.push(sent.url());
  });
  await saveButton(page).click();

  await expect(editButton(page)).toBeFocused();
  expect(patches).toHaveLength(1);
  const patch = patches[0]!;
  expect(new URL(patch.url()).pathname).toBe(`/api/accounts/${checkingId}`);
  expect(patch.postData()).toBe(
    JSON.stringify({ bankName: 'Nordic Bank', branchName: 'Harbour Branch', accountType: 'savings' }),
  );
  expect(patch.headers()['x-time-zone']).toBe(TIME_ZONE);
  expect(patch.headers()['x-expected-user']).toBe(user.email);
  const savedReadOut = [
    ['Bank Name', 'Nordic Bank'],
    ['Account Type', 'Savings'],
    ['Balance', '$33,362.48'],
    ['Branch Name', 'Harbour Branch'],
    ['Account Number', '**** **** **** 7310'],
  ];
  expect(await readOut(page)).toEqual(savedReadOut);
  await recordAddedText(page);

  async function expectEveryScreen() {
    await sidebarLink(page, 'Balances').click();
    await expect(balancesCard(page, 1)).toContainText('Nordic Bank');
    await expect(balancesCard(page, 1).getByRole('heading', { level: 3 })).toHaveText('Savings');
    await expect(balancesCard(page, 1)).not.toContainText('AB Bank Ltd');
    await sidebarLink(page, 'Overview').click();
    await expect((await slide(page, 1)).locator('p')).toHaveText([
      'Account Type',
      'Savings',
      '**** **** **** 7310',
      '$33,362.48',
    ]);
    await sidebarLink(page, 'Transactions').click();
    await expect
      .poll(async () => (await transactionRows(page)).slice(0, 3))
      .toEqual([
        ['Jeans', 'Savings'],
        ['Movie ticket', 'Credit Card'],
        ['Pizza', 'Credit Card'],
      ]);
    await transactionsTab(page, 'Revenue').click();
    await expect
      .poll(async () => (await transactionRows(page)).slice(0, 2))
      .toEqual([
        ['Freelance payment', 'Savings'],
        ['Dividend', 'Investment'],
      ]);
    await transactionsTab(page, 'Expenses').click();
    await expect.poll(async () => (await transactionRows(page))[0]).toEqual(['Jeans', 'Savings']);
  }

  await expectEveryScreen();
  expect(await addedTexts(page)).not.toContain('Checking');
  expect(historyRequests.filter((url) => url.includes(`/api/accounts/${checkingId}/`))).toEqual([]);

  // After a reload, the same: stored.
  for (const path of ['/overview', '/balances', '/transactions', `/balances/${checkingId}`]) {
    await page.goto(path);
    await expect(headerDate(page)).toBeVisible();
  }
  await waitForCards(page);
  expect(await readOut(page)).toEqual(savedReadOut);
  await expectEveryScreen();
});

// T24: AC2, AC3 and AC6: the shared rule in the browser, Cancel and Escape (#26, #87 b, #120 b).
test('shows the rule’s messages under the fields with red borders, sends nothing; Cancel and Escape discard', async ({
  page,
}) => {
  await signUp(page.request);
  await openAccount(page);
  const patches = recordPatches(page);
  const red = await tokenColor(page, '--color-special-red');
  await editButton(page).click();

  await bankName(page).fill('   ');
  await branchName(page).fill('B'.repeat(101));
  await saveButton(page).click();

  await expect(bankName(page)).toHaveAccessibleDescription('Bank Name is required');
  await expect(branchName(page)).toHaveAccessibleDescription('Branch Name must be at most 100 characters');
  expect(await computed(control(bankName(page)), 'border-top-color')).toBe(red);
  expect(await computed(control(branchName(page)), 'border-top-color')).toBe(red);
  await expect(bankName(page)).toBeFocused();
  // The form moves focus to the field with the error, then once more on a timer (react-hook-form): typing in another
  // field before that timer has run would land in that one.
  await afterQueuedTimers(page);

  // A pasted tab inside a valid name.
  await bankName(page).fill('AB\tBank');
  await branchName(page).fill('Park Street Branch');
  await saveButton(page).click();
  await expect(bankName(page)).toHaveAccessibleDescription('Bank Name cannot contain tabs or line breaks');
  expect(patches).toEqual([]);

  await cancelButton(page).click();
  await expect(editButton(page)).toBeFocused();
  expect(await readOut(page)).toEqual([
    ['Bank Name', 'AB Bank Ltd'],
    ['Account Type', 'Checking'],
    ['Balance', '$33,362.48'],
    ['Branch Name', 'Park Street Branch'],
    ['Account Number', '**** **** **** 7310'],
  ]);

  await editButton(page).click();
  await expect(bankName(page)).toHaveValue('AB Bank Ltd');
  await bankName(page).fill('Escaped Bank');
  await page.keyboard.press('Escape');
  await expect(editButton(page)).toBeFocused();
  await expect(detailsCard(page).locator('dd').first()).toHaveText('AB Bank Ltd');

  await editButton(page).click();
  await accountType(page).click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(accountType(page)).toBeFocused();
  await expect(saveButton(page)).toBeVisible();
  expect(patches).toEqual([]);
});

// T25: AC1, AC4, AC6 and AC16: the keyboard path and the focus after each action (#63, #87, #121).
test('works by keyboard: the Tab order, the select, Enter to save, Escape; the ring only from the keyboard', async ({
  page,
}) => {
  await signUp(page.request);
  await openAccount(page);
  const active = await tokenColor(page, '--color-input-active');

  await search(page).focus();
  await page.keyboard.press('Tab');
  await expect(editButton(page)).toBeFocused();
  await expectRing(page, editButton(page));
  await page.keyboard.press('Enter');
  await expect(bankName(page)).toBeFocused();
  expect(await computed(control(bankName(page)), 'border-top-color')).toBe(active);

  await page.keyboard.press('Tab');
  await expect(accountType(page)).toBeFocused();
  // The select as task 005 draws it: the darker border, no ring (#121).
  expect(await computed(accountType(page), 'border-top-color')).toBe(active);
  expect(await computed(accountType(page), 'outline-style')).toBe('none');
  await page.keyboard.press('Tab');
  await expect(branchName(page)).toBeFocused();
  expect(await computed(control(branchName(page)), 'border-top-color')).toBe(active);
  await page.keyboard.press('Tab');
  await expect(saveButton(page)).toBeFocused();
  await expectRing(page, saveButton(page));
  await page.keyboard.press('Tab');
  await expect(cancelButton(page)).toBeFocused();
  await expectRing(page, cancelButton(page));
  await page.keyboard.press('Tab');
  await expect(loadMore(page)).toBeFocused();

  // The select by keyboard: open, an arrow, Enter.
  await accountType(page).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toBeVisible();
  // Radix moves focus to the selected option once the list is placed: each key after that, as a person would press it
  // (task 023: an arrow sent before it was lost at HEAD).
  await expect(page.getByRole('option', { name: 'Checking' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: 'Savings' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(accountType(page)).toHaveText('Savings');

  // Enter in Branch Name saves; focus on "Edit Details" with the ring.
  await branchName(page).focus();
  await page.keyboard.press('Enter');
  await expect(editButton(page)).toBeFocused();
  await expectRing(page, editButton(page));
  expect((await readOut(page))[1]).toEqual(['Account Type', 'Savings']);

  // Escape: focus on "Edit Details" with the ring.
  await page.keyboard.press('Enter');
  await expect(bankName(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(editButton(page)).toBeFocused();
  await expectRing(page, editButton(page));

  // By mouse: Edit, Save; focus on "Edit Details" with no ring.
  await editButton(page).click();
  await saveButton(page).click();
  await expect(editButton(page)).toBeFocused();
  expect(await editButton(page).evaluate((node) => node.matches(':focus-visible'))).toBe(false);
  expect(await computed(editButton(page), 'outline-style')).toBe('none');
});

const NOT_FOUND = '{"message":"Account not found"}';

// T26: AC9 and AC10: the API through the real stack: one 404, then 403, 400 and 409, nothing changed (#39, #75, #119).
test('answers another user’s account, an unknown and a bad ID the same 404; cross-site 403, no header 400, B’s email 409', async ({
  page,
  request,
}) => {
  const b = await signUp(request);
  const bAccounts = await accountsOf(request);
  const a = await signUp(page.request);
  const aAccounts = await accountsOf(page.request);
  const body = { bankName: 'Changed Bank', branchName: 'Changed Branch', accountType: 'loan' };
  const patch = (path: string, headers: Record<string, string> = {}) =>
    page.request.patch(path, { headers: { ...ZONE_HEADERS, 'X-Expected-User': a.email, ...headers }, data: body });

  for (const raw of [
    String(bAccounts[1]!.id),
    String(Math.max(...bAccounts.map((x) => x.id)) + 100_000),
    'abc',
    '01',
  ]) {
    const response = await patch(`/api/accounts/${raw}`);
    const read = await page.request.get(`/api/accounts/${raw}`, { headers: ZONE_HEADERS });
    expect([raw, response.status(), await response.text()]).toEqual([raw, 404, NOT_FOUND]);
    expect([raw, read.status(), await read.text()]).toEqual([raw, 404, NOT_FOUND]);
    expect(response.headers()['cache-control']).toBe('no-store');
  }
  const empty = await patch('/api/accounts//');
  expect([empty.status(), await empty.text()]).toEqual([404, NOT_FOUND]);

  const own = `/api/accounts/${aAccounts[1]!.id}`;
  expect((await patch(own, { 'Sec-Fetch-Site': 'cross-site' })).status()).toBe(403);
  expect((await patch(own, { Origin: 'http://evil.example' })).status()).toBe(403);
  const noHeader = await page.request.patch(own, { headers: ZONE_HEADERS, data: body });
  expect(noHeader.status()).toBe(400);
  const other = await patch(own, { 'X-Expected-User': b.email });
  expect([other.status(), await other.json()]).toEqual([
    409,
    { message: 'Another user is signed in. Nothing was saved.' },
  ]);

  expect(await accountsOf(page.request)).toEqual(aAccounts);
  expect(await accountsOf(request)).toEqual(bAccounts);
});

/** Logs out the context's session on a second page and signs up Ada, as another tab of the same browser does. */
async function signUpAdaInAnotherTab(page: Page): Promise<User> {
  const second = await page.context().newPage();
  expect((await second.request.post('/api/auth/logout')).status()).toBe(204);
  const ada = { ...newUser(), fullName: 'Ada Lovelace' };
  expect((await second.request.post('/api/auth/signup', { data: ada })).status()).toBe(201);
  await second.close();
  return ada;
}

/**
 * Holds the tab's next session checks until `release`, so the 409's message can be read before the check switches the
 * tab to the signed-in user.
 */
async function holdSessionChecks(page: Page) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/auth/me', async (route) => {
    await held;
    await route.continue();
  });
  return release;
}

/** `user`'s data read through a session of its own. */
async function readAs(request: APIRequestContext, user: User, path: string) {
  const login = await request.post('/api/auth/login', {
    data: { email: user.email, password: user.password, keepSignedIn: false },
  });
  expect(login.status()).toBe(200);
  const response = await request.get(path, { headers: ZONE_HEADERS });
  expect(response.ok()).toBe(true);
  return (await response.json()) as unknown;
}

// T27: AC12, the stale tab (#110, #119): another tab logged A out and signed up B; A's tab saves before its check runs.
test('refuses the goal save of a stale tab with 409, then shows the signed-in user; nothing saved for anyone', async ({
  page,
  request,
}) => {
  const a = await signUp(page.request);
  await page.goto('/overview');
  const goals = region(page, 'Goals');
  await goals.getByRole('button', { name: 'Edit savings goal' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit savings goal' });
  await dialog.getByRole('textbox', { name: 'Target Amounts' }).fill('45000');
  const puts: number[] = [];
  page.on('response', (response) => {
    if (response.request().method() === 'PUT') puts.push(response.status());
  });

  const ada = await signUpAdaInAnotherTab(page);
  const release = await holdSessionChecks(page);
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(dialog.getByRole('alert')).toHaveText('Another user is signed in. Nothing was saved.');
  release();
  await expect(page.getByText('Hello Ada')).toBeVisible();
  await expect(dialog).toBeHidden();
  expect(puts).toEqual([409]);
  const demoGoal = { target: { cents: 2_000_000, currency: 'USD' }, present: { cents: 1_625_000, currency: 'USD' } };
  expect(await readAs(request, a, '/api/savings-goals/current')).toMatchObject({ month: '2026-10', goal: demoGoal });
  expect(await readAs(request, ada, '/api/savings-goals/current')).toMatchObject({ month: '2026-10', goal: demoGoal });
});

test('refuses the account save of a stale tab with 409, then opens Balances for the signed-in user; nothing saved', async ({
  page,
  request,
}) => {
  const a = await signUp(page.request);
  const ids = await openAccount(page);
  await editButton(page).click();
  await bankName(page).fill('Stale Bank');
  const patches: number[] = [];
  page.on('response', (response) => {
    if (response.request().method() === 'PATCH') patches.push(response.status());
  });

  const ada = await signUpAdaInAnotherTab(page);
  const release = await holdSessionChecks(page);
  await saveButton(page).click();

  await expect(detailsRegion(page).getByRole('alert')).toHaveText('Another user is signed in. Nothing was saved.');
  release();
  await expect(region(page, 'Balances')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/balances');
  await expect(page.getByText('Ada Lovelace', { exact: true })).toBeVisible();
  expect(patches).toEqual([409]);
  expect(await readAs(request, a, `/api/accounts/${ids[1]}`)).toMatchObject({ bankName: 'AB Bank Ltd' });
  const adaAccounts = (await readAs(request, ada, '/api/accounts')) as AccountsBody;
  expect(adaAccounts.accounts.map((account) => account.bankName)).toEqual([
    'Master Card',
    'AB Bank Ltd',
    'Brac Bank Ltd.',
    'AB Bank Ltd',
    'City Bank Ltd.',
  ]);
});

const refocus = (page: Page) =>
  page.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));

// T28: AC15, two tabs of the same user: last write wins for all three fields (a choice in the task file).
test('lets the later save win for all three fields; a tab shows them on focus, a tab in edit mode keeps its typing', async ({
  page,
  context,
}) => {
  await signUp(page.request);
  const ids = await openAccount(page);
  const second = await context.newPage();
  const third = await context.newPage();
  for (const tab of [second, third]) {
    await tab.goto(`/balances/${ids[1]}`);
    await waitForCards(tab);
  }
  for (const tab of [page, second, third]) await editButton(tab).click();

  await bankName(page).fill('First Bank');
  await saveButton(page).click();
  await expect(editButton(page)).toBeVisible();
  await branchName(second).fill('Second Branch');
  await saveButton(second).click();
  await expect(editButton(second)).toBeVisible();
  await bankName(third).fill('Third Typing');

  const stored = [
    ['Bank Name', 'AB Bank Ltd'],
    ['Account Type', 'Checking'],
    ['Balance', '$33,362.48'],
    ['Branch Name', 'Second Branch'],
    ['Account Number', '**** **** **** 7310'],
  ];
  expect(await readOut(second)).toEqual(stored);
  await page.bringToFront();
  await refocus(page);
  await expect.poll(() => readOut(page)).toEqual(stored);

  await third.bringToFront();
  const asked = third.waitForResponse((response) => new URL(response.url()).pathname === `/api/accounts/${ids[1]}`);
  await refocus(third);
  const answer = (await (await asked).json()) as { balance: { cents: number } };
  expect(answer.balance.cents).toBe(3_336_248);
  await expect(bankName(third)).toHaveValue('Third Typing');
  await expect(branchName(third)).toHaveValue('Park Street Branch');
  expect(await readOut(third)).toEqual([
    ['Balance', '$33,362.48'],
    ['Account Number', '**** **** **** 7310'],
  ]);
});

// T29: AC19, a card network on a type without a card: no rule (#24, #120 a).
test('keeps the Mastercard logo when the Credit Card is saved as a Loan, on Balances and the Overview carousel', async ({
  page,
}) => {
  await signUp(page.request);
  await openAccount(page, 0);
  await editButton(page).click();
  await chooseType(page, 'Loan');
  await saveButton(page).click();
  await expect(editButton(page)).toBeFocused();

  await sidebarLink(page, 'Balances').click();
  await expect(balancesCard(page, 0).getByRole('heading', { level: 3 })).toHaveText('Loan');
  await expect(balancesCard(page, 0).getByRole('img', { name: 'Mastercard' })).toBeVisible();
  await sidebarLink(page, 'Overview').click();
  const first = await slide(page, 0);
  await expect(first.locator('p').nth(1)).toHaveText('Loan');
  await expect(first.getByRole('img', { name: 'Mastercard' })).toBeVisible();
});

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;
const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x - 0.5 &&
  inner.y >= outer.y - 0.5 &&
  inner.x + inner.width <= outer.x + outer.width + 0.5 &&
  inner.y + inner.height <= outer.y + outer.height + 0.5;
const near = (actual: number, expected: number, what: string, tolerance = 0.5) =>
  expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);
const scrollWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);
const pageRight = (page: Page) => page.evaluate(() => document.body.getBoundingClientRect().right);

/** The box of each element's own text (all its lines) and its line count. */
const textBoxes = (locator: Locator) =>
  locator.evaluateAll((elements) =>
    elements.map((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const { x, y, width, height } = range.getBoundingClientRect();
      const rects = [...range.getClientRects()];
      return { x, y, width, height, lines: new Set(rects.map((rect) => Math.round(rect.y))).size };
    }),
  );

const longWords =
  'The First Community Cooperative Savings and Commercial Bank of Greater Dhaka and Chittagong Division';
const longNoSpace = 'ParkStreetRiversideCommercialDistrict'.repeat(3).slice(0, 100);

// T30: AC18 and AC21, edit mode's layout against view mode's at 1440 and 1280, and long names (#94, #106, #115 b).
for (const [width, height] of [
  [1440, 1024],
  [1280, 1024],
] as const) {
  test(`keeps view mode’s edges, columns and read-only places in edit mode, growing downward only, at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await signUp(page.request);
    await openAccount(page);
    const title = await box(detailsRegion(page).getByRole('heading', { level: 2 }));
    const card = await box(detailsCard(page));
    const history = await box(historyCard(page));
    const terms = await textBoxes(detailsCard(page).locator('dt'));
    const [, , viewBalance, , viewNumber] = terms;

    await editButton(page).click();
    await expect(bankName(page)).toBeFocused();

    near((await box(detailsRegion(page).getByRole('heading', { level: 2 }))).y, title.y, 'the title stays');
    const editCard = await box(detailsCard(page));
    near(editCard.x, card.x, 'the card’s left edge');
    near(editCard.width, card.width, 'the card’s width');
    near(editCard.y, card.y, 'the card’s top');
    expect(editCard.height, 'the card grows').toBeGreaterThan(card.height);
    near((await box(historyCard(page))).y - history.y, editCard.height - card.height, 'the history moves down as much');

    const [balance, number] = await textBoxes(detailsCard(page).locator('dt'));
    near(balance!.x, viewBalance!.x, 'Balance in its column');
    near(balance!.y, viewBalance!.y, 'Balance at view mode’s place');
    near(number!.x, viewNumber!.x, 'Account Number in its column');
    // The labels as text boxes, as the terms: Bank Name, Account Type, Branch Name in the document's order.
    const labels = await textBoxes(detailsCard(page).locator('label'));
    expect(labels).toHaveLength(3);
    const [bankLabel, typeLabel, branchLabel] = [labels[0]!, labels[1]!, labels[2]!];
    near(bankLabel.x, terms[0]!.x, 'Bank Name in the first column');
    near(typeLabel.x, terms[1]!.x, 'Account Type in the second column');
    near(branchLabel.x, terms[3]!.x, 'Branch Name in the first column');
    near(bankLabel.y, viewBalance!.y, 'the first row at view mode’s top', 1);
    near(number!.y, branchLabel.y, 'Account Number at the top of its row', 1);
    for (const field of [control(bankName(page)), accountType(page), control(branchName(page))]) {
      near((await box(field)).height, 48, 'a field 48 high');
    }
    const save = await box(saveButton(page));
    const cancel = await box(cancelButton(page));
    near(save.width, 160, 'Save 160 wide');
    near(save.height, 48, 'Save 48 high');
    near(cancel.width, 160, 'Cancel 160 wide');
    near(save.x, card.x + 32, 'Save in "Edit Details"’ place');
    const parts = [
      bankLabel,
      typeLabel,
      branchLabel,
      balance!,
      number!,
      await box(control(bankName(page))),
      await box(accountType(page)),
      await box(control(branchName(page))),
      save,
      cancel,
    ];
    for (const [a, first] of parts.entries()) {
      expect(inside(first, editCard), `part ${a} inside the card`).toBe(true);
      for (const second of parts.slice(a + 1)) expect(overlaps(first, second), `parts ${a} overlap`).toBe(false);
    }
    expect(await scrollWidth(page), 'no horizontal scroll').toBe(Math.round(await pageRight(page)));
  });

  for (const [name, long] of [
    ['in words', longWords],
    ['with no space', longNoSpace],
  ] as const) {
    test(`holds 100-character names ${name} on one line in the fields, the errors inside their column, then wraps them, at ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await signUp(page.request);
      await openAccount(page);
      await editButton(page).click();
      await bankName(page).fill(long);
      await branchName(page).fill(long.toUpperCase());

      const editCard = await box(detailsCard(page));
      for (const field of [bankName(page), branchName(page)]) {
        near((await box(control(field))).height, 48, 'one line in the field');
        expect(await field.evaluate((input) => input.scrollWidth > input.clientWidth), 'it scrolls inside').toBe(true);
        expect(inside(await box(control(field)), editCard)).toBe(true);
      }
      // The longest error, wrapped inside its column.
      await branchName(page).fill(`${long.toUpperCase()}X`);
      await saveButton(page).click();
      const error = detailsCard(page).getByText('Branch Name must be at most 100 characters');
      await expect(error).toBeVisible();
      const errorBox = await box(error);
      const fieldBox = await box(control(branchName(page)));
      expect(errorBox.x + errorBox.width).toBeLessThanOrEqual(fieldBox.x + fieldBox.width + 0.5);
      expect(inside(errorBox, await box(detailsCard(page)))).toBe(true);
      expect(await scrollWidth(page), 'no horizontal scroll').toBe(Math.round(await pageRight(page)));

      await branchName(page).fill(long.toUpperCase());
      await saveButton(page).click();
      await expect(editButton(page)).toBeFocused();
      const values = await textBoxes(detailsCard(page).locator('dd'));
      expect(values[0]!.lines, 'Bank Name wraps').toBeGreaterThan(1);
      expect(values[3]!.lines, 'Branch Name wraps').toBeGreaterThan(1);
      const card = await box(detailsCard(page));
      for (const value of values) expect(inside(value, card)).toBe(true);
      expect(await scrollWidth(page), 'no horizontal scroll').toBe(Math.round(await pageRight(page)));
    });
  }
}
