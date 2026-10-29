import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { focusManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import styles from '../../src/components/RecentTransactionItem/RecentTransactionItem.module.css';
import { demoExpenses, demoRevenue, me, recentTransactions, renderApp, signedInDefaults, today } from '../support/app';

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
  vi.restoreAllMocks();
  focusManager.setFocused(undefined);
});
afterAll(() => server.close());

/** Overview signed in, with `handlers` first (the demo transactions by default), once the section shows. */
async function openOverview(...handlers: Parameters<typeof server.use>) {
  server.use(me.signedIn(), today.answers(), ...handlers);
  const view = renderApp('/overview');
  await screen.findByRole('region', { name: 'Recent Transaction' });
  return view;
}

const recent = () => screen.getByRole('region', { name: 'Recent Transaction' });
const tablist = () => within(recent()).getByRole('tablist', { name: 'Recent Transaction' });
const tab = (name: 'All' | 'Revenue' | 'Expenses') => within(tablist()).getByRole('tab', { name });
const panel = () => within(recent()).getByRole('tabpanel');
const selectedTab = () => within(tablist()).getByRole('tab', { selected: true });
/** Waits until the panel shows the selected tab's list. */
const list = () => within(panel()).findByRole('list');
/** The rows of the selected tab: the hidden tabs' lists are not in the accessibility tree. */
const rows = () => within(panel()).queryAllByRole('listitem');
const viewAll = () => within(recent()).getByRole('link', { name: 'View All' });

const count = (request: string) => requests.filter((sent) => sent === request).length;
const recentPath = 'GET /api/transactions/recent';

const refocusWindow = () =>
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });

/** The browser's IANA zone as `browserTimeZone()` reads it. */
function mockBrowserTimeZone(timeZone: string) {
  const real = new Intl.DateTimeFormat().resolvedOptions();
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ ...real, timeZone });
}

/** A frontend source file's text. */
const source = (path: string) => readFileSync(resolve(import.meta.dirname, '../../src', path), 'utf8');

/** A row as the card shows it: the icon's name, then the item, the shop, the amount and the date. */
const rowSummary = (row: HTMLElement) => [
  within(row).getByRole('img').getAttribute('aria-label'),
  ...[...row.querySelectorAll('p, time')].map((element) => element.textContent),
];

const firstLoginAll = [
  ['Shopping', 'Jeans', 'Denim House', '-$266.00', '22 Oct, 2026'],
  ['Entertainment', 'Movie ticket', 'Inox', '-$17.64', '21 Oct, 2026'],
  ['Food', 'Pizza', 'Pizza Hit', '-$24.64', '20 Oct, 2026'],
  ['Transportation', 'Taxi fare', 'Uber', '-$10.64', '19 Oct, 2026'],
  ['Food', 'Restaurant bill', 'Spice Garden', '-$147.84', '18 Oct, 2026'],
];
const firstLoginRevenue = [
  ['Income', 'Freelance payment', 'Bright Studio', '+$179.20', '17 Oct, 2026'],
  ['Income', 'Dividend', 'AB Bank Ltd', '+$84.00', '15 Oct, 2026'],
  ['Income', 'Freelance payment', 'Bright Studio', '+$179.20', '10 Oct, 2026'],
  ['Income', 'Freelance payment', 'Bright Studio', '+$179.20', '3 Oct, 2026'],
  ['Income', 'Design project', 'Acme Ltd.', '+$784.00', '1 Oct, 2026'],
];

// T7: the first login's Recent Transaction card (AC1, AC13; #11, #19, #40, #56, demo-data.md).
describe('the Recent Transaction card', () => {
  it('shows the tablist with All selected and the 5 newest transactions, as drawn', async () => {
    await openOverview();
    await list();

    const tabs = within(tablist()).getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    for (const [index, name] of ['All', 'Revenue', 'Expenses'].entries()) {
      expect(tabs[index]).toHaveAccessibleName(name);
    }
    expect(tab('All')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Revenue')).toHaveAttribute('aria-selected', 'false');
    expect(rows()).toHaveLength(5);
    expect(rows().map(rowSummary)).toEqual(firstLoginAll);
    expect(within(recent()).getByRole('heading', { level: 2 })).toHaveTextContent('Recent Transaction');
    expect(viewAll()).toHaveAttribute('href', '/transactions');
  });

  it('names each icon by its category, the wallet "Income"', async () => {
    const { user } = await openOverview();
    await list();

    expect(rows()).toHaveLength(5);
    for (const [index, name] of ['Shopping', 'Entertainment', 'Food', 'Transportation', 'Food'].entries()) {
      expect(within(rows()[index]!).getByRole('img')).toHaveAccessibleName(name);
    }
    await user.click(tab('Revenue'));
    for (const row of rows()) expect(within(row).getByRole('img')).toHaveAccessibleName('Income');
  });

  it('gives each date as a time element with the occurredAt value', async () => {
    await openOverview();
    await list();

    expect(rows().map((row) => row.querySelector('time')!.dateTime)).toEqual(
      demoExpenses.map((transaction) => transaction.occurredAt),
    );
  });

  it('draws the divider under every row but the last: 4 dividers', async () => {
    await openOverview();
    await list();

    expect(rows().map((row) => row.classList.contains(styles.divided!))).toEqual([true, true, true, true, false]);
  });

  it('makes the panel a tabpanel named by the selected tab, a Tab stop with nothing focusable in the rows', async () => {
    await openOverview();
    await list();

    expect(panel()).toHaveAccessibleName('All');
    expect(panel()).toHaveAttribute('tabindex', '0');
    expect(panel().id).not.toBe('');
    for (const element of within(tablist()).getAllByRole('tab')) {
      expect(element).toHaveAttribute('aria-controls', panel().id);
    }
    expect(panel().querySelectorAll('a, button, input, select, textarea, [tabindex]')).toHaveLength(0);
  });

  it('asks for the transactions once, with the browser’s time zone', async () => {
    const zones: (string | null)[] = [];
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname === '/api/transactions/recent') zones.push(request.headers.get('x-time-zone'));
    });
    const { user } = await openOverview();
    await list();
    await user.click(tab('Revenue'));
    await user.click(tab('Expenses'));

    expect(zones).toEqual([Intl.DateTimeFormat().resolvedOptions().timeZone]);
  });
});

// T8: the tabs by mouse and keyboard, the hidden lists and the Tab order (AC2, AC13, AC15; #19, #87, #112).
describe('the Recent Transaction tabs', () => {
  it('shows each tab’s own list when clicked, the clicked tab selected', async () => {
    const { user } = await openOverview();
    await list();

    await user.click(tab('Revenue'));
    expect(tab('Revenue')).toHaveAttribute('aria-selected', 'true');
    expect(tab('All')).toHaveAttribute('aria-selected', 'false');
    expect(panel()).toHaveAccessibleName('Revenue');
    expect(rows().map(rowSummary)).toEqual(firstLoginRevenue);

    await user.click(tab('Expenses'));
    expect(tab('Expenses')).toHaveAttribute('aria-selected', 'true');
    expect(panel()).toHaveAccessibleName('Expenses');
    expect(rows().map(rowSummary)).toEqual(firstLoginAll);

    await user.click(tab('All'));
    expect(tab('All')).toHaveAttribute('aria-selected', 'true');
    expect(rows().map(rowSummary)).toEqual(firstLoginAll);
  });

  it('keeps the three lists in the panel, the two not selected hidden from assistive technology', async () => {
    const { user } = await openOverview();
    await list();
    const lists = () => [...panel().querySelectorAll('ul')];

    expect(lists()).toHaveLength(3);
    expect(lists().map((element) => element.closest('[aria-hidden="true"]') === null)).toEqual([true, false, false]);
    expect(within(panel()).getAllByRole('list')).toHaveLength(1);
    expect(within(panel()).getAllByRole('listitem')).toHaveLength(5);

    await user.click(tab('Revenue'));
    expect(lists().map((element) => element.closest('[aria-hidden="true"]') === null)).toEqual([false, true, false]);
    expect(within(panel()).getAllByRole('listitem')).toHaveLength(5);
  });

  it('moves the selection with Right and Left, wrapping, and with Home and End', async () => {
    const { user } = await openOverview();
    await list();
    tab('All').focus();

    await user.keyboard('{ArrowRight}');
    expect(selectedTab()).toHaveAccessibleName('Revenue');
    expect(selectedTab()).toHaveFocus();
    expect(rows().map(rowSummary)).toEqual(firstLoginRevenue);
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(selectedTab()).toHaveAccessibleName('All');
    await user.keyboard('{ArrowLeft}');
    expect(selectedTab()).toHaveAccessibleName('Expenses');
    await user.keyboard('{Home}');
    expect(selectedTab()).toHaveAccessibleName('All');
    await user.keyboard('{End}');
    expect(selectedTab()).toHaveAccessibleName('Expenses');
    expect(panel()).toHaveAccessibleName('Expenses');
  });

  // Task 017: after the panel, Tab reaches the next card's first focusable element, the "Weekly Comparison" control;
  // task 018: then Expenses Breakdown's six right arrows.
  it('tabs from "View All" to the selected tab, the panel, the Statistics control, Housing’s right arrow, and back with Shift+Tab', async () => {
    const { user } = await openOverview();
    await list();
    await user.click(tab('Revenue'));

    viewAll().focus();
    await user.tab();
    expect(tab('Revenue')).toHaveFocus();
    expect(
      within(tablist())
        .getAllByRole('tab')
        .map((element) => element.tabIndex),
    ).toEqual([-1, 0, -1]);
    await user.tab();
    expect(panel()).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('combobox', { name: 'Statistics' })).toHaveFocus();
    await user.tab();
    expect(await screen.findByRole('link', { name: 'Housing expenses' })).toHaveFocus();

    screen.getByRole('combobox', { name: 'Statistics' }).focus();
    await user.tab({ shift: true });
    expect(panel()).toHaveFocus();
    await user.tab({ shift: true });
    expect(tab('Revenue')).toHaveFocus();
    await user.tab({ shift: true });
    expect(viewAll()).toHaveFocus();
  });
});

// T9: fewer than 5, a tab or all lists empty, and dates in the browser's zone (AC3, AC5, AC6; #6, #40, #54).
describe('the Recent Transaction lists', () => {
  it('shows only the rows sent: 3 with 2 dividers, 1 with none, and the message for none', async () => {
    const { user } = await openOverview(recentTransactions.few());
    await list();

    expect(rows()).toHaveLength(3);
    expect(rows().map((row) => row.classList.contains(styles.divided!))).toEqual([true, true, false]);

    await user.click(tab('Revenue'));
    expect(rows()).toHaveLength(1);
    expect(rows()[0]!.classList.contains(styles.divided!)).toBe(false);

    await user.click(tab('Expenses'));
    expect(rows()).toHaveLength(0);
    expect(within(panel()).queryByRole('list')).toBeNull();
    expect(shownMessage()).toBe('No transactions yet');
  });

  it('shows "No transactions yet" in Revenue only when only Revenue is empty', async () => {
    const { user } = await openOverview(recentTransactions.noRevenue());
    await list();

    expect(rows()).toHaveLength(5);
    expect(shownMessage()).toBeNull();

    await user.click(tab('Revenue'));
    expect(shownMessage()).toBe('No transactions yet');
    expect(within(panel()).queryByRole('list')).toBeNull();

    await user.click(tab('Expenses'));
    expect(rows().map(rowSummary)).toEqual(firstLoginAll);
    expect(shownMessage()).toBeNull();
  });

  it('shows the tabs and "No transactions yet" when every list is empty', async () => {
    const { user } = await openOverview(recentTransactions.none());

    expect(await within(panel()).findByText('No transactions yet')).toBeInTheDocument();
    expect(within(recent()).queryByRole('list')).toBeNull();
    expect(within(tablist()).getAllByRole('tab')).toHaveLength(3);
    await user.click(tab('Revenue'));
    expect(within(panel()).getByText('No transactions yet')).toBeInTheDocument();
    expect(viewAll()).toBeInTheDocument();
  });

  it.each([
    ['Europe/Belgrade', '23 Oct, 2026'],
    ['America/New_York', '22 Oct, 2026'],
  ])('shows a transaction at 2026-10-22T23:30:00Z on its date in %s: %s', async (zone, date) => {
    mockBrowserTimeZone(zone);
    const late = { ...demoRevenue[0]!, occurredAt: '2026-10-22T23:30:00.000Z' };
    await openOverview(recentTransactions.answers({ all: [late], revenue: [late], expenses: [] }));
    await list();

    expect(rows()[0]!.querySelector('time')).toHaveTextContent(date);
    expect(rows()[0]!.querySelector('time')).toHaveAttribute('datetime', '2026-10-22T23:30:00.000Z');
  });
});

/** The empty message of the selected tab, or null: the hidden tabs' messages are not shown. */
function shownMessage() {
  const messages = within(panel())
    .queryAllByText('No transactions yet')
    .filter((element) => element.closest('[aria-hidden="true"]') === null);
  return messages.length === 0 ? null : messages.map((element) => element.textContent).join();
}

// T10: loading, error and a failed refetch (AC11; #6, #88, #89, #105 a).
describe('the Recent Transaction card states', () => {
  it('shows the tabs and the skeleton while the transactions load, with the other sections in place', async () => {
    await openOverview(recentTransactions.pending());

    await waitFor(() => expect(panel().querySelector('[aria-busy="true"]')).not.toBeNull());
    expect(within(tablist()).getAllByRole('tab')).toHaveLength(3);
    expect(tab('All')).toHaveAttribute('aria-selected', 'true');
    expect(within(recent()).queryByRole('list')).toBeNull();
    expect(screen.getByRole('region', { name: 'Total Balance' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Upcoming Bill' })).toBeInTheDocument();
  });

  it('shows the error state in the panel after the request and its 3 retries fail, and Retry loads the rows', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await openOverview(recentTransactions.fails());

    await vi.advanceTimersByTimeAsync(30_000);

    expect(count(recentPath)).toBe(4);
    expect(within(panel()).getByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(within(recent()).queryByRole('list')).toBeNull();
    expect(within(tablist()).getAllByRole('tab')).toHaveLength(3);
    expect(await screen.findByText('$130,254.67')).toBeInTheDocument();

    // Retry follows the panel in the Tab order.
    panel().focus();
    await user.tab();
    expect(within(panel()).getByRole('button', { name: 'Retry' })).toHaveFocus();

    server.use(recentTransactions.answers());
    await user.click(within(panel()).getByRole('button', { name: 'Retry' }));

    expect(await list()).toBeInTheDocument();
    expect(rows().map(rowSummary)).toEqual(firstLoginAll);
    expect(within(recent()).queryByRole('alert')).toBeNull();
  });

  it('keeps the rows, with no message, when a later refetch fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openOverview();
    await list();
    server.use(recentTransactions.fails());
    const before = count(recentPath);

    refocusWindow();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(count(recentPath) - before).toBe(4);
    expect(rows().map(rowSummary)).toEqual(firstLoginAll);
    expect(within(recent()).queryByRole('alert')).toBeNull();
  });
});

// T11: AC12, the frontend selects the tab's list and formats it; it filters, sorts and calculates nothing (#11, #40).
describe('the Recent Transaction sources', () => {
  const files = [
    'components/RecentTransaction/RecentTransaction.tsx',
    'components/RecentTransactionItem/RecentTransactionItem.tsx',
    'api/transactions.ts',
  ];
  const calculating =
    /\bcents\b|Math\.|\bDate\b|getTime|parseInt|parseFloat|Number\(|\.(filter|sort|toSorted|reduce|slice|splice|reverse|toReversed)\(|\boccurredAt\s*[-+*/<>]/;

  it('never calculates with cents or dates, and never filters or sorts the rows', () => {
    expect(files.filter((file) => calculating.test(source(file)))).toEqual([]);
  });

  it('formats with the shared formatters in the browser’s zone and selects the list by the tab', () => {
    const item = source('components/RecentTransactionItem/RecentTransactionItem.tsx');
    const card = source('components/RecentTransaction/RecentTransaction.tsx');

    expect(item).toMatch(/\bformatSignedMoney\(transaction\.amount, transaction\.direction\)/);
    expect(item).toMatch(/\bformatDate\(transaction\.occurredAt, browserTimeZone\(\)\)/);
    expect(card).toMatch(/\bdata\[tab\.value\]/);
  });

  it.each([
    ['const total = row.amount.cents * 2;', true],
    ['const day = new Date(row.occurredAt);', true],
    ['data.all.filter((row) => row.direction === "income")', true],
    ['rows.toSorted(byDate)', true],
    ['data.all.slice(0, 5)', true],
    ['formatDate(transaction.occurredAt, browserTimeZone())', false],
    ['formatSignedMoney(transaction.amount, transaction.direction)', false],
  ])('the calculation check on %s: %s', (code, flagged) => {
    expect(calculating.test(code)).toBe(flagged);
  });
});
