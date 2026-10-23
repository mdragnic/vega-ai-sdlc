import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures';
import { collectErrors, computed, tokenColor, tokenComputed } from '../helpers';

async function openGallery(page: Page) {
  await page.goto('/dev/components');
  await expect(page.getByRole('heading', { level: 1, name: 'Component gallery' })).toBeVisible();
}

const box = async (locator: Locator) => (await locator.boundingBox())!;
const figure = (page: Page, region: string, name: string) =>
  page.getByRole('region', { name: region, exact: true }).getByRole('figure', { name, exact: true });

// T4: the section title, the title-to-card gaps and the card (AC3, AC5).
test('Section titles and Cards use the measured tokens', async ({ page }) => {
  await openGallery(page);
  const plain = figure(page, 'Section', 'Plain, like 104 Total Balance');
  const title = plain.getByRole('heading', { level: 2, name: 'Total Balance' });
  const card = title.locator('xpath=../following-sibling::*[1]');

  expect(await computed(title, 'color')).toBe(await tokenColor(page, '--color-gray-02'));
  expect(await computed(title, 'font-size')).toBe('22px');
  expect(await computed(title, 'line-height')).toBe('32px');
  expect(await computed(title, 'font-weight')).toBe('400');

  // The title row is the title's 32px line box; the card follows at the screen's gap.
  for (const [name, heading, gap] of [
    ['Plain, like 104 Total Balance', 'Total Balance', 8],
    ['16px gap, like 105 Balances', 'Balances', 16],
  ] as const) {
    const h2 = figure(page, 'Section', name).getByRole('heading', { level: 2, name: heading });
    const row = await box(h2.locator('..'));
    const next = await box(h2.locator('xpath=../following-sibling::*[1]'));
    expect(row.height).toBe(32);
    expect(next.y - (row.y + row.height)).toBe(gap);
  }

  expect(await computed(card, 'background-color')).toBe(await tokenColor(page, '--color-white'));
  expect(await computed(card, 'border-radius')).toBe(await tokenComputed(page, 'border-radius', '--radius-card'));
  expect(await computed(card, 'box-shadow')).toBe(await tokenComputed(page, 'box-shadow', '--shadow-card'));
  expect(await computed(card, 'padding')).toBe('24px');
  const flush = figure(page, 'Card', 'No padding').getByText('Content that sets its own insets').locator('..');
  expect(await computed(flush, 'padding')).toBe('0px');
  expect(await computed(flush, 'box-shadow')).toBe(await tokenComputed(page, 'box-shadow', '--shadow-card'));
});

// T4, AC4: "View All" flush right and centered on the title row; the note on its bottom.
test('"View All" and the note sit on the right of the title row', async ({ page }) => {
  await openGallery(page);
  const bills = figure(page, 'Section', 'With View All, like 104 Upcoming Bill');
  const link = bills.getByRole('link', { name: 'View All' });
  const row = await box(bills.getByRole('heading', { level: 2 }).locator('..'));
  const chevron = await box(link.locator('svg'));
  const linkBox = await box(link);

  expect(chevron.x + chevron.width).toBe(row.x + row.width);
  expect(chevron.width).toBe(16);
  expect(linkBox.y + linkBox.height / 2).toBe(row.y + row.height / 2);
  expect(await computed(link, 'color')).toBe(await tokenColor(page, '--color-gray-02'));
  expect(await computed(link, 'font-size')).toBe('12px');
  expect(await computed(link, 'text-decoration-line')).toBe('none');

  const breakdown = figure(page, 'Section', 'With the note, like 104 Expenses Breakdown');
  const note = breakdown.getByText('*Compare to last month');
  const noteBox = await box(note);
  const noteRow = await box(breakdown.getByRole('heading', { level: 2 }).locator('..'));
  expect(noteBox.x + noteBox.width).toBe(noteRow.x + noteRow.width);
  expect(noteBox.y + noteBox.height).toBe(noteRow.y + noteRow.height);
  expect(await computed(note, 'color')).toBe(await tokenColor(page, '--color-gray-03'));
  expect(await computed(note, 'font-size')).toBe('12px');
});

// T7: the Active style on whichever tab is selected, Inactive on the others (AC6, #19).
test('the selected tab is teal and bold with the 2px teal underline, the others Secondary', async ({ page }) => {
  await openGallery(page);
  const teal = await tokenColor(page, '--color-primary');
  const secondary = await tokenColor(page, '--color-secondary');

  for (const [name, selected] of [
    ['All active', 'All'],
    ['Revenue active', 'Revenue'],
    ['Expenses active', 'Expenses'],
  ] as const) {
    for (const tab of await figure(page, 'MenuTab', name).getByRole('tab').all()) {
      const isSelected = (await tab.getAttribute('aria-selected')) === 'true';
      expect(isSelected).toBe((await tab.textContent())!.startsWith(selected));
      expect(await computed(tab, 'height')).toBe('32px');
      expect(await computed(tab, 'border-bottom-width')).toBe('2px');
      expect(await computed(tab, 'color')).toBe(isSelected ? teal : secondary);
      expect(await computed(tab, 'font-weight')).toBe(isSelected ? '700' : '600');
      expect(await computed(tab, 'border-bottom-color')).toBe(isSelected ? teal : 'rgba(0, 0, 0, 0)');
    }
  }

  // The tabs keep their widths and positions when the selection moves (each is as wide as its bold label).
  // Boxes relative to the tablist, since a click may scroll the page.
  const tablist = figure(page, 'MenuTab', 'Interactive').getByRole('tablist');
  const tabs = tablist.getByRole('tab');
  const layout = async () => {
    const origin = await box(tablist);
    return Promise.all(
      (await tabs.all()).map(async (tab) => {
        const { x, y, width, height } = await box(tab);
        return { x: x - origin.x, y: y - origin.y, width, height };
      }),
    );
  };
  const before = await layout();
  await tabs.nth(1).click();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  expect(await layout()).toEqual(before);
  expect(before[1]!.x - (before[0]!.x + before[0]!.width)).toBe(20);
});

// T9: tile size, tile color and icon color per measured context (AC9).
test('CategoryIcon variants match the measured tiles', async ({ page }) => {
  await openGallery(page);
  const variants = [
    ['Recent Transaction (104)', 40, 40, '--color-gray-06', '--color-gray-01'],
    ['Expenses Breakdown (104)', 40, 56, '--color-gray-06', '--color-gray-02'],
    ['Card header (109)', 40, 48, '--color-special-bg', '--color-secondary'],
    ['Goals (110)', 40, 48, '--color-gray-06', '--color-secondary'],
    ['Table row (107)', 24, 24, null, '--color-secondary'],
  ] as const;

  for (const [name, width, height, tile, icon] of variants) {
    const icons = await figure(page, 'CategoryIcon', name).getByRole('img').all();
    expect(icons).toHaveLength(7);
    for (const element of icons) {
      const tileBox = await box(element);
      const glyph = await box(element.locator('svg'));
      expect([tileBox.width, tileBox.height]).toEqual([width, height]);
      expect([glyph.width, glyph.height]).toEqual([24, 24]);
      // The icon is centered in its tile.
      expect(glyph.x - tileBox.x).toBe((width - 24) / 2);
      expect(glyph.y - tileBox.y).toBe((height - 24) / 2);
      expect(await computed(element, 'background-color')).toBe(
        tile ? await tokenColor(page, tile) : 'rgba(0, 0, 0, 0)',
      );
      expect(await computed(element.locator('svg'), 'color')).toBe(await tokenColor(page, icon));
      if (tile) expect(await computed(element, 'border-radius')).toBe('8px');
    }
  }
});

// T11: the date and amount boxes (AC10, AC11).
test('DateBox shows the month over the day in the measured box and type', async ({ page }) => {
  await openGallery(page);
  const sizes = [
    ['Compact (104)', 44, 64, '--color-gray-01', '12px', '400', '--color-default-black'],
    ['Large (108)', 72, 80, '--color-gray-02', '16px', '600', '--color-secondary'],
  ] as const;

  for (const [name, width, height, monthColor, monthSize, monthWeight, dayColor] of sizes) {
    const dates = figure(page, 'DateBox', name).locator('time');
    await expect(dates).toHaveCount(3);
    const first = dates.first();
    const month = first.locator('span').first();
    const day = first.locator('span').last();
    const dateBox = await box(first);

    expect([dateBox.width, dateBox.height]).toEqual([width, height]);
    expect(await computed(first, 'background-color')).toBe(await tokenColor(page, '--color-gray-06'));
    expect(await computed(first, 'border-radius')).toBe('8px');
    expect(await month.textContent()).toBe('May');
    expect(await day.textContent()).toBe('15');
    expect(await computed(month, 'color')).toBe(await tokenColor(page, monthColor));
    expect(await computed(month, 'font-size')).toBe(monthSize);
    expect(await computed(month, 'font-weight')).toBe(monthWeight);
    expect(await computed(day, 'color')).toBe(await tokenColor(page, dayColor));
    expect(await computed(day, 'font-size')).toBe('22px');
    expect(await computed(day, 'font-weight')).toBe('800');
    // The month sits above the day, 4px apart, both centered in the box.
    const monthBox = await box(month);
    const dayBox = await box(day);
    expect(dayBox.y - (monthBox.y + monthBox.height)).toBe(4);
    expect(monthBox.y - dateBox.y).toBe(dateBox.y + dateBox.height - (dayBox.y + dayBox.height));
    await expect(dates.nth(2)).toHaveText('Sep05');
  }
});

test('AmountBox has the measured border and type, and widens for a long amount on one line', async ({ page }) => {
  await openGallery(page);
  const sizes = [
    ['Compact (104)', 68, 40, '--color-secondary', '16px', 12],
    ['Large (108)', 108, 48, '--color-default-black', '18px', 16],
  ] as const;

  for (const [name, minWidth, height, color, fontSize, padding] of sizes) {
    const amounts = figure(page, 'AmountBox', name);
    const short = amounts.getByText('$150.00', { exact: true });
    const long = amounts.getByText('$1,000,000,000.00', { exact: true });
    const shortBox = await box(short);
    const longBox = await box(long);

    expect(shortBox.height).toBe(height);
    expect(shortBox.width).toBeGreaterThanOrEqual(minWidth);
    expect(await computed(short, 'border-top-width')).toBe('1px');
    expect(await computed(short, 'border-top-color')).toBe(await tokenColor(page, '--color-gray-05'));
    expect(await computed(short, 'border-radius')).toBe('8px');
    expect(await computed(short, 'color')).toBe(await tokenColor(page, color));
    expect(await computed(short, 'font-size')).toBe(fontSize);
    expect(await computed(short, 'font-weight')).toBe('800');

    // The long amount widens the box: same height, text on one line inside the border and padding.
    expect(longBox.height).toBe(height);
    const text = await long.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const rects = [...range.getClientRects()];
      const { left, right } = range.getBoundingClientRect();
      return { lines: new Set(rects.map((rect) => Math.round(rect.top))).size, left, right };
    });
    expect(text.lines).toBe(1);
    expect(text.left).toBeGreaterThanOrEqual(longBox.x + 1 + padding - 0.5);
    expect(text.right).toBeLessThanOrEqual(longBox.x + longBox.width - 1 - padding + 0.5);
  }
});

// T15: one broken widget shows its error state; the other keeps working; Retry recovers (AC15).
test('a render error breaks only its widget, and Retry renders it again', async ({ page }) => {
  const errors = collectErrors(page);
  await openGallery(page);
  const demo = figure(page, 'DataState', 'Error boundary: one widget breaks, the other keeps working');
  const first = demo.getByRole('region', { name: 'First widget' });
  const second = demo.getByRole('region', { name: 'Second widget' });
  await expect(first.getByText('$150.00')).toBeVisible();
  expect(errors).toEqual([]);

  await demo.getByRole('button', { name: 'Render a bad amount' }).click();

  await expect(first.getByRole('alert')).toHaveText('Something went wrong.');
  await expect(second.getByText('$559.00')).toBeVisible();
  await second.getByRole('tab', { name: 'Revenue' }).click();
  await expect(second.getByRole('tabpanel')).toHaveText(/Income only/);
  await expect(page.getByRole('heading', { level: 1, name: 'Component gallery' })).toBeVisible();

  await first.getByRole('button', { name: 'Retry' }).click();
  await expect(first.getByText('$150.00')).toBeVisible();
  await expect(first.getByRole('alert')).toHaveCount(0);

  // The only console error is the expected one, from formatMoney on 12.5 cents.
  expect(errors.length).toBeGreaterThan(0);
  for (const error of errors) expect(error).toContain('Money must be integer cents, got 12.5');
});

// T16: the teal ring on keyboard focus only (AC16, #87).
test('keyboard focus shows the teal ring on tabs, "View All", Retry and ButtonSmall; a click does not', async ({
  page,
}) => {
  await openGallery(page);
  const teal = await tokenColor(page, '--color-primary');
  const tab = figure(page, 'MenuTab', 'Interactive').getByRole('tab', { name: 'All' });
  const viewAll = figure(page, 'Section', 'With View All, like 104 Upcoming Bill').getByRole('link', {
    name: 'View All',
  });
  const retry = figure(page, 'DataState', 'Error').getByRole('button', { name: 'Retry' });
  const details = figure(page, 'ButtonSmall', 'Default').getByRole('button', { name: 'Details' });

  for (const target of [tab, viewAll, retry, details]) {
    await target.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(target).toBeFocused();
    expect(await computed(target, 'outline-style')).toBe('solid');
    expect(await computed(target, 'outline-color')).toBe(teal);
    expect(await computed(target, 'outline-width')).toBe('2px');
    expect(await computed(target, 'outline-offset')).toBe('2px');
  }

  for (const target of [tab, details]) {
    await target.click();
    await expect(target).toBeFocused();
    expect(await computed(target, 'outline-style')).toBe('none');
  }
  // A mouse press focuses the link without the ring; releasing elsewhere avoids leaving the gallery.
  await viewAll.hover();
  await page.mouse.down();
  await expect(viewAll).toBeFocused();
  expect(await computed(viewAll, 'outline-style')).toBe('none');
  await page.mouse.move(0, 0);
  await page.mouse.up();
});

// T17: the skeleton pulses, and stops under reduced motion (AC17).
test('Skeleton pulses, and does not animate with reduced motion', async ({ page }) => {
  await openGallery(page);
  const block = figure(page, 'Skeleton', 'Shapes: text, block, circle').locator('span').nth(1);
  expect(await computed(block, 'animation-name')).not.toBe('none');
  expect(await computed(block, 'background-color')).toBe(await tokenColor(page, '--color-gray-05'));

  await page.emulateMedia({ reducedMotion: 'reduce' });

  expect(await computed(block, 'animation-name')).toBe('none');
});
