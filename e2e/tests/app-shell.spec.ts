import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures';
import { computed, tokenColor } from '../helpers';

async function openGallery(page: Page) {
  await page.goto('/dev/components');
  await expect(page.getByRole('heading', { level: 1, name: 'Component gallery' })).toBeVisible();
}

const frameNames = {
  104: 'Like 104: Overview active, with greeting',
  105: 'Like 105: Balances active, no greeting',
} as const;

/** One gallery AppLayout frame, scrolled so its top is at the top of the 1440x1024 viewport. */
async function openFrame(page: Page, frame: keyof typeof frameNames) {
  await openGallery(page);
  const figure = page.getByRole('figure', { name: frameNames[frame] });
  const header = figure.locator('header');
  const layout = header.locator('../..');
  await layout.evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY));
  return { figure, header, layout };
}

const box = async (locator: Locator) => (await locator.boundingBox())!;

const sections = ['Overview', 'Balances', 'Transactions', 'Bills', 'Expenses', 'Goals', 'Settings'];

// T3: an inactive item under the pointer shows Hover; the active item stays Active (AC3).
test('hovering an inactive item shows the Hover style, the active item stays Active', async ({ page }) => {
  await openGallery(page);
  const navBar = page.getByRole('region', { name: 'NavBar', exact: true });
  const inactive = navBar.getByRole('link', { name: 'Balances' });
  const active = navBar.getByRole('link', { name: 'Overview' });
  const hoverBackground = await tokenColor(page, '--color-white-8');
  const inactiveText = await tokenColor(page, '--color-white-70');

  expect(await computed(inactive, 'background-color')).toBe('rgba(0, 0, 0, 0)');
  await inactive.hover();
  expect(await computed(inactive, 'background-color')).toBe(hoverBackground);
  expect(await computed(inactive, 'color')).toBe(inactiveText);

  await active.hover();
  expect(await computed(active, 'background-color')).toBe(await tokenColor(page, '--color-primary'));
  expect(await computed(active, 'color')).toBe(await tokenColor(page, '--color-white'));
  expect(await computed(inactive, 'background-color')).toBe('rgba(0, 0, 0, 0)');
});

// T10: the content and the header scroll, the sidebar stays in place, no horizontal scroll (AC10, #5, #83).
test('scrolling moves the header and the content while the sidebar stays in place', async ({ page }) => {
  const { figure, header } = await openFrame(page, 104);
  const sidebarParts = [
    figure.getByRole('img', { name: 'FINEbank.IO' }),
    figure.getByRole('navigation', { name: 'Main' }),
    figure.getByRole('button', { name: 'Logout' }),
    figure.getByRole('link', { name: 'View profile' }),
  ];
  const before = await Promise.all(sidebarParts.map(box));
  const headerBefore = await box(header);
  const contentBefore = await box(figure.getByRole('main'));

  await page.evaluate(() => window.scrollBy(0, 800));

  expect((await box(header)).y).toBe(headerBefore.y - 800);

  expect(await Promise.all(sidebarParts.map(box))).toEqual(before);
  expect((await box(figure.getByRole('main'))).y).toBe(contentBefore.y - 800);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
});

// Task 003 review: on a window shorter than the sidebar (796px), Logout and the profile block stay reachable.
test('on a short window the sidebar scrolls, so Logout and "View profile" stay reachable', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 640 });
  const { figure } = await openFrame(page, 105);
  const targets = [figure.getByRole('button', { name: 'Logout' }), figure.getByRole('link', { name: 'View profile' })];

  for (const target of targets) {
    await target.scrollIntoViewIfNeeded();
    const { y, height } = await box(target);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y + height).toBeLessThanOrEqual(640);
  }
  // The dark sidebar still covers what scrolled in.
  expect(await computed(figure.getByRole('navigation', { name: 'Main' }).locator('..'), 'background-color')).toBe(
    await tokenColor(page, '--color-default-black'),
  );
  expect((await box(figure.getByRole('navigation', { name: 'Main' }).locator('..'))).height).toBeGreaterThanOrEqual(
    796,
  );
});

// Task 003 review: a very long first name is cut with an ellipsis instead of pushing the page sideways (AC10).
test('a very long greeting name does not scroll the page sideways', async ({ page }) => {
  const { header } = await openFrame(page, 104);
  // Found by element, since the test replaces its text.
  const greeting = header.locator('p');
  await expect(greeting).toHaveText('Hello Tanzir');

  await greeting.evaluate((element) => {
    element.textContent = `Hello ${'Maximilianfriedrichwilhelm'.repeat(4)}`;
  });

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  expect(await box(header.getByRole('search'))).toMatchObject({ x: 1056, width: 352 });
  expect(await computed(greeting, 'text-overflow')).toBe('ellipsis');
});

// Validation step 4 positions, measured on 104 and 105 (CSS px, halved from the 2x PNGs).
test('the sidebar matches the positions measured on 104', async ({ page }) => {
  const { figure, layout } = await openFrame(page, 104);
  const links = figure.getByRole('navigation', { name: 'Main' }).getByRole('link');

  const navBar = figure.getByRole('navigation', { name: 'Main' }).locator('..');
  expect(await box(navBar)).toEqual({ x: 0, y: 0, width: 280, height: 1024 });
  expect(await computed(navBar, 'background-color')).toBe(await tokenColor(page, '--color-default-black'));

  // Logo glyphs x 117 to 443 and y 108 to 144 at 2x: 164 wide, centered, its bottom at 72.
  const logo = await box(figure.getByRole('img', { name: 'FINEbank.IO' }));
  expect(logo.x).toBe(58);
  expect(logo.width).toBe(164);
  expect(logo.y + logo.height).toBe(72);
  expect(await computed(figure.getByRole('img', { name: 'FINEbank.IO' }), 'color')).toBe(
    await tokenColor(page, '--color-white'),
  );

  for (const [index, name] of sections.entries()) {
    expect(await box(links.nth(index))).toEqual({ x: 28, y: 120 + 64 * index, width: 224, height: 48 });
    // The 24px icon box sits 16px inside the item, the label 12px after it (tokens.md).
    const icon = await box(links.nth(index).locator('svg'));
    expect(icon).toEqual({ x: 44, y: 132 + 64 * index, width: 24, height: 24 });
    expect((await box(links.nth(index).getByText(name))).x).toBe(80);
  }

  expect(await box(figure.getByRole('button', { name: 'Logout' }))).toEqual({ x: 28, y: 780, width: 224, height: 48 });
  expect(await box(figure.getByRole('button', { name: 'Logout' }).locator('svg'))).toEqual({
    x: 44,
    y: 794,
    width: 20,
    height: 20,
  });
  expect((await box(figure.getByRole('button', { name: 'Logout' }).getByText('Logout'))).x).toBe(80);

  expect(await box(figure.getByRole('separator'))).toEqual({ x: 28, y: 872, width: 224, height: 1 });
  expect(await box(figure.getByRole('img', { name: 'Tanzir Rahman' }))).toEqual({
    x: 28,
    y: 908,
    width: 32,
    height: 32,
  });
  expect((await box(figure.getByText('Tanzir Rahman', { exact: true }))).x).toBe(76);
  expect((await box(figure.getByRole('link', { name: 'View profile' }))).x).toBe(76);
  // The three dots: glyph x 496 to 503 and y 1828 to 1867 at 2x, flush with the item's right edge.
  const dots = await box(
    layout
      .locator('svg')
      .filter({ hasNot: page.locator('path') })
      .last(),
  );
  expect(dots.x + dots.width).toBe(252);
  expect(dots.y + dots.height / 2).toBe(924);
});

test('the header matches the positions measured on 104 and 105', async ({ page }) => {
  for (const frame of [104, 105] as const) {
    const { header } = await openFrame(page, frame);
    expect(await box(header)).toEqual({ x: 280, y: 0, width: 1160, height: 88 });

    // The bottom line: 1px of Gray/05 at y 87.
    const line = await header.evaluate((element) => {
      const style = getComputedStyle(element, '::after');
      return { color: style.backgroundColor, height: style.height, bottom: style.bottom };
    });
    expect(line).toEqual({ color: await tokenColor(page, '--color-gray-05'), height: '1px', bottom: '0px' });

    const [chevron, bell, searchIcon] = await header.locator('svg').all();
    const chevronBox = await box(chevron!);
    expect(chevronBox).toMatchObject({ y: 32, width: 24, height: 24 });
    if (frame === 104) {
      // The "»" follows the greeting by 24. 104 has it at x 468; the greeting's advance in Inter Variable is
      // about 1px narrower than Figma's Inter (task 003 Log), so it lands within 1.5px of that.
      const greeting = await box(header.getByText('Hello Tanzir'));
      expect(greeting.x).toBe(304);
      expect(chevronBox.x).toBe(greeting.x + greeting.width + 24);
      expect(Math.abs(chevronBox.x - 468)).toBeLessThanOrEqual(1.5);
    } else {
      expect(chevronBox.x).toBe(304);
    }
    expect((await box(header.locator('time'))).x).toBe(chevronBox.x + 24 + 4);
    expect(await box(bell!)).toEqual({ x: 992, y: 32, width: 24, height: 24 });
    expect(await box(header.getByRole('search'))).toEqual({ x: 1056, y: 20, width: 352, height: 48 });
    expect((await box(header.getByRole('searchbox'))).x).toBe(1088);
    expect(await box(searchIcon!)).toEqual({ x: 1360, y: 32, width: 24, height: 24 });
  }
});

// #87: keyboard focus shows the teal ring on the sidebar links, Logout, "View profile" and the search field.
test('keyboard focus shows the teal ring through the sidebar and the header, in order', async ({ page }) => {
  const { figure } = await openFrame(page, 104);
  const teal = await tokenColor(page, '--color-primary');
  const search = figure.getByRole('searchbox', { name: 'Search' });
  const order = [
    ...sections.map((name) => figure.getByRole('navigation', { name: 'Main' }).getByRole('link', { name })),
    figure.getByRole('button', { name: 'Logout' }),
    figure.getByRole('link', { name: 'View profile' }),
  ];

  await order[0]!.focus();
  await page.keyboard.press('Shift+Tab');
  for (const target of order) {
    await page.keyboard.press('Tab');
    await expect(target).toBeFocused();
    expect(await computed(target, 'outline-style')).toBe('solid');
    expect(await computed(target, 'outline-color')).toBe(teal);
  }
  await page.keyboard.press('Tab');
  await expect(search).toBeFocused();
  const field = figure.getByRole('search');
  expect(await computed(field, 'outline-style')).toBe('solid');
  expect(await computed(field, 'outline-color')).toBe(teal);

  const logout = figure.getByRole('button', { name: 'Logout' });
  await logout.click();
  expect(await computed(logout, 'outline-style')).toBe('none');
});

// AC9 in the browser: typing works, Enter sends no request and the page stays (#7). The gallery field is in no
// form; Enter inside a form (implicit submission) is the unit test T9.
test('the search field takes text, and Enter sends no request and stays on the page', async ({ page }) => {
  const { figure } = await openFrame(page, 104);
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  const search = figure.getByRole('searchbox', { name: 'Search' });

  await search.fill('rent');
  await search.press('Enter');

  await expect(search).toHaveValue('rent');
  expect(requests).toEqual([]);
  expect(new URL(page.url()).pathname).toBe('/dev/components');
});

// Visual-only parts: the colors measured on 104 (AC1, AC2, AC8).
test('the shell uses the measured colors', async ({ page }) => {
  const { figure, header } = await openFrame(page, 104);
  const nav = figure.getByRole('navigation', { name: 'Main' });
  const color = (token: string) => tokenColor(page, token);

  expect(await computed(nav.getByRole('link', { name: 'Overview' }), 'background-color')).toBe(
    await color('--color-primary'),
  );
  expect(await computed(nav.getByRole('link', { name: 'Overview' }), 'color')).toBe(await color('--color-white'));
  expect(await computed(nav.getByRole('link', { name: 'Balances' }), 'color')).toBe(await color('--color-white-70'));
  expect(await computed(figure.getByRole('button', { name: 'Logout' }), 'background-color')).toBe(
    await color('--color-logout-bg'),
  );
  expect(await computed(figure.getByRole('separator'), 'background-color')).toBe(await color('--color-white-8'));
  expect(await computed(header.getByText('Hello Tanzir'), 'color')).toBe(await color('--color-default-black'));
  expect(await computed(header.locator('time'), 'color')).toBe(await color('--color-gray-03'));
  const [chevron, bell] = await header.locator('svg').all();
  expect(await computed(chevron!, 'color')).toBe(await color('--color-gray-03'));
  expect(await computed(bell!, 'color')).toBe(await color('--color-gray-01'));
  expect(await computed(header.getByRole('search'), 'background-color')).toBe(await color('--color-white'));
});
