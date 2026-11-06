import { randomUUID } from 'node:crypto';

import type { APIRequestContext, Locator, Page, Request } from '@playwright/test';

import { expect, test } from '../fixtures';
import { box, computed, expectRing, newUser, signUp, tokenColor, tokenComputed, type User } from '../helpers';

/** Built from char codes, so no escape sequence in this file can change them. */
const TAB = String.fromCharCode(9);
const DOUBLE_STRUCK_A = String.fromCodePoint(0x1d538);

const main = (page: Page) => page.getByRole('main');
const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const profileBlock = (page: Page) => sidebar(page).locator('..');
const tablist = (page: Page) => main(page).getByRole('tablist', { name: 'Settings' });
const tab = (page: Page, name: 'Account' | 'Security') => tablist(page).getByRole('tab', { name, exact: true });
const field = (page: Page, name: 'Full name' | 'Email' | 'Username' | 'Phone Number') =>
  main(page).getByRole('textbox', { name, exact: true });
/** The country code's trigger, found also while its open list hides the page from roles (task 005). */
const countryCode = (page: Page) => main(page).locator('button[role="combobox"]');
const saveButton = (page: Page) => main(page).getByRole('button', { name: 'Save changes', exact: true });
const statusText = (page: Page) => main(page).getByRole('status');
/** The Settings card: the page's one white card. */
const card = (page: Page) => main(page).locator(':scope > div').first();
/** A field's 56 px value box: the input's parent. */
const valueBox = (input: Locator) => input.locator('..');
/** A field's block (label, value box, message). */
const fieldBlock = (input: Locator) => valueBox(input).locator('..');
/** The Phone Number box (the country code, the divider and the number), found also while the open list hides the page. */
const phoneRow = (page: Page) => page.locator('main div:has(> input[inputmode="numeric"])');

type BorderColor = '--color-input-border' | '--color-input-active' | '--color-special-red';

/** #127 a: the app's Input border on the four sides, in `token`'s color, with the Input's radius. */
async function expectBorder(page: Page, target: Locator, token: BorderColor) {
  const color = await tokenColor(page, token);
  const width = await tokenComputed(page, 'width', '--border-width-input');
  for (const side of ['top', 'right', 'bottom', 'left']) {
    expect(await computed(target, `border-${side}-style`), side).toBe('solid');
    expect(await computed(target, `border-${side}-width`), side).toBe(width);
    expect(await computed(target, `border-${side}-color`), side).toBe(color);
  }
  expect(await computed(target, 'border-top-left-radius')).toBe(
    await tokenComputed(page, 'border-top-left-radius', '--radius-input'),
  );
}

/** A username no other test or run has: the test database is shared by the run. */
const uniqueUsername = (prefix: string) => `${prefix}.${randomUUID().slice(0, 8)}`;

/** Signs up a user through the page's API context (so the page is signed in) and opens Settings with the form shown. */
async function openSettings(page: Page): Promise<User> {
  const user = await signUp(page.request);
  await page.goto('/settings/account');
  await expect(field(page, 'Full name')).toHaveValue('Tanzir Rahman');
  return user;
}

/** The API requests the page sends from now on, as `METHOD path`. */
function apiRequests(page: Page): string[] {
  const sent: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) sent.push(`${request.method()} ${url.pathname}`);
  });
  return sent;
}

/** The `PATCH /api/profile` requests the page sends, from now on. */
function profilePatches(page: Page): Request[] {
  const patches: Request[] = [];
  page.on('request', (request) => {
    if (request.method() === 'PATCH' && new URL(request.url()).pathname === '/api/profile') patches.push(request);
  });
  return patches;
}

/** The parts of a multipart request in order, each `[name, value]`, read from its raw body. */
function partsOf(request: Request): [string, string][] {
  const boundary = /boundary=(.+)$/.exec(request.headers()['content-type'] ?? '')?.[1];
  const body = request.postDataBuffer()?.toString('utf8') ?? '';
  return body
    .split(`--${boundary}`)
    .slice(1, -1)
    .map((part) => {
      const separator = part.indexOf('\r\n\r\n');
      const name = /name="([^"]+)"/.exec(part.slice(0, separator))?.[1] ?? '';
      return [name, part.slice(separator + 4, -2)];
    });
}

/** `user`'s stored profile, read through a session of its own. */
async function profileOf(request: APIRequestContext, user: User) {
  const login = await request.post('/api/auth/login', {
    data: { email: user.email, password: user.password, keepSignedIn: false },
  });
  expect(login.status()).toBe(200);
  const response = await request.get('/api/profile');
  expect(response.status()).toBe(200);
  return (await response.json()) as Record<string, string>;
}

/** Chooses a country code with the mouse, scrolling the long list as needed. */
async function chooseCode(page: Page, code: string) {
  await countryCode(page).click();
  await page.getByRole('option', { name: code, exact: true }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(countryCode(page)).toHaveText(code);
}

const firePageVisible = (page: Page) =>
  page.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));

/** Logs out the context's session on a second page and signs up Ada, as another tab of the same browser does. */
async function signUpAdaInAnotherTab(page: Page): Promise<User> {
  const second = await page.context().newPage();
  expect((await second.request.post('/api/auth/logout')).status()).toBe(204);
  const ada = { ...newUser(), fullName: 'Ada Lovelace' };
  expect((await second.request.post('/api/auth/signup', { data: ada })).status()).toBe(201);
  await second.close();
  return ada;
}

/** Holds the tab's next session checks until `release`, so a 409's message can be read before the check runs. */
async function holdSessionChecks(page: Page) {
  const { promise: held, resolve: release } = Promise.withResolvers<void>();
  await page.route('**/api/auth/me', async (route) => {
    await held;
    await route.continue();
  });
  return release;
}

// T24: AC3, AC7, AC9, AC11, a second user's save through the real stack: the shell follows from the PATCH's answer.
test('saves a second user’s four fields from "View profile", and the shell follows with no other request', async ({
  page,
  request,
}) => {
  await signUp(request);
  const user = await signUp(page.request);
  const generated = ((await (await page.request.get('/api/auth/me')).json()) as { username: string }).username;
  await page.goto('/overview');
  await profileBlock(page).getByRole('link', { name: 'View profile' }).click();

  await expect(page).toHaveURL(/\/settings\/account$/);
  await expect(field(page, 'Full name')).toHaveValue('Tanzir Rahman');
  await expect(field(page, 'Email')).toHaveValue(user.email);
  await expect(field(page, 'Username')).toHaveValue(generated);
  await expect(countryCode(page)).toHaveText('+1');
  await expect(field(page, 'Phone Number')).toHaveValue('');

  // #127 a: the editable fields in the Input's border, the read-only Email borderless.
  for (const name of ['Full name', 'Username'] as const) {
    await expectBorder(page, valueBox(field(page, name)), '--color-input-border');
  }
  await expectBorder(page, phoneRow(page), '--color-input-border');
  expect(await computed(valueBox(field(page, 'Email')), 'border-top-width')).toBe('0px');
  expect(await computed(field(page, 'Email'), 'border-top-width')).toBe('0px');

  // #127 b: "Save changes" is unavailable, focusable and sends nothing until a field differs from the stored value,
  // and again once the values are back to the stored ones (the one PATCH counted below is the real save).
  const patches = profilePatches(page);
  await expect(saveButton(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(saveButton(page)).not.toHaveAttribute('disabled');
  await saveButton(page).click({ force: true });
  await expect(saveButton(page)).toBeFocused();
  await expect(statusText(page)).toHaveText('');
  await field(page, 'Full name').fill('Tanzir');
  await expect(saveButton(page)).toBeEnabled();
  await field(page, 'Full name').fill('Tanzir Rahman');
  await expect(saveButton(page)).toHaveAttribute('aria-disabled', 'true');

  const username = uniqueUsername('ana');
  await field(page, 'Full name').fill('  Ana Marija Petrović  ');
  await expect(saveButton(page)).toBeEnabled();
  await field(page, 'Username').fill(username);
  await chooseCode(page, '+381');
  await field(page, 'Phone Number').fill('64 123-4567');
  const sent = apiRequests(page);
  await saveButton(page).click();

  await expect(statusText(page)).toHaveText('Profile updated');
  // Saved: the stored values are the form's, so the button is unavailable again, focus kept on it.
  await expect(saveButton(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(saveButton(page)).toBeFocused();
  expect(patches).toHaveLength(1);
  expect(partsOf(patches[0]!)).toEqual([
    ['fullName', 'Ana Marija Petrović'],
    ['username', username],
    ['phoneCountryCode', '+381'],
    ['phoneNumber', '641234567'],
  ]);
  expect(patches[0]!.headers()['content-type']).toMatch(/^multipart\/form-data; boundary=/);
  expect(patches[0]!.headers()['x-expected-user']).toBe(user.email);
  await expect(field(page, 'Phone Number')).toHaveValue('641234567');
  await expect(field(page, 'Full name')).toHaveValue('Ana Marija Petrović');
  await expect(profileBlock(page).getByText('Ana Marija Petrović', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Ana Marija Petrović' })).toHaveText('AP');
  expect(sent).toEqual(['PATCH /api/profile']);

  await sidebar(page).getByRole('link', { name: 'Overview' }).click();
  await expect(page.getByRole('banner').getByText('Hello Ana', { exact: true })).toBeVisible();
  expect(sent.filter((line) => /^GET \/api\/(auth\/me|profile)$/.test(line))).toEqual([]);

  await page.goto('/settings/account');
  await expect(field(page, 'Full name')).toHaveValue('Ana Marija Petrović');
  await expect(field(page, 'Username')).toHaveValue(username);
  await expect(countryCode(page)).toHaveText('+381');
  await expect(field(page, 'Phone Number')).toHaveValue('641234567');
  await expect(profileBlock(page).getByText('Ana Marija Petrović', { exact: true })).toBeVisible();
});

// T25: AC6, AC8, AC10, the rules in the browser, and a username the first user has.
test('shows each broken rule under its field with nothing sent, and a taken username after the 409', async ({
  page,
  request,
}) => {
  const first = await signUp(request);
  const firstProfile = (await (await request.get('/api/profile')).json()) as Record<string, string>;
  const second = await openSettings(page);
  const patches = profilePatches(page);

  await field(page, 'Full name').fill('   ');
  await field(page, 'Username').fill('Ana');
  await field(page, 'Phone Number').fill('064a123');
  await saveButton(page).click();

  await expect(field(page, 'Full name')).toHaveAccessibleDescription('Name is required');
  await expect(field(page, 'Username')).toHaveAccessibleDescription(
    'Username can only contain lowercase letters, numbers, dots and underscores',
  );
  await expect(field(page, 'Phone Number')).toHaveAccessibleDescription('Phone Number can only contain digits');
  await expect(field(page, 'Full name')).toBeFocused();
  expect(patches).toHaveLength(0);
  // #127 a: the Input's error border on each field with a message, also the focused one.
  for (const name of ['Full name', 'Username'] as const) {
    await expectBorder(page, valueBox(field(page, name)), '--color-special-red');
  }
  await expectBorder(page, phoneRow(page), '--color-special-red');

  await field(page, 'Full name').fill('');
  await page.keyboard.insertText(`Ana${TAB}Marija`);
  await saveButton(page).click();
  await expect(field(page, 'Full name')).toHaveAccessibleDescription('Name cannot contain tabs or line breaks');
  expect(patches).toHaveLength(0);

  const secondBefore = (await (await page.request.get('/api/profile')).json()) as Record<string, string>;
  await field(page, 'Full name').fill('Ana Marija');
  await field(page, 'Username').fill(firstProfile.username!);
  await field(page, 'Phone Number').fill('');
  const answer = page.waitForResponse((response) => response.request().method() === 'PATCH');
  await saveButton(page).click();

  expect((await answer).status()).toBe(409);
  await expect(field(page, 'Username')).toHaveAccessibleDescription('This username is already taken');
  await expect(field(page, 'Username')).toBeFocused();
  await expect(main(page).getByRole('alert')).toHaveCount(0);
  expect(await profileOf(request, first)).toEqual(firstProfile);
  expect(await profileOf(page.request, second)).toEqual(secondBefore);
});

/** An editable field with focus: the caret and the Input's darker border around its value box, no ring (#127 a). */
async function expectFocusBorder(page: Page, input: Locator, container: Locator = valueBox(input)) {
  await expect(input).toBeFocused();
  expect(await computed(input, 'outline-style')).toBe('none');
  expect(await computed(container, 'outline-style')).toBe('none');
  expect(await computed(input, 'border-top-width')).toBe('0px');
  await expectBorder(page, container, '--color-input-active');
}

// T26: AC2, AC5, AC16, the keyboard: the Tab order, the rings, the tabs, the country code and Enter to save.
test('tabs through the form in order with the ring where there is no caret, and saves by keys', async ({ page }) => {
  await openSettings(page);
  await page.getByRole('searchbox', { name: 'Search' }).focus();

  await page.keyboard.press('Tab');
  await expect(tab(page, 'Account')).toBeFocused();
  await expectRing(page, tab(page, 'Account'));
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/\/settings\/security$/);
  await expect(tab(page, 'Security')).toBeFocused();
  await expect(tab(page, 'Security')).toHaveAttribute('aria-selected', 'true');
  await expectRing(page, tab(page, 'Security'));
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/\/settings\/account$/);
  await expect(tab(page, 'Account')).toBeFocused();
  // The URL changes before the page shows the tab: wait for the Account panel itself before pressing Tab.
  await expect(tab(page, 'Account')).toHaveAttribute('aria-selected', 'true');
  await expect(field(page, 'Full name')).toBeVisible();
  // Keys faster than a render (found in the manual checks): End then Home ends on Account, selected and in the URL.
  await page.keyboard.press('End');
  await page.keyboard.press('Home');
  await expect(page).toHaveURL(/\/settings\/account$/);
  await expect(tab(page, 'Account')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'Account')).toBeFocused();
  await expect(field(page, 'Full name')).toBeVisible();

  await page.keyboard.press('Tab');
  await expectFocusBorder(page, field(page, 'Full name'));
  await page.keyboard.press('Tab');
  // The read-only Email has no caret and no border: the ring around its value box (#87, #127 a).
  await expect(field(page, 'Email')).toBeFocused();
  expect(await field(page, 'Email').evaluate((node) => node.matches(':focus-visible'))).toBe(true);
  expect(await computed(valueBox(field(page, 'Email')), 'outline-style')).toBe('solid');
  expect(await computed(valueBox(field(page, 'Email')), 'outline-width')).toBe('2px');
  expect(await computed(valueBox(field(page, 'Email')), 'outline-color')).toBe(
    await tokenColor(page, '--color-primary'),
  );
  expect(await computed(valueBox(field(page, 'Email')), 'border-top-width')).toBe('0px');
  // Focus gone, Full name's border is the resting one again.
  await expectBorder(page, valueBox(field(page, 'Full name')), '--color-input-border');
  await page.keyboard.press('Tab');
  await expectFocusBorder(page, field(page, 'Username'));
  await page.keyboard.press('Tab');
  await expect(countryCode(page)).toBeFocused();
  await expectRing(page, countryCode(page));
  // Focus on either control darkens the phone box (#127 a).
  await expectBorder(page, phoneRow(page), '--color-input-active');
  await page.keyboard.press('Tab');
  await expectFocusBorder(page, field(page, 'Phone Number'), phoneRow(page));
  await page.keyboard.press('Tab');
  // Nothing changed yet: "Save changes" is unavailable but takes focus with its ring (#127 b, as task 022).
  await expect(saveButton(page)).toBeFocused();
  await expect(saveButton(page)).toHaveAttribute('aria-disabled', 'true');
  await expectRing(page, saveButton(page));
  await expectBorder(page, phoneRow(page), '--color-input-border');

  // The country code by keyboard: open, type its digits, choose. The box stays dark while the list is open.
  await countryCode(page).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('option', { name: '+1', exact: true })).toBeFocused();
  await expectBorder(page, phoneRow(page), '--color-input-active');
  await page.keyboard.type('381');
  await expect(page.getByRole('option', { name: '+381', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(countryCode(page)).toHaveText('+381');
  await expect(countryCode(page)).toBeFocused();
  await expect(saveButton(page)).toBeEnabled();

  // Enter in the number saves; saved, the button is unavailable again with focus on it.
  await field(page, 'Phone Number').fill('641234567');
  await field(page, 'Phone Number').press('Enter');
  await expect(statusText(page)).toHaveText('Profile updated');
  await expect(saveButton(page)).toBeFocused();
  await expect(saveButton(page)).toHaveAttribute('aria-disabled', 'true');

  // The mouse: the tabs and Email take focus with no ring.
  await tab(page, 'Security').click();
  await expect(tab(page, 'Security')).toBeFocused();
  expect(await tab(page, 'Security').evaluate((node) => node.matches(':focus-visible'))).toBe(false);
  await tab(page, 'Account').click();
  await field(page, 'Email').click();
  await expect(field(page, 'Email')).toBeFocused();
  expect(await computed(valueBox(field(page, 'Email')), 'outline-style')).toBe('none');
});

// T27: AC11, AC12, AC13, the endpoint's protections through the real stack, a user from each session.
test('refuses cross-site, unguarded, other-user, JSON and file requests, and takes the email from nobody', async ({
  page,
  request,
}) => {
  const a = await signUp(page.request);
  const b = await signUp(request);
  const valid = {
    fullName: 'Api Name',
    username: uniqueUsername('api'),
    phoneCountryCode: '+44',
    phoneNumber: '2071234567',
  };
  const patch = (headers: Record<string, string>, body: object = { multipart: valid }) =>
    page.request.patch('/api/profile', { headers, ...body });
  const own = { 'X-Expected-User': a.email };
  const aBefore = (await (await page.request.get('/api/profile')).json()) as Record<string, string>;
  const bBefore = (await (await request.get('/api/profile')).json()) as Record<string, string>;

  expect((await patch({ ...own, 'Sec-Fetch-Site': 'cross-site' })).status()).toBe(403);
  expect((await patch({ ...own, Origin: 'http://evil.example' })).status()).toBe(403);
  expect((await patch({})).status()).toBe(400);
  const otherUser = await patch({ 'X-Expected-User': b.email });
  expect([otherUser.status(), await otherUser.json()]).toEqual([
    409,
    { message: 'Another user is signed in. Nothing was saved.' },
  ]);
  expect((await patch(own, { data: valid })).status()).toBe(415);
  const file = await patch(own, {
    multipart: { ...valid, photo: { name: 'me.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50]) } },
  });
  expect(file.status()).toBe(400);
  expect((await (await page.request.get('/api/profile')).json()) as unknown).toEqual(aBefore);

  const withEmail = await patch(own, { multipart: { ...valid, email: b.email } });

  expect(withEmail.status()).toBe(200);
  expect(await withEmail.json()).toEqual({ ...valid, email: a.email });
  expect(await profileOf(page.request, a)).toEqual({ ...valid, email: a.email });
  expect(await profileOf(request, b)).toEqual(bBefore);
});

// T28: AC14, the stale tab (#110, #119): another tab logged A out and signed up B; A's tab saves before its check runs.
test('refuses the save of a stale tab with 409, then shows the signed-in user; nothing saved for anyone', async ({
  page,
  request,
}) => {
  const a = await openSettings(page);
  await field(page, 'Full name').fill('Typed For A');
  const statuses: number[] = [];
  page.on('response', (response) => {
    if (response.request().method() === 'PATCH') statuses.push(response.status());
  });

  const ada = await signUpAdaInAnotherTab(page);
  const release = await holdSessionChecks(page);
  await saveButton(page).click();

  await expect(main(page).getByRole('alert')).toHaveText('Another user is signed in. Nothing was saved.');
  expect(statuses).toEqual([409]);
  release();
  await expect(profileBlock(page).getByText('Ada Lovelace', { exact: true })).toBeVisible();
  await expect(field(page, 'Full name')).toHaveValue('Ada Lovelace');
  expect(statuses).toEqual([409]);
  expect((await profileOf(request, a)).fullName).toBe('Tanzir Rahman');
  expect((await profileOf(request, ada)).fullName).toBe('Ada Lovelace');
});

// T29: AC9, two pages of one user: last write wins; the other page's sidebar follows at its next session check.
test('lets the last save win across two pages, and the other page’s sidebar follows without losing its form', async ({
  page,
}) => {
  const user = await openSettings(page);
  const second = await page.context().newPage();
  await second.goto('/settings/account');
  await expect(field(second, 'Full name')).toHaveValue('Tanzir Rahman');

  await field(page, 'Full name').fill('First Name');
  await saveButton(page).click();
  await expect(statusText(page)).toHaveText('Profile updated');
  const username = uniqueUsername('second');
  await field(second, 'Username').fill(username);
  await saveButton(second).click();
  await expect(statusText(second)).toHaveText('Profile updated');

  expect(await profileOf(page.request, user)).toMatchObject({ fullName: 'Tanzir Rahman', username });
  await expect(profileBlock(page).getByText('First Name', { exact: true })).toBeVisible();
  await firePageVisible(page);
  await expect(profileBlock(page).getByText('Tanzir Rahman', { exact: true })).toBeVisible();
  await expect(field(page, 'Full name')).toHaveValue('First Name');
  await second.close();
});

type Box = { x: number; y: number; width: number; height: number };
const near = (actual: number, expected: number, what: string, tolerance = 1) =>
  expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);
const pageRight = (page: Page) => page.evaluate(() => document.body.getBoundingClientRect().right);
const scrollWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);
const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x - 0.5 && inner.x + inner.width <= outer.x + outer.width + 0.5;

/**
 * AC17, AC20: 111's places, x from the card's left edge (the sidebar 280 and 24) and its right one from the page's
 * (32 inside it, a classic scrollbar's gutter outside, #101): the tabs, the four fields 104 apart, the picture column at
 * 684 of 1040, the box and the button at their sizes, the card 648 high.
 */
async function expectLayout(page: Page) {
  const right = await pageRight(page);
  const cardBox = await box(card(page));
  near(cardBox.x, 304, 'card left');
  near(cardBox.y, 104, 'card top');
  near(cardBox.x + cardBox.width, right - 32, 'card right');
  near(cardBox.height, 648, 'card height');
  // 111's corners: 16 (Marko at the gate, `--radius-settings-card`), where every other card keeps Card's 8.
  for (const corner of ['top-left', 'top-right', 'bottom-right', 'bottom-left']) {
    expect(await computed(card(page), `border-${corner}-radius`)).toBe('16px');
  }
  const contentLeft = cardBox.x + 32;
  const contentWidth = cardBox.width - 64;

  const account = await box(tab(page, 'Account'));
  near(account.x, contentLeft, 'Account tab left');
  near(account.y, cardBox.y + 40, 'tabs top');
  near(account.height, 40, 'tab height');
  near(account.width, 88, 'Account tab width (its underline 336 to 424; Semibold here 1 px wider)', 1.5);
  near((await box(tab(page, 'Security'))).x, account.x + account.width + 32, 'Security 32 after Account');

  const inputs = ['Full name', 'Email', 'Username', 'Phone Number'] as const;
  for (const [index, name] of inputs.entries()) {
    const label = await box(main(page).getByText(name, { exact: true }).first());
    near(label.y, cardBox.y + 112 + index * 104, `${name} label line top`, 1.5);
    near(label.x, contentLeft, `${name} label left`);
  }
  for (const name of ['Full name', 'Email', 'Username'] as const) {
    const value = await box(valueBox(field(page, name)));
    near(value.height, 56, `${name} value box height`);
    near(value.width, (contentWidth * 540) / 1040, `${name} field width (540 of 1040)`, 1.5);
    near((await box(field(page, name))).x, contentLeft + 24, `${name} value 24 in`);
  }
  const picture = await box(main(page).getByText('Your Profile Picture', { exact: true }));
  near(picture.x, contentLeft + (contentWidth * 684) / 1040, 'picture column at 684 of 1040', 1.5);
  near(picture.y, cardBox.y + 112, 'picture label on the first label’s line', 1.5);
  const uploadBox = await box(main(page).getByText('Upload your photo').locator('..'));
  near(uploadBox.width, 144, 'upload box width');
  near(uploadBox.height, 132, 'upload box height');
  near(uploadBox.y, picture.y + 24 + 32, 'upload box 32 under its label');
  near(uploadBox.x + uploadBox.width / 2, picture.x + picture.width / 2, 'upload box centred under its label');
  // Visual only until task 029 (AC4): the default cursor, not a pointer or text one.
  expect(await computed(main(page).getByText('Upload your photo').locator('..'), 'cursor')).toBe('default');
  expect(await computed(main(page).getByText('Your Profile Picture', { exact: true }), 'cursor')).toBe('default');
  const button = await box(saveButton(page));
  near(button.x, contentLeft, 'button left');
  near(button.y, cardBox.y + 552, 'button top');
  near(button.width, 192, 'button width');
  near(button.height, 48, 'button height');
  near(cardBox.y + cardBox.height, button.y + button.height + 48, 'card 48 under the button');
  const fieldsRight = (await box(valueBox(field(page, 'Full name')))).x + (contentWidth * 540) / 1040;
  expect(fieldsRight, 'the fields end before the picture column').toBeLessThanOrEqual(picture.x);
  expect(await scrollWidth(page), 'no horizontal scroll').toBeLessThanOrEqual(Math.round(right));
}

// T30: AC17, AC20, 111's layout at 1280, 1440 and 1920; a 100-code-point name; every field's error; the bottom inset.
test('places 111’s parts at 1280, 1440 and 1920, keeps long names and errors inside, and ends 32 above the page end', async ({
  page,
}) => {
  await openSettings(page);
  for (const [width, height] of [
    [1440, 1024],
    [1280, 1024],
    [1920, 1080],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expectLayout(page);
  }
  await page.setViewportSize({ width: 1440, height: 1024 });

  // The shared Card keeps its 8 elsewhere: Bills' card.
  await page.goto('/bills');
  const billsCard = main(page).getByRole('region', { name: 'Upcoming Bills' }).locator(':scope > div').last();
  await expect(billsCard).toBeVisible();
  expect(await computed(billsCard, 'border-top-left-radius')).toBe('8px');

  // A 100-code-point name stays on one line in its field, scrolling inside it.
  const longName = `${'Ana Marija '.repeat(9)}${DOUBLE_STRUCK_A}`;
  await page.route('**/api/profile', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    return route.fulfill({ response, json: { ...((await response.json()) as object), fullName: longName } });
  });
  await page.goto('/settings/account');
  await expect(field(page, 'Full name')).toHaveValue(longName);
  near((await box(valueBox(field(page, 'Full name')))).height, 56, 'long name: one line');
  expect(await field(page, 'Full name').evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  await page.unroute('**/api/profile');

  // Every field's error, wrapping inside the fields' column.
  await page.route('**/api/profile', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    return route.fulfill({
      status: 400,
      json: {
        message: 'Validation failed',
        fieldErrors: {
          fullName: 'Name must be at most 100 characters',
          username: 'Username can only contain lowercase letters, numbers, dots and underscores',
          phoneCountryCode: 'Choose a country code',
          phoneNumber: 'Phone Number can only contain digits',
        },
      },
    });
  });
  await page.setViewportSize({ width: 1280, height: 1024 });
  // A change first: "Save changes" sends nothing until a field differs from the stored value (#127 b).
  await field(page, 'Phone Number').fill('5');
  await saveButton(page).click();
  await expect(field(page, 'Username')).toHaveAccessibleDescription(
    'Username can only contain lowercase letters, numbers, dots and underscores',
  );
  for (const name of ['Full name', 'Username', 'Phone Number'] as const) {
    const block = await box(fieldBlock(field(page, name)));
    const message = await box(fieldBlock(field(page, name)).locator('p').last());
    expect(inside(message, block), `${name}: the message inside its column`).toBe(true);
  }
  expect(await scrollWidth(page), 'no horizontal scroll with the errors').toBeLessThanOrEqual(
    Math.round(await pageRight(page)),
  );
  await page.unroute('**/api/profile');

  // 1280x720: the page scrolls; the card ends 32 above its end (#111).
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/settings/account');
  await expect(field(page, 'Full name')).toBeVisible();
  const { pageEnd, cardBottom } = await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const cardElement = document.querySelector('main > div')!;
    return {
      pageEnd: document.documentElement.scrollHeight,
      cardBottom: cardElement.getBoundingClientRect().bottom + window.scrollY,
    };
  });
  near(pageEnd, cardBottom + 32, 'the card 32 above the page end');
});
