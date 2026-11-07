import { randomUUID } from 'node:crypto';

import type { APIRequestContext, Locator, Page, Request } from '@playwright/test';

import { FIXED_NOW, TIME_ZONE } from '../constants';
import { expect, test } from '../fixtures';
import {
  box,
  computed,
  expectRing,
  googleSignIn,
  newUser,
  signUp,
  tokenColor,
  tokenComputed,
  type User,
} from '../helpers';

const main = (page: Page) => page.getByRole('main');
const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const profileBlock = (page: Page) => sidebar(page).locator('..');
const tablist = (page: Page) => main(page).getByRole('tablist', { name: 'Settings' });
const tab = (page: Page, name: 'Account' | 'Security') => tablist(page).getByRole('tab', { name, exact: true });
type PasswordLabel = 'Old Password' | 'New Password' | 'Retype Password';
const password = (page: Page, label: PasswordLabel) => main(page).getByLabel(label, { exact: true });
const passwords = (page: Page) => [
  password(page, 'Old Password'),
  password(page, 'New Password'),
  password(page, 'Retype Password'),
];
const phoneGroup = (page: Page) => main(page).getByRole('group', { name: 'Phone Number', exact: true });
const countryCode = (page: Page) => phoneGroup(page).getByRole('textbox', { name: 'Country code', exact: true });
const phoneNumber = (page: Page) => phoneGroup(page).getByRole('textbox', { name: 'Phone Number', exact: true });
const updateButton = (page: Page) => main(page).getByRole('button', { name: 'Update Password', exact: true });
const statusText = (page: Page) => main(page).getByRole('status');
/** The Settings card: the page's one white card. */
const card = (page: Page) => main(page).locator(':scope > div').first();
/** A field's 56 px value box: the input's parent. */
const valueBox = (input: Locator) => input.locator('..');
/** A field's block (label, value box, message). */
const fieldBlock = (input: Locator) => valueBox(input).locator('..');

const wrongPassword = 'Current password is incorrect';

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

/** Borderless, as the read-only Email (#127 a). */
async function expectNoBorder(target: Locator) {
  for (const side of ['top', 'right', 'bottom', 'left']) {
    expect(await computed(target, `border-${side}-style`), side).toBe('none');
  }
}

/** Signs up a user through the page's API context (so the page is signed in) and opens Settings, Security. */
async function openSecurity(page: Page): Promise<User> {
  const user = await signUp(page.request);
  await page.goto('/settings/security');
  await expect(password(page, 'Old Password')).toBeVisible();
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

/** The `PUT /api/auth/password` requests the page sends, from now on. */
function passwordPuts(page: Page): Request[] {
  const puts: Request[] = [];
  page.on('request', (request) => {
    if (request.method() === 'PUT' && new URL(request.url()).pathname === '/api/auth/password') puts.push(request);
  });
  return puts;
}

/** A login through the API: its status. */
async function loginStatus(request: APIRequestContext, email: string, passwordValue: string) {
  const response = await request.post('/api/auth/login', {
    data: { email, password: passwordValue, keepSignedIn: false },
  });
  return response.status();
}

/** The three fields typed: Old, New, Retype. */
async function fill(page: Page, old: string, next: string, retype = next) {
  await password(page, 'Old Password').fill(old);
  await password(page, 'New Password').fill(next);
  await password(page, 'Retype Password').fill(retype);
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

/** The page's window got focus back, as a browser tells the app when the user returns to the tab. */
const refocus = (page: Page) =>
  page.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));

// T20: AC2, AC4, AC6, AC7, the change through the real stack, a second user, then the logins.
test('changes a second user’s password: the request, "Password updated", still signed in, and only the new one logs in', async ({
  page,
  request,
}) => {
  const first = await signUp(request);
  const user = await openSecurity(page);
  const puts = passwordPuts(page);

  // The empty bordered masked fields, no eye, the button unavailable.
  for (const field of passwords(page)) {
    await expect(field).toHaveValue('');
    await expect(field).toHaveAttribute('type', 'password');
    await expect(field).not.toHaveAttribute('placeholder');
    await expectBorder(page, valueBox(field), '--color-input-border');
  }
  await expect(main(page).getByRole('button', { name: /show password/i })).toHaveCount(0);
  await expect(updateButton(page)).toHaveAttribute('aria-disabled', 'true');
  await updateButton(page).click({ force: true });
  await page.waitForTimeout(200);
  expect(puts).toHaveLength(0);

  await fill(page, user.password, 'newpass12');
  const sent = apiRequests(page);
  await updateButton(page).click();

  await expect(statusText(page)).toHaveText('Password updated');
  expect(puts).toHaveLength(1);
  expect(puts[0]!.headers()['content-type']).toBe('application/json');
  expect(puts[0]!.headers()['x-expected-user']).toBe(user.email);
  expect(puts[0]!.postDataJSON()).toEqual({ currentPassword: user.password, newPassword: 'newpass12' });
  for (const field of passwords(page)) await expect(field).toHaveValue('');
  await expect(updateButton(page)).toBeFocused();
  await expect(updateButton(page)).toHaveAttribute('aria-disabled', 'true');
  await page.waitForTimeout(300);
  expect(sent.filter((line) => !line.startsWith('GET /api/calendar'))).toEqual(['PUT /api/auth/password']);
  await expect(page).toHaveURL(/\/settings\/security$/);
  await expect(profileBlock(page).getByText('Tanzir Rahman', { exact: true })).toBeVisible();
  // The same session still answers, and the page stays when it checks it again.
  expect((await page.request.get('/api/auth/me')).status()).toBe(200);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(/\/settings\/security$/);

  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('textbox', { name: 'Email Address' }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect');
  await page.getByLabel('Password', { exact: true }).fill('newpass12');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/overview$/);
  // The user signed up first is untouched.
  expect(await loginStatus(request, first.email, first.password)).toBe(200);
});

// T21: AC5, AC8, the rules in the browser and the wrong current password.
test('shows the rules’ messages with red borders and nothing sent, then the wrong current password after its 400', async ({
  page,
}) => {
  const user = await openSecurity(page);
  const puts = passwordPuts(page);

  await fill(page, user.password, 'abc', 'abd');
  await updateButton(page).click();

  await expect(password(page, 'New Password')).toHaveAccessibleDescription('Password must be at least 8 characters');
  await expect(password(page, 'Retype Password')).toHaveAccessibleDescription('Passwords do not match');
  await expect(password(page, 'New Password')).toBeFocused();
  await expectBorder(page, valueBox(password(page, 'New Password')), '--color-special-red');
  await expectBorder(page, valueBox(password(page, 'Retype Password')), '--color-special-red');
  expect(puts).toHaveLength(0);

  await fill(page, user.password, user.password);
  await updateButton(page).click();
  await expect(password(page, 'New Password')).toHaveAccessibleDescription(
    'New password must be different from the old password',
  );
  expect(puts).toHaveLength(0);

  await fill(page, 'wrong-pass1', 'newpass12');
  await updateButton(page).click();

  await expect(password(page, 'Old Password')).toHaveAccessibleDescription(wrongPassword);
  await expect(password(page, 'Old Password')).toBeFocused();
  await expectBorder(page, valueBox(password(page, 'Old Password')), '--color-special-red');
  expect(puts).toHaveLength(1);
  await expect(password(page, 'Old Password')).toHaveValue('wrong-pass1');
  await expect(password(page, 'New Password')).toHaveValue('newpass12');
  await expect(password(page, 'Retype Password')).toHaveValue('newpass12');
  expect(await loginStatus(page.request, user.email, user.password)).toBe(200);
});

// T22: AC7, #129 a, the user's other sessions end with the change; the current one stays.
test('signs another browser of the user out at its next request, keeping this one and another user signed in', async ({
  page,
  browser,
  request,
}) => {
  const first = await signUp(request);
  const user = await openSecurity(page);
  const context = await browser.newContext({ timezoneId: TIME_ZONE });
  try {
    const other = await context.newPage();
    await other.clock.install({ time: FIXED_NOW });
    await other.clock.setFixedTime(FIXED_NOW);
    expect(await loginStatus(other.request, user.email, user.password)).toBe(200);
    await other.goto('/overview');
    await expect(other.getByRole('main')).toBeVisible();
    await expect(other).toHaveURL(/\/overview$/);

    await fill(page, user.password, 'newpass12');
    await updateButton(page).click();
    await expect(statusText(page)).toHaveText('Password updated');

    const check = other.waitForResponse((response) => new URL(response.url()).pathname === '/api/auth/me');
    await refocus(other);
    expect((await check).status()).toBe(401);
    await expect(other).toHaveURL(/\/login/);
    expect((await page.request.get('/api/auth/me')).status()).toBe(200);
    await refocus(page);
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/settings\/security$/);
    expect((await request.get('/api/auth/me')).status()).toBe(200);
    expect(await loginStatus(request, first.email, first.password)).toBe(200);
  } finally {
    await context.close();
  }
});

// T23: AC3, a Google-only user: the phone alone; a direct request gets the wrong-password 400.
test('shows a Google-only user the read-only phone alone, refuses a direct change, and Google sign-in still works', async ({
  page,
}) => {
  const email = `google.${randomUUID()}@example.com`;
  await page.goto('/login');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await googleSignIn(page, { name: 'Gina Google', email });
  await expect(page).toHaveURL(/\/overview$/);

  await page.goto('/settings/security');

  await expect(countryCode(page)).toHaveValue('+1');
  await expect(phoneNumber(page)).toHaveValue('');
  await expect(main(page).getByLabel('Old Password', { exact: true })).toHaveCount(0);
  await expect(main(page).getByLabel('New Password', { exact: true })).toHaveCount(0);
  await expect(main(page).getByLabel('Retype Password', { exact: true })).toHaveCount(0);
  await expect(main(page).getByRole('button', { name: 'Update Password' })).toHaveCount(0);
  const response = await page.request.put('/api/auth/password', {
    headers: { 'X-Expected-User': email },
    data: { currentPassword: 'anything-1', newPassword: 'newpass12' },
  });
  expect([response.status(), await response.json()]).toEqual([
    400,
    { message: wrongPassword, fieldErrors: { currentPassword: wrongPassword } },
  ]);

  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await googleSignIn(page, { name: 'Gina Google', email });
  await expect(page).toHaveURL(/\/overview$/);
});

// T24: AC11, the protection through the real stack.
test('refuses cross-site, unguarded and other-user changes, and takes the user from the session only', async ({
  page,
  request,
}) => {
  const b = await signUp(request);
  const a = await signUp(page.request);
  const put = (headers: Record<string, string>, data: object) =>
    page.request.put('/api/auth/password', { headers, data });
  const change = { currentPassword: a.password, newPassword: 'newpass12' };

  expect((await put({ 'X-Expected-User': a.email, 'Sec-Fetch-Site': 'cross-site' }, change)).status()).toBe(403);
  expect((await put({}, change)).status()).toBe(400);
  const otherUser = await put({ 'X-Expected-User': b.email }, change);
  expect([otherUser.status(), await otherUser.json()]).toEqual([
    409,
    { message: 'Another user is signed in. Nothing was saved.' },
  ]);
  expect(await loginStatus(request, a.email, a.password)).toBe(200);

  const named = await put({ 'X-Expected-User': a.email }, { ...change, userId: 1, email: b.email });

  expect(named.status()).toBe(204);
  expect(await named.text()).toBe('');
  expect(await loginStatus(request, b.email, b.password)).toBe(200);
  expect(await loginStatus(request, a.email, 'newpass12')).toBe(200);
  expect(await loginStatus(request, a.email, a.password)).toBe(401);
});

// T25: AC17, the stale tab (#119): another tab logged A out and signed up B; A's tab changes before its check runs.
test('refuses the change of a stale tab with 409, then shows the signed-in user; no password changed', async ({
  page,
  request,
}) => {
  const a = await openSecurity(page);
  await fill(page, a.password, 'newpass12');
  const statuses: number[] = [];
  page.on('response', (response) => {
    if (response.request().method() === 'PUT') statuses.push(response.status());
  });
  const second = await page.context().newPage();
  expect((await second.request.post('/api/auth/logout')).status()).toBe(204);
  const b = { ...newUser(), fullName: 'Ada Lovelace' };
  expect((await second.request.post('/api/auth/signup', { data: b })).status()).toBe(201);
  await second.close();
  const release = await holdSessionChecks(page);

  await updateButton(page).click();

  await expect(main(page).getByRole('alert')).toHaveText('Another user is signed in. Nothing was saved.');
  expect(statuses).toEqual([409]);
  release();
  await expect(profileBlock(page).getByText('Ada Lovelace', { exact: true })).toBeVisible();
  await expect(password(page, 'Old Password')).toHaveValue('');
  await expect(password(page, 'New Password')).toHaveValue('');
  expect(statuses).toEqual([409]);
  expect(await loginStatus(request, a.email, a.password)).toBe(200);
  expect(await loginStatus(request, b.email, b.password)).toBe(200);
});

// T26: AC4, AC6, AC15, the keyboard: the Tab order, the borders and rings, Enter to save, the typing across tabs.
test('tabs through the passwords, the read-only phone and the button with the right focus look, and saves by Enter', async ({
  page,
}) => {
  const user = await openSecurity(page);
  await tab(page, 'Security').focus();

  await page.keyboard.press('Tab');
  for (const field of passwords(page)) {
    await expect(field).toBeFocused();
    expect(await computed(field, 'outline-style')).toBe('none');
    expect(await computed(valueBox(field), 'outline-style')).toBe('none');
    await expectBorder(page, valueBox(field), '--color-input-active');
    await page.keyboard.press('Tab');
  }
  await expect(countryCode(page)).toBeFocused();
  await expectRing(page, countryCode(page));
  await expectNoBorder(valueBox(countryCode(page)));
  await page.keyboard.press('Tab');
  await expect(phoneNumber(page)).toBeFocused();
  await expectRing(page, phoneNumber(page));
  await page.keyboard.press('Tab');
  await expect(updateButton(page)).toBeFocused();
  await expect(updateButton(page)).toHaveAttribute('aria-disabled', 'true');
  await expectRing(page, updateButton(page));

  // A click on the read-only number: focus, no ring.
  await phoneNumber(page).click();
  await expect(phoneNumber(page)).toBeFocused();
  expect(await computed(phoneNumber(page), 'outline-style')).toBe('none');

  // The typing survives a visit to Account.
  await fill(page, user.password, 'newpass12', 'newpass1');
  await tab(page, 'Account').click();
  await expect(main(page).getByRole('textbox', { name: 'Full name', exact: true })).toBeVisible();
  await tab(page, 'Security').click();
  await expect(password(page, 'Retype Password')).toHaveValue('newpass1');

  await password(page, 'Retype Password').fill('newpass12');
  await password(page, 'Retype Password').press('Enter');

  await expect(statusText(page)).toHaveText('Password updated');
  await expect(updateButton(page)).toBeFocused();
  expect(await loginStatus(page.request, user.email, 'newpass12')).toBe(200);
});

type Box = { x: number; y: number; width: number; height: number };
const near = (actual: number, expected: number, what: string, tolerance = 1) =>
  expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);
const pageRight = (page: Page) => page.evaluate(() => document.body.getBoundingClientRect().right);
const scrollWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);
const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x - 0.5 && inner.x + inner.width <= outer.x + outer.width + 0.5;

/**
 * AC16, AC19: 112's places on 111's grid, x from the card's left edge: the tabs, the four fields 104 apart, 540 of
 * 1040 wide, the values 24 in, the button 192x48 40 under the phone, the card 648 high and 48 under the button.
 */
async function expectLayout(page: Page) {
  const right = await pageRight(page);
  const cardBox = await box(card(page));
  near(cardBox.x, 304, 'card left');
  near(cardBox.y, 104, 'card top');
  near(cardBox.x + cardBox.width, right - 32, 'card right');
  near(cardBox.height, 648, 'card height');
  const contentLeft = cardBox.x + 32;
  const contentWidth = cardBox.width - 64;
  const security = await box(tab(page, 'Security'));
  near(security.y, cardBox.y + 40, 'tabs top');

  const labels = ['Old Password', 'New Password', 'Retype Password', 'Phone Number'] as const;
  for (const [index, name] of labels.entries()) {
    // The Account panel's "Phone Number" is mounted too, hidden.
    const label = await box(main(page).getByText(name, { exact: true }).filter({ visible: true }));
    near(label.y, cardBox.y + 112 + index * 104, `${name} label line top`, 1.5);
    near(label.x, contentLeft, `${name} label left`);
  }
  for (const field of [...passwords(page), phoneNumber(page)]) {
    const value = await box(valueBox(field));
    near(value.height, 56, 'value box height');
    near(value.width, (contentWidth * 540) / 1040, 'field width (540 of 1040)', 1.5);
  }
  for (const field of passwords(page)) near((await box(field)).x, contentLeft + 24, 'password value 24 in');
  const code = await box(countryCode(page));
  near(code.x, contentLeft + 24, 'code 24 in');
  // The code as wide as its text (`field-sizing: content`): whole, and not an input's default width; the divider 4 after
  // it, as the Account tab's row (task 028).
  expect(code.width, 'the code as narrow as its text').toBeLessThan(48);
  expect(await countryCode(page).evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  const divider = await box(phoneGroup(page).locator('svg'));
  near(divider.x, code.x + code.width + 4, 'divider 4 after the code');
  const button = await box(updateButton(page));
  near(button.x, contentLeft, 'button left');
  near(button.y, cardBox.y + 552, 'button top');
  near(button.width, 192, 'button width');
  near(button.height, 48, 'button height');
  near(cardBox.y + cardBox.height, button.y + button.height + 48, 'card 48 under the button');
  expect(await scrollWidth(page), 'no horizontal scroll').toBeLessThanOrEqual(Math.round(right));
}

// T27: AC3, AC14, AC16, AC19, the layout at 1280, 1440 and 1920, the errors, the skeleton, the bottom inset and the
// Google-only card.
test('places 112’s parts at 1280, 1440 and 1920, keeps errors inside, holds the skeleton’s place and ends 32 above the page end', async ({
  page,
}) => {
  await openSecurity(page);
  for (const [width, height] of [
    [1440, 1024],
    [1280, 1024],
    [1920, 1080],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expectLayout(page);
  }

  // Every field's error, wrapping inside the fields' column.
  await page.setViewportSize({ width: 1280, height: 1024 });
  await fill(page, '', `a${'x'.repeat(128)}`, 'abc');
  await updateButton(page).click();
  await expect(password(page, 'Retype Password')).toHaveAccessibleDescription('Passwords do not match');
  for (const field of passwords(page)) {
    const block = await box(fieldBlock(field));
    const message = await box(fieldBlock(field).locator('p').last());
    expect(inside(message, block), 'the message inside its column').toBe(true);
  }
  expect(await scrollWidth(page), 'no horizontal scroll with the errors').toBeLessThanOrEqual(
    Math.round(await pageRight(page)),
  );

  // The skeleton holds the form's place: the card is as high while the profile loads as with the form.
  await page.setViewportSize({ width: 1440, height: 1024 });
  const { promise: held, resolve: release } = Promise.withResolvers<void>();
  await page.route('**/api/profile', async (route) => {
    await held;
    await route.continue();
  });
  await page.goto('/settings/security');
  await expect(tablist(page)).toBeVisible();
  // The Security panel's skeleton: the hidden Account panel shows its own too.
  await expect(
    main(page).locator('[aria-hidden="true"] [class*="skeleton"]').filter({ visible: true }).first(),
  ).toBeVisible();
  const loading = await box(card(page));
  release();
  await expect(password(page, 'Old Password')).toBeVisible();
  near((await box(card(page))).height, loading.height, 'the card as high with the skeleton as with the form');
  await page.unroute('**/api/profile');

  // 1280x720: the page scrolls; the card ends 32 above its end (#111).
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/settings/security');
  await expect(password(page, 'Old Password')).toBeVisible();
  const { pageEnd, cardBottom } = await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const cardElement = document.querySelector('main > div')!;
    return {
      pageEnd: document.documentElement.scrollHeight,
      cardBottom: cardElement.getBoundingClientRect().bottom + window.scrollY,
    };
  });
  near(pageEnd, cardBottom + 32, 'the card 32 above the page end');

  // A Google-only user's card ends 48 under the phone row, which takes the first field's place.
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.route('**/api/profile', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    return route.fulfill({ response, json: { ...((await response.json()) as object), hasPassword: false } });
  });
  await page.goto('/settings/security');
  await expect(countryCode(page)).toBeVisible();
  await expect(main(page).getByLabel('Old Password', { exact: true })).toHaveCount(0);
  const googleCard = await box(card(page));
  const phoneBlock = await box(phoneGroup(page));
  near(phoneBlock.y, googleCard.y + 112, 'the phone in the first field’s place', 1.5);
  near(googleCard.y + googleCard.height, phoneBlock.y + phoneBlock.height + 48, 'card 48 under the phone row');
  near(
    (await box(valueBox(phoneNumber(page)))).width,
    ((googleCard.width - 64) * 540) / 1040,
    'phone 540 of 1040',
    1.5,
  );
});
