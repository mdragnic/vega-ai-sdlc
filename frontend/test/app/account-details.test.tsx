import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { focusManager, onlineManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import historyItemStyles from '../../src/components/TransactionsHistoryItem/TransactionsHistoryItem.module.css';
import {
  accountDetails,
  accountHistory,
  dataStateRootIn,
  demoCheckingHistoryPage1,
  demoHistoryCursors,
  demoHistoryPages,
  endingHistoryPages,
  fewHistoryPages,
  me,
  noHistoryPages,
  renderApp,
  signedInDefaults,
  tenHistoryPages,
  today,
} from '../support/app';

const server = setupServer(...signedInDefaults());

/** Every request under `/api/accounts/` sent: its path, its cursor (null for none) and its zone. */
let accountRequests: { path: string; cursor: string | null; zone: string | null }[] = [];

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  accountRequests = [];
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/accounts/')) return;
    accountRequests.push({
      path: url.pathname,
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

/** How many requests asked for Checking's page 2. */
const page2Requests = () => accountRequests.filter(({ cursor }) => cursor === demoHistoryCursors.checkingPage2).length;

/**
 * Account Details at `path` signed in, with `handlers` first (the demo by default), once its first section shows. In
 * StrictMode, as the app runs in development and e2e: effects and ref cleanups run twice on mount.
 */
async function openAccount(path = '/balances/2', ...handlers: Parameters<typeof server.use>) {
  server.use(me.signedIn(), today.answers(), ...handlers);
  const view = renderApp(path, undefined, { strict: true });
  await screen.findByRole('region', { name: 'Account Details' });
  return view;
}

const detailsRegion = () => screen.getByRole('region', { name: 'Account Details' });
const historyRegion = () => screen.getByRole('region', { name: 'Transactions History' });
/** Waits until the history shows its table. */
const table = () => within(historyRegion()).findByRole('table');
/** The body rows, in the order shown. */
const bodyRows = async () => within(within(await table()).getAllByRole('rowgroup')[1]!).getAllByRole('row');
const loadMore = () => within(historyRegion()).getByRole('button', { name: 'Load More' });
const queryLoadMore = () => within(historyRegion()).queryByRole('button', { name: 'Load More' });
const sidebar = () => screen.getByRole('navigation', { name: 'Main' });
const search = () => screen.getByRole('searchbox', { name: 'Search' });
const currentLinks = () =>
  within(sidebar())
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.textContent);

/** Each label of the details card with its value, in reading order. */
async function detailsReadOut() {
  const terms = await within(detailsRegion()).findAllByRole('term');
  const definitions = within(detailsRegion()).getAllByRole('definition');
  return terms.map((term, index) => [term.textContent, definitions[index]!.textContent]);
}

/** A row as the table shows it: each cell's text. */
const rowSummary = (row: HTMLElement) =>
  within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent);
const summaries = async () => (await bodyRows()).map(rowSummary);

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

/** Checking's details as shown (AC2): each label read before its value. */
const checkingReadOut = [
  ['Bank Name', 'AB Bank Ltd'],
  ['Account Type', 'Checking'],
  ['Balance', '$33,362.48'],
  ['Branch Name', 'Park Street Branch'],
  ['Account Number', '**** **** **** 7310'],
];

type Summary = [date: string, status: string, type: string, receipt: string, amount: string];

/** Checking's first page as shown (AC4). */
const checkingPage1: Summary[] = [
  ['22 Oct, 2026', 'Complete', 'Debit', 'z7YBsODpLNW', '-$266.00'],
  ['18 Oct, 2026', 'Complete', 'Debit', 'nPcvc24YHB7', '-$147.84'],
  ['17 Oct, 2026', 'Complete', 'Credit', 'SVqWhlvmJqw', '+$179.20'],
  ['15 Oct, 2026', 'Complete', 'Debit', '5vSKgU8NCTh', '-$322.00'],
  ['14 Oct, 2026', 'Complete', 'Debit', '93i3nSBYFAa', '-$20.16'],
  ['12 Oct, 2026', 'Complete', 'Debit', 'UYdw2FRyetE', '-$58.80'],
  ['11 Oct, 2026', 'Complete', 'Debit', 'UK5fQ9kfUyy', '-$31.92'],
  ['10 Oct, 2026', 'Complete', 'Credit', 'IhN8Byqe5aj', '+$179.20'],
  ['7 Oct, 2026', 'Complete', 'Debit', 'nPAdhi6fo6A', '-$21.28'],
  ['4 Oct, 2026', 'Complete', 'Debit', 'CrSNatgkImu', '-$283.36'],
];
/** Checking's second page as shown (AC6): the Freelance payment of 3 Oct first. */
const checkingPage2: Summary[] = [
  ['3 Oct, 2026', 'Complete', 'Credit', 'gceoLfSMg8H', '+$179.20'],
  ['1 Oct, 2026', 'Complete', 'Debit', 'dR9mGBqImes', '-$231.84'],
  ['1 Oct, 2026', 'Complete', 'Credit', 'tCVmvauhOp2', '+$784.00'],
  ['27 Sep, 2026', 'Complete', 'Debit', 'WQNNoDFvLkW', '-$22.40'],
  ['24 Sep, 2026', 'Complete', 'Debit', 'IIi2wjhROnv', '-$26.88'],
  ['24 Sep, 2026', 'Complete', 'Credit', 'RlP3QuUPF9n', '+$179.20'],
  ['22 Sep, 2026', 'Complete', 'Debit', 'kuti5FrFrA5', '-$223.44'],
  ['18 Sep, 2026', 'Complete', 'Debit', 'WRVovyTJFmc', '-$127.68'],
  ['17 Sep, 2026', 'Complete', 'Credit', 'ryXZj7Rr9EP', '+$179.20'],
  ['15 Sep, 2026', 'Complete', 'Debit', 'R8TepGymZJI', '-$270.48'],
];

/**
 * Texts of an account that must never show for a not-found account (AC13): the labels, values and rows only Account
 * Details would add, never Balances, whose cards repeat the Bank Name, the number and the balance.
 */
const accountTexts = [
  'Park Street Branch',
  'Bank Name',
  'Branch Name',
  'Edit Details',
  'z7YBsODpLNW',
  'Complete',
  'Debit',
];

/** Records every text added under `document.body` from now on, until `stop` is called. */
function recordAddedText() {
  const texts: string[] = [];
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) texts.push(node.textContent ?? '');
      if (mutation.type === 'characterData') texts.push(mutation.target.textContent ?? '');
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return {
    texts,
    stop: () => {
      for (const mutation of observer.takeRecords()) {
        for (const node of mutation.addedNodes) texts.push(node.textContent ?? '');
      }
      observer.disconnect();
    },
  };
}

/** A backend of the demo that answers first pages at once and holds every Load More until `release` is called. */
function heldLoadMore(pages = demoHistoryPages) {
  let release!: () => void;
  const released = new Promise<void>((done) => {
    release = done;
  });
  const handler = http.get('*/api/accounts/:accountId/transactions', async ({ params, request }) => {
    const accountPages = pages[Number(params.accountId)]!;
    const cursor = new URL(request.url).searchParams.get('cursor');
    if (cursor === null) return HttpResponse.json(accountPages[0]);
    await released;
    return HttpResponse.json(
      accountPages.find((_, index) => index > 0 && accountPages[index - 1]!.nextCursor === cursor),
    );
  });
  return { handler, release };
}

// T15: AC1, AC2, AC4, AC15 and AC16, Checking with the demo data (#10, #11, #19, #25, #27, #47, #57).
describe('Account Details', () => {
  it('shows the two regions, Balances active, the date and no greeting', async () => {
    await openAccount();

    expect(within(detailsRegion()).getByRole('heading', { level: 2, name: 'Account Details' })).toBeInTheDocument();
    expect(
      within(historyRegion()).getByRole('heading', { level: 2, name: 'Transactions History' }),
    ).toBeInTheDocument();
    expect(currentLinks()).toEqual(['Balances']);
    expect(await within(screen.getByRole('banner')).findByText('22 Oct, 2026')).toBeInTheDocument();
    expect(screen.queryByText(/Hello/)).toBeNull();
  });

  it('shows Checking’s five values as a description list, each label read before its value', async () => {
    await openAccount();

    expect(await detailsReadOut()).toEqual(checkingReadOut);
  });

  it('shows the Credit Card’s values at /balances/1', async () => {
    await openAccount('/balances/1');

    expect(await detailsReadOut()).toEqual([
      ['Bank Name', 'Master Card'],
      ['Account Type', 'Credit Card'],
      ['Balance', '$21,019.18'],
      ['Branch Name', 'Main Branch'],
      ['Account Number', '**** **** **** 2598'],
    ]);
  });

  it('draws "Edit Details" and "Remove" visual only: inert, hidden from assistive technology, no button or link', async () => {
    await openAccount();
    await detailsReadOut();

    for (const text of ['Edit Details', 'Remove']) {
      const element = within(detailsRegion()).getByText(text);
      expect(element.closest('[aria-hidden="true"]')).not.toBeNull();
      expect(element.closest('[inert]')).not.toBeNull();
      expect(element.closest('button, a, [tabindex], [role="button"]')).toBeNull();
      expect(screen.queryByRole('button', { name: text, hidden: true })).toBeNull();
    }
  });

  it('shows the table with its five column headers and Checking’s 10 rows in the order sent, and "Load More"', async () => {
    await openAccount();
    const shown = await table();

    expect(shown).toHaveAccessibleName('Transactions History');
    expect(
      within(shown)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Date', 'Status', 'Transaction Type', 'Receipt', 'Amount']);
    expect(await summaries()).toEqual(checkingPage1);
    expect(loadMore()).toBeInTheDocument();
  });

  it('gives each date as a time element with the occurredAt value, the receipt as text, a divider under every row but the last', async () => {
    await openAccount();
    const rows = await bodyRows();

    expect(rows.map((row) => row.querySelector('time')?.getAttribute('datetime'))).toEqual(
      demoCheckingHistoryPage1.transactions.map((row) => row.occurredAt),
    );
    expect(within(await table()).queryAllByRole('link')).toEqual([]);
    expect(rows.map((row) => row.classList.contains(historyItemStyles.divided!))).toEqual([
      ...Array.from({ length: 9 }, () => true),
      false,
    ]);
  });

  it('lists the Credit Card’s Failed Pizza fifth, like a Complete row', async () => {
    await openAccount('/balances/1');

    expect((await summaries())[4]).toEqual(['16 Oct, 2026', 'Failed', 'Debit', 'CFP5E9VV2Fn', '-$24.64']);
  });

  it('has no back or breadcrumb control: nothing in the content is a link, its only button is "Load More"', async () => {
    await openAccount();
    await table();
    const main = screen.getByRole('main');

    expect(within(main).queryAllByRole('link', { hidden: true })).toEqual([]);
    expect(
      within(main)
        .getAllByRole('button', { hidden: true })
        .map((button) => button.textContent),
    ).toEqual(['Load More']);
  });

  it('asks for the details and the first page once each, with no cursor and the browser’s zone', async () => {
    mockBrowserTimeZone('Europe/Belgrade');
    await openAccount();
    await table();
    await detailsReadOut();

    expect(accountRequests).toEqual([
      { path: '/api/accounts/2', cursor: null, zone: 'Europe/Belgrade' },
      { path: '/api/accounts/2/transactions', cursor: null, zone: 'Europe/Belgrade' },
    ]);
  });
});

// T16: AC3, AC15 and AC16, the visual-only parts and the Tab order (#23, #26, #87).
describe('the Account Details visual-only parts and keyboard', () => {
  it.each(['Edit Details', 'Remove'])('does nothing on a click on "%s"', async (text) => {
    const { user, url } = await openAccount();
    await table();
    const focused = document.activeElement;
    const before = accountRequests.length;

    await user.click(within(detailsRegion()).getByText(text));

    expect(url()).toBe('/balances/2');
    expect(document.activeElement).toBe(focused);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(accountRequests).toHaveLength(before);
    expect(await detailsReadOut()).toEqual(checkingReadOut);
  });

  it('tabs from the search field to "Load More", then out of the content; Shift+Tab goes back', async () => {
    const { user } = await openAccount();
    await table();
    const main = screen.getByRole('main');

    search().focus();
    await user.tab();
    expect(loadMore()).toHaveFocus();
    await user.tab();
    expect(main.contains(document.activeElement)).toBe(false);

    loadMore().focus();
    await user.tab({ shift: true });
    expect(search()).toHaveFocus();
  });
});

// T17: AC13 (Marko's addition 2), the frontend route: an ID outside the strict rule, or a 404, opens Balances (#39).
describe('the Account Details route', () => {
  it.each([
    '/balances/abc',
    '/balances/0',
    '/balances/01',
    '/balances/1e3',
    '/balances/-1',
    '/balances/1.0',
    '/balances/12abc',
    '/balances/%20',
    '/balances/9007199254740992',
  ])('opens Balances for %s, replacing it in the history, with no account request', async (path) => {
    server.use(me.signedIn(), today.answers());
    const recorder = recordAddedText();
    const { url, router } = renderApp(path, undefined, { strict: true });

    expect(await screen.findByRole('region', { name: 'Balances' })).toBeInTheDocument();
    recorder.stop();
    expect(url()).toBe('/balances');
    expect(router.state.historyAction).toBe('REPLACE');
    expect(currentLinks()).toEqual(['Balances']);
    expect(accountRequests).toEqual([]);
    expect(screen.queryByRole('region', { name: 'Account Details' })).toBeNull();
  });

  it.each(['/balances/', '/balances//'])('shows Balances for %s with no account request', async (path) => {
    server.use(me.signedIn(), today.answers());
    renderApp(path, undefined, { strict: true });

    expect(await screen.findByRole('region', { name: 'Balances' })).toBeInTheDocument();
    expect(accountRequests).toEqual([]);
  });

  it.each([
    ['an unknown ID', '/balances/999', []],
    ['the largest safe integer', '/balances/9007199254740991', []],
    ['a demo account whose history answers 404', '/balances/2', [accountHistory.notFound()]],
    ['a demo account whose details answer 404', '/balances/2', [accountDetails.notFound()]],
  ])(
    'opens Balances for %s after its 404, never showing a value, asking once (no retry)',
    async (_case, path, handlers) => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      server.use(me.signedIn(), today.answers(), ...handlers);
      const recorder = recordAddedText();
      const { url, router } = renderApp(path, undefined, { strict: true });

      expect(await screen.findByRole('region', { name: 'Balances' })).toBeInTheDocument();
      await vi.advanceTimersByTimeAsync(30_000);
      recorder.stop();

      expect(url()).toBe('/balances');
      expect(router.state.historyAction).toBe('REPLACE');
      const id = path.slice('/balances/'.length);
      expect(accountRequests.filter((request) => request.path === `/api/accounts/${id}`)).toHaveLength(1);
      expect(
        accountRequests.filter((request) => request.path === `/api/accounts/${id}/transactions`).length,
      ).toBeLessThanOrEqual(1);
      const added = recorder.texts.join('\n');
      for (const text of accountTexts) expect(added).not.toContain(text);
    },
  );
});

// T18: AC6, AC16 and AC17, "Load More" (#6, #27, #117 a and b, #118 a).
describe('the history’s "Load More"', () => {
  it('shows the loading look while the next page loads, asks once for page 1’s cursor, then adds page 2', async () => {
    const held = heldLoadMore();
    const { user } = await openAccount('/balances/2', held.handler);
    await table();

    await user.click(loadMore());

    await waitFor(() => expect(loadMore()).toHaveAttribute('aria-busy', 'true'));
    expect(loadMore()).toHaveAttribute('aria-disabled', 'true');
    expect(within(loadMore()).getByTestId('spinner')).toBeInTheDocument();
    expect(loadMore()).toHaveAccessibleName('Load More');
    await user.click(loadMore());
    const history = accountRequests.filter((request) => request.path === '/api/accounts/2/transactions');
    expect(history.map(({ cursor }) => cursor)).toEqual([null, demoHistoryCursors.checkingPage2]);

    held.release();

    await waitFor(async () => expect(await bodyRows()).toHaveLength(20));
    expect(await summaries()).toEqual([...checkingPage1, ...checkingPage2]);
    expect(loadMore()).not.toHaveAttribute('aria-busy');
  });

  it('moves focus to the first new row, focusable by script only, and Tab from it reaches "Load More"', async () => {
    const { user } = await openAccount();
    await table();
    loadMore().focus();

    await user.keyboard('{Enter}');

    await waitFor(async () => expect((await bodyRows())[10]).toHaveFocus());
    const rows = await bodyRows();
    expect(rows[10]).toHaveAttribute('tabindex', '-1');
    expect(rows.filter((row) => row.hasAttribute('tabindex'))).toEqual([rows[10]]);
    expect(rowSummary(rows[10]!)).toEqual(checkingPage2[0]);
    await user.tab();
    expect(loadMore()).toHaveFocus();
  });

  it('leaves focus where the user moved it while the next page loaded (#118 a)', async () => {
    const held = heldLoadMore();
    const { user } = await openAccount('/balances/2', held.handler);
    await table();
    await user.click(loadMore());
    await waitFor(() => expect(loadMore()).toHaveAttribute('aria-busy', 'true'));
    search().focus();

    held.release();

    await waitFor(async () => expect(await bodyRows()).toHaveLength(20));
    expect(search()).toHaveFocus();
  });

  it('hides "Load More" when the last page arrives, focus on its first row, never the page body', async () => {
    const { user } = await openAccount('/balances/2', accountHistory.answers(endingHistoryPages));
    await table();
    await user.click(loadMore());
    await waitFor(async () => expect(await bodyRows()).toHaveLength(20));

    await user.click(loadMore());

    await waitFor(async () => expect(await bodyRows()).toHaveLength(22));
    expect(queryLoadMore()).toBeNull();
    expect((await bodyRows())[20]).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
    expect((await summaries()).slice(20)).toEqual([
      ['12 Sep, 2026', 'Complete', 'Debit', 'LastRow0001', '-$58.80'],
      ['10 Sep, 2026', 'Pending', 'Debit', 'LastRow0002', '-$31.92'],
    ]);
  });

  it('keeps the rows on a failed Load More, the message above the button in a status region, then adds the page once', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await openAccount('/balances/2', accountHistory.loadMoreFailsThenAnswers());
    await table();
    loadMore().focus();

    await user.keyboard('{Enter}');
    await vi.advanceTimersByTimeAsync(30_000);

    expect(page2Requests()).toBe(4);
    expect(await summaries()).toEqual(checkingPage1);
    const status = within(historyRegion()).getByRole('status');
    expect(status).toHaveTextContent('Something went wrong.');
    expect(status.compareDocumentPosition(loadMore()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(loadMore()).toHaveFocus();

    await user.keyboard('{Enter}');

    await waitFor(async () => expect(await bodyRows()).toHaveLength(20));
    expect(await summaries()).toEqual([...checkingPage1, ...checkingPage2]);
    expect(within(historyRegion()).queryByText('Something went wrong.')).toBeNull();
    expect(page2Requests()).toBe(5);
  });
});

// T19: AC4 and AC17, the states and the dates in the browser's zone (#6, #11, #54, #88, #89, #114, #117 c).
describe('the Account Details states', () => {
  it('shows both skeletons, busy, while the requests run', async () => {
    await openAccount('/balances/2', accountDetails.pending(), accountHistory.pending());

    const busy = screen.getByRole('main').querySelectorAll('[aria-busy="true"]');
    expect(busy).toHaveLength(2);
    expect(within(detailsRegion()).queryByRole('term')).toBeNull();
    expect(within(historyRegion()).queryByRole('table')).toBeNull();
    expect(queryLoadMore()).toBeNull();
  });

  it.each([
    ['the details', () => accountDetails.failsThenAnswers(), detailsRegion, historyRegion],
    ['the history', () => accountHistory.failsThenAnswers(), historyRegion, detailsRegion],
  ])(
    'shows the error state in %s card only after its retries, the other card working, and Retry loads it',
    async (_case, failing, failingRegion, otherRegion) => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { user } = await openAccount('/balances/2', failing());

      await vi.advanceTimersByTimeAsync(30_000);

      expect(within(failingRegion()).getByRole('alert')).toHaveTextContent('Something went wrong.');
      expect(within(otherRegion()).queryByRole('alert')).toBeNull();
      expect(
        within(otherRegion()).queryAllByRole('term').length + within(otherRegion()).queryAllByRole('table').length,
      ).toBeGreaterThan(0);

      await user.click(within(failingRegion()).getByRole('button', { name: 'Retry' }));

      await waitFor(() => expect(within(failingRegion()).queryByRole('alert')).toBeNull());
      expect(await detailsReadOut()).toEqual(checkingReadOut);
      expect(await summaries()).toEqual(checkingPage1);
    },
  );

  // Task 021 code review: the other card keeps working while one card asks again (AC17), so a request that starts again
  // with no data never sends the shown card back to its skeleton or drops its focus.
  it('keeps the history and focus on "Load More" while a Retry of the failed details is still running', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await openAccount('/balances/2', accountDetails.fails());
    await vi.advanceTimersByTimeAsync(30_000);
    expect(within(detailsRegion()).getByRole('alert')).toBeInTheDocument();
    await table();
    server.use(accountDetails.pending());

    await user.click(within(detailsRegion()).getByRole('button', { name: 'Retry' }));
    loadMore().focus();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(await summaries()).toEqual(checkingPage1);
    expect(loadMore()).toHaveFocus();
    expect(within(historyRegion()).queryByRole('table', { hidden: true })).not.toBeNull();
  });

  it('keeps the history and focus when the window gets focus back while the details are in their error state', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openAccount('/balances/2', accountDetails.fails());
    await vi.advanceTimersByTimeAsync(30_000);
    await table();
    loadMore().focus();
    server.use(accountDetails.pending());

    refocusWindow();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(await summaries()).toEqual(checkingPage1);
    expect(loadMore()).toHaveFocus();
  });

  it('shows the history while the details are still between their retries', async () => {
    await openAccount('/balances/2', accountDetails.fails());

    // Within the first retry's delay, long before the 3 retries are over: the history's first answer is in, and the
    // details' first try failed, so it is no 404.
    expect(await summaries()).toEqual(checkingPage1);
    expect(within(detailsRegion()).queryByRole('alert')).toBeNull();
  });

  it.each([
    ['the details', () => accountDetails.failsThenAnswers(), detailsRegion],
    ['the history', () => accountHistory.failsThenAnswers(), historyRegion],
  ])('keeps focus in %s card on a keyboard Retry, never the page body (#114)', async (_case, failing, region) => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await openAccount('/balances/2', failing());
    await vi.advanceTimersByTimeAsync(30_000);
    within(region()).getByRole('button', { name: 'Retry' }).focus();

    await user.keyboard('{Enter}');

    await waitFor(() => expect(within(region()).queryByRole('alert')).toBeNull());
    expect(dataStateRootIn(region())).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
  });

  it('keeps the details and the rows, with no message, when a later refetch fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openAccount();
    await table();
    await detailsReadOut();
    server.use(accountDetails.fails(), accountHistory.fails());

    refocusWindow();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(await detailsReadOut()).toEqual(checkingReadOut);
    expect(await summaries()).toEqual(checkingPage1);
    expect(screen.getByRole('main').querySelectorAll('[role="alert"]')).toHaveLength(0);
  });

  it('shows "No transactions yet" with no table and no "Load More" when there are none', async () => {
    await openAccount('/balances/2', accountHistory.answers(noHistoryPages));

    expect(await within(historyRegion()).findByText('No transactions yet')).toBeInTheDocument();
    expect(within(historyRegion()).queryByRole('table')).toBeNull();
    expect(queryLoadMore()).toBeNull();
  });

  it.each([
    ['3 rows', fewHistoryPages, 3],
    ['exactly 10 rows', tenHistoryPages, 10],
  ])('shows %s with no cursor and no "Load More"', async (_case, pages, count) => {
    await openAccount('/balances/2', accountHistory.answers(pages));

    expect(await bodyRows()).toHaveLength(count);
    expect(queryLoadMore()).toBeNull();
  });

  it.each([
    ['Europe/Belgrade', '23 Oct, 2026'],
    ['America/New_York', '22 Oct, 2026'],
  ])('shows a row at 2026-10-22T23:30:00Z in %s on %s', async (zone, date) => {
    mockBrowserTimeZone(zone);
    const late = {
      ...demoHistoryPages,
      2: [
        {
          transactions: [{ ...demoCheckingHistoryPage1.transactions[0]!, occurredAt: '2026-10-22T23:30:00.000Z' }],
          nextCursor: null,
        },
      ],
    };
    await openAccount('/balances/2', accountHistory.answers(late));

    expect((await summaries())[0]![0]).toBe(date);
    expect(accountRequests[0]!.zone).toBe(zone);
  });

  it('opens on the first 10 again after "Load More" and a visit elsewhere (#117 c)', async () => {
    const { user, router } = await openAccount();
    await table();
    await user.click(loadMore());
    await waitFor(async () => expect(await bodyRows()).toHaveLength(20));

    await act(() => router.navigate('/overview'));
    await act(() => router.navigate('/balances/2'));

    expect(await summaries()).toEqual(checkingPage1);
  });
});

/** A frontend source file's text, by its path under `frontend/src`. */
const srcDir = resolve(import.meta.dirname, '../../src');
const source = (path: string) => readFileSync(join(srcDir, path), 'utf8');

// T20: AC18, the frontend shows the data as sent and only formats it (#11, #19, #25, #74).
describe('the Account Details sources', () => {
  const files = [
    'app/pages/AccountDetailsPage.tsx',
    'components/AccountDetailsCard/AccountDetailsCard.tsx',
    'components/TransactionsHistoryTable/TransactionsHistoryTable.tsx',
    'components/TransactionsHistoryItem/TransactionsHistoryItem.tsx',
  ];
  // Task 020's guard: no arithmetic on cents or dates, no sort, filter, reduce or slice of rows.
  const calculating =
    /\bcents\b|Math\.|new Date|\bDate\.|getTime|parseInt|parseFloat|Number\(|toFixed|toLocaleString|Intl\.|\.(filter|sort|toSorted|reduce|slice|splice|reverse|toReversed)\(|\boccurredAt\s*[-+*/<>]/;

  it.each(files)('%s sorts, filters, counts and calculates nothing', (file) => {
    expect(source(file)).not.toMatch(calculating);
  });

  it('formats only through the shared formatters, the date in the browser’s zone', () => {
    const card = source('components/AccountDetailsCard/AccountDetailsCard.tsx');
    const item = source('components/TransactionsHistoryItem/TransactionsHistoryItem.tsx');

    expect(card).toMatch(/accountTypeLabel\(/);
    expect(card).toMatch(/formatMoney\(/);
    expect(card).toMatch(/\.maskedNumber\}/);
    expect(item).toMatch(/formatSignedMoney\(/);
    expect(item).toMatch(/formatDate\([^)]*browserTimeZone\(\)\)/);
    expect(item).toMatch(/transactionStatusLabel\(/);
    expect(item).toMatch(/transactionTypeLabel\(/);
    expect(item).toMatch(/\.receipt\}/);
  });

  it('parses the route’s account ID with the shared schema before any request', () => {
    const page = source('app/pages/AccountDetailsPage.tsx');

    expect(page).toMatch(/accountIdSchema\.safeParse\(/);
    expect(page).not.toMatch(/parseInt|Number\(/);
  });
});
