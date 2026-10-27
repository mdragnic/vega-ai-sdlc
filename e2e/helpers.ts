import { randomUUID } from 'node:crypto';

import { type APIRequestContext, type ConsoleMessage, expect, type Locator, type Page } from '@playwright/test';

import { FRONTEND_URL } from './constants';

/** Console errors and uncaught page errors, collected from now on. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** The computed color a token resolves to, read through a probe element. */
export async function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = `var(${name})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  }, token);
}

/** One computed style property of an element. */
export async function computed(locator: Locator, property: string): Promise<string> {
  return locator.evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property);
}

/** The computed value of `property` when set to `var(token)`, read through a probe element. */
export async function tokenComputed(page: Page, property: string, token: string): Promise<string> {
  return page.evaluate(
    ([name, prop]) => {
      const probe = document.createElement('div');
      probe.style.setProperty(prop, `var(${name})`);
      document.body.append(probe);
      const value = getComputedStyle(probe).getPropertyValue(prop);
      probe.remove();
      return value;
    },
    [token, property] as const,
  );
}

/** Sign up fields with an email no other test uses: the test database is shared by the run. */
export function newUser() {
  return { fullName: 'Tanzir Rahman', email: `${randomUUID()}@example.com`, password: 'abcdef12' };
}

export type User = ReturnType<typeof newUser>;

/** A registered user with an email no other test uses, signed up through the API. */
export async function signUp(request: APIRequestContext): Promise<User> {
  const user = newUser();
  const response = await request.post('/api/auth/signup', { data: user });
  expect(response.status()).toBe(201);
  return user;
}

/** An element's box on the page. */
export const box = async (locator: Locator) => (await locator.boundingBox())!;

/** A measured position, within 2px. */
export const within2 = (actual: number, expected: number, what: string) =>
  expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(2);

/** The box with the border around an `Input` field. */
export const control = (field: Locator) => field.locator('..');

export const SESSION_COOKIE = 'finebank_session';

/** The session cookie as the browser stores it. */
export async function sessionCookie(page: Page) {
  const cookies = await page.context().cookies(`${FRONTEND_URL}/api/auth/me`);
  return cookies.find((cookie) => cookie.name === SESSION_COOKIE);
}

/** The 2px teal `:focus-visible` ring of #87 on `element`, focused by the keyboard. */
export async function expectRing(page: Page, element: Locator) {
  expect(await element.evaluate((node) => node.matches(':focus-visible'))).toBe(true);
  expect(await computed(element, 'outline-style')).toBe('solid');
  expect(await computed(element, 'outline-width')).toBe('2px');
  expect(await computed(element, 'outline-offset')).toBe('2px');
  expect(await computed(element, 'outline-color')).toBe(await tokenColor(page, '--color-primary'));
}

/** Presses the mouse on `link` (released away from it, so it does not navigate): focus, but no ring (#87). */
export async function expectNoRingOnMouseFocus(page: Page, link: Locator) {
  const linkBox = await box(link);
  await page.mouse.move(linkBox.x + linkBox.width / 2, linkBox.y + linkBox.height / 2);
  await page.mouse.down();

  await expect(link).toBeFocused();
  expect(await link.evaluate((node) => node.matches(':focus-visible'))).toBe(false);
  expect(await computed(link, 'outline-style')).toBe('none');
  await page.mouse.move(5, 5);
  await page.mouse.up();
}

/** The fields of the fake Google page (task 012); each one as entered there, the prefilled value when not given. */
export interface GoogleProfile {
  name?: string;
  email?: string;
  emailVerified?: boolean;
}

/**
 * On the fake Google page, which "Continue with Google" opens with NODE_ENV=test (#75): changes its prefilled
 * profile by `profile` and presses `button`.
 */
export async function googleSignIn(
  page: Page,
  profile: GoogleProfile = {},
  button: 'Continue' | 'Cancel' | 'Fail' = 'Continue',
): Promise<void> {
  await expect(page).toHaveTitle('Fake Google');
  if (profile.name !== undefined) await page.getByLabel('Name').fill(profile.name);
  if (profile.email !== undefined) await page.getByLabel('Email', { exact: true }).fill(profile.email);
  if (profile.emailVerified !== undefined) await page.getByLabel('Email verified').setChecked(profile.emailVerified);
  await page.getByRole('button', { name: button }).click();
}

/**
 * The Upcoming Bill rows as #111 a lays them out where the text and the amount box do not fit side by side, as at
 * 1440 with the demo bills (task 015): each row's amount box under its text, right-aligned in the card's content box
 * (inset 24), the date box at the row's top.
 */
export async function expectBillAmountsUnderText(page: Page): Promise<void> {
  const region = page.getByRole('main').getByRole('region', { name: 'Upcoming Bill' });
  const items = region.getByRole('listitem');
  await expect(items).toHaveCount(2);
  const cardBox = await box(region.locator(':scope > div').last());
  for (const [index, item] of (await items.all()).entries()) {
    const row = `row ${index + 1}`;
    const date = await box(item.locator('time').first());
    const lastCharge = await box(item.locator('p').last());
    const amount = await box(item.locator('time').first().locator('xpath=following-sibling::div[1]/span'));
    expect(amount.y, `${row} amount box under the text`).toBeGreaterThanOrEqual(lastCharge.y + lastCharge.height);
    within2(amount.x + amount.width, cardBox.x + cardBox.width - 24, `${row} amount box right-aligned`);
    expect(date.y, `${row} date box at the row's top`).toBeLessThan(lastCharge.y);
  }
}

/**
 * Waits until the Overview Recent Transaction panel shows its content (rows, the empty message or the error state),
 * so a check that depends on the layout of grid rows 2 and 3 measures their final height (task 016).
 */
export async function waitForRecentTransactions(page: Page): Promise<void> {
  const panel = page.getByRole('main').getByRole('region', { name: 'Recent Transaction' }).getByRole('tabpanel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('[aria-busy="true"]')).toHaveCount(0);
}
