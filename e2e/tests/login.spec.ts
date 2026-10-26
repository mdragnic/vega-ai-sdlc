import { randomUUID } from 'node:crypto';

import type { Locator, Page } from '@playwright/test';

import { FIXED_NOW, FRONTEND_URL } from '../constants';
import { expect, test } from '../fixtures';
import { box, computed, control, sessionCookie, signUp, tokenColor, within2 } from '../helpers';

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

const emailField = (page: Page) => page.getByRole('textbox', { name: 'Email Address' });
const passwordField = (page: Page) => page.getByLabel('Password', { exact: true });
const loginButton = (page: Page) => page.getByRole('button', { name: 'Login' });
const keepSignedIn = (page: Page) => page.getByRole('checkbox', { name: 'Keep me signed in' });

async function logIn(page: Page, email: string, password: string) {
  await emailField(page).fill(email);
  await passwordField(page).fill(password);
  await loginButton(page).click();
}

// T17: a signed-out visitor returns to the page asked for, with its query and hash (AC6, AC13, #3).
test('returns to the page asked for after login, and Back does not show Login', async ({ page, request }) => {
  const user = await signUp(request);
  await page.goto('/');
  await page.goto('/balances/12?view=1#top');

  await expect(page).toHaveURL(`${FRONTEND_URL}/login?returnTo=%2Fbalances%2F12%3Fview%3D1%23top`);
  await logIn(page, `  ${user.email.toUpperCase()} `, user.password);

  await expect(page).toHaveURL(`${FRONTEND_URL}/balances/12?view=1#top`);
  await expect(page.getByRole('main')).toBeVisible();
  await page.goBack();
  // The page before: `/`, which opens Overview for a signed-in user (task 011, #39).
  await expect(page).toHaveURL(`${FRONTEND_URL}/overview`);
  await expect(loginButton(page)).toHaveCount(0);
});

// T18: "Keep me signed in" sets the cookie's lifetime (AC11, #14, #75).
test('keeps the session cookie for 30 days when checked, and for the browser session when not', async ({
  page,
  browser,
  request,
}) => {
  const user = await signUp(request);
  await page.goto('/login');
  await expect(keepSignedIn(page)).toHaveAttribute('aria-checked', 'true');
  await logIn(page, user.email, user.password);
  await expect(page).toHaveURL(`${FRONTEND_URL}/overview`);

  const kept = await sessionCookie(page);
  // The browser counts Max-Age from the real time, not from the page's fixed clock.
  expect(Math.abs(kept!.expires - (Date.now() / 1000 + THIRTY_DAYS_SECONDS))).toBeLessThan(120);

  const context = await browser.newContext();
  const second = await context.newPage();
  await second.goto('/login');
  await keepSignedIn(second).click();
  await expect(keepSignedIn(second)).toHaveAttribute('aria-checked', 'false');
  await logIn(second, user.email, user.password);
  await expect(second).toHaveURL(`${FRONTEND_URL}/overview`);

  expect((await sessionCookie(second))!.expires).toBe(-1);
  await context.close();
});

// T19: wrong credentials show one message above the Login button (AC8, #14).
test('shows the same message above Login for a wrong password and an unknown email', async ({ page, request }) => {
  const user = await signUp(request);
  await page.goto('/login');

  const attempts = [
    [user.email, 'wrong-password'],
    [`${randomUUID()}@example.com`, user.password],
  ] as const;
  for (const [email, password] of attempts) {
    await logIn(page, email, password);

    const alert = page.getByRole('alert');
    await expect(alert).toHaveText('Email or password is incorrect');
    const alertBox = await box(alert);
    const loginBox = await box(loginButton(page));
    expect(alertBox.y + alertBox.height).toBeLessThanOrEqual(loginBox.y);
    expect(alertBox.y).toBeGreaterThanOrEqual((await box(keepSignedIn(page))).y);
    await expect(page).toHaveURL(`${FRONTEND_URL}/login`);
    await expect(emailField(page)).toHaveValue(email);
    await expect(emailField(page)).not.toHaveAttribute('aria-invalid', 'true');
  }
});

// T20: a signed-in user on Login goes to Overview, and the form never shows (AC12, #3, #97 c).
test('sends a signed-in user from Login to Overview without showing the form', async ({ page, request }) => {
  const user = await signUp(request);
  await page.goto('/login');
  await logIn(page, user.email, user.password);
  await expect(page).toHaveURL(`${FRONTEND_URL}/overview`);

  // Records whether the Login form ever appears while a page loads.
  await page.addInitScript(() => {
    new MutationObserver(() => {
      if (document.querySelector('input[type="email"]')) {
        (window as unknown as { loginFormSeen: boolean }).loginFormSeen = true;
      }
    }).observe(document, { childList: true, subtree: true });
  });

  for (const path of ['/login', '/login?returnTo=%2Fbills']) {
    await page.goto(path);
    await expect(page).toHaveURL(`${FRONTEND_URL}/overview`);
    await expect(page.getByRole('main')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { loginFormSeen?: boolean }).loginFormSeen)).toBeFalsy();
  }
});

// T21: the return target is only a path inside the app; anything else opens Overview (AC14).
test('opens Overview for every return target that is not a path inside the app', async ({ page, request }) => {
  const user = await signUp(request);
  const visited: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) visited.push(frame.url());
  });
  const offSite: string[] = [];
  await page.route('**/*evil.example*/**', async (route) => {
    offSite.push(route.request().url());
    await route.abort();
  });

  const encoded = [
    'https://evil.example/overview',
    '//evil.example',
    '/\\evil.example',
    '/%09/evil.example',
    'javascript:alert(1)',
    'balances',
    '',
    '/login',
    '/sign-up',
    '/forgot-password',
  ].map((value) => `returnTo=${encodeURIComponent(value)}`);
  // As typed into the address bar: the browser decodes %09 to a tab, which the URL parser would drop.
  const raw = ['returnTo=/%09/evil.example', 'returnTo=//evil.example', 'returnTo=/\\evil.example', 'returnTo='];

  for (const query of [...encoded, ...raw]) {
    await page.context().clearCookies();
    await page.goto(`/login?${query}`);
    await logIn(page, user.email, user.password);
    await expect(page, query).toHaveURL(`${FRONTEND_URL}/overview`);
  }

  expect(offSite).toEqual([]);
  expect(visited.filter((url) => !url.startsWith(`${FRONTEND_URL}/`))).toEqual([]);
});

// T22: a session that ends while the app is open sends the user to Login on the next check (AC15, #3, #75).
test('opens Login with the page as the return target when the session expires in the background', async ({
  page,
  request,
}) => {
  const user = await signUp(request);
  await page.goto('/login?returnTo=%2Foverview');
  await logIn(page, user.email, user.password);
  await expect(page).toHaveURL(`${FRONTEND_URL}/overview`);

  const expired = new Date(Date.parse(FIXED_NOW) + THIRTY_DAYS_SECONDS * 1000 + 60_000).toISOString();
  expect((await request.put('/api/test/clock', { data: { now: expired } })).ok()).toBe(true);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));

  await expect(page).toHaveURL(`${FRONTEND_URL}/login?returnTo=%2Foverview`);
  await expect(loginButton(page)).toBeVisible();
});

// T23: keyboard order and the teal ring on both links; Login keeps focus while loading (AC5, AC9; #87).
test('tabs through the screen in order with the teal ring on the links', async ({ page }) => {
  await page.goto('/login');
  await expect(loginButton(page)).toBeVisible();
  const primary = await tokenColor(page, '--color-primary');

  const order = [
    emailField(page),
    page.getByRole('link', { name: 'Forgot Password?' }),
    passwordField(page),
    page.getByRole('button', { name: 'Show password' }),
    keepSignedIn(page),
    loginButton(page),
    page.getByRole('button', { name: 'Continue with Google' }),
    page.getByRole('link', { name: 'Create an account' }),
  ];
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  for (const element of order) {
    await page.keyboard.press('Tab');
    await expect(element).toBeFocused();
    if ((await element.evaluate((node) => node.tagName)) === 'A') {
      expect(await computed(element, 'outline-style')).toBe('solid');
      expect(await computed(element, 'outline-width')).toBe('2px');
      expect(await computed(element, 'outline-offset')).toBe('2px');
      expect(await computed(element, 'outline-color')).toBe(primary);
    }
  }
});

test('shows no ring on a link focused by the mouse', async ({ page }) => {
  await page.goto('/login');
  for (const name of ['Forgot Password?', 'Create an account']) {
    const link = page.getByRole('link', { name });
    const linkBox = await box(link);
    await page.mouse.move(linkBox.x + linkBox.width / 2, linkBox.y + linkBox.height / 2);
    await page.mouse.down();

    await expect(link).toBeFocused();
    expect(await link.evaluate((node) => node.matches(':focus-visible'))).toBe(false);
    expect(await computed(link, 'outline-style')).toBe('none');
    // Release away from the link, so it does not navigate.
    await page.mouse.move(5, 5);
    await page.mouse.up();
  }
});

test('keeps keyboard focus on Login while the request runs', async ({ page, request }) => {
  const user = await signUp(request);
  const { promise: released, resolve: release } = Promise.withResolvers<void>();
  let logins = 0;
  await page.route('**/api/auth/login', async (route) => {
    logins += 1;
    await released;
    await route.continue();
  });
  await page.goto('/login');
  await emailField(page).fill(user.email);
  await passwordField(page).fill('wrong-password');

  await loginButton(page).focus();
  await page.keyboard.press('Enter');
  await expect(loginButton(page)).toHaveAttribute('aria-busy', 'true');
  await expect(loginButton(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(loginButton(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await passwordField(page).press('Enter');
  await loginButton(page).focus();

  release();
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect');
  await expect(loginButton(page)).not.toHaveAttribute('aria-busy');
  await expect(loginButton(page)).toBeFocused();
  expect(logins).toBe(1);
});

// T24: the layout of 101 at 1440x1024 (AC1, AC4; #63, #66, #70). Positions measured on the 2x PNG, halved.
test('matches the positions measured on 101', async ({ page }) => {
  await page.goto('/login');
  await expect(loginButton(page)).toBeVisible();

  const logo = await box(page.getByRole('img', { name: 'FINEbank.IO' }));
  within2(logo.x, 584, 'logo x');
  within2(logo.x + logo.width, 856, 'logo right');
  within2(logo.y, 160, 'logo top');
  within2(logo.y + logo.height, 190, 'logo bottom');
  await expect(page.getByRole('img', { name: 'FINEbank.IO' })).toHaveCSS(
    'color',
    await tokenColor(page, '--color-primary'),
  );

  const rows: [string, Locator, number, number][] = [
    ['Email input', control(emailField(page)), 288, 336],
    ['Password input', control(passwordField(page)), 392, 440],
    ['checkbox', keepSignedIn(page), 474, 494],
    ['Login', loginButton(page), 512, 560],
    ['divider', page.getByText('or sign in with').locator('..'), 592, 612],
    ['Google', page.getByRole('button', { name: 'Continue with Google' }), 644, 692],
  ];
  for (const [what, locator, top, bottom] of rows) {
    const { x, y, width, height } = await box(locator);
    within2(y, top, `${what} top`);
    within2(y + height, bottom, `${what} bottom`);
    if (what !== 'checkbox') {
      within2(x, 520, `${what} left`);
      within2(x + width, 920, `${what} right`);
    }
  }

  // "Forgot Password?" glyphs on 101: x 818 to 919, on the line of the "Password" label.
  const forgot = await box(page.getByRole('link', { name: 'Forgot Password?' }));
  const passwordLabel = await box(page.locator('label', { hasText: /^Password$/ }));
  within2(forgot.x, 818, '"Forgot Password?" left');
  within2(forgot.x + forgot.width, 920, '"Forgot Password?" right');
  within2(forgot.y + forgot.height / 2, passwordLabel.y + passwordLabel.height / 2, '"Forgot Password?" middle');

  const create = page.getByRole('link', { name: 'Create an account' });
  const createBox = await box(create);
  within2(createBox.x, 649.5, '"Create an account" left');
  within2(createBox.x + createBox.width, 790.5, '"Create an account" right');
  within2(createBox.y, 732, '"Create an account" top');
  await expect(create).toHaveCSS('color', await tokenColor(page, '--color-primary'));
  await expect(create).toHaveCSS('font-size', '16px');

  await expect(emailField(page)).not.toHaveAttribute('placeholder');
  await expect(passwordField(page)).not.toHaveAttribute('placeholder');
});

// AC4 on the screen: the Active border only on the focused field (#63).
test('gives only the focused field the Active border', async ({ page }) => {
  await page.goto('/login');
  await passwordField(page).fill('password123456');
  await emailField(page).fill('johndoe@email.com');

  const active = await tokenColor(page, '--color-input-active');
  const normal = await tokenColor(page, '--color-input-border');
  await expect(emailField(page).locator('..')).toHaveCSS('border-top-color', active);
  await expect(passwordField(page).locator('..')).toHaveCSS('border-top-color', normal);
});

// T25: both links are in-app navigations, with no full page load (AC5).
test('follows "Forgot Password?" and "Create an account" without a page load', async ({ page }) => {
  await page.goto('/login');
  await expect(loginButton(page)).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { sameDocument: boolean }).sameDocument = true;
  });
  const sameDocument = () => page.evaluate(() => (window as unknown as { sameDocument?: boolean }).sameDocument);

  await page.getByRole('link', { name: 'Forgot Password?' }).click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/forgot-password`);
  expect(await sameDocument()).toBe(true);

  await page.goBack();
  await expect(page).toHaveURL(`${FRONTEND_URL}/login`);
  await expect(loginButton(page)).toBeVisible();
  expect(await sameDocument()).toBe(true);

  await page.getByRole('link', { name: 'Create an account' }).click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/sign-up`);
  expect(await sameDocument()).toBe(true);
});
// "Continue with Google" (T14 here until task 012): e2e/tests/google-sign-in.spec.ts.
