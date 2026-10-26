import { randomUUID } from 'node:crypto';

import type { Page } from '@playwright/test';

import { FRONTEND_URL } from '../constants';
import { expect, test } from '../fixtures';
import { box, googleSignIn, sessionCookie, signUp, within2 } from '../helpers';

// Task 012: "Continue with Google" through the fake Google page (NODE_ENV=test, #75).

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;
const failureMessage = 'Google sign-in failed. Please try again.';

const googleButton = (page: Page) => page.getByRole('button', { name: 'Continue with Google' });
const loginButton = (page: Page) => page.getByRole('button', { name: 'Login' });
const navBar = (page: Page) => page.getByRole('navigation', { name: 'Main' }).locator('..');
const header = (page: Page) => page.getByRole('banner');

/** An email no other test uses, with capitals, as Google may give it. */
const newGoogleEmail = () => `Google.${randomUUID()}@Example.com`;

/** The signed-in user, or the status when none. */
async function signedInUser(page: Page) {
  const response = await page.request.get('/api/auth/me');
  return response.ok() ? ((await response.json()) as { fullName: string; email: string }) : response.status();
}

async function hasSignInCookie(page: Page): Promise<boolean> {
  return (await page.context().cookies()).some((cookie) => cookie.name === 'finebank_google_signin');
}

// T23: AC1, AC2, AC4.
test('signs in a new user from Login and opens the page asked for, through a full page load', async ({ page }) => {
  const email = newGoogleEmail();
  await page.goto('/bills');
  await expect(page).toHaveURL(`${FRONTEND_URL}/login?returnTo=%2Fbills`);
  await expect(loginButton(page)).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { beforeGoogle: boolean }).beforeGoogle = true;
  });

  const start = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/auth/google');
  await googleButton(page).click();
  expect(new URL((await start).url()).search).toBe('?returnTo=%2Fbills');
  await googleSignIn(page, { name: 'Gina Google', email });

  await expect(page).toHaveURL(`${FRONTEND_URL}/bills`);
  await expect(navBar(page).getByText('Gina Google', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { beforeGoogle?: boolean }).beforeGoogle)).toBeUndefined();
  const cookie = await sessionCookie(page);
  // The browser counts Max-Age from the real time, not from the page's fixed clock.
  expect(Math.abs(cookie!.expires - (Date.now() / 1000 + THIRTY_DAYS_SECONDS))).toBeLessThan(120);
  expect(await signedInUser(page)).toMatchObject({ fullName: 'Gina Google', email: email.toLowerCase() });
  expect(await hasSignInCookie(page)).toBe(false);
});

// T24: AC2 (US-02 criterion 9).
test('signs up a new user from Sign up and opens Overview with their name', async ({ page }) => {
  await page.goto('/sign-up');

  await googleButton(page).click();
  await googleSignIn(page, { name: 'Sam Signup', email: newGoogleEmail() });

  await expect(page).toHaveURL(`${FRONTEND_URL}/overview`);
  await expect(header(page).getByText('Hello Sam')).toBeVisible();
  await expect(navBar(page).getByText('Sam Signup', { exact: true })).toBeVisible();
});

/** Logs in on Login with an email and a password. */
async function logIn(page: Page, email: string, password: string) {
  await page.getByRole('textbox', { name: 'Email Address' }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await loginButton(page).click();
}

// T25: AC3 (#104).
test('signs in the password user with the same email, keeps their name and removes their password', async ({
  page,
  request,
}) => {
  const user = await signUp(request);
  await page.goto('/login');

  await googleButton(page).click();
  await googleSignIn(page, { name: 'Other Google Name', email: user.email.toUpperCase() });

  await expect(page).toHaveURL(`${FRONTEND_URL}/overview`);
  await expect(header(page).getByText('Hello Tanzir')).toBeVisible();
  await expect(navBar(page).getByText('Tanzir Rahman', { exact: true })).toBeVisible();
  await expect(page.getByText('Other Google Name')).toHaveCount(0);

  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/login`);
  await logIn(page, user.email, user.password);
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect');
  await expect(page).toHaveURL(`${FRONTEND_URL}/login`);
});

// T33: AC3 (#104). Someone signs up first with the victim's email; the victim's Google sign-in takes the account back.
test("ends the session and the password of someone who signed up first with the victim's email", async ({
  page,
  browser,
}) => {
  const victimEmail = newGoogleEmail();
  const attacker = await browser.newContext({ baseURL: FRONTEND_URL, viewport: { width: 1440, height: 1024 } });
  const attackerPage = await attacker.newPage();
  const signUpResponse = await attackerPage.request.post('/api/auth/signup', {
    data: { fullName: 'Attacker Person', email: victimEmail, password: 'attacker-pass1' },
  });
  expect(signUpResponse.status()).toBe(201);
  await attackerPage.goto('/overview');
  await expect(header(attackerPage).getByText('Hello Attacker')).toBeVisible();

  await page.goto('/login');
  await googleButton(page).click();
  await googleSignIn(page, { name: 'Victim Person', email: victimEmail });
  await expect(page).toHaveURL(`${FRONTEND_URL}/overview`);

  // The attacker's next request gets 401, so their open page goes to Login.
  await attackerPage.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Bills' }).click();
  await expect(attackerPage).toHaveURL(`${FRONTEND_URL}/login?returnTo=%2Fbills`);
  await logIn(attackerPage, victimEmail, 'attacker-pass1');
  await expect(attackerPage.getByRole('alert')).toHaveText('Email or password is incorrect');
  await attacker.close();
});

// T26: AC5.
test('returns to Login with the page asked for and no message when cancelled on Google', async ({ page }) => {
  await page.goto('/login?returnTo=%2Fbills');

  await googleButton(page).click();
  await googleSignIn(page, {}, 'Cancel');

  await expect(page).toHaveURL(`${FRONTEND_URL}/login?returnTo=%2Fbills`);
  await expect(loginButton(page)).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await signedInUser(page)).toBe(401);
  expect(await hasSignInCookie(page)).toBe(false);
});

// T27: AC6, AC7.
test.describe('a failed Google sign-in', () => {
  test('returns to Login with the message once, the marker gone from the URL', async ({ page }) => {
    await page.goto('/login?returnTo=%2Fbills');

    await googleButton(page).click();
    await googleSignIn(page, {}, 'Fail');

    await expect(page.getByRole('alert')).toHaveText(failureMessage);
    await expect(page).toHaveURL(`${FRONTEND_URL}/login?returnTo=%2Fbills`);
    expect(await signedInUser(page)).toBe(401);
    expect(await hasSignInCookie(page)).toBe(false);

    await page.reload();
    await expect(loginButton(page)).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('fails for an unverified email and creates no user', async ({ page, request }) => {
    const email = newGoogleEmail();
    await page.goto('/login');

    await googleButton(page).click();
    await googleSignIn(page, { email, emailVerified: false });

    await expect(page.getByRole('alert')).toHaveText(failureMessage);
    await expect(page).toHaveURL(`${FRONTEND_URL}/login`);
    const signUpResponse = await request.post('/api/auth/signup', {
      data: { fullName: 'Tanzir Rahman', email, password: 'abcdef12' },
    });
    expect(signUpResponse.status()).toBe(201);
  });

  test("never signs in a browser that did not start the sign-in, with another browser's code (login CSRF)", async ({
    page,
    browser,
  }) => {
    // An attacker's own sign-in, stopped where Google sends their browser back with an unused code.
    const attacker = await browser.newContext({ baseURL: FRONTEND_URL });
    const start = await attacker.request.get('/api/auth/google', { maxRedirects: 0 });
    const authorization = new URL(start.headers().location!, FRONTEND_URL);
    const answer = await attacker.request.post(authorization.pathname, {
      maxRedirects: 0,
      form: {
        state: authorization.searchParams.get('state')!,
        code_challenge: authorization.searchParams.get('code_challenge')!,
        name: 'Attacker',
        email: newGoogleEmail(),
        email_verified: 'on',
        action: 'continue',
      },
    });
    const callbackUrl = answer.headers().location!;

    await page.goto(callbackUrl);

    await expect(page).toHaveURL(`${FRONTEND_URL}/login`);
    await expect(page.getByRole('alert')).toHaveText(failureMessage);
    expect(await signedInUser(page)).toBe(401);
    // The code was good: only the attacker's own browser, with its sign-in cookie, signs in with it.
    const own = await attacker.request.get(callbackUrl, { maxRedirects: 0 });
    expect(own.headers().location).toBe('/overview');
    await attacker.close();
  });
});

// T28: AC14 (#3).
test('sends a signed-in user from Login with the failure marker to Overview without the form', async ({ page }) => {
  await signUp(page.request);
  // Records whether the Login form ever appears while the page loads.
  await page.addInitScript(() => {
    new MutationObserver(() => {
      if (document.querySelector('input[type="email"]')) {
        (window as unknown as { loginFormSeen: boolean }).loginFormSeen = true;
      }
    }).observe(document, { childList: true, subtree: true });
  });

  await page.goto('/login?googleSignIn=failed');

  await expect(page).toHaveURL(`${FRONTEND_URL}/overview`);
  await expect(page.getByRole('main')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { loginFormSeen?: boolean }).loginFormSeen)).toBeFalsy();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

// T29: AC15. The Google button where tasks 009 and 010 measured it, between the submit button and the link.
test.describe('the Google button keeps its place', () => {
  for (const [path, submit, link, top, bottom] of [
    ['/login', 'Login', 'Create an account', 644, 692],
    ['/sign-up', 'Sign up', 'Sign in here', 736, 784],
  ] as const) {
    test(`on ${path}`, async ({ page }) => {
      await page.goto(path);
      const submitButton = page.getByRole('button', { name: submit });
      await expect(submitButton).toBeVisible();

      const { x, y, width, height } = await box(googleButton(page));
      within2(y, top, 'Google top');
      within2(y + height, bottom, 'Google bottom');
      within2(x, 520, 'Google left');
      within2(x + width, 920, 'Google right');

      await submitButton.focus();
      await page.keyboard.press('Tab');
      await expect(googleButton(page)).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: link })).toBeFocused();
    });
  }
});
