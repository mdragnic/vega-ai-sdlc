import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { focusManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import chartStyles from '../../src/components/ComparisonBarChart/ComparisonBarChart.module.css';
import cardStyles from '../../src/components/ExpensesBreakdown/ExpensesBreakdown.module.css';
import {
  dataStateRootIn,
  expensesBreakdown,
  longLineItemInWords,
  longLineItemNoSpace,
  me,
  monthlyComparison,
  renderApp,
  signedInDefaults,
  today,
} from '../support/app';

const server = setupServer(...signedInDefaults());

/** Every request the app sends, as `METHOD /path`, and the zone of each expenses request. */
let requests: string[] = [];
let expensesZones: (string | null)[] = [];

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  requests = [];
  expensesZones = [];
  server.events.on('request:start', ({ request }) => {
    const { pathname } = new URL(request.url);
    requests.push(`${request.method} ${pathname}`);
    if (pathname.startsWith('/api/expenses')) expensesZones.push(request.headers.get('x-time-zone'));
  });
});
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
  vi.useRealTimers();
  focusManager.setFocused(undefined);
});
afterAll(() => server.close());

/**
 * Expenses signed in, with `handlers` first (the demo answers by default), once both sections show. In StrictMode, as
 * the app runs in development and e2e: effects and ref cleanups run twice on mount.
 */
async function openExpenses(...handlers: Parameters<typeof server.use>) {
  server.use(me.signedIn(), today.answers(), ...handlers);
  const view = renderApp('/expenses', undefined, { strict: true });
  await screen.findByRole('region', { name: 'Expenses Comparison' });
  await screen.findByRole('region', { name: 'Expenses Breakdown' });
  return view;
}

const SOFT_HYPHEN = '­';
const comparison = () => screen.getByRole('region', { name: 'Expenses Comparison' });
const breakdown = () => screen.getByRole('region', { name: 'Expenses Breakdown' });
const control = () => within(comparison()).getByRole('combobox', { name: 'Expenses Comparison' });
/** The legend: the chart card's only list. */
const legend = () => within(comparison()).getByRole('list');
/** Waits until the card shows the chart's table. */
const chartTable = () =>
  within(comparison()).findByRole('table', { name: 'Expenses per month, this year and last year' });
const bars = (series: 'previous' | 'current') => comparison().querySelectorAll(`path.${chartStyles[series]}`);
const yLabels = () =>
  [...comparison().querySelectorAll(`text.${chartStyles.yLabel}`)].map((label) => label.textContent);
const xLabels = () =>
  [...comparison().querySelectorAll(`text.${chartStyles.xLabel}`)].map((label) => label.textContent);
/** The table's rows as text: the label, then Last year and This year. */
const tableRows = (element: HTMLElement) =>
  within(element)
    .getAllByRole('row')
    .map((row) => [...row.children].map((cell) => cell.textContent));
/** Waits until the section shows its list of cards (the outermost list), and returns the cards. */
const cards = async () => {
  const [list] = await within(breakdown()).findAllByRole('list');
  return [...list!.children] as HTMLElement[];
};
const sidebar = () => screen.getByRole('navigation', { name: 'Main' });
const search = () => screen.getByRole('searchbox', { name: 'Search' });

const monthlyPath = 'GET /api/expenses/monthly-comparison';
const breakdownPath = 'GET /api/expenses/breakdown';
const count = (request: string) => requests.filter((sent) => sent === request).length;

const refocusWindow = () =>
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });

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

/** A card's header: the first part of the `Card` the list item holds (the body follows it). */
const headerOf = (card: HTMLElement) => card.firstElementChild!.firstElementChild as HTMLElement;

/** What a card's header shows: its four lines (the name, the total, the percentage, the comparison) and its arrow. */
function shownHeader(card: HTMLElement) {
  const header = headerOf(card);
  const arrow = header.querySelector(`.${cardStyles.up}`)
    ? 'up'
    : header.querySelector(`.${cardStyles.down}`)
      ? 'down'
      : null;
  return { lines: [...header.querySelectorAll('p')].map((line) => line.textContent), arrow };
}

/** A card's items as shown: the name, the amount and the date of each, with the date's ISO value. */
const shownItems = (card: HTMLElement) =>
  [...card.querySelectorAll('li')].map((item) => ({
    lines: [...item.querySelectorAll('p')].map((line) => line.textContent),
    dateTime: item.querySelector('time')?.dateTime,
  }));

/** A first login's chart table on 22 Oct 2026 (task 024 References; AC3, AC21). */
const firstLoginRows = [
  ['', 'Last year', 'This year'],
  ['Jan', '$1,992.40', '$2,066.16'],
  ['Feb', '$1,652.61', '$1,713.83'],
  ['Mar', '$1,799.72', '$1,866.36'],
  ['Apr', '$1,744.45', '$1,809.09'],
  ['May', '$1,978.44', '$2,046.16'],
  ['Jun', '$2,479.12', '$2,550.26'],
  ['Jul', '$1,934.21', '$2,005.88'],
  ['Aug', '$1,912.31', '$1,983.12'],
  ['Sep', '$1,808.94', '$1,875.95'],
  ['Oct', '$1,982.95', '$1,893.80'],
  ['Nov', '$1,834.11', ''],
  ['Dec', '$2,340.36', ''],
];

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A first login's six cards as a screen reader reads them (AC11, AC12, AC21). */
const firstLoginReadOut = [
  [
    'Housing',
    '$252.00',
    'down 17% compared to last month',
    'Parking',
    '$20.16',
    '14 Oct, 2026',
    'House Rent',
    '$231.84',
    '1 Oct, 2026',
  ],
  [
    'Food',
    '$510.04',
    'up 7% compared to last month',
    'Pizza',
    '$24.64',
    '20 Oct, 2026',
    'Restaurant bill',
    '$147.84',
    '18 Oct, 2026',
  ],
  [
    'Transportation',
    '$53.20',
    'down 32% compared to last month',
    'Taxi fare',
    '$10.64',
    '19 Oct, 2026',
    'Taxi fare',
    '$10.64',
    '13 Oct, 2026',
  ],
  [
    'Entertainment',
    '$282.24',
    'up 16% compared to last month',
    'Movie ticket',
    '$17.64',
    '21 Oct, 2026',
    'GTR 5',
    '$188.16',
    '17 Oct, 2026',
  ],
  [
    'Shopping',
    '$658.00',
    'up 14% compared to last month',
    'Jeans',
    '$266.00',
    '22 Oct, 2026',
    'Shirt',
    '$322.00',
    '15 Oct, 2026',
  ],
  [
    'Others',
    '$138.32',
    'down 31% compared to last month',
    'Donation',
    '$31.92',
    '11 Oct, 2026',
    'Loan installment',
    '$106.40',
    '10 Oct, 2026',
  ],
];

/** The same headers as they show: the name with soft hyphens, the total, the percentage with no `*`, the arrow. */
const firstLoginHeaders = [
  { lines: [`Hous${SOFT_HYPHEN}ing`, '$252.00', '17%', 'Compare to last month'], arrow: 'down' },
  { lines: ['Food', '$510.04', '7%', 'Compare to last month'], arrow: 'up' },
  {
    lines: [`Trans${SOFT_HYPHEN}por${SOFT_HYPHEN}ta${SOFT_HYPHEN}tion`, '$53.20', '32%', 'Compare to last month'],
    arrow: 'down',
  },
  {
    lines: [`En${SOFT_HYPHEN}ter${SOFT_HYPHEN}tain${SOFT_HYPHEN}ment`, '$282.24', '16%', 'Compare to last month'],
    arrow: 'up',
  },
  { lines: [`Shop${SOFT_HYPHEN}ping`, '$658.00', '14%', 'Compare to last month'], arrow: 'up' },
  { lines: [`Oth${SOFT_HYPHEN}ers`, '$138.32', '31%', 'Compare to last month'], arrow: 'down' },
];

const categoryNames = ['Housing', 'Food', 'Transportation', 'Entertainment', 'Shopping', 'Others'];

// T13: AC1 to AC3, AC10 to AC12, AC21, the first login's page (#10, #29, #55, #61, #113 b, #115 b, #122 b).
describe('the Expenses page', () => {
  it('shows Expenses active, the date, no greeting, and the sections "Expenses Comparison" and "Expenses Breakdown"', async () => {
    await openExpenses();

    const current = within(sidebar())
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.textContent)).toEqual(['Expenses']);
    expect(await within(screen.getByRole('banner')).findByText('22 Oct, 2026')).toBeInTheDocument();
    expect(screen.queryByText(/Hello/)).toBeNull();
    expect(
      within(screen.getByRole('main'))
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(['Expenses Comparison', 'Expenses Breakdown']);
  });

  it('asks for the monthly comparison and the breakdown once each, with the browser’s time zone', async () => {
    await openExpenses();
    await chartTable();
    await cards();

    expect(count(monthlyPath)).toBe(1);
    expect(count(breakdownPath)).toBe(1);
    expect(expensesZones).toEqual([
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ]);
  });
});

describe('the Expenses Comparison card', () => {
  it('shows "Monthly Comparison" as a combobox named Expenses Comparison and the legend "This year" and "Last year"', async () => {
    await openExpenses();

    expect(control()).toHaveTextContent(/^Monthly Comparison$/);
    expect(
      within(legend())
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['This year', 'Last year']);
  });

  it('carries the values in the table: a row per month by its label, amounts in full, an empty cell after October', async () => {
    await openExpenses();

    expect(tableRows(await chartTable())).toEqual(firstLoginRows);
  });

  it('draws 12 gray bars, 10 teal bars to October, the labels Jan to Dec and the y labels $0 to $4k, the SVG hidden', async () => {
    await openExpenses();
    await chartTable();

    expect(bars('previous')).toHaveLength(12);
    expect(bars('current')).toHaveLength(10);
    expect(xLabels()).toEqual(months);
    expect(yLabels()).toEqual(['$0', '$1k', '$2k', '$3k', '$4k']);
    expect(comparison().querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('the Expenses Breakdown cards', () => {
  it('lists six cards in the order sent, each named by its clean category name', async () => {
    await openExpenses();

    const shown = await cards();
    expect(shown).toHaveLength(6);
    expect(shown.map((card) => card.tagName)).toEqual(Array.from({ length: 6 }, () => 'LI'));
    for (const [index, card] of shown.entries()) expect(card).toHaveAccessibleName(categoryNames[index]);
  });

  it('reads each card as its name, total, change sentence and items, with no soft hyphen and no asterisk', async () => {
    await openExpenses();

    const shown = await cards();
    expect(shown.map(readOut)).toEqual(firstLoginReadOut);
    for (const card of shown) {
      expect(readOut(card).join(' ')).not.toContain(SOFT_HYPHEN);
      expect(readOut(card).join(' ')).not.toMatch(/\*|Compare to last month/);
    }
  });

  it('shows each header’s name with its soft hyphens, the total, the percentage with no asterisk, its arrow and "Compare to last month"', async () => {
    await openExpenses();

    expect((await cards()).map(shownHeader)).toEqual(firstLoginHeaders);
  });

  it('hides the icon, the hyphenated name, the percentage, the arrow and "Compare to last month" from assistive technology', async () => {
    await openExpenses();

    for (const card of await cards()) {
      const header = headerOf(card);
      const hidden = [...header.querySelectorAll('[aria-hidden="true"]')];
      const [name, , percentage, compare] = [...header.querySelectorAll('p')];
      const icon = header.querySelector('span > svg')!.parentElement!;
      for (const element of [icon, name!, percentage!, compare!]) {
        expect(hidden.some((each) => each.contains(element))).toBe(true);
      }
    }
  });

  it('lists each card’s items newest first as sent, the amount with no sign and the date in a time element', async () => {
    await openExpenses();

    const [housing, , , , shopping] = await cards();
    expect(shownItems(housing!)).toEqual([
      { lines: ['Parking', '$20.16', '14 Oct, 2026'], dateTime: '2026-10-14T12:00:00.000Z' },
      { lines: ['House Rent', '$231.84', '1 Oct, 2026'], dateTime: '2026-10-01T12:00:00.000Z' },
    ]);
    expect(shownItems(shopping!)).toEqual([
      { lines: ['Jeans', '$266.00', '22 Oct, 2026'], dateTime: '2026-10-22T12:00:00.000Z' },
      { lines: ['Shirt', '$322.00', '15 Oct, 2026'], dateTime: '2026-10-15T12:00:00.000Z' },
    ]);
    for (const card of await cards()) {
      expect(within(card).getByRole('list')).toBeInTheDocument();
      expect(card.textContent).not.toMatch(/[-+−]\s?\$/);
    }
  });
});

// T14: AC7, AC14, AC15, AC23, the data's edges (#55, #61, #91 c).
describe('the Expenses data cases', () => {
  it('shows "No expenses this year or last year" in the chart’s box when every value is 0, the header row kept', async () => {
    await openExpenses(monthlyComparison.allZero());

    expect(await within(comparison()).findByText('No expenses this year or last year')).toBeInTheDocument();
    expect(within(comparison()).queryByRole('table')).toBeNull();
    expect(control()).toHaveTextContent('Monthly Comparison');
    expect(legend()).toBeInTheDocument();
  });

  it('shows no gray bar and January’s teal bar when last year is all 0, the axis $0 to $2k', async () => {
    await openExpenses(monthlyComparison.lastYearZero());
    const rows = tableRows(await chartTable());

    expect(bars('previous')).toHaveLength(0);
    expect(bars('current')).toHaveLength(1);
    expect(rows[1]).toEqual(['Jan', '$0.00', '$1,038.56']);
    expect(rows[2]).toEqual(['Feb', '$0.00', '']);
    expect(yLabels()).toEqual(['$0', '$500', '$1k', '$1.5k', '$2k']);
  });

  it('labels the months of the year it is sent: 2027 against 2026 at the year change', async () => {
    await openExpenses(monthlyComparison.newYear());
    const rows = tableRows(await chartTable());

    expect(rows.slice(1).map((row) => row[0])).toEqual(months);
    expect(rows[1]).toEqual(['Jan', '$2,066.16', '$266.80']);
    expect(rows[12]).toEqual(['Dec', '$2,427.04', '']);
    expect(bars('current')).toHaveLength(1);
  });

  it('shows one item at the top of a card with one, and "No expenses this month" in the others', async () => {
    await openExpenses(expensesBreakdown.oneItem());

    const [housing, ...rest] = await cards();
    expect(shownItems(housing!)).toEqual([
      { lines: ['House Rent', '$270.48', '1 Nov, 2026'], dateTime: '2026-11-01T12:00:00.000Z' },
    ]);
    expect(within(housing!).queryByText('No expenses this month')).toBeNull();
    for (const card of rest) {
      expect(within(card).getByText('No expenses this month')).toBeInTheDocument();
      expect(within(card).queryByRole('list')).toBeNull();
      expect(shownHeader(card)).toMatchObject({ arrow: 'down' });
      expect(shownHeader(card).lines.slice(1)).toEqual(['$0.00', '100%', 'Compare to last month']);
    }
  });

  it('shows an empty percentage line, no arrow and "Compare to last month" when last month was $0.00', async () => {
    await openExpenses(expensesBreakdown.noLastMonth());

    const shown = await cards();
    expect(shown.map(shownHeader).map(({ lines, arrow }) => [lines.slice(1), arrow])).toEqual(
      ['$237.50', '$273.79', '$36.11', '$74.10', '$305.91', '$111.15'].map((total) => [
        [total, '', 'Compare to last month'],
        null,
      ]),
    );
    // Nothing is said about a change there is none of.
    for (const card of shown) expect(readOut(card).join(' ')).not.toMatch(/compared to last month/);
    expect(readOut(shown[0]!).slice(0, 3)).toEqual(['Housing', '$237.50', 'Parking']);
  });

  it('shows six $0.00 with no change and "No expenses this month" in every card', async () => {
    await openExpenses(expensesBreakdown.allZero());

    const shown = await cards();
    expect(shown).toHaveLength(6);
    for (const card of shown) {
      expect(shownHeader(card)).toEqual({
        lines: [expect.any(String), '$0.00', '', 'Compare to last month'],
        arrow: null,
      });
      expect(within(card).getByText('No expenses this month')).toBeInTheDocument();
    }
  });

  it('shows `0%` with no arrow for no change, and a $1,000,000,000.00 total', async () => {
    await openExpenses(expensesBreakdown.mixed());

    const [housing, food, , entertainment] = await cards();
    expect(shownHeader(housing!)).toEqual({
      lines: [`Hous${SOFT_HYPHEN}ing`, '$200.00', '0%', 'Compare to last month'],
      arrow: null,
    });
    expect(readOut(housing!)).toContain('0% compared to last month');
    expect(shownHeader(food!).lines.slice(1, 3)).toEqual(['$0.00', '100%']);
    expect(shownHeader(entertainment!).lines[1]).toBe('$1,000,000,000.00');
  });

  it('shows the long names and amounts as text, whole', async () => {
    await openExpenses(expensesBreakdown.long());

    const [housing, food] = await cards();
    expect(shownHeader(housing!).lines[1]).toBe('$1,000,000,000.00');
    expect(shownItems(housing!)[0]!.lines).toEqual([longLineItemInWords, '$1,000,000,000.00', '21 Oct, 2026']);
    expect(shownItems(food!)[0]!.lines).toEqual([longLineItemNoSpace, '$24.64', '20 Oct, 2026']);
    expect(longLineItemInWords).toHaveLength(120);
    expect(longLineItemNoSpace).toHaveLength(120);
  });
});

// T15: AC19, the states of each widget (#6, #88, #89, #114, #116).
describe('the Expenses states', () => {
  it('shows the chart’s skeleton under the header row, busy, while its request runs; the cards show', async () => {
    await openExpenses(monthlyComparison.pending());

    await waitFor(() => expect(comparison().querySelector('[aria-busy="true"]')).not.toBeNull());
    expect(control()).toHaveTextContent('Monthly Comparison');
    expect(legend()).toBeInTheDocument();
    expect(within(comparison()).queryByRole('table')).toBeNull();
    expect(await cards()).toHaveLength(6);
  });

  it('shows the cards’ skeleton, busy, while their request runs; the chart shows', async () => {
    await openExpenses(expensesBreakdown.pending());

    await waitFor(() => expect(breakdown().querySelector('[aria-busy="true"]')).not.toBeNull());
    expect(within(breakdown()).queryByRole('list')).toBeNull();
    expect(tableRows(await chartTable())).toEqual(firstLoginRows);
  });

  it('shows the chart’s error state after its request and 3 retries fail, the cards working, and Retry loads it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await openExpenses(monthlyComparison.failsThenAnswers());

    await vi.advanceTimersByTimeAsync(30_000);

    expect(count(monthlyPath)).toBe(4);
    expect(within(comparison()).getByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(within(comparison()).queryByRole('table')).toBeNull();
    expect(control()).toHaveTextContent('Monthly Comparison');
    expect(await cards()).toHaveLength(6);
    expect(within(breakdown()).queryByRole('alert')).toBeNull();

    await user.click(within(comparison()).getByRole('button', { name: 'Retry' }));

    expect(tableRows(await chartTable())).toEqual(firstLoginRows);
    expect(within(comparison()).queryByRole('alert')).toBeNull();
  });

  it('shows the cards’ error state in one card across the grid, the chart working, and Retry loads them', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await openExpenses(expensesBreakdown.failsThenAnswers());

    await vi.advanceTimersByTimeAsync(30_000);

    expect(count(breakdownPath)).toBe(4);
    const alert = within(breakdown()).getByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong.');
    expect(within(breakdown()).queryByRole('list')).toBeNull();
    expect(within(breakdown()).getAllByRole('button')).toHaveLength(1);
    expect(tableRows(await chartTable())).toEqual(firstLoginRows);

    await user.click(within(breakdown()).getByRole('button', { name: 'Retry' }));

    expect((await cards()).map(readOut)).toEqual(firstLoginReadOut);
    expect(within(breakdown()).queryByRole('alert')).toBeNull();
  });

  it.each([
    ['the chart', comparison, () => monthlyComparison.failsThenAnswers(), () => chartTable()],
    ['the cards', breakdown, () => expensesBreakdown.failsThenAnswers(), () => cards()],
  ] as const)(
    'keeps focus in %s on a keyboard Retry, never the page body (#114)',
    async (_widget, region, handler, data) => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { user } = await openExpenses(handler());
      await vi.advanceTimersByTimeAsync(30_000);
      within(region()).getByRole('button', { name: 'Retry' }).focus();

      await user.keyboard('{Enter}');

      await data();
      expect(dataStateRootIn(region())).toHaveFocus();
      expect(document.activeElement).not.toBe(document.body);
    },
  );

  it.each([
    ['the chart', () => monthlyComparison.fails(), monthlyPath],
    ['the cards', () => expensesBreakdown.fails(), breakdownPath],
  ] as const)('keeps %s, with no message, when a later refetch fails', async (_widget, failing, path) => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openExpenses();
    await chartTable();
    await cards();
    server.use(failing());
    const before = count(path);

    refocusWindow();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(count(path) - before).toBe(4);
    expect(tableRows(await chartTable())).toEqual(firstLoginRows);
    expect((await cards()).map(readOut)).toEqual(firstLoginReadOut);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

// T16: AC8, the one comparison: the shared list with "Monthly Comparison" only (#29, #60, #90 a).
describe('the "Monthly Comparison" control', () => {
  it('opens the list on a click with one option, selected; choosing it closes the list and sends nothing', async () => {
    const { user } = await openExpenses();
    const table = await chartTable();
    const sent = requests.length;

    await user.click(control());
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Monthly Comparison']);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await user.click(options[0]!);

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(control()).toHaveTextContent('Monthly Comparison');
    expect(tableRows(table)).toEqual(firstLoginRows);
    expect(requests).toHaveLength(sent);
  });

  it.each(['{Enter}', ' ', '{ArrowDown}', '{ArrowUp}'])(
    'opens by keyboard with %s and closes on Escape, sending nothing',
    async (key) => {
      const { user } = await openExpenses();
      await chartTable();
      const sent = requests.length;
      control().focus();

      await user.keyboard(key);
      expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1);
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('listbox')).toBeNull();
      await waitFor(() => expect(control()).toHaveFocus());
      expect(control()).toHaveTextContent('Monthly Comparison');
      expect(requests).toHaveLength(sent);
    },
  );
});

// T17: AC9, AC20, nothing in the chart or the cards is focusable or reacts (#29).
describe('no chart or card actions', () => {
  it('tabs from the header’s search field to the control, then out of the content; Shift+Tab goes back', async () => {
    const { user } = await openExpenses();
    await chartTable();
    await cards();
    const main = screen.getByRole('main');

    search().focus();
    await user.tab();
    expect(control()).toHaveFocus();
    await user.tab();
    expect(main.contains(document.activeElement)).toBe(false);

    await user.tab({ shift: true });
    expect(control()).toHaveFocus();
    await user.tab({ shift: true });
    expect(search()).toHaveFocus();
  });

  it('has nothing focusable or clickable in the cards or the chart', async () => {
    await openExpenses();
    const table = await chartTable();

    for (const container of [breakdown(), table.parentElement!]) {
      expect(
        container.querySelectorAll('a, button, input, select, textarea, [tabindex], [role="button"]'),
      ).toHaveLength(0);
    }
  });

  it('changes nothing and sends nothing on a hover or a click on a bar, a card or an item', async () => {
    const { user, url } = await openExpenses();
    await chartTable();
    const shown = await cards();
    const before = screen.getByRole('main').innerHTML;
    const sent = requests.length;

    await user.hover(bars('current')[5]!);
    await user.click(bars('previous')[5]!);
    for (const card of shown) {
      await user.hover(card);
      await user.click(card);
      for (const item of within(card).queryAllByRole('listitem')) await user.click(item);
    }

    expect(screen.getByRole('main').innerHTML).toBe(before);
    expect(within(comparison()).queryByRole('tooltip')).toBeNull();
    expect(url()).toBe('/expenses');
    expect(requests).toHaveLength(sent);
  });
});

// T18: AC13, AC19, AC26, Overview and Expenses share one answer; Overview's card never shows the items.
describe('Overview and Expenses', () => {
  it('shows Overview’s six totals and changes in the cards at once, from the one cached answer; Overview shows no item', async () => {
    server.use(me.signedIn(), today.answers());
    const { user, url } = renderApp('/overview', undefined, { strict: true });
    const overview = await screen.findByRole('region', { name: 'Expenses Breakdown' });
    const overviewItems = within(await within(overview).findByRole('list')).getAllByRole('listitem');
    // Overview's item reads its name, total, change and right arrow (task 018); the `*` aside, the cards agree.
    const fromOverview = overviewItems.map((item) => readOut(item).slice(0, 3));
    for (const text of ['Parking', 'House Rent', '$20.16', '$231.84', '14 Oct, 2026', 'Loan installment', 'Jeans']) {
      expect(overview).not.toHaveTextContent(text);
    }
    expect(overview.querySelectorAll('time')).toHaveLength(0);
    // From here the breakdown request never answers: Expenses can only show the cached answer.
    server.use(expensesBreakdown.pending());

    await user.click(within(overview).getByRole('link', { name: 'Housing expenses' }));

    expect(url()).toBe('/expenses');
    const shown = await cards();
    expect(shown.map((card) => readOut(card).slice(0, 3))).toEqual(fromOverview);
    expect(shown.map(readOut)).toEqual(firstLoginReadOut);
    expect(count(breakdownPath)).toBeGreaterThanOrEqual(1);
    expect(requests.filter((sent) => sent.startsWith('GET /api/expenses/') && sent !== breakdownPath)).toEqual([
      monthlyPath,
    ]);
  });
});

/** A frontend source file's text, by its path under `frontend/src`. */
const srcDir = resolve(import.meta.dirname, '../../src');
const source = (path: string) => readFileSync(join(srcDir, path), 'utf8');
/** Source text without its comments, which cite stories and decisions ("US-15", "#94"). */
const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

// T19: AC6, AC18, the frontend maps the responses into the components and formats them; it calculates nothing
// (#11, #53, #55, #74, #80).
describe('the Expenses sources', () => {
  const files = [
    'app/pages/ExpensesPage.tsx',
    'components/ExpensesComparison/ExpensesComparison.tsx',
    'components/ExpensesBreakdownList/ExpensesBreakdownList.tsx',
    'components/ExpensesBreakdown/ExpensesBreakdown.tsx',
    'components/ExpensesLineItem/ExpensesLineItem.tsx',
    'api/expenses.ts',
  ];
  // As tasks 016, 017 and 023's guards: no money, percent or date arithmetic, no sort, filter or slice, no Math.
  const calculating =
    /\bcents\b|\.percent\s*[-+*/<>]|Math\.|\bnew Date\b|\bDate\.|getTime|parseInt|parseFloat|Number\(|toFixed|toLocaleString|Intl\.|\.(filter|sort|toSorted|reduce|slice|splice|reverse|toReversed|every|some)\(|[-+*/]\s*\d|\d\s*[-+*/]/;
  const usesAxisTicks = /\baxisTicks\s*\(|import\s*\{[^}]*\baxisTicks\b[^}]*\}\s*from|\baxisTicks\s*[,}]/;

  it.each(files)('%s sorts, filters, slices and calculates nothing', (file) => {
    expect(withoutComments(source(file))).not.toMatch(calculating);
  });

  it.each([
    'const top = Math.max(...values);',
    'const total = month.lastYear.cents + month.thisYear.cents;',
    'const shown = recent.slice(0, 2);',
    'const sorted = recent.toSorted(byDate);',
    'const items = recent.filter((item) => item.amount.cents > 0);',
    'const empty = months.every((month) => month.lastYear.cents === 0);',
    'new Date(item.occurredAt)',
    'const rounded = change.percent * 100;',
    'const next = index + 1;',
  ])('flags %s', (code) => {
    expect(code).toMatch(calculating);
  });

  it.each(['formatMonthAxisLabel(month.month)', 'formatDate(item.occurredAt, browserTimeZone())'])(
    'allows %s',
    (code) => {
      expect(code).not.toMatch(calculating);
    },
  );

  it('never imports or calls axisTicks anywhere in frontend/src', () => {
    const offenders = sourceFiles(srcDir)
      .filter((file) => usesAxisTicks.test(readFileSync(file, 'utf8')))
      .map((file) => relative(srcDir, file).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('formats only through the shared formatters and takes the empty state from the backend’s null ticks', () => {
    const chart = source('components/ExpensesComparison/ExpensesComparison.tsx');
    const card = source('components/ExpensesBreakdown/ExpensesBreakdown.tsx');
    const item = source('components/ExpensesLineItem/ExpensesLineItem.tsx');

    expect(chart).toMatch(/\bformatMonthAxisLabel\(/);
    expect(chart).toMatch(/\bticks === null\b/);
    expect(chart).toMatch(/<ComparisonBarChart\b/);
    expect(card).toMatch(/\bformatMoney\(total\)/);
    expect(card).toMatch(/\bformatPercent\(/);
    expect(card).toMatch(/\bhyphenatedCategoryLabel\(/);
    expect(item).toMatch(/\bformatMoney\(/);
    expect(item).not.toMatch(/\bformatSignedMoney\b/);
    expect(item).toMatch(/\bformatDate\([^)]*browserTimeZone\(\)\)/);
  });

  it('shares the change sentence with Overview’s ExpensesItem: one helper, no copy', () => {
    const card = source('components/ExpensesBreakdown/ExpensesBreakdown.tsx');
    const overviewItem = source('components/ExpensesItem/ExpensesItem.tsx');

    for (const file of [card, overviewItem]) {
      expect(file).toMatch(/\bexpenseChangeText\(/);
      expect(file).not.toMatch(/compared to last month/);
    }
  });

  it('draws no hover and no pointer in the cards or the items (#29)', () => {
    for (const file of [
      'components/ExpensesBreakdown/ExpensesBreakdown.module.css',
      'components/ExpensesLineItem/ExpensesLineItem.module.css',
      'components/ExpensesBreakdownList/ExpensesBreakdownList.module.css',
    ]) {
      expect(source(file)).not.toMatch(/:hover|cursor\s*:/);
    }
  });
});
