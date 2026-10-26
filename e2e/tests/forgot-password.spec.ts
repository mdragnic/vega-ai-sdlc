import type { Locator, Page } from '@playwright/test';

import { FRONTEND_URL } from '../constants';
import { expect, test } from '../fixtures';
import { box, control, expectNoRingOnMouseFocus, expectRing, signUp, tokenColor, within2 } from '../helpers';

const emailField = (page: Page) => page.getByRole('textbox', { name: 'Email Address' });
const resetButton = (page: Page) => page.getByRole('button', { name: 'Password Reset' });
const backLink = (page: Page) => page.getByRole('link', { name: 'Back to login' });

// T19: keyboard order and the teal ring on "Back to login" (AC13, #87).
test('tabs through the screen in order with the teal ring on "Back to login"', async ({ page }) => {
  await page.goto('/forgot-password');
  await expect(resetButton(page)).toBeVisible();

  await page.locator('body').click({ position: { x: 5, y: 5 } });
  for (const element of [emailField(page), resetButton(page), backLink(page)]) {
    await page.keyboard.press('Tab');
    await expect(element).toBeFocused();
  }

  await expectRing(page, backLink(page));
});

test('shows no ring on "Back to login" focused by the mouse', async ({ page }) => {
  await page.goto('/forgot-password');
  await expectNoRingOnMouseFocus(page, backLink(page));
});

// T19: "Password Reset" sends nothing and shows nothing (AC14, #16).
test('sends nothing and shows nothing on "Password Reset"', async ({ page }) => {
  await page.goto('/forgot-password');
  await expect(resetButton(page)).toBeVisible();
  const requests: string[] = [];
  page.on('request', (sent) => requests.push(sent.url()));
  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  // The browser's own validation fires `invalid` (and shows its bubble) when a form without noValidate is
  // submitted with "abc" in an email field.
  await page.evaluate(() => {
    document.addEventListener('invalid', () => ((window as unknown as { invalids: number }).invalids += 1), true);
    (window as unknown as { invalids: number }).invalids = 0;
  });

  await emailField(page).fill('abc');
  await emailField(page).press('Enter');
  await resetButton(page).click();
  await emailField(page).fill('marko@example.com');
  await resetButton(page).click();
  await emailField(page).fill('');
  await emailField(page).press('Enter');
  await emailField(page).fill('marko@example.com');
  await emailField(page).press('Enter');

  await expect(page).toHaveURL(`${FRONTEND_URL}/forgot-password`);
  await expect(emailField(page)).toHaveValue('marko@example.com');
  await expect(emailField(page)).not.toHaveAttribute('aria-invalid');
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { invalids: number }).invalids)).toBe(0);
  expect(requests.filter((url) => url.includes('/api/'))).toEqual([]);
  expect(dialogs).toEqual([]);
});

// T17: a signed-in user on Forgot Password goes to Overview, and the screen never shows (AC16; #97 c, #99 a).
test('sends a signed-in user from Forgot Password to Overview without showing the screen', async ({ page }) => {
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

  await page.goto('/forgot-password');

  await expect(page).toHaveURL(`${FRONTEND_URL}/overview`);
  await expect(page.getByRole('main')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { formSeen?: boolean }).formSeen)).toBeFalsy();
});

// T21: the layout of 103 at 1440x1024 (AC12; #63, #65, #66, #70, #99 b). Positions measured on the 2x PNG,
// halved; text rows are line boxes (glyph tops less the offset of the type size, measured on a render).
test('matches the positions measured on 103', async ({ page }) => {
  await page.goto('/forgot-password');
  await expect(resetButton(page)).toBeVisible();

  const logo = page.getByRole('img', { name: 'FINEbank.IO' });
  const logoBox = await box(logo);
  within2(logoBox.x, 584, 'logo x');
  within2(logoBox.x + logoBox.width, 856, 'logo right');
  // 103 draws the logo top at 230, a tie on the 4px grid: built at 228 (#99 b).
  within2(logoBox.y, 228, 'logo top');
  await expect(logo).toHaveCSS('color', await tokenColor(page, '--color-primary'));

  const heading = page.getByRole('heading', { level: 1, name: 'Forgot Password?' });
  const text = page.getByText('Enter your email address to get the');
  const rows: [string, Locator, number, number][] = [
    ['heading', heading, 303, 335],
    // 103 draws the two lines 26px apart, from 348 to 398. Built 24 apart (listed in the visual check), the
    // second line sits where 103 draws it and the first 2px lower: 350.
    ['text', text, 350, 398],
    ['Email input', control(emailField(page)), 466, 514],
    ['Password Reset', resetButton(page), 546, 594],
  ];
  for (const [what, locator, top, bottom] of rows) {
    const { x, y, width, height } = await box(locator);
    within2(y, top, `${what} top`);
    within2(y + height, bottom, `${what} bottom`);
    within2(x, 520, `${what} left`);
    within2(x + width, 920, `${what} right`);
  }

  // The centered glyphs of 103: each text line, and "Back to login".
  const lines = await text.evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    return [...range.getClientRects()].filter((rect) => rect.width > 0).map(({ left, right }) => ({ left, right }));
  });
  expect(lines).toHaveLength(2);
  within2(lines[0]!.left, 572, 'text line 1 left');
  within2(lines[0]!.right, 868.5, 'text line 1 right');
  within2(lines[1]!.left, 636.5, 'text line 2 left');
  within2(lines[1]!.right, 804, 'text line 2 right');

  const back = await box(backLink(page));
  within2(back.x, 671, '"Back to login" left');
  within2(back.x + back.width, 769, '"Back to login" right');
  within2(back.y, 618, '"Back to login" top');

  await expect(heading).toHaveCSS('color', await tokenColor(page, '--color-form-label'));
  await expect(heading).toHaveCSS('font-size', '24px');
  await expect(heading).toHaveCSS('font-weight', '700');
  await expect(text).toHaveCSS('color', await tokenColor(page, '--color-gray-01'));
  await expect(text).toHaveCSS('font-size', '18px');
  await expect(backLink(page)).toHaveCSS('color', await tokenColor(page, '--color-gray-02'));
  await expect(backLink(page)).toHaveCSS('font-size', '16px');
  await expect(backLink(page)).toHaveCSS('font-weight', '600');
  await expect(emailField(page)).toHaveAttribute('placeholder', 'hello@example.com');
});
