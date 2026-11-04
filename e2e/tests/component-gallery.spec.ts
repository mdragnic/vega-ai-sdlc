import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures';
import { collectErrors, computed, tokenColor } from '../helpers';

const sections = [
  'Input',
  'ButtonPrimary',
  'ButtonSecondary',
  'RemindMe',
  'FieldError',
  'FormError',
  'Spinner',
  'TextDivider',
  'AuthLayout',
  'NavMenu',
  'Logout',
  'Avatar',
  'Profile',
  'NavBar',
  'HeaderSearch',
  'Header',
  'AppLayout',
  'Section',
  'Card',
  'MenuTab',
  'CategoryIcon',
  'DateBox',
  'AmountBox',
  'ButtonSmall',
  'Skeleton',
  'DataState',
  'ChartLegend',
  'ComparisonBarChart',
  'ComparisonBarChartSkeleton',
  'TargetVsAchievementMeter',
];

async function openGallery(page: Page) {
  await page.goto('/dev/components');
  await expect(page.getByRole('heading', { level: 1, name: 'Component gallery' })).toBeVisible();
}

// T13: the dev server serves the gallery with every section and no console errors (AC12).
test('the gallery shows every component section without console errors', async ({ page }) => {
  const errors = collectErrors(page);
  const warnings: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text());
  });

  await openGallery(page);

  for (const name of sections) {
    await expect(page.getByRole('region', { name, exact: true })).toBeVisible();
  }
  await expect(
    page.getByRole('figure', { name: 'Show Password' }).getByLabel('Password', { exact: true }),
  ).toHaveAttribute('type', 'text');
  expect(errors).toEqual([]);
  expect(warnings).toEqual([]);
});

// Task 026 code review: the Saving Summary's header row where it does not fit: the legend under the title row,
// right-aligned on the content's edge, nothing overlapping (#106, #108 b).
test('the Saving Summary legend moves under its title row in a narrow card, right-aligned', async ({ page }) => {
  await openGallery(page);
  const figure = page.getByRole('figure', { name: 'Narrow: the legend under the title row (#108 b)' });
  await expect(figure.getByText('No savings this month or last month')).toBeVisible();
  const title = (await figure.getByRole('heading', { level: 3 }).boundingBox())!;
  const selector = (await figure.getByRole('combobox', { name: 'Saving Summary' }).boundingBox())!;
  const legend = (await figure.getByRole('list').boundingBox())!;
  // The header row: the title's group's parent.
  const row = (await figure.getByRole('heading', { level: 3 }).locator('xpath=../..').boundingBox())!;

  expect(selector.x).toBeGreaterThan(title.x + title.width);
  expect(selector.y + selector.height).toBeLessThanOrEqual(legend.y);
  expect(title.y + title.height).toBeLessThanOrEqual(legend.y);
  // Right-aligned on the header row's end, the card's content edge.
  expect(Math.abs(legend.x + legend.width - (row.x + row.width))).toBeLessThanOrEqual(1);
});

// T2: the Active border and text color only while the field has focus; empty or filled without focus is normal (AC1, #63).
test('an input shows the Active style only while it has focus', async ({ page }) => {
  await openGallery(page);
  const active = await tokenColor(page, '--color-input-active');
  const normal = await tokenColor(page, '--color-input-border');
  const muted = await tokenColor(page, '--color-auth-muted');
  const empty = page.getByRole('figure', { name: 'Name-Email, empty' }).getByLabel('Email Address');
  const field = page.getByRole('figure', { name: 'Name-Email, filled' }).getByLabel('Email Address');
  // The border is drawn by the box around the input (and the eye on a password field).
  const border = (input: typeof field) => computed(input.locator('..'), 'border-top-color');

  expect(await border(empty)).toBe(normal);
  expect(await border(field)).toBe(normal);

  await field.focus();
  expect(await border(field)).toBe(active);
  expect(await computed(field, 'color')).toBe(active);

  await page.keyboard.type('.rs');
  await field.blur();
  await expect(field).toHaveValue('johndoe@email.com.rs');
  expect(await border(field)).toBe(normal);
  expect(await computed(field, 'color')).toBe(muted);
});

// The typed text and the eye sit 16px inside the field's outer edge, as in 101 (task 002 review).
test('input text and the eye sit 16px inside the field edge', async ({ page }) => {
  await openGallery(page);
  const figure = page.getByRole('figure', { name: 'Password, masked, with label action' });
  const input = figure.getByLabel('Password', { exact: true });
  const box = (await input.locator('..').boundingBox())!;
  const text = (await input.boundingBox())!;
  const eye = (await figure.getByRole('button', { name: 'Show password' }).boundingBox())!;

  expect(text.x - box.x).toBe(16);
  expect(box.x + box.width - (eye.x + eye.width)).toBe(16);
});

// #87 (a): keyboard focus shows a teal outline on buttons, the eye and the checkbox; a mouse click does not.
test('keyboard focus shows a teal outline on buttons, the eye and the checkbox', async ({ page }) => {
  await openGallery(page);
  const teal = await tokenColor(page, '--color-primary');
  const region = (name: string) => page.getByRole('region', { name, exact: true });
  const targets = [
    region('ButtonPrimary').getByRole('button', { name: 'Login' }).first(),
    region('ButtonSecondary').getByRole('button').first(),
    region('Input').getByRole('button', { name: 'Show password' }),
    region('RemindMe').getByRole('checkbox').first(),
  ];

  for (const target of targets) {
    // Focus by keyboard: from the target back one step and forward again.
    await target.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(target).toBeFocused();
    expect(await computed(target, 'outline-style')).toBe('solid');
    expect(await computed(target, 'outline-color')).toBe(teal);
    expect(await computed(target, 'outline-width')).not.toBe('0px');
  }

  const clicked = region('ButtonSecondary').getByRole('button').first();
  await clicked.click();
  expect(await computed(clicked, 'outline-style')).toBe('none');
});

// #87 (b): a field with an error has the red border while the error shows, also with focus.
test('a field with an error has the red border, also while it has focus', async ({ page }) => {
  await openGallery(page);
  const red = await tokenColor(page, '--color-special-red');
  const figure = page.getByRole('figure', { name: 'Field error' });
  const field = figure.getByLabel('Email Address');
  const border = () => computed(field.locator('..'), 'border-top-color');

  await expect(figure.getByText('Email is required')).toBeVisible();
  expect(await border()).toBe(red);

  await field.focus();
  expect(await border()).toBe(red);
});

// T11: the auth frame at 1440x1024 (AC10, #66, #70).
test('AuthLayout centers the 400px column and the teal logo on the page background', async ({ page }) => {
  await openGallery(page);
  const frame = page.getByRole('figure', { name: 'Page frame' });
  const column = frame.getByRole('main');
  const logo = column.getByRole('img', { name: 'FINEbank.IO' });
  const pageFrame = column.locator('..');

  const columnBox = await column.boundingBox();
  expect(columnBox).toMatchObject({ x: 520, width: 400 });

  // Measured on 101, 102 and 103: x 584.5 to 856.5, 272 wide; the SVG viewBox (163x18) gives the height.
  const logoBox = (await logo.boundingBox())!;
  expect(logoBox.width).toBe(272);
  expect(logoBox.x + logoBox.width / 2).toBe(720);
  expect(logoBox.height).toBeCloseTo(30, 0);
  expect(await computed(logo, 'color')).toBe(await tokenColor(page, '--color-primary'));

  expect(await computed(pageFrame, 'background-color')).toBe(await tokenColor(page, '--color-gray-06'));
  expect((await pageFrame.boundingBox())!.height).toBeGreaterThanOrEqual(1024);
});
