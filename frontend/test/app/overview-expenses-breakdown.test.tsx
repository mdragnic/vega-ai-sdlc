import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { focusManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import itemStyles from '../../src/components/ExpensesItem/ExpensesItem.module.css';
import { dataStateRootIn, expensesBreakdown, me, renderApp, signedInDefaults, today } from '../support/app';

const server = setupServer(...signedInDefaults());

/** Every request the app sends, as `METHOD /path`. */
let requests: string[] = [];

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  requests = [];
  server.events.on('request:start', ({ request }) => {
    requests.push(`${request.method} ${new URL(request.url).pathname}`);
  });
});
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
  vi.useRealTimers();
  focusManager.setFocused(undefined);
});
afterAll(() => server.close());

/** Overview signed in, with `handlers` first (the demo expenses breakdown by default), once the section shows. */
async function openOverview(...handlers: Parameters<typeof server.use>) {
  server.use(me.signedIn(), today.answers(), ...handlers);
  const view = renderApp('/overview');
  await screen.findByRole('region', { name: 'Expenses Breakdown' });
  return view;
}

const SOFT_HYPHEN = '­';
const breakdown = () => screen.getByRole('region', { name: 'Expenses Breakdown' });
/** Waits until the card shows its list of categories. */
const list = () => within(breakdown()).findByRole('list');
const items = async () => within(await list()).getAllByRole('listitem');
const arrowLink = (category: string) => within(breakdown()).getByRole('link', { name: `${category} expenses` });

/**
 * What assistive technology reads in an element, in order: its text, skipping what is hidden from it, and an
 * element's `aria-label` in place of its content.
 */
function readOut(element: Element): string[] {
  if (element.getAttribute('aria-hidden') === 'true') return [];
  const label = element.getAttribute('aria-label');
  if (label !== null) return [label];
  return [...element.childNodes].flatMap((node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent!.trim() === '' ? [] : [node.textContent!.trim()];
    return node instanceof Element ? readOut(node) : [];
  });
}

/** What shows on screen in an item: its text, the visually hidden spans left out, and the small arrow's direction. */
function shown(item: HTMLElement) {
  const visible = [...item.querySelectorAll('p')].map((line) => line.textContent);
  const arrow = item.querySelector(`.${itemStyles.up}`)
    ? 'up'
    : item.querySelector(`.${itemStyles.down}`)
      ? 'down'
      : null;
  return { lines: visible, arrow };
}

const weeklyComparison = () => screen.getByRole('combobox', { name: 'Statistics' });
const breakdownPath = 'GET /api/expenses/breakdown';
const count = (request: string) => requests.filter((sent) => sent === request).length;

const refocusWindow = () =>
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });

/** A first login's six items on 22 Oct 2026 as a screen reader reads them (demo-data.md; AC1, AC11). */
const firstLoginReadOut = [
  ['Housing', '$252.00', 'down 17% compared to last month', 'Housing expenses'],
  ['Food', '$510.04', 'up 7% compared to last month', 'Food expenses'],
  ['Transportation', '$53.20', 'down 32% compared to last month', 'Transportation expenses'],
  ['Entertainment', '$282.24', 'up 16% compared to last month', 'Entertainment expenses'],
  ['Shopping', '$658.00', 'up 14% compared to last month', 'Shopping expenses'],
  ['Others', '$138.32', 'down 31% compared to last month', 'Others expenses'],
];

/** The same items as they show: the hyphenated name, the total, the percentage line, and the small arrow. */
const firstLoginShown = [
  { lines: [`Hous${SOFT_HYPHEN}ing`, '$252.00', '17%*'], arrow: 'down' },
  { lines: ['Food', '$510.04', '7%*'], arrow: 'up' },
  { lines: [`Trans${SOFT_HYPHEN}por${SOFT_HYPHEN}ta${SOFT_HYPHEN}tion`, '$53.20', '32%*'], arrow: 'down' },
  { lines: [`En${SOFT_HYPHEN}ter${SOFT_HYPHEN}tain${SOFT_HYPHEN}ment`, '$282.24', '16%*'], arrow: 'up' },
  { lines: [`Shop${SOFT_HYPHEN}ping`, '$658.00', '14%*'], arrow: 'up' },
  { lines: [`Oth${SOFT_HYPHEN}ers`, '$138.32', '31%*'], arrow: 'down' },
];

// T9: AC1, AC11, the first login's card (#21, #56, #61, #87, #115 b; demo-data.md).
describe('the Expenses Breakdown card', () => {
  it('lists the six categories in the order sent, each read as its name, total, change and right arrow', async () => {
    await openOverview();

    expect((await items()).map(readOut)).toEqual(firstLoginReadOut);
  });

  it('shows each name with its soft hyphens, the total, the percentage with its asterisk and the small arrow', async () => {
    await openOverview();

    expect((await items()).map(shown)).toEqual(firstLoginShown);
  });

  it('hides the icon, the hyphenated name, the percentage, its asterisk and the small arrows from assistive technology', async () => {
    await openOverview();

    for (const item of await items()) {
      const hidden = [...item.querySelectorAll('[aria-hidden="true"]')];
      const icon = item.querySelector('span > svg')!.parentElement!;
      const [name, , change] = [...item.querySelectorAll('p')];
      expect(hidden).toContain(icon);
      expect(hidden.some((element) => element.contains(name!))).toBe(true);
      expect(hidden.some((element) => element.contains(change!))).toBe(true);
      expect(readOut(item).join(' ')).not.toContain(SOFT_HYPHEN);
      expect(readOut(item).join(' ')).not.toMatch(/\*/);
    }
  });

  it('links each right arrow to Expenses, named by its category, its icon hidden; nothing else in an item is a link', async () => {
    await openOverview();

    const links = within(await list()).getAllByRole('link');
    expect(links.map((link) => [link.getAttribute('aria-label'), link.getAttribute('href')])).toEqual(
      ['Housing', 'Food', 'Transportation', 'Entertainment', 'Shopping', 'Others'].map((name) => [
        `${name} expenses`,
        '/expenses',
      ]),
    );
    for (const link of links) {
      expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      expect(link.textContent).toBe('');
    }
    for (const item of await items()) {
      expect(item.querySelectorAll('a, button, [tabindex]')).toHaveLength(1);
    }
  });

  it('asks for the breakdown once, with the browser’s time zone', async () => {
    const zones: (string | null)[] = [];
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname === '/api/expenses/breakdown') zones.push(request.headers.get('x-time-zone'));
    });
    await openOverview();
    await list();

    expect(zones).toEqual([Intl.DateTimeFormat().resolvedOptions().timeZone]);
  });

  it('keeps the title and the "*Compare to last month" note', async () => {
    await openOverview();
    await list();

    expect(within(breakdown()).getByRole('heading', { level: 2 })).toHaveTextContent('Expenses Breakdown');
    expect(within(breakdown()).getByText('*Compare to last month')).toBeInTheDocument();
  });
});

// T10: AC3, AC5, the changes the backend can send (#21, #61, #115 a).
describe('the Expenses Breakdown changes', () => {
  it('shows each total with no percentage and no arrow when last month was $0.00, the line kept empty', async () => {
    await openOverview(expensesBreakdown.noLastMonth());

    const all = await items();
    expect(all.map(shown)).toEqual(
      [
        `Hous${SOFT_HYPHEN}ing`,
        'Food',
        `Trans${SOFT_HYPHEN}por${SOFT_HYPHEN}ta${SOFT_HYPHEN}tion`,
        `En${SOFT_HYPHEN}ter${SOFT_HYPHEN}tain${SOFT_HYPHEN}ment`,
        `Shop${SOFT_HYPHEN}ping`,
        `Oth${SOFT_HYPHEN}ers`,
      ].map((name, index) => ({
        lines: [name, ['$237.50', '$273.79', '$36.11', '$74.10', '$305.91', '$111.15'][index], ''],
        arrow: null,
      })),
    );
    expect(all.map(readOut)[0]).toEqual(['Housing', '$237.50', 'Housing expenses']);
  });

  it('shows six $0.00 with no percentage and no empty message when there are no expenses at all', async () => {
    await openOverview(expensesBreakdown.allZero());

    const all = await items();
    expect(all).toHaveLength(6);
    expect(all.map((item) => shown(item).lines.slice(1))).toEqual(Array.from({ length: 6 }, () => ['$0.00', '']));
    expect(all.map((item) => shown(item).arrow)).toEqual(Array.from({ length: 6 }, () => null));
    expect(within(breakdown()).queryByRole('status')).toBeNull();
    expect(within(breakdown()).queryByText(/no expenses/i)).toBeNull();
  });

  it('shows 0% with no arrow, $0.00 with 100% down, an empty line and a long total as sent', async () => {
    await openOverview(expensesBreakdown.mixed());

    const all = await items();
    expect(all.slice(0, 4).map(shown)).toEqual([
      { lines: [`Hous${SOFT_HYPHEN}ing`, '$200.00', '0%*'], arrow: null },
      { lines: ['Food', '$0.00', '100%*'], arrow: 'down' },
      { lines: [`Trans${SOFT_HYPHEN}por${SOFT_HYPHEN}ta${SOFT_HYPHEN}tion`, '$53.20', ''], arrow: null },
      { lines: [`En${SOFT_HYPHEN}ter${SOFT_HYPHEN}tain${SOFT_HYPHEN}ment`, '$1,000,000,000.00', '250%*'], arrow: 'up' },
    ]);
    expect(all.slice(0, 4).map(readOut)).toEqual([
      ['Housing', '$200.00', '0% compared to last month', 'Housing expenses'],
      ['Food', '$0.00', 'down 100% compared to last month', 'Food expenses'],
      ['Transportation', '$53.20', 'Transportation expenses'],
      ['Entertainment', '$1,000,000,000.00', 'up 250% compared to last month', 'Entertainment expenses'],
    ]);
  });
});

/** The sidebar's active entries. */
const activeNav = () =>
  within(screen.getByRole('navigation', { name: 'Main' }))
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.textContent);

// T11: AC10, the right arrow opens Expenses (#21).
describe('the right arrows', () => {
  it('opens Expenses on a click, the sidebar’s Expenses active', async () => {
    const { user, url } = await openOverview();
    await list();

    await user.click(arrowLink('Shopping'));

    expect(url()).toBe('/expenses');
    expect(activeNav()).toEqual(['Expenses']);
  });

  it('opens Expenses on Enter', async () => {
    const { user, url } = await openOverview();
    await list();
    arrowLink('Housing').focus();

    await user.keyboard('{Enter}');

    expect(url()).toBe('/expenses');
    expect(activeNav()).toEqual(['Expenses']);
  });

  it('changes nothing on a click on the rest of an item', async () => {
    const { user, url } = await openOverview();
    const [housing] = await items();
    const before = breakdown().innerHTML;

    await user.click(within(housing!).getByText('$252.00'));
    await user.click(housing!.querySelector('span')!);

    expect(url()).toBe('/overview');
    expect(breakdown().innerHTML).toBe(before);
  });
});

// T12: AC12: loading, error, Retry and a failed refetch (#6, #88, #89, #114).
describe('the Expenses Breakdown states', () => {
  it('shows the skeleton, busy, while the request runs, the other sections in place', async () => {
    await openOverview(expensesBreakdown.pending());

    await waitFor(() => expect(breakdown().querySelector('[aria-busy="true"]')).not.toBeNull());
    expect(within(breakdown()).queryByRole('list')).toBeNull();
    expect(within(breakdown()).getByText('*Compare to last month')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Statistics' })).toBeInTheDocument();
  });

  it('shows the error state after the request and its 3 retries fail, the rest of the page working, and Retry loads it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await openOverview(expensesBreakdown.fails());

    await vi.advanceTimersByTimeAsync(30_000);

    expect(count(breakdownPath)).toBe(4);
    expect(within(breakdown()).getByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(within(breakdown()).queryByRole('list')).toBeNull();
    expect(await screen.findByText('$130,254.67')).toBeInTheDocument();
    await user.click(weeklyComparison());
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1);
    await user.keyboard('{Escape}');

    server.use(expensesBreakdown.answers());
    await user.click(within(breakdown()).getByRole('button', { name: 'Retry' }));

    expect((await items()).map(readOut)).toEqual(firstLoginReadOut);
    expect(within(breakdown()).queryByRole('alert')).toBeNull();
  });

  it('keeps focus in the card on a keyboard Retry, and Tab goes on to Housing’s right arrow', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await openOverview(expensesBreakdown.fails());
    await vi.advanceTimersByTimeAsync(30_000);
    within(breakdown()).getByRole('button', { name: 'Retry' }).focus();
    server.use(expensesBreakdown.answers());

    await user.keyboard('{Enter}');

    expect(await list()).toBeInTheDocument();
    expect(dataStateRootIn(breakdown())).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
    await user.tab();
    expect(arrowLink('Housing')).toHaveFocus();
  });

  it('keeps the items, with no message, when a later refetch fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openOverview();
    await list();
    server.use(expensesBreakdown.fails());
    const before = count(breakdownPath);

    refocusWindow();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(count(breakdownPath) - before).toBe(4);
    expect((await items()).map(readOut)).toEqual(firstLoginReadOut);
    expect(within(breakdown()).queryByRole('alert')).toBeNull();
  });
});

// T13: AC11, the Tab order: the "Weekly Comparison" control, the six right arrows, then out of the page's content (#87).
describe('the Expenses Breakdown Tab order', () => {
  it('tabs from the "Weekly Comparison" control through the six right arrows and out; Shift+Tab goes back', async () => {
    const { user } = await openOverview();
    await list();
    const main = screen.getByRole('main');
    const names = ['Housing', 'Food', 'Transportation', 'Entertainment', 'Shopping', 'Others'];

    weeklyComparison().focus();
    for (const name of names) {
      await user.tab();
      expect(arrowLink(name)).toHaveFocus();
    }
    await user.tab();
    expect(main.contains(document.activeElement)).toBe(false);

    arrowLink('Others').focus();
    for (const name of names.toReversed().slice(1)) {
      await user.tab({ shift: true });
      expect(arrowLink(name)).toHaveFocus();
    }
    await user.tab({ shift: true });
    expect(weeklyComparison()).toHaveFocus();
  });
});

/** A frontend source file's text, by its path under `frontend/src`. */
const srcDir = resolve(import.meta.dirname, '../../src');
const source = (path: string) => readFileSync(join(srcDir, path), 'utf8');

// T14: AC8, the frontend maps the response into the items and formats it; it calculates, sorts and filters nothing
// (#11, #74).
describe('the Expenses Breakdown sources', () => {
  const files = [
    'components/OverviewExpensesBreakdown/OverviewExpensesBreakdown.tsx',
    'components/ExpensesItem/ExpensesItem.tsx',
    'api/expenses.ts',
  ];
  const calculating =
    /Math\.|\.cents\s*[-+*/<>]|[-+*/<>]\s*\w+\.cents\b|\.percent\s*[-+*/<>]|[-+*/<>]\s*\w+\.percent\b|parseInt|parseFloat|Number\(|\.sort\(|\.toSorted\(|\.filter\(|\.reduce\(|\.reverse\(|[-+*/]\s*\d|\d\s*[-+*/]/;

  it('never calculates, sorts or filters', () => {
    expect(files.filter((file) => calculating.test(source(file)))).toEqual([]);
  });

  it('formats the money, the percentages and the labels with the shared formatters', () => {
    const item = source('components/ExpensesItem/ExpensesItem.tsx');

    expect(item).toMatch(/\bformatMoney\(/);
    expect(item).toMatch(/\bformatPercent\(/);
    expect(item).toMatch(/\bcategoryLabel\(/);
    expect(item).toMatch(/\bhyphenatedCategoryLabel\(/);
  });

  it.each([
    ['const share = Math.round(total.cents / 100);', true],
    ['const change = item.total.cents - last.cents;', true],
    ['const larger = change.percent > 50;', true],
    ['const sorted = categories.toSorted(byTotal);', true],
    ['const shown = categories.filter((each) => each.total.cents > 0);', true],
    ['const text = formatPercent(change.percent);', false],
    ['const money = formatMoney(item.total);', false],
  ])('the calculation check on %s: %s', (code, flagged) => {
    expect(calculating.test(code)).toBe(flagged);
  });
});

/** A component's CSS module source, by its path under `frontend/src/components`. */
const css = (path: string) => source(`components/${path}`);

/** The declaration blocks of a CSS source that wrap text anywhere. */
const wrappingRules = (text: string) =>
  [...text.matchAll(/\{([^{}]*)\}/g)]
    .map((match) => match[1]!)
    .filter((rule) => /overflow-wrap:\s*anywhere/.test(rule));

// T21: AC17, #115 b: every rule that lets text wrap in the three widgets hyphenates where the browser can, with
// overflow-wrap: anywhere as the fallback (the e2e test checks the computed styles).
describe('the wrapping text of Expenses Breakdown, Recent Transaction and Upcoming Bill', () => {
  it.each([
    'ExpensesItem/ExpensesItem.module.css',
    'RecentTransactionItem/RecentTransactionItem.module.css',
    'UpcomingBill/UpcomingBill.module.css',
  ])('%s: hyphens: auto beside every overflow-wrap: anywhere', (path) => {
    const rules = wrappingRules(css(path));

    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) expect(rule).toMatch(/hyphens:\s*auto/);
  });
});
