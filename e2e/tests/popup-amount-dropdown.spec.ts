import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures';
import { collectErrors, computed, tokenColor, tokenComputed } from '../helpers';

const box = async (locator: Locator) => (await locator.boundingBox())!;
const figure = (page: Page, region: string, name: string) =>
  page.getByRole('region', { name: region, exact: true }).getByRole('figure', { name, exact: true });

async function openDemo(page: Page) {
  await page.goto('/dev/popup');
  await expect(page.getByRole('button', { name: 'Open two-field popup' })).toBeVisible();
}

async function openGallery(page: Page) {
  await page.goto('/dev/components');
  await expect(page.getByRole('heading', { level: 1, name: 'Component gallery' })).toBeVisible();
}

/** Opens a demo popup and returns the dialog. */
async function openPopup(page: Page, fields: 'two' | 'one') {
  await page.getByRole('button', { name: `Open ${fields}-field popup` }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('textbox').first()).toBeFocused();
  // Radix starts listening for presses outside one timer tick after opening, so the opening click cannot
  // close it. A person cannot click that fast; a test can, so it waits that tick.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
  return dialog;
}

/** The bordered box of a PopupInputSmall: the parent of its input. */
const fieldBox = (field: Locator) => field.locator('..');
const overlayOf = (dialog: Locator) => dialog.locator('xpath=preceding-sibling::*[1]');
const scrollY = (page: Page) => page.evaluate(() => window.scrollY);
const focusInside = (dialog: Locator) => dialog.evaluate((element) => element.contains(document.activeElement));

// T2: the panel, the X, the fields and Save as in 104.1, 110.1 and 110.2, centered on the content area (AC2, #90 c).
test('the popup panel matches 104.1 and 110.2, centered on the content area', async ({ page }) => {
  await openDemo(page);
  const dialog = await openPopup(page, 'two');

  expect(await box(dialog)).toEqual({ x: 616, y: 276, width: 488, height: 392 });
  expect(await computed(dialog, 'background-color')).toBe(await tokenColor(page, '--color-white'));
  expect(await computed(dialog, 'border-radius')).toBe('16px');
  expect(await computed(dialog, 'box-shadow')).toBe('none');

  const close = dialog.getByRole('button', { name: 'Close' });
  expect(await box(close)).toEqual({ x: 1104 - 24 - 32, y: 300, width: 32, height: 32 });
  expect(await computed(close, 'color')).toBe(await tokenColor(page, '--color-secondary'));
  expect(await box(close.locator('svg'))).toEqual({ x: 1048, y: 300, width: 32, height: 32 });

  const target = fieldBox(dialog.getByRole('textbox', { name: 'Target Amounts' }));
  const present = fieldBox(dialog.getByRole('textbox', { name: 'Present Amounts' }));
  expect(await box(target)).toEqual({ x: 680, y: 372, width: 360, height: 56 });
  expect(await box(present)).toEqual({ x: 680, y: 484, width: 360, height: 56 });
  expect(await box(dialog.getByText('Target Amounts'))).toMatchObject({ x: 680, y: 340, height: 24 });
  const save = dialog.getByRole('button', { name: 'Save' });
  expect(await box(save)).toEqual({ x: 764, y: 572, width: 192, height: 48 });

  // The title names the dialog but is not shown.
  expect(await box(dialog.getByRole('heading'))).toMatchObject({ width: 1, height: 1 });

  await page.keyboard.press('Escape');
  const one = await openPopup(page, 'one');
  expect(await box(one)).toEqual({ x: 616, y: 276, width: 488, height: 280 });
  expect(await box(one.getByRole('button', { name: 'Save' }))).toEqual({ x: 764, y: 460, width: 192, height: 48 });

  // Wider window: still centered on the content area right of the 280px sidebar.
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1600, height: 1024 });
  const wide = await openPopup(page, 'two');
  expect(await box(wide)).toMatchObject({ x: 696, y: 276, width: 488 });
});

// T3: the dim covers the content area only, and nothing behind moves (AC3).
test('the overlay dims the content area below the header, and the page does not move', async ({ page }) => {
  await openDemo(page);
  // Hidden from assistive technology while the popup is open, so the query includes hidden elements.
  const card = page.getByRole('region', { name: 'Goals', includeHidden: true });
  const before = await box(card);
  const sidebarBefore = await page.screenshot({ clip: { x: 0, y: 0, width: 280, height: 1024 } });
  const headerBefore = await page.screenshot({ clip: { x: 280, y: 0, width: 1160, height: 88 } });

  const dialog = await openPopup(page, 'two');
  // The opener's hover and focus are gone once the popup has focus; let the page settle.
  await page.mouse.move(1300, 1000);
  const overlay = overlayOf(dialog);

  expect(await box(overlay)).toEqual({ x: 280, y: 88, width: 1160, height: 936 });
  expect(await computed(overlay, 'background-color')).toBe(await tokenColor(page, '--color-default-black-15'));
  expect(await page.screenshot({ clip: { x: 0, y: 0, width: 280, height: 1024 } })).toEqual(sidebarBefore);
  expect(await page.screenshot({ clip: { x: 280, y: 0, width: 1160, height: 88 } })).toEqual(headerBefore);
  expect(await box(card)).toEqual(before);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect(await box(card)).toEqual(before);

  // Scrolled so the header is off screen: everything right of the sidebar is dimmed.
  await page.evaluate(() => window.scrollTo(0, 100));
  const scrolledCard = await box(card);
  const scrolled = await openPopup(page, 'one');
  expect(await box(overlayOf(scrolled))).toEqual({ x: 280, y: 0, width: 1160, height: 1024 });
  expect(await scrollY(page)).toBe(100);
  expect(await box(card)).toEqual(scrolledCard);
});

// T4: the whole page is blocked while the popup is open (AC4, #35).
test('the sidebar, the header and the wheel do nothing while the popup is open, and focus stays inside', async ({
  page,
}) => {
  await openDemo(page);
  const url = page.url();
  const dialog = await openPopup(page, 'two');

  // A raw mouse click at the link: Radix turns pointer events off outside the popup.
  const balances = await box(page.getByRole('link', { name: 'Balances', includeHidden: true }));
  await page.mouse.click(balances.x + balances.width / 2, balances.y + balances.height / 2);
  const search = await box(page.getByRole('searchbox', { name: 'Search', includeHidden: true }));
  await page.mouse.click(search.x + search.width / 2, search.y + search.height / 2);
  await page.mouse.click(700, 44);

  await expect(dialog).toBeVisible();
  expect(page.url()).toBe(url);
  expect(await focusInside(dialog)).toBe(true);

  await page.mouse.move(900, 900);
  await page.mouse.wheel(0, 600);
  await page.mouse.move(140, 500);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(200);
  expect(await scrollY(page)).toBe(0);

  for (const key of ['Tab', 'Shift+Tab']) {
    for (let press = 0; press < 6; press += 1) {
      await page.keyboard.press(key);
      expect(await focusInside(dialog)).toBe(true);
    }
  }

  for (const landmark of [page.locator('nav'), page.locator('main'), page.locator('header')]) {
    expect(await landmark.evaluate((element) => element.closest('[aria-hidden="true"]') !== null)).toBe(true);
  }

  // The content behind is under the dim: a click there reaches the overlay, not the content, and closes the
  // popup like any click on the dimmed area (#35, AC5). The "View All" link under it does not navigate.
  const viewAll = await box(page.getByRole('link', { name: 'View All', includeHidden: true }));
  await page.mouse.click(viewAll.x + viewAll.width / 2, viewAll.y + viewAll.height / 2);
  await expect(dialog).toBeHidden();
  expect(page.url()).toBe(url);
});

// AC5: X, Esc and the dimmed area close it and focus returns to the opener; a reopened popup shows the initial values.
test('X, Esc and the dimmed area close the popup and return focus to the opener', async ({ page }) => {
  await openDemo(page);
  const opener = page.getByRole('button', { name: 'Open two-field popup' });

  let dialog = await openPopup(page, 'two');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();

  dialog = await openPopup(page, 'two');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();

  dialog = await openPopup(page, 'two');
  await page.getByRole('textbox', { name: 'Target Amounts' }).pressSequentially('9');
  // The sidebar: blocked, not dimmed, so the popup stays open.
  await page.mouse.click(140, 900);
  await expect(dialog).toBeVisible();
  await page.mouse.click(1300, 900);
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();

  dialog = await openPopup(page, 'two');
  await expect(dialog.getByRole('textbox', { name: 'Target Amounts' })).toHaveValue('500000');
  await dialog.click({ position: { x: 20, y: 300 } });
  await expect(dialog).toBeVisible();
});

// T7, T6: the field, the `$`, the value and the placeholder use the measured tokens (AC6, AC7, #64, #90 b).
test('the amount fields use the measured label and field styles', async ({ page }) => {
  await openGallery(page);
  const gray02 = await tokenColor(page, '--color-gray-02');
  const prefilled = figure(page, 'PopupInputSmall', 'Prefilled 500000');
  const input = prefilled.getByRole('textbox', { name: 'Target Amounts' });
  const control = fieldBox(input);
  const sign = prefilled.getByText('$', { exact: true });

  expect(await box(control)).toMatchObject({ width: 360, height: 56 });
  expect(await computed(control, 'border-top-width')).toBe('1px');
  expect(await computed(control, 'border-top-color')).toBe(await tokenColor(page, '--color-special-bg'));
  expect(await computed(control, 'border-radius')).toBe('8px');
  const controlBox = await box(control);
  const signBox = await box(sign);
  const inputBox = await box(input);
  expect(signBox.x).toBe(controlBox.x + 24);
  expect(inputBox.x).toBe(signBox.x + signBox.width);
  for (const text of [sign, input]) {
    expect(await computed(text, 'color')).toBe(gray02);
    expect(await computed(text, 'font-size')).toBe('16px');
    expect(await computed(text, 'line-height')).toBe('24px');
    expect(await computed(text, 'font-weight')).toBe('400');
  }

  const label = prefilled.getByText('Target Amounts');
  expect(await computed(label, 'color')).toBe(await tokenColor(page, '--color-secondary'));
  expect(await computed(label, 'font-size')).toBe('16px');
  expect(await computed(label, 'line-height')).toBe('24px');
  const labelBox = await box(label);
  expect(controlBox.y - (labelBox.y + labelBox.height)).toBe(8);

  // No placeholder: the `$` alone. With the placeholder: the placeholder alone, where the `$` would start.
  const target = figure(page, 'PopupInputSmall', 'Empty, no placeholder (Target)');
  await expect(target.getByText('$', { exact: true })).toBeVisible();

  const present = figure(page, 'PopupInputSmall', 'Empty, with the placeholder (Present)');
  const presentInput = present.getByRole('textbox', { name: 'Present Amounts' });
  await expect(present.getByText('$', { exact: true })).toBeHidden();
  expect((await box(presentInput)).x).toBe((await box(fieldBox(presentInput))).x + 24);
  expect(await presentInput.evaluate((element) => getComputedStyle(element, '::placeholder').color)).toBe(gray02);

  await presentInput.pressSequentially('5');
  await expect(present.getByText('$', { exact: true })).toBeVisible();
  await expect(presentInput).toHaveValue('5');
});

// T8 in a browser: rejected keys and pastes keep the value and the caret; allowed ones stand (AC8).
test('the amount field rejects keys and pastes that are not allowed', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openGallery(page);
  const example = figure(page, 'PopupInputSmall', 'Interactive: the cents read from the text');
  const input = example.getByRole('textbox', { name: 'Target Amounts' });

  await input.pressSequentially('12a,$ -5.255.');
  await expect(input).toHaveValue('125.25');
  await expect(example.getByText('Cents: 12525')).toBeVisible();

  await input.evaluate((element: HTMLInputElement) => element.setSelectionRange(1, 1));
  await page.keyboard.type(',');
  expect(await input.evaluate((element: HTMLInputElement) => [element.value, element.selectionStart])).toEqual([
    '125.25',
    1,
  ]);

  for (const text of ['1,000', '12.345', '$5']) {
    await page.evaluate((value) => navigator.clipboard.writeText(value), text);
    await page.keyboard.press('ControlOrMeta+V');
    await expect(input).toHaveValue('125.25');
  }

  await input.fill('');
  await page.evaluate(() => navigator.clipboard.writeText('.5'));
  await page.keyboard.press('ControlOrMeta+V');
  await expect(input).toHaveValue('.5');
  await expect(example.getByText('Cents: 50')).toBeVisible();

  // A spreadsheet cell ends with a line break, which the browser drops on paste.
  await input.fill('');
  await page.evaluate(() => navigator.clipboard.writeText('500\r\n'));
  await page.keyboard.press('ControlOrMeta+V');
  await expect(input).toHaveValue('500');
  await expect(example.getByText('Cents: 50000')).toBeVisible();
});

// T11: the darker border on focus, the red border with an error, also focused (AC10, #63, #87).
test('the amount field border darkens on focus and is red with an error', async ({ page }) => {
  await openGallery(page);
  const input = figure(page, 'PopupInputSmall', 'Prefilled 500000').getByRole('textbox');
  const errored = figure(page, 'PopupInputSmall', 'With an error').getByRole('textbox');
  const red = await tokenColor(page, '--color-special-red');

  await input.focus();
  expect(await computed(fieldBox(input), 'border-top-color')).toBe(await tokenColor(page, '--color-secondary'));
  expect(await computed(input, 'outline-style')).toBe('none');

  expect(await computed(fieldBox(errored), 'border-top-color')).toBe(red);
  await errored.focus();
  expect(await computed(fieldBox(errored), 'border-top-color')).toBe(red);
  await expect(figure(page, 'PopupInputSmall', 'With an error').getByText('Enter a target amount')).toBeVisible();
});

// T13: each closed look as measured in 110 and 111, and the Input look for Account Type (AC12, #26, #60).
test('the Dropdown triggers match 110, 111 and the closed Input', async ({ page }) => {
  await openGallery(page);
  const gray01 = await tokenColor(page, '--color-gray-01');
  const secondary = await tokenColor(page, '--color-secondary');

  for (const name of ['box, like 110 Savings Goal', 'plain, like 110 Saving Summary']) {
    const trigger = figure(page, 'Dropdown', name).getByRole('combobox');
    const text = trigger.getByText('Mar, 2026');
    const chevron = trigger.locator('svg');
    const triggerBox = await box(trigger);
    const textBox = await box(text);
    const chevronBox = await box(chevron);
    expect(await computed(trigger, 'color')).toBe(gray01);
    expect(await computed(trigger, 'font-size')).toBe('12px');
    expect(await computed(trigger, 'line-height')).toBe('16px');
    expect(await computed(trigger, 'font-weight')).toBe('400');
    expect(chevronBox).toMatchObject({ width: 16, height: 16 });
    expect(await computed(chevron, 'color')).toBe(secondary);
    expect(chevronBox.x - (textBox.x + textBox.width)).toBe(8);
    if (name.startsWith('box')) {
      expect(triggerBox.height).toBe(32);
      expect(textBox.x - triggerBox.x).toBe(16);
      expect(triggerBox.x + triggerBox.width - (chevronBox.x + chevronBox.width)).toBe(16);
      expect(await computed(trigger, 'background-color')).toBe(await tokenColor(page, '--color-gray-06'));
      expect(await computed(trigger, 'border-top-width')).toBe('1px');
      expect(await computed(trigger, 'border-top-color')).toBe(await tokenColor(page, '--color-gray-05'));
      expect(await computed(trigger, 'border-radius')).toBe('4px');
    } else {
      expect(textBox.x).toBe(triggerBox.x);
      expect(await computed(trigger, 'background-color')).toBe('rgba(0, 0, 0, 0)');
      expect(await computed(trigger, 'border-top-width')).toBe('0px');
    }
  }

  const inline = figure(page, 'Dropdown', 'inline, like 111 country code').getByRole('combobox');
  expect(await inline.locator('svg').count()).toBe(0);
  expect(await computed(inline, 'color')).toBe(await tokenColor(page, '--color-gray-02'));
  expect(await computed(inline, 'font-size')).toBe('16px');
  expect(await computed(inline, 'line-height')).toBe('24px');
  expect(await computed(inline, 'border-top-width')).toBe('0px');

  const input = figure(page, 'Dropdown', 'input, Account Type (#26, not designed)').getByRole('combobox');
  expect(await box(input)).toMatchObject({ height: 48 });
  expect(await computed(input, 'border-top-color')).toBe(await tokenColor(page, '--color-input-border'));
  expect(await computed(input, 'border-radius')).toBe('8px');
  expect(await computed(input, 'color')).toBe(await tokenColor(page, '--color-auth-muted'));
  expect(await computed(input, 'font-size')).toBe('16px');
  expect(await box(input.locator('svg'))).toMatchObject({ width: 24, height: 24 });
  const inputBox = await box(input);
  const chevronBox = await box(input.locator('svg'));
  expect(inputBox.x + inputBox.width - (chevronBox.x + chevronBox.width)).toBe(16);
});

// T15, T16: every variant opens one list look below its trigger (AC13, AC16, #90 a).
test('every Dropdown opens the same list below its trigger', async ({ page }) => {
  await openGallery(page);
  // The Dropdown examples end the gallery: room after them, so each trigger can be scrolled to the middle.
  await page.evaluate(() => {
    document.body.style.paddingBottom = '1024px';
  });
  const variants = [
    ['box, like 110 Savings Goal', 'Mar, 2026'],
    ['plain, like 110 Saving Summary', 'Mar, 2026'],
    ['inline, like 111 country code', '+880'],
    ['input, Account Type (#26, not designed)', 'Checking'],
  ] as const;
  const looks: string[][] = [];

  for (const [name, selected] of variants) {
    const trigger = figure(page, 'Dropdown', name).getByRole('combobox');
    await trigger.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    // Measured before opening: the open list hides the rest of the page from assistive technology.
    const triggerBox = await box(trigger);
    await trigger.click();
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();
    const list = listbox.locator('xpath=ancestor-or-self::*[@data-side][1]');
    const listBox = await box(list);
    expect(listBox.x).toBe(triggerBox.x);
    expect(listBox.width).toBeGreaterThanOrEqual(triggerBox.width);
    // Below, with room: the trigger is centered. The next test opens a list where there is no room.
    expect(await list.getAttribute('data-side')).toBe('bottom');
    expect(listBox.y).toBeGreaterThanOrEqual(triggerBox.y + triggerBox.height);

    const chosen = page.getByRole('option', { name: selected });
    await expect(chosen).toHaveAttribute('aria-selected', 'true');
    await expect(chosen).toBeInViewport();
    const other = page.getByRole('option', { selected: false }).first();
    await other.hover();
    await expect(other).toHaveAttribute('data-highlighted', '');
    looks.push([
      await computed(list, 'border-radius'),
      await computed(list, 'box-shadow'),
      await computed(list, 'border-top-width'),
      await computed(list, 'border-top-color'),
      await computed(list, 'background-color'),
      await computed(other, 'background-color'),
      await computed(other, 'color'),
      await computed(chosen, 'color'),
      await computed(chosen, 'font-weight'),
      await computed(chosen, 'font-size'),
    ]);
    await page.keyboard.press('Escape');
    await expect(listbox).toBeHidden();
  }

  expect(looks[0]).toEqual([
    '16px',
    await tokenComputed(page, 'box-shadow', '--shadow-card'),
    '1px',
    await tokenColor(page, '--color-gray-05'),
    await tokenColor(page, '--color-white'),
    await tokenColor(page, '--color-gray-06'),
    await tokenColor(page, '--color-default-black'),
    await tokenColor(page, '--color-primary'),
    '600',
    '14px',
  ]);
  for (const look of looks) expect(look).toEqual(looks[0]);
});

// T15: a 60-month list near the bottom of the window fits inside it and scrolls; the page stays put (AC15).
test('a long list fits in the window and scrolls inside', async ({ page }) => {
  await openGallery(page);
  // The DataState error example shows its skeleton for 800 ms, then the shorter error state. The 60-month
  // example ends the gallery, so the page is scrolled to its end here: wait for that height change first.
  await expect(figure(page, 'DataState', 'Error').getByRole('alert')).toBeVisible();
  const trigger = figure(page, 'Dropdown', '60 months').getByRole('combobox');
  await trigger.evaluate((element) => window.scrollBy(0, element.getBoundingClientRect().top - 900));
  const before = await scrollY(page);
  const triggerBox = await box(trigger);

  await trigger.click();
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  const list = listbox.locator('xpath=ancestor-or-self::*[@data-side][1]');
  const listBox = await box(list);

  expect(await list.getAttribute('data-side')).toBe('top');
  expect(listBox.y + listBox.height).toBeLessThanOrEqual(triggerBox.y);
  expect(listBox.y).toBeGreaterThanOrEqual(0);
  expect(listBox.y + listBox.height).toBeLessThanOrEqual(1024);
  expect(await page.getByRole('option').count()).toBe(60);
  const scroller = listbox.locator('[data-radix-select-viewport]');
  expect(await scroller.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await expect(page.getByRole('option', { name: 'Oct, 2026' })).toBeInViewport();

  await page.mouse.move(listBox.x + 20, listBox.y + 40);
  await page.mouse.wheel(0, 4000);
  await expect(page.getByRole('option', { name: 'Nov, 2021' })).toBeInViewport();
  expect(await scrollY(page)).toBe(before);

  await page.mouse.click(5, 5);
  await expect(listbox).toBeHidden();
  expect(await scrollY(page)).toBe(before);

  // A selection deep in the list: reopened, the list scrolls it into view and marks it (AC13).
  await trigger.click();
  await expect(listbox).toBeVisible();
  await page.mouse.move(listBox.x + 20, listBox.y + 40);
  await page.mouse.wheel(0, 4000);
  await page.getByRole('option', { name: 'Nov, 2021' }).click();
  await expect(listbox).toBeHidden();
  await expect(trigger).toHaveText('Nov, 2021');
  await page.mouse.move(5, 5);
  await trigger.click();
  const deep = page.getByRole('option', { name: 'Nov, 2021' });
  await expect(deep).toHaveAttribute('aria-selected', 'true');
  await expect(deep).toBeInViewport();
  await expect(page.getByRole('option', { name: 'Oct, 2026' })).not.toBeInViewport();
  expect(await scrollY(page)).toBe(before);
});

const ring = async (locator: Locator) => [
  await computed(locator, 'outline-style'),
  await computed(locator, 'outline-width'),
  await computed(locator, 'outline-offset'),
  await computed(locator, 'outline-color'),
];

// T17: the teal ring on keyboard focus only; the field and the input trigger darken their border (AC17, #87).
test('keyboard focus shows the teal ring on X, Save and the triggers, a mouse press does not', async ({ page }) => {
  await openDemo(page);
  const teal = await tokenColor(page, '--color-primary');
  const shown = ['solid', '2px', '2px', teal];
  const dialog = await openPopup(page, 'two');
  const save = dialog.getByRole('button', { name: 'Save' });
  const close = dialog.getByRole('button', { name: 'Close' });

  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(save).toBeFocused();
  expect(await ring(save)).toEqual(shown);
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  expect(await ring(close)).toEqual(shown);

  for (const control of [save, close]) {
    const { x, y, width, height } = await box(control);
    await page.mouse.move(x + width / 2, y + height / 2);
    await page.mouse.down();
    await expect(control).toBeFocused();
    expect(await computed(control, 'outline-style')).toBe('none');
    await page.mouse.move(700, 300);
    await page.mouse.up();
  }

  await openGallery(page);
  for (const name of [
    'box, like 110 Savings Goal',
    'plain, like 110 Saving Summary',
    'inline, like 111 country code',
  ]) {
    const trigger = figure(page, 'Dropdown', name).getByRole('combobox');
    await trigger.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(trigger).toBeFocused();
    expect(await ring(trigger)).toEqual(shown);

    await trigger.click();
    await page.getByRole('option', { selected: false }).first().click();
    await expect(trigger).toBeFocused();
    expect(await computed(trigger, 'outline-style')).toBe('none');

    // Keyboard focus, then the mouse opens the list and a click outside closes it: no ring either.
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(trigger).toBeFocused();
    expect(await ring(trigger)).toEqual(shown);
    await trigger.click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.mouse.click(1380, 500);
    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(await computed(trigger, 'outline-style')).toBe('none');
  }

  const input = figure(page, 'Dropdown', 'input, Account Type (#26, not designed)').getByRole('combobox');
  await input.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(input).toBeFocused();
  expect(await computed(input, 'outline-style')).toBe('none');
  expect(await computed(input, 'border-top-color')).toBe(await tokenColor(page, '--color-input-active'));

  // While the list is open, focus is in it and the trigger is hidden from roles; the field still looks active.
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toBeVisible();
  const openInput = page.locator('button[role="combobox"][aria-label="Account Type"]');
  expect(await computed(openInput, 'border-top-color')).toBe(await tokenColor(page, '--color-input-active'));
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toBeHidden();
});

// T19: the gallery sections and the popup page, with no console errors or warnings (AC19).
test('the gallery shows the new sections and /dev/popup opens and closes both popups cleanly', async ({ page }) => {
  const errors = collectErrors(page);
  const warnings: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text());
  });

  await openGallery(page);
  for (const name of ['Popup', 'GoalPopupInput', 'PopupInputSmall', 'Dropdown']) {
    await expect(page.getByRole('region', { name, exact: true })).toBeVisible();
  }
  await page.getByRole('region', { name: 'Popup', exact: true }).getByRole('link', { name: 'Open /dev/popup' }).click();
  await expect(page).toHaveURL(/\/dev\/popup$/);

  for (const fields of ['two', 'one'] as const) {
    const dialog = await openPopup(page, fields);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();
  }
  await expect(page.getByRole('status')).toHaveText('Target: 50000000 cents.');

  await page.getByRole('checkbox', { name: 'Save fails' }).click();
  const dialog = await openPopup(page, 'two');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('The amounts could not be saved. Try again.');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();

  expect(errors).toEqual([]);
  expect(warnings).toEqual([]);
});
