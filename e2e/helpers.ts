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
