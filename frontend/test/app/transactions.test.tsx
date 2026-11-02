import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { TransactionsPage } from '@finebank/shared';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import itemStyles from '../../src/components/TransactionItem/TransactionItem.module.css';
import {
  dataStateRootIn,
  demoAllPage1,
  demoCursors,
  demoRevenuePage1,
  demoTransactionPages,
  endingTransactionPages,
  fewTransactionPages,
  me,
  noTransactionPages,
  renderApp,
  signedInDefaults,
  tenTransactionPages,
  today,
  transactions,
} from '../support/app';

const server = setupServer(...signedInDefaults());

/** Every `GET /api/transactions` sent: its tab, its cursor (null for none) and its zone. */
let pageRequests: { tab: string | null; cursor: string | null; zone: string | null }[] = [];

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  pageRequests = [];
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname !== '/api/transactions') return;
    pageRequests.push({
      tab: url.searchParams.get('tab'),
      cursor: url.searchParams.get('cursor'),
      zone: request.headers.get('x-time-zone'),
    });
  });
});
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
  vi.useRealTimers();
  vi.restoreAllMocks();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
});
afterAll(() => server.close());

/**
 * Transactions signed in, with `handlers` first (the demo pages by default), once the section shows. In StrictMode, as
 * the app runs in development and e2e: effects and ref cleanups run twice on mount (the focus and cache logic).
 */
async function openTransactions(...handlers: Parameters<typeof server.use>) {
  server.use(me.signedIn(), today.answers(), ...handlers);
  const view = renderApp('/transactions', undefined, { strict: true });
  await screen.findByRole('region', { name: 'Recent Transaction' });
  return view;
}

const section = () => screen.getByRole('region', { name: 'Recent Transaction' });
const tablist = () => within(section()).getByRole('tablist', { name: 'Recent Transaction' });
const tab = (name: 'All' | 'Revenue' | 'Expenses') => within(tablist()).getByRole('tab', { name });
const panel = () => within(section()).getByRole('tabpanel');
/** Waits until the panel shows its table. */
const table = () => within(panel()).findByRole('table');
/** The body rows, in the order shown. */
const bodyRows = async () => within(within(await table()).getAllByRole('rowgroup')[1]!).getAllByRole('row');
const loadMore = () => within(panel()).getByRole('button', { name: 'Load More' });
const queryLoadMore = () => within(panel()).queryByRole('button', { name: 'Load More' });
const sidebar = () => screen.getByRole('navigation', { name: 'Main' });
const search = () => screen.getByRole('searchbox', { name: 'Search' });

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

/** A row as the table shows it: the icon's name, then each cell's text. */
const rowSummary = (row: HTMLElement) => [
  within(row).getByRole('img').getAttribute('aria-label'),
  ...within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent),
];
const summaries = async () => (await bodyRows()).map(rowSummary);

type Summary = [icon: string, item: string, shop: string, date: string, method: string, amount: string];

/** All's first page on 22 Oct 2026 as shown (AC2): the Failed Pizza like a Complete row. */
const allPage1: Summary[] = [
  ['Shopping', 'Jeans', 'Denim House', '22 Oct, 2026', 'Checking', '-$266.00'],
  ['Entertainment', 'Movie ticket', 'Inox', '21 Oct, 2026', 'Credit Card', '-$17.64'],
  ['Food', 'Pizza', 'Pizza Hit', '20 Oct, 2026', 'Credit Card', '-$24.64'],
  ['Transportation', 'Taxi fare', 'Uber', '19 Oct, 2026', 'Credit Card', '-$10.64'],
  ['Food', 'Restaurant bill', 'Spice Garden', '18 Oct, 2026', 'Checking', '-$147.84'],
  ['Entertainment', 'GTR 5', 'Gadget & Gear', '17 Oct, 2026', 'Credit Card', '-$188.16'],
  ['Income', 'Freelance payment', 'Bright Studio', '17 Oct, 2026', 'Checking', '+$179.20'],
  ['Food', 'Pizza', 'Pizza Hit', '16 Oct, 2026', 'Credit Card', '-$24.64'],
  ['Food', 'Biriyani', 'Hajir Biriyani', '16 Oct, 2026', 'Credit Card', '-$14.78'],
  ['Shopping', 'Shirt', 'XL fashions', '15 Oct, 2026', 'Checking', '-$322.00'],
];
/** All's second page (AC4): Dividend first, Metro Card bill last. */
const allPage2: Summary[] = [
  ['Income', 'Dividend', 'AB Bank Ltd', '15 Oct, 2026', 'Investment', '+$84.00'],
  ['Housing', 'Parking', 'City Parking', '14 Oct, 2026', 'Checking', '-$20.16'],
  ['Transportation', 'Taxi fare', 'Uber', '13 Oct, 2026', 'Credit Card', '-$10.64'],
  ['Entertainment', 'iTunes', 'iTunes Store', '12 Oct, 2026', 'Checking', '-$58.80'],
  ['Others', 'Donation', 'City Charity Trust', '11 Oct, 2026', 'Checking', '-$31.92'],
  ['Others', 'Loan installment', 'City Bank Ltd.', '10 Oct, 2026', 'Loan', '-$106.40'],
  ['Income', 'Freelance payment', 'Bright Studio', '10 Oct, 2026', 'Checking', '+$179.20'],
  ['Shopping', 'Keyboard', 'Gadget & Gear', '9 Oct, 2026', 'Credit Card', '-$42.00'],
  ['Food', 'Pizza', 'Pizza Hit', '8 Oct, 2026', 'Credit Card', '-$24.64'],
  ['Transportation', 'Metro Card bill', 'Metro Rail', '7 Oct, 2026', 'Checking', '-$21.28'],
];
const freelance = (date: string): Summary => [
  'Income',
  'Freelance payment',
  'Bright Studio',
  date,
  'Checking',
  '+$179.20',
];
/** Revenue's first page (AC3). */
const revenuePage1: Summary[] = [
  freelance('17 Oct, 2026'),
  ['Income', 'Dividend', 'AB Bank Ltd', '15 Oct, 2026', 'Investment', '+$84.00'],
  freelance('10 Oct, 2026'),
  freelance('3 Oct, 2026'),
  ['Income', 'Design project', 'Acme Ltd.', '1 Oct, 2026', 'Checking', '+$784.00'],
  ['Income', 'Interest', 'Brac Bank Ltd.', '28 Sep, 2026', 'Savings', '+$44.80'],
  ['Income', 'Card repayment', 'AB Bank Ltd', '27 Sep, 2026', 'Credit Card', '+$504.00'],
  freelance('24 Sep, 2026'),
  freelance('17 Sep, 2026'),
  ['Income', 'Dividend', 'AB Bank Ltd', '15 Sep, 2026', 'Investment', '+$84.00'],
];
/** Expenses' first page (AC3): All's without the Freelance payment, then Parking. */
const expensesPage1: Summary[] = [...allPage1.filter((row) => row[0] !== 'Income'), allPage2[1]!];

/** A backend that answers first pages at once and holds every Load More until `release` is called. */
function heldLoadMore(pages = demoTransactionPages) {
  let release!: () => void;
  const released = new Promise<void>((done) => {
    release = done;
  });
  const handler = http.get('*/api/transactions', async ({ request }) => {
    const query = new URL(request.url).searchParams;
    const tabPages = pages[query.get('tab') as keyof typeof pages];
    const cursor = query.get('cursor');
    if (cursor === null) return HttpResponse.json(tabPages[0]);
    await released;
    return HttpResponse.json(tabPages.find((_, index) => index > 0 && tabPages[index - 1]!.nextCursor === cursor));
  });
  return { handler, release };
}

/** One page of All holding a single transaction at 2026-10-22T23:30:00Z (AC9). */
const lateNightPage: TransactionsPage = {
  transactions: [{ ...demoAllPage1.transactions[0]!, occurredAt: '2026-10-22T23:30:00.000Z' }],
  nextCursor: null,
};

// T10: AC1, AC2 and AC16, the first visit with the demo data (#10, #11, #19, #27, #56, #57).
describe('the Transactions page', () => {
  it('shows the title, Transactions active, the date and no greeting, and the tabs with All selected', async () => {
    await openTransactions();

    expect(within(section()).getByRole('heading', { level: 2 })).toHaveTextContent('Recent Transaction');
    const current = within(sidebar())
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.textContent)).toEqual(['Transactions']);
    expect(await within(screen.getByRole('banner')).findByText('22 Oct, 2026')).toBeInTheDocument();
    expect(screen.queryByText(/Hello/)).toBeNull();
    expect(
      within(tablist())
        .getAllByRole('tab')
        .map((element) => element.getAttribute('aria-selected')),
    ).toEqual(['true', 'false', 'false']);
    expect(tab('All')).toHaveAccessibleName('All');
    expect(tab('Revenue')).toHaveAccessibleName('Revenue');
    expect(tab('Expenses')).toHaveAccessibleName('Expenses');
  });

  it('shows All’s 10 rows in the order sent under the five column headers, and "Load More"', async () => {
    await openTransactions();

    const shown = await table();
    expect(shown).toHaveAccessibleName('All');
    expect(
      within(shown)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Items', 'Shop Name', 'Date', 'Payment Method', 'Amount']);
    for (const header of within(shown).getAllByRole('columnheader')) expect(header).toHaveAttribute('scope', 'col');
    expect(await summaries()).toEqual(allPage1);
    expect(loadMore()).toBeInTheDocument();
  });

  it('gives each date as a time element with the occurredAt value, and draws a divider under every row but the last', async () => {
    await openTransactions();

    const rows = await bodyRows();
    expect(rows.map((row) => row.querySelector('time')!.dateTime)).toEqual(
      demoAllPage1.transactions.map((row) => row.occurredAt),
    );
    expect(rows.map((row) => row.classList.contains(itemStyles.divided!))).toEqual([
      ...Array.from({ length: 9 }, () => true),
      false,
    ]);
  });

  it('makes the panel a Tab stop named by the selected tab; nothing in the rows is focusable', async () => {
    await openTransactions();
    await table();

    expect(panel()).toHaveAccessibleName('All');
    expect(panel()).toHaveAttribute('tabindex', '0');
    for (const element of within(tablist()).getAllByRole('tab')) {
      expect(element).toHaveAttribute('aria-controls', panel().id);
    }
    expect([...panel().querySelectorAll('a, button, input, select, textarea, [tabindex]')]).toEqual([loadMore()]);
  });

  // Once, also through StrictMode's second mount (the page's effects run twice).
  it('asks for All’s first page once, with no cursor and the browser’s time zone', async () => {
    await openTransactions();
    await table();

    expect(pageRequests).toEqual([
      { tab: 'all', cursor: null, zone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    ]);
  });

  it('opens from Overview’s Recent Transaction "View All"', async () => {
    server.use(me.signedIn(), today.answers());
    const { user, url } = renderApp('/overview');
    const recentOnOverview = await screen.findByRole('region', { name: 'Recent Transaction' });

    await user.click(within(recentOnOverview).getByRole('link', { name: 'View All' }));

    expect(url()).toBe('/transactions');
    expect(await summaries()).toEqual(allPage1);
    expect(tab('All')).toHaveAttribute('aria-selected', 'true');
  });
});

// T11: AC3 and AC20, the tabs by mouse and keyboard; each tab's own first page (#19, #117 c).
describe('the Transactions tabs', () => {
  it('shows each tab’s first page when clicked, asking for that tab with no cursor', async () => {
    const { user } = await openTransactions();
    await table();

    await user.click(tab('Revenue'));
    expect(tab('Revenue')).toHaveAttribute('aria-selected', 'true');
    expect(tab('All')).toHaveAttribute('aria-selected', 'false');
    expect(panel()).toHaveAccessibleName('Revenue');
    await waitFor(async () => expect(await summaries()).toEqual(revenuePage1));
    expect(await table()).toHaveAccessibleName('Revenue');

    await user.click(tab('Expenses'));
    expect(panel()).toHaveAccessibleName('Expenses');
    await waitFor(async () => expect(await summaries()).toEqual(expensesPage1));

    await user.click(tab('All'));
    await waitFor(async () => expect(await summaries()).toEqual(allPage1));
    expect(pageRequests.map(({ tab: name, cursor }) => [name, cursor])).toEqual([
      ['all', null],
      ['revenue', null],
      ['expenses', null],
      ['all', null],
    ]);
  });

  it('moves the selection with Right and Left, wrapping, and with Home and End', async () => {
    const { user } = await openTransactions();
    await table();
    tab('All').focus();

    await user.keyboard('{ArrowRight}');
    expect(tab('Revenue')).toHaveFocus();
    await waitFor(async () => expect(await summaries()).toEqual(revenuePage1));
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(tab('All')).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowLeft}');
    expect(tab('Expenses')).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(tab('All')).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{End}');
    expect(tab('Expenses')).toHaveAttribute('aria-selected', 'true');
    await waitFor(async () => expect(await summaries()).toEqual(expensesPage1));
    expect(
      within(tablist())
        .getAllByRole('tab')
        .map((element) => element.tabIndex),
    ).toEqual([-1, -1, 0]);
  });

  it('opens at All on every visit', async () => {
    const { user, router } = await openTransactions();
    await user.click(tab('Revenue'));
    await waitFor(async () => expect(await summaries()).toEqual(revenuePage1));

    await act(() => router.navigate('/overview'));
    await act(() => router.navigate('/transactions'));

    expect(tab('All')).toHaveAttribute('aria-selected', 'true');
    expect(await summaries()).toEqual(allPage1);
  });

  it('shows All’s first 10 again after "Load More" on All and a visit to Revenue (#117 c)', async () => {
    const { user } = await openTransactions();
    await table();
    await user.click(loadMore());
    await waitFor(async () => expect(await bodyRows()).toHaveLength(20));

    await user.click(tab('Revenue'));
    await waitFor(async () => expect(await summaries()).toEqual(revenuePage1));
    await user.click(tab('All'));

    expect(await summaries()).toEqual(allPage1);
    await waitFor(() => expect(pageRequests.at(-1)).toMatchObject({ tab: 'all', cursor: null }));
    expect(await summaries()).toEqual(allPage1);
    expect(loadMore()).toBeInTheDocument();
  });

  it('drops All’s later pages when the page closes: the next visit shows its first 10', async () => {
    const { user, router } = await openTransactions();
    await table();
    await user.click(loadMore());
    await waitFor(async () => expect(await bodyRows()).toHaveLength(20));

    await act(() => router.navigate('/overview'));
    await act(() => router.navigate('/transactions'));

    expect(await summaries()).toEqual(allPage1);
  });

  it('drops a Load More paused offline when the tab is left: its page never comes back to All', async () => {
    const { user } = await openTransactions();
    await table();
    act(() => onlineManager.setOnline(false));
    await user.click(loadMore());
    await user.click(tab('Revenue'));

    act(() => onlineManager.setOnline(true));
    await waitFor(async () => expect(await summaries()).toEqual(revenuePage1));
    await user.click(tab('All'));

    await waitFor(() => expect(pageRequests.at(-1)).toMatchObject({ tab: 'all', cursor: null }));
    await waitFor(() => expect(within(panel()).queryByRole('table', { name: 'All' })).not.toBeNull());
    expect(await summaries()).toEqual(allPage1);
    expect(pageRequests.filter(({ cursor }) => cursor !== null)).toEqual([]);
  });

  it('shows a loaded tab at once while a Retry on another tab is still running', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let holdAll = false;
    const { user } = await openTransactions(
      http.get('*/api/transactions', async ({ request }) => {
        if (new URL(request.url).searchParams.get('tab') !== 'all') return HttpResponse.json(demoRevenuePage1);
        if (holdAll) await delay('infinite');
        return HttpResponse.json({ message: 'Internal server error' }, { status: 500 });
      }),
    );
    await vi.advanceTimersByTimeAsync(30_000);
    await user.click(tab('Revenue'));
    await waitFor(async () => expect(await summaries()).toEqual(revenuePage1));
    await user.click(tab('All'));
    await vi.advanceTimersByTimeAsync(30_000);
    holdAll = true;
    await user.click(within(panel()).getByRole('button', { name: 'Retry' }));

    await user.click(tab('Revenue'));

    expect(within(panel()).getByRole('table', { name: 'Revenue' })).toBeInTheDocument();
    expect(await summaries()).toEqual(revenuePage1);
  });

  it('asks for every loaded page again, in turn, when the window gets focus back', async () => {
    const { user } = await openTransactions();
    await table();
    await user.click(loadMore());
    await waitFor(async () => expect(await bodyRows()).toHaveLength(20));
    const before = pageRequests.length;

    refocusWindow();

    await waitFor(() =>
      expect(pageRequests.slice(before).map(({ tab: name, cursor }) => [name, cursor])).toEqual([
        ['all', null],
        ['all', demoCursors.allPage2],
      ]),
    );
    await waitFor(() => expect(loadMore()).not.toHaveAttribute('aria-busy'));
    expect(await summaries()).toEqual([...allPage1, ...allPage2]);
  });

  it('drops a Load More still running when the tab is left: its page never comes back to All', async () => {
    const held = heldLoadMore();
    const { user } = await openTransactions(held.handler);
    await table();
    await user.click(loadMore());
    await waitFor(() => expect(loadMore()).toHaveAttribute('aria-busy', 'true'));

    await user.click(tab('Revenue'));
    await waitFor(async () => expect(await summaries()).toEqual(revenuePage1));
    held.release();
    await user.click(tab('All'));

    await waitFor(() => expect(pageRequests.at(-1)).toMatchObject({ tab: 'all', cursor: null }));
    await waitFor(() => expect(loadMore()).not.toHaveAttribute('aria-busy'));
    expect(await summaries()).toEqual(allPage1);
  });
});

// T12: AC4, AC5 and AC16, "Load More": the loading look, the next page from the cursor, the end, the focus (#6, #27,
// #74, #117 a).
describe('"Load More"', () => {
  it('shows the loading look while the next page loads, asks once for page 1’s cursor, then adds page 2', async () => {
    const held = heldLoadMore();
    const { user } = await openTransactions(held.handler);
    await table();

    await user.click(loadMore());

    await waitFor(() => expect(loadMore()).toHaveAttribute('aria-busy', 'true'));
    expect(loadMore()).toHaveAttribute('aria-disabled', 'true');
    expect(within(loadMore()).getByTestId('spinner')).toBeInTheDocument();
    expect(loadMore()).toHaveAccessibleName('Load More');
    expect(loadMore()).toHaveFocus();
    await user.click(loadMore());
    expect(pageRequests.map(({ tab: name, cursor }) => [name, cursor])).toEqual([
      ['all', null],
      ['all', demoCursors.allPage2],
    ]);
    expect(await bodyRows()).toHaveLength(10);

    held.release();

    await waitFor(async () => expect(await bodyRows()).toHaveLength(20));
    expect(await summaries()).toEqual([...allPage1, ...allPage2]);
    expect(loadMore()).not.toHaveAttribute('aria-busy');
    expect(pageRequests).toHaveLength(2);
  });

  it('moves focus to the first new row, focusable by script only, and Tab from it reaches "Load More" (#117 a)', async () => {
    const { user } = await openTransactions();
    await table();
    loadMore().focus();

    await user.keyboard('{Enter}');

    await waitFor(async () => expect((await bodyRows())[10]).toHaveFocus());
    const rows = await bodyRows();
    expect(rows[10]).toHaveAttribute('tabindex', '-1');
    expect(rows.filter((row) => row.hasAttribute('tabindex'))).toEqual([rows[10]]);
    expect(rowSummary(rows[10]!)).toEqual(allPage2[0]);
    await user.tab();
    expect(loadMore()).toHaveFocus();
  });

  it('leaves focus where the user moved it while the next page loaded', async () => {
    const held = heldLoadMore();
    const { user } = await openTransactions(held.handler);
    await table();
    await user.click(loadMore());
    await waitFor(() => expect(loadMore()).toHaveAttribute('aria-busy', 'true'));
    search().focus();

    held.release();

    await waitFor(async () => expect(await bodyRows()).toHaveLength(20));
    expect(search()).toHaveFocus();
  });

  it('moves focus the same way after a click', async () => {
    const { user } = await openTransactions();
    await table();

    await user.click(loadMore());

    await waitFor(async () => expect((await bodyRows())[10]).toHaveFocus());
  });

  it('hides "Load More" when the last page arrives, focus on its first row, never the page body', async () => {
    const { user } = await openTransactions(transactions.answers(endingTransactionPages));
    await table();
    await user.click(loadMore());
    await waitFor(async () => expect(await bodyRows()).toHaveLength(20));

    await user.click(loadMore());

    await waitFor(async () => expect(await bodyRows()).toHaveLength(22));
    expect(queryLoadMore()).toBeNull();
    const rows = await bodyRows();
    expect(rows[20]).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
    expect((await summaries()).slice(20)).toEqual([
      ['Entertainment', 'Movie ticket', 'Inox', '6 Oct, 2026', 'Credit Card', '-$17.64'],
      ['Food', 'Biriyani', 'Hajir Biriyani', '5 Oct, 2026', 'Credit Card', '-$14.78'],
    ]);
    expect(pageRequests.map(({ cursor }) => cursor)).toEqual([null, demoCursors.allPage2, demoCursors.allPage3]);
  });

  it('draws the divider under every row but the last, across pages', async () => {
    const { user } = await openTransactions();
    await table();

    await user.click(loadMore());

    await waitFor(async () => expect(await bodyRows()).toHaveLength(20));
    expect((await bodyRows()).map((row) => row.classList.contains(itemStyles.divided!))).toEqual([
      ...Array.from({ length: 19 }, () => true),
      false,
    ]);
  });
});

// T13: AC15, a failed "Load More" keeps the rows and asks for the same page again (#88, #117 b).
describe('a failed "Load More"', () => {
  it('keeps the rows, shows the message above the button in a status region, keeps focus, then adds the page once', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await openTransactions(transactions.loadMoreFailsThenAnswers());
    await table();
    loadMore().focus();

    await user.keyboard('{Enter}');
    await vi.advanceTimersByTimeAsync(30_000);

    expect(pageRequests.filter(({ cursor }) => cursor === demoCursors.allPage2)).toHaveLength(4);
    expect(await summaries()).toEqual(allPage1);
    const status = within(panel()).getByRole('status');
    expect(status).toHaveTextContent('Something went wrong.');
    expect(status.compareDocumentPosition(loadMore()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(loadMore()).toHaveFocus();
    expect(loadMore()).not.toHaveAttribute('aria-busy');

    await user.keyboard('{Enter}');

    await waitFor(async () => expect(await bodyRows()).toHaveLength(20));
    expect(await summaries()).toEqual([...allPage1, ...allPage2]);
    expect(within(panel()).queryByText('Something went wrong.')).toBeNull();
    expect(pageRequests.filter(({ cursor }) => cursor === demoCursors.allPage2)).toHaveLength(5);
  });

  it('announces a second failure again: the message is a new node in the status region each time', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await openTransactions(transactions.loadMoreFails());
    await table();
    await user.click(loadMore());
    await vi.advanceTimersByTimeAsync(30_000);
    const status = within(panel()).getByRole('status');
    const first = status.firstElementChild;
    expect(first).toHaveTextContent('Something went wrong.');

    await user.click(loadMore());
    await vi.advanceTimersByTimeAsync(30_000);

    expect(pageRequests.filter(({ cursor }) => cursor === demoCursors.allPage2)).toHaveLength(8);
    expect(status).toHaveTextContent('Something went wrong.');
    expect(status.firstElementChild).not.toBeNull();
    expect(status.firstElementChild).not.toBe(first);
    expect(await summaries()).toEqual(allPage1);
  });

  it('drops the message when the tab changes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await openTransactions(transactions.loadMoreFailsThenAnswers());
    await table();
    await user.click(loadMore());
    await vi.advanceTimersByTimeAsync(30_000);
    expect(within(panel()).getByRole('status')).toHaveTextContent('Something went wrong.');

    await user.click(tab('Revenue'));
    await waitFor(async () => expect(await summaries()).toEqual(revenuePage1));
    expect(within(panel()).queryByText('Something went wrong.')).toBeNull();
    await user.click(tab('All'));

    await waitFor(async () => expect(await summaries()).toEqual(allPage1));
    expect(within(panel()).queryByText('Something went wrong.')).toBeNull();
  });
});

// T14: AC9 and AC14, the states and the dates in the browser's zone (#6, #11, #54, #88, #89, #114).
describe('the Transactions states', () => {
  it('shows the tabs and the skeleton, busy, while the first page loads', async () => {
    await openTransactions(transactions.pending());

    await waitFor(() => expect(panel().querySelector('[aria-busy="true"]')).not.toBeNull());
    expect(within(tablist()).getAllByRole('tab')).toHaveLength(3);
    expect(within(panel()).queryByRole('table')).toBeNull();
    expect(queryLoadMore()).toBeNull();
  });

  it('shows the skeleton after switching to a tab not yet loaded', async () => {
    const { user } = await openTransactions();
    await table();
    server.use(
      http.get('*/api/transactions', async () => {
        await delay('infinite');
        return HttpResponse.json(demoAllPage1);
      }),
    );

    await user.click(tab('Revenue'));

    await waitFor(() => expect(panel().querySelector('[aria-busy="true"]')).not.toBeNull());
    expect(within(panel()).queryByRole('table')).toBeNull();
  });

  it('shows the error state in the card after the first page and its 3 retries fail, and Retry loads the rows', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await openTransactions(transactions.failsThenAnswers());

    await vi.advanceTimersByTimeAsync(30_000);

    expect(pageRequests).toHaveLength(4);
    expect(within(panel()).getByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(within(panel()).queryByRole('table')).toBeNull();
    expect(queryLoadMore()).toBeNull();
    expect(within(tablist()).getAllByRole('tab')).toHaveLength(3);

    await user.click(within(panel()).getByRole('button', { name: 'Retry' }));

    expect(await summaries()).toEqual(allPage1);
    expect(within(panel()).queryByRole('alert')).toBeNull();
  });

  it('keeps focus in the panel on a keyboard Retry, never the page body (#114)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await openTransactions(transactions.failsThenAnswers());
    await vi.advanceTimersByTimeAsync(30_000);
    within(panel()).getByRole('button', { name: 'Retry' }).focus();

    await user.keyboard('{Enter}');

    expect(await table()).toBeInTheDocument();
    expect(dataStateRootIn(panel())).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
  });

  it('keeps the rows, with no message, when a later refetch fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openTransactions();
    await table();
    server.use(transactions.fails());
    const before = pageRequests.length;

    refocusWindow();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(pageRequests.length - before).toBe(4);
    expect(await summaries()).toEqual(allPage1);
    expect(within(panel()).queryByRole('alert')).toBeNull();
    // The Load More status region is there, empty: no message.
    expect(within(panel()).getByRole('status')).toBeEmptyDOMElement();
  });

  it('shows "No transactions yet" in the card with no table and no "Load More" when there are none', async () => {
    await openTransactions(transactions.answers(noTransactionPages));

    expect(await within(panel()).findByText('No transactions yet')).toBeInTheDocument();
    expect(within(panel()).queryByRole('table')).toBeNull();
    expect(queryLoadMore()).toBeNull();
  });

  it.each([
    ['3 rows', fewTransactionPages, 3],
    ['exactly 10 rows', tenTransactionPages, 10],
  ])('shows %s with no cursor and no "Load More"', async (_case, pages, count) => {
    await openTransactions(transactions.answers(pages));

    expect(await bodyRows()).toHaveLength(count);
    expect(queryLoadMore()).toBeNull();
  });

  it.each([
    ['Europe/Belgrade', '23 Oct, 2026'],
    ['America/New_York', '22 Oct, 2026'],
  ])('shows a transaction at 2026-10-22T23:30:00Z in %s on %s', async (zone, date) => {
    mockBrowserTimeZone(zone);
    await openTransactions(transactions.answers({ ...demoTransactionPages, all: [lateNightPage] }));

    expect((await summaries())[0]![3]).toBe(date);
    expect(pageRequests[0]!.zone).toBe(zone);
  });
});

/** A frontend source file's text, by its path under `frontend/src`. */
const srcDir = resolve(import.meta.dirname, '../../src');
const source = (path: string) => readFileSync(join(srcDir, path), 'utf8');

// T15: AC17, the frontend shows the rows as sent and only formats them (#11, #19, #74).
describe('the Transactions sources', () => {
  const files = [
    'app/pages/TransactionsPage.tsx',
    'components/TransactionTable/TransactionTable.tsx',
    'components/TransactionItem/TransactionItem.tsx',
    'api/transactions.ts',
  ];
  // As task 016's guard, with the column header "Date" allowed as text.
  const calculating =
    /\bcents\b|Math\.|new Date|\bDate\.|getTime|parseInt|parseFloat|Number\(|toFixed|toLocaleString|Intl\.|\.(filter|sort|toSorted|reduce|slice|splice|reverse|toReversed)\(|\boccurredAt\s*[-+*/<>]/;

  it.each(files)('%s sorts, filters, slices and calculates nothing', (file) => {
    expect(source(file)).not.toMatch(calculating);
  });

  it.each([
    'const total = row.amount.cents * 2;',
    'rows.toSorted((a, b) => a.occurredAt - b.occurredAt)',
    'rows.filter((row) => row.direction === "income")',
    'new Date(row.occurredAt)',
    'pages.slice(0, 1)',
  ])('flags %s', (code) => {
    expect(code).toMatch(calculating);
  });

  it('formats a row only through the shared formatters, the date in the browser’s zone', () => {
    const item = source('components/TransactionItem/TransactionItem.tsx');

    expect(item).toMatch(/formatSignedMoney\(/);
    expect(item).toMatch(/formatDate\([^)]*browserTimeZone\(\)\)/);
    expect(item).toMatch(/accountTypeLabel\(/);
  });
});

// T16: AC16, the Tab order (#87, #112, #117 a).
describe('the Transactions Tab order', () => {
  it('tabs from the search field to the selected tab, the panel, "Load More" and out; Shift+Tab goes back', async () => {
    const { user } = await openTransactions();
    await table();
    const main = screen.getByRole('main');

    search().focus();
    await user.tab();
    expect(tab('All')).toHaveFocus();
    await user.tab();
    expect(panel()).toHaveFocus();
    await user.tab();
    expect(loadMore()).toHaveFocus();
    await user.tab();
    expect(main.contains(document.activeElement)).toBe(false);

    loadMore().focus();
    await user.tab({ shift: true });
    expect(panel()).toHaveFocus();
    await user.tab({ shift: true });
    expect(tab('All')).toHaveFocus();
    await user.tab({ shift: true });
    expect(search()).toHaveFocus();
  });

  it('tabs from the selected tab to the panel and out when there is no "Load More"', async () => {
    const { user } = await openTransactions(transactions.answers(tenTransactionPages));
    await table();
    const main = screen.getByRole('main');

    tab('All').focus();
    await user.tab();
    expect(panel()).toHaveFocus();
    await user.tab();
    expect(main.contains(document.activeElement)).toBe(false);
  });
});
