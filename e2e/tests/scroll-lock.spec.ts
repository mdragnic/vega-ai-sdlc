import type { Locator, Page } from '@playwright/test';

import { TIME_ZONE } from '../constants';
import { expect, test } from '../fixtures';
import { signUp } from '../helpers';

/*
 * Task 032 item 1 (#100, #101, #134 b, #135). Radix's scroll lock (`react-remove-scroll-bar`, inside Dialog and Select)
 * gives `body[data-scroll-locked]` a right margin of `innerWidth - documentElement.clientWidth`, measured as a popup or
 * dropdown opens, to make up for the scrollbar it hides. App pages keep that space already (`scrollbar-gutter:
 * stable`), so the margin took it twice and the page narrowed by 15 px. Playwright's headless Chromium hides
 * scrollbars (`--hide-scrollbars`), where the gap is 0 and nothing moved, so no other spec saw it. This file runs
 * without that flag: Chromium then draws a classic 15 px scrollbar, as a desktop browser on Windows does.
 */
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

const WIDTH = 1440;
/** The gutter's place: the `html` box ends where the 15 px scrollbar gutter starts (#101). */
const GUTTER_LEFT = 1425;
const SCROLLBAR = 15;

const main = (page: Page) => page.getByRole('main');
const region = (page: Page, name: string) => main(page).getByRole('region', { name, exact: true });
const CATEGORIES = ['Housing', 'Food', 'Transportation', 'Entertainment', 'Shopping', 'Others'];

type Reading = {
  /** Every box on the page outside the popup or dropdown, by group, position in the group and tag. */
  boxes: Record<string, string>;
  scrollX: number;
  scrollY: number;
  htmlRight: number;
  /** The width a drawn vertical scrollbar takes; 0 when none is drawn. */
  scrollbar: number;
  scrollHeight: number;
};

/**
 * The page's boxes, read through CSS selectors: while a dropdown is open, Radix hides the rest of the page from role
 * locators. The popup or dropdown itself is portalled to `body`, outside every group read here.
 */
function read(page: Page): Promise<Reading> {
  return page.evaluate(() => {
    const content = document.querySelector('main')!;
    const column = content.parentElement!;
    const layout = column.parentElement!;
    const sidebar = layout.firstElementChild!;
    const header = column.querySelector(':scope > header')!;
    const groups: Record<string, Element[]> = {
      html: [document.documentElement],
      body: [document.body],
      layout: [layout, column],
      sidebar: [sidebar, ...sidebar.querySelectorAll(':scope > *, :scope > * > *')],
      header: [header, ...header.querySelectorAll('*')],
      main: [content, ...content.querySelectorAll(':scope > *, section, section > *, li')],
    };
    const boxes: Record<string, string> = {};
    for (const [group, elements] of Object.entries(groups)) {
      elements.forEach((element, index) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        boxes[`${group} ${index} ${element.tagName.toLowerCase()}`] = `x ${x} y ${y} w ${width} h ${height}`;
      });
    }
    const root = document.documentElement;
    return {
      boxes,
      scrollX,
      scrollY,
      htmlRight: root.getBoundingClientRect().right,
      scrollbar: innerWidth - root.clientWidth,
      scrollHeight: root.scrollHeight,
    };
  });
}

/** What must not change while a popup or dropdown is open: every box, the scroll position and the gutter's place. */
const layoutOf = ({ boxes, scrollX, scrollY, htmlRight }: Reading) => ({ boxes, scrollX, scrollY, htmlRight });

/** Reads the page once two readings a frame apart agree, so nothing still loading is mistaken for a movement. */
async function settledReading(page: Page): Promise<Reading> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  let previous = await read(page);
  await expect
    .poll(async () => {
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
      const next = await read(page);
      const same = JSON.stringify(next) === JSON.stringify(previous);
      previous = next;
      return same;
    })
    .toBe(true);
  return previous;
}

/** Waits until the page shows its content: the header's date and no busy widget. */
async function waitForContent(page: Page) {
  await expect(page.getByRole('banner').locator('time')).toBeVisible();
  await expect(main(page).locator('[aria-busy="true"]')).toHaveCount(0);
}

type Control = {
  name: string;
  /** The control that opens it. */
  opener: (page: Page) => Locator;
  /** What shows while it is open. */
  opened: (page: Page) => Locator;
};

const popup = (name: string, opener: (page: Page) => Locator): Control => ({
  name,
  opener,
  opened: (page) => page.getByRole('dialog'),
});
const dropdown = (name: string, opener: (page: Page) => Locator): Control => ({
  name,
  opener,
  opened: (page) => page.getByRole('listbox'),
});

type AppPage = {
  name: string;
  /** Opens the page for a new demo user and waits for its content. */
  open: (page: Page) => Promise<void>;
  /** Whether the page is taller than a 1024 high window, so a scrollbar is drawn there (#135). */
  scrollsAt1024: boolean;
  controls: Control[];
};

async function openAccountDetailsEditMode(page: Page) {
  await signUp(page.request);
  const response = await page.request.get('/api/accounts', { headers: { 'X-Time-Zone': TIME_ZONE } });
  expect(response.ok()).toBe(true);
  const { accounts } = (await response.json()) as { accounts: { id: number }[] };
  await page.goto(`/balances/${accounts[1]!.id}`);
  await waitForContent(page);
  await region(page, 'Account Details').getByRole('button', { name: 'Edit Details' }).click();
  await expect(region(page, 'Account Details').locator('button[role="combobox"]')).toBeVisible();
}

const openPath = (path: string) => async (page: Page) => {
  await signUp(page.request);
  await page.goto(path);
  await waitForContent(page);
};

/** Every popup and dropdown on an app page (task 032, fact 3): P1 to P3 and D1 to D6. */
const PAGES: AppPage[] = [
  {
    name: 'Overview',
    open: openPath('/overview'),
    scrollsAt1024: true,
    controls: [
      popup('P1 Edit savings goal', (page) =>
        region(page, 'Goals').getByRole('button', { name: 'Edit savings goal', exact: true }),
      ),
      dropdown('D1 Statistics', (page) => region(page, 'Statistics').getByRole('combobox', { name: 'Statistics' })),
    ],
  },
  {
    name: 'Goals',
    open: openPath('/goals'),
    scrollsAt1024: false,
    controls: [
      popup('P2 Adjust Goal', (page) =>
        region(page, 'Goals').getByRole('button', { name: 'Adjust Goal', exact: true }),
      ),
      ...CATEGORIES.map((category) =>
        popup(`P3 Adjust ${category}`, (page) =>
          region(page, 'Expenses Goals by Category')
            .getByRole('listitem')
            .filter({ has: page.getByRole('heading', { level: 3, name: category, exact: true }) })
            .getByRole('button', { name: 'Adjust', exact: true }),
        ),
      ),
      dropdown('D3 Savings Goal month', (page) =>
        region(page, 'Goals').getByRole('combobox', { name: 'Savings Goal' }),
      ),
      dropdown('D4 Saving Summary month', (page) =>
        region(page, 'Goals').getByRole('combobox', { name: 'Saving Summary', exact: true }),
      ),
    ],
  },
  {
    name: 'Expenses',
    open: openPath('/expenses'),
    scrollsAt1024: false,
    controls: [
      dropdown('D2 Expenses Comparison', (page) =>
        region(page, 'Expenses Comparison').getByRole('combobox', { name: 'Expenses Comparison' }),
      ),
    ],
  },
  {
    name: 'Account Details in edit mode',
    open: openAccountDetailsEditMode,
    scrollsAt1024: true,
    controls: [
      dropdown('D5 Account Type', (page) => region(page, 'Account Details').locator('button[role="combobox"]')),
    ],
  },
  {
    name: 'Settings, Account tab',
    open: openPath('/settings/account'),
    scrollsAt1024: false,
    controls: [dropdown('D6 Country code', (page) => main(page).locator('button[role="combobox"]'))],
  },
];

/** Opens a popup or dropdown by a click on its control and waits for the scroll lock. */
async function openControl(page: Page, control: Control) {
  await control.opener(page).click();
  await expect(control.opened(page)).toBeVisible();
  await expect(page.locator('body[data-scroll-locked]')).toHaveCount(1);
}

/** Closes it with Escape and waits for the scroll lock to end. */
async function closeControl(page: Page, control: Control) {
  await page.keyboard.press('Escape');
  await expect(control.opened(page)).toHaveCount(0);
  await expect(page.locator('body[data-scroll-locked]')).toHaveCount(0);
}

for (const height of [1024, 720]) {
  for (const appPage of PAGES) {
    const scrolls = height === 720 || appPage.scrollsAt1024;
    const codes = [...new Set(appPage.controls.map((control) => control.name.split(' ')[0]))].join(', ');
    test(`${appPage.name} at ${WIDTH}x${height}: ${codes} move nothing as each opens and closes`, async ({ page }) => {
      await page.setViewportSize({ width: WIDTH, height });
      await appPage.open(page);

      for (const control of appPage.controls) {
        const where = `${appPage.name} at ${WIDTH}x${height}, ${control.name}`;
        // In view first, so the click does not scroll the page between the readings.
        await control.opener(page).scrollIntoViewIfNeeded();
        const closed = await settledReading(page);
        // The precondition: a classic scrollbar takes 15 px wherever the page scrolls, so this cannot pass on a hidden
        // one; on a page that fits in the window none is drawn, and the stable gutter still keeps its place (#135 a).
        expect(closed.htmlRight, `${where}: the gutter's place`).toBe(GUTTER_LEFT);
        if (scrolls) {
          expect(closed.scrollbar, `${where}: the scrollbar's width before it opens`).toBe(SCROLLBAR);
        } else {
          expect(closed.scrollHeight, `${where}: the page fits in the window`).toBeLessThanOrEqual(height);
        }

        await openControl(page, control);
        const open = await read(page);
        expect.soft(layoutOf(open), `${where}: open`).toEqual(layoutOf(closed));

        await closeControl(page, control);
        const closedAgain = await settledReading(page);
        expect.soft(layoutOf(closedAgain), `${where}: closed again`).toEqual(layoutOf(closed));
        expect(closedAgain.scrollbar, `${where}: the scrollbar's width after it closes`).toBe(closed.scrollbar);
      }
    });
  }
}

/** Waits until the page has handled one wheel event and then drawn a few frames, time enough for a scroll to start. */
async function wheelOver(page: Page, x: number, y: number, deltaY: number) {
  const handled = page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        window.addEventListener(
          'wheel',
          () => {
            let frames = 10;
            const tick = () => (--frames === 0 ? resolve() : requestAnimationFrame(tick));
            requestAnimationFrame(tick);
          },
          { capture: true, once: true },
        );
      }),
  );
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, deltaY);
  await handled;
}

const scrollYOf = (page: Page) => page.evaluate(() => scrollY);

test('Goals at 1440x720, scrolled part way: with P2 or D3 open the wheel does not scroll and no thumb is drawn; closed, it scrolls again', async ({
  page,
}) => {
  await page.setViewportSize({ width: WIDTH, height: 720 });
  await openPath('/goals')(page);
  const goals = PAGES.find((appPage) => appPage.name === 'Goals')!;
  const controls = goals.controls.filter((control) => /^(P2|D3) /.test(control.name));
  expect(controls).toHaveLength(2);

  for (const control of controls) {
    await page.evaluate(() => window.scrollTo(0, 30));
    const closed = await settledReading(page);
    expect(closed.scrollY, `${control.name}: scrolled part way`).toBe(30);
    expect(closed.scrollbar, `${control.name}: the scrollbar's width before it opens`).toBe(SCROLLBAR);

    await openControl(page, control);
    // #134 b1: the thumb is hidden while it is open (no scrollbar takes width), and the gutter keeps its place.
    const open = await read(page);
    expect(open.scrollbar, `${control.name}: no scrollbar drawn while open`).toBe(0);
    expect(open.htmlRight, `${control.name}: the gutter's place while open`).toBe(GUTTER_LEFT);
    // #35: the page behind it does not scroll. The point is on the page, right of the popup and away from the list.
    await wheelOver(page, 1300, 650, 200);
    expect(await scrollYOf(page), `${control.name}: the wheel while open`).toBe(30);

    await closeControl(page, control);
    expect((await read(page)).scrollbar, `${control.name}: the thumb is back after it closes`).toBe(SCROLLBAR);
    await page.mouse.move(1300, 650);
    await page.mouse.wheel(0, 200);
    await expect.poll(() => scrollYOf(page), `${control.name}: the wheel after it closes`).toBeGreaterThan(30);
  }
});
