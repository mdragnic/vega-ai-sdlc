import { randomUUID } from 'node:crypto';

import type { Locator, Page } from '@playwright/test';

import { FRONTEND_URL } from '../constants';
import { expect, test } from '../fixtures';
import {
  box,
  control,
  expectNoRingOnMouseFocus,
  expectRing,
  sessionCookie,
  signUp,
  tokenColor,
  within2,
} from '../helpers';

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

const nameField = (page: Page) => page.getByRole('textbox', { name: 'Name' });
const emailField = (page: Page) => page.getByRole('textbox', { name: 'Email Address' });
const passwordField = (page: Page) => page.getByLabel('Password', { exact: true });
const signUpButton = (page: Page) => page.getByRole('button', { name: 'Sign up' });
const signInLink = (page: Page) => page.getByRole('link', { name: 'Sign in here' });

async function fillForm(page: Page, fullName: string, email: string, password: string) {
  await nameField(page).fill(fullName);
  await emailField(page).fill(email);
  await passwordField(page).fill(password);
}

/** The left and right edges of the text inside `locator`, not of its box. */
const textExtent = (locator: Locator) =>
  locator.evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const { left, right } = range.getBoundingClientRect();
    return { left, right };
  });

// T15: a new account through the UI, signed in for 30 days, on Overview (AC4; #1, #3, #15, #63, #78, #95).
test('signs up a new user, opens Overview, and Back does not show Sign up', async ({ page }) => {
  const email = `${randomUUID()}@Example.COM`;
  const signUps: number[] = [];
  page.on('response', (response) => {
    if (response.url().endsWith('/api/auth/signup')) signUps.push(response.status());
  });
  await page.goto('/');
  await page.goto('/sign-up');

  await fillForm(page, '  Tanzir Rahman ', `  ${email} `, 'abcdef12');
  await signUpButton(page).click();

  await expect(page).toHaveURL(`${FRONTEND_URL}/overview`);
  await expect(page.getByRole('main')).toBeVisible();
  expect(signUps).toEqual([201]);
  const me = await page.request.get('/api/auth/me');
  expect(me.status()).toBe(200);
  expect(await me.json()).toMatchObject({ fullName: 'Tanzir Rahman', email: email.toLowerCase() });
  // The browser counts Max-Age from the real time, not from the page's fixed clock.
  const cookie = await sessionCookie(page);
  expect(Math.abs(cookie!.expires - (Date.now() / 1000 + THIRTY_DAYS_SECONDS))).toBeLessThan(120);

  await page.goBack();
  // The page before: `/`, which opens Overview for a signed-in user (task 011, #39).
  await expect(page).toHaveURL(`${FRONTEND_URL}/overview`);
  await expect(signUpButton(page)).toHaveCount(0);
});

// T16: an email already registered shows its message under Email with the red border, and focus moves to Email,
// so a screen reader reads the message (AC6; #15, #87; task 010 gate). The border stays red with focus (#87).
test('shows the email taken message under Email and focuses Email', async ({ page, request }) => {
  const user = await signUp(request);
  await page.goto('/sign-up');

  await fillForm(page, 'Someone Else', user.email.toUpperCase(), 'abcdef12');
  await signUpButton(page).click();

  await expect(page.getByText('An account with this email already exists')).toBeVisible();
  await expect(page).toHaveURL(`${FRONTEND_URL}/sign-up`);
  await expect(emailField(page)).toBeFocused();
  await expect(emailField(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(emailField(page)).toHaveAccessibleDescription('An account with this email already exists');
  await expect(control(emailField(page))).toHaveCSS('border-top-color', await tokenColor(page, '--color-special-red'));
  await expect(page.getByRole('alert')).toHaveCount(0);
  const message = await box(page.getByText('An account with this email already exists'));
  expect(message.y).toBeGreaterThanOrEqual((await box(control(emailField(page)))).y);
  expect(message.y).toBeLessThan((await box(passwordField(page))).y);
});

// T17: a signed-in user on Sign up goes to Overview, and the form never shows (AC9; #3, #97 c).
test('sends a signed-in user from Sign up to Overview without showing the form', async ({ page }) => {
  // page.request shares the browser's cookies: this signs the page in.
  await signUp(page.request);
  await page.addInitScript(() => {
    new MutationObserver(() => {
      // Any field but the header search of the app page it opens (task 011).
      if (document.querySelector('input:not([type="search"])')) {
        (window as unknown as { formSeen: boolean }).formSeen = true;
      }
    }).observe(document, { childList: true, subtree: true });
  });

  await page.goto('/sign-up');

  await expect(page).toHaveURL(`${FRONTEND_URL}/overview`);
  await expect(page.getByRole('main')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { formSeen?: boolean }).formSeen)).toBeFalsy();
});

// T18: keyboard order, the teal ring on "Sign in here", and focus kept while loading (AC3, AC7, AC8; #87).
test('tabs through the screen in order, never stopping on "terms of service."', async ({ page }) => {
  await page.goto('/sign-up');
  await expect(signUpButton(page)).toBeVisible();

  const order = [
    nameField(page),
    emailField(page),
    passwordField(page),
    page.getByRole('button', { name: 'Show password' }),
    signUpButton(page),
    page.getByRole('button', { name: 'Continue with Google' }),
    signInLink(page),
  ];
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  for (const element of order) {
    await page.keyboard.press('Tab');
    await expect(element).toBeFocused();
  }
  await expectRing(page, signInLink(page));
});

test('shows no ring on "Sign in here" focused by the mouse', async ({ page }) => {
  await page.goto('/sign-up');
  await expectNoRingOnMouseFocus(page, signInLink(page));
});

test('keeps keyboard focus on Sign up while the request runs', async ({ page, request }) => {
  const user = await signUp(request);
  const { promise: released, resolve: release } = Promise.withResolvers<void>();
  let signUps = 0;
  await page.route('**/api/auth/signup', async (route) => {
    signUps += 1;
    await released;
    await route.continue();
  });
  await page.goto('/sign-up');
  await fillForm(page, 'Tanzir Rahman', user.email, 'abcdef12');

  await passwordField(page).press('Enter');
  await expect(signUpButton(page)).toHaveAttribute('aria-busy', 'true');
  await expect(signUpButton(page)).toHaveAttribute('aria-disabled', 'true');
  await signUpButton(page).focus();
  await page.keyboard.press('Enter');
  await expect(signUpButton(page)).toBeFocused();
  await passwordField(page).press('Enter');
  await signUpButton(page).focus();

  // The email is registered: after the 409 focus moves to Email (T16).
  release();
  await expect(page.getByText('An account with this email already exists')).toBeVisible();
  await expect(signUpButton(page)).not.toHaveAttribute('aria-busy');
  await expect(emailField(page)).toBeFocused();
  expect(signUps).toBe(1);
});

// T8 and T11 in the browser: "terms of service." and "Continue with Google" are visual only (AC8, AC11).
test('does nothing on "terms of service." and "Continue with Google"', async ({ page }) => {
  await page.goto('/sign-up');
  await expect(signUpButton(page)).toBeVisible();
  const requests: string[] = [];
  page.on('request', (sent) => requests.push(sent.url()));

  await page.getByText('terms of service.').click();
  await page.getByRole('button', { name: 'Continue with Google' }).click();

  await expect(page).toHaveURL(`${FRONTEND_URL}/sign-up`);
  expect(requests).toEqual([]);
  await expect(page.getByText('Name is required')).toHaveCount(0);
});

// T20: the Active border only on the focused field (AC10, #63).
test('gives only the focused field the Active border', async ({ page }) => {
  await page.goto('/sign-up');
  await passwordField(page).fill('password123456');
  await nameField(page).fill('Tanzir Rahman');

  const active = await tokenColor(page, '--color-input-active');
  const normal = await tokenColor(page, '--color-input-border');
  await expect(nameField(page)).toBeFocused();
  await expect(control(nameField(page))).toHaveCSS('border-top-color', active);
  await expect(control(emailField(page))).toHaveCSS('border-top-color', normal);
  await expect(control(passwordField(page))).toHaveCSS('border-top-color', normal);
});

// T21: the layout of 102 at 1440x1024 (AC1; #63, #65, #66, #70). Positions measured on the 2x PNG, halved;
// text rows are line boxes (glyph tops less the offset of the type size, measured on a render).
test('matches the positions measured on 102', async ({ page }) => {
  await page.goto('/sign-up');
  await expect(signUpButton(page)).toBeVisible();

  const logo = page.getByRole('img', { name: 'FINEbank.IO' });
  const logoBox = await box(logo);
  within2(logoBox.x, 584, 'logo x');
  within2(logoBox.x + logoBox.width, 856, 'logo right');
  within2(logoBox.y, 112, 'logo top');
  within2(logoBox.y + logoBox.height, 142, 'logo bottom');
  await expect(logo).toHaveCSS('color', await tokenColor(page, '--color-primary'));

  const heading = page.getByRole('heading', { level: 1, name: 'Create an account' });
  const terms = page.getByText('By continuing, you agree to our');
  const signIn = page.getByText('Already have an account?');
  const rows: [string, Locator, number, number][] = [
    ['heading', heading, 179, 211],
    ['Name input', control(nameField(page)), 276, 324],
    ['Email input', control(emailField(page)), 380, 428],
    ['Password input', control(passwordField(page)), 484, 532],
    ['terms', terms, 564, 584],
    ['Sign up', signUpButton(page), 604, 652],
    ['divider', page.getByText('or sign up with').locator('..'), 684, 704],
    ['Google', page.getByRole('button', { name: 'Continue with Google' }), 736, 784],
    ['sign in line', signIn, 824, 848],
  ];
  for (const [what, locator, top, bottom] of rows) {
    const { x, y, width, height } = await box(locator);
    within2(y, top, `${what} top`);
    within2(y + height, bottom, `${what} bottom`);
    within2(x, 520, `${what} left`);
    within2(x + width, 920, `${what} right`);
  }

  // The centered text of the heading and the last line: their glyphs on 102.
  const headingText = await textExtent(heading);
  within2(headingText.left, 613.5, 'heading text left');
  within2(headingText.right, 827, 'heading text right');
  const signInText = await textExtent(signIn);
  within2(signInText.left, 575.5, 'sign in text left');
  within2(signInText.right, 864.5, 'sign in text right');
  // The terms text starts at the column edge; it renders 4px wider than 102 (listed in the visual check).
  within2((await textExtent(terms)).left, 521, 'terms text left');

  await expect(heading).toHaveCSS('color', await tokenColor(page, '--color-form-label'));
  await expect(heading).toHaveCSS('font-size', '24px');
  await expect(heading).toHaveCSS('font-weight', '700');
  await expect(terms).toHaveCSS('color', await tokenColor(page, '--color-input-active'));
  await expect(terms).toHaveCSS('font-size', '14px');
  await expect(page.getByText('terms of service.')).toHaveCSS('color', await tokenColor(page, '--color-primary'));
  await expect(signIn).toHaveCSS('color', await tokenColor(page, '--color-auth-muted'));
  await expect(signIn).toHaveCSS('font-size', '16px');
  await expect(signInLink(page)).toHaveCSS('color', await tokenColor(page, '--color-primary'));
  await expect(signInLink(page)).toHaveCSS('font-weight', '600');

  await expect(nameField(page)).not.toHaveAttribute('placeholder');
  await expect(emailField(page)).toHaveAttribute('placeholder', 'hello@example.com');
  await expect(passwordField(page)).not.toHaveAttribute('placeholder');
});

// T22: the links between Login, Sign up and Forgot Password, with no full page load (AC3, AC13, AC17).
test('links Login, Sign up and Forgot Password both ways without a page load', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { sameDocument: boolean }).sameDocument = true;
  });
  const sameDocument = () => page.evaluate(() => (window as unknown as { sameDocument?: boolean }).sameDocument);

  const steps: [string, string][] = [
    ['Create an account', '/sign-up'],
    ['Sign in here', '/login'],
    ['Forgot Password?', '/forgot-password'],
    ['Back to login', '/login'],
  ];
  for (const [name, path] of steps) {
    await page.getByRole('link', { name }).click();
    await expect(page).toHaveURL(`${FRONTEND_URL}${path}`);
    expect(await sameDocument(), name).toBe(true);
  }
  await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
});
