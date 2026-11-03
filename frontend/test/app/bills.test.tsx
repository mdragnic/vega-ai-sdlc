import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { focusManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { adobeUrl, figmaUrl } from '../../src/assets/brand';
import itemStyles from '../../src/components/BillItem/BillItem.module.css';
import {
  dataStateRootIn,
  demoBillDescription,
  demoBills,
  longBillNoSpace,
  longBills,
  longBillWords,
  me,
  renderApp,
  signedInDefaults,
  threeBills,
  today,
  upcomingBills,
} from '../support/app';

const server = setupServer(...signedInDefaults());

/** Every request the app sends, as `METHOD /path`, and the zone of each bills request. */
let requests: string[] = [];
let billZones: (string | null)[] = [];

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  requests = [];
  billZones = [];
  server.events.on('request:start', ({ request }) => {
    const { pathname } = new URL(request.url);
    requests.push(`${request.method} ${pathname}`);
    if (pathname === '/api/bills/upcoming') billZones.push(request.headers.get('x-time-zone'));
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
 * Bills signed in, with `handlers` first (the demo bills by default), once the section shows. In StrictMode, as the
 * app runs in development and e2e: effects and ref cleanups run twice on mount.
 */
async function openBills(...handlers: Parameters<typeof server.use>) {
  server.use(me.signedIn(), today.answers(), ...handlers);
  const view = renderApp('/bills', undefined, { strict: true });
  await screen.findByRole('region', { name: 'Upcoming Bills' });
  return view;
}

const section = () => screen.getByRole('region', { name: 'Upcoming Bills' });
/** The white card: the section's element after its title row. */
const card = () => section().lastElementChild as HTMLElement;
/** Waits until the card shows its table. */
const table = () => within(section()).findByRole('table');
/** The body rows, in the order shown. */
const bodyRows = async () => within(within(await table()).getAllByRole('rowgroup')[1]!).getAllByRole('row');
const sidebar = () => screen.getByRole('navigation', { name: 'Main' });
const search = () => screen.getByRole('searchbox', { name: 'Search' });
const billRequests = () => requests.filter((sent) => sent === 'GET /api/bills/upcoming').length;

const refocusWindow = () =>
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });

/** A row as shown: each cell's text. */
const cellTexts = (row: HTMLElement) =>
  within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent);

/** The demo rows of AC3 at the fixed clock, each cell's text: the date box, the logo (no text), the title over its
 * description, the last charge and the amount. */
const demoRows = [
  ['May15', '', `Figma - Yearly Plan${demoBillDescription}`, '14 May, 2026', '$150.00'],
  ['Jun16', '', `Adobe Inc - Yearly Plan${demoBillDescription}`, '17 Jun, 2026', '$559.00'],
  ['May15', '', `Figma - Yearly Plan${demoBillDescription}`, '14 May, 2027', '$150.00'],
  ['Jun16', '', `Adobe Inc - Yearly Plan${demoBillDescription}`, '17 Jun, 2027', '$559.00'],
];

// T6: AC1 to AC4 and AC14, the first visit with the demo data (#10, #11, #28, #41, #88).
describe('the Bills page', () => {
  it('shows the title, Bills active, the date and no greeting', async () => {
    await openBills();

    expect(within(section()).getByRole('heading', { level: 2 })).toHaveTextContent('Upcoming Bills');
    const current = within(sidebar())
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.textContent)).toEqual(['Bills']);
    expect(await within(screen.getByRole('banner')).findByText('22 Oct, 2026')).toBeInTheDocument();
    expect(screen.queryByText(/Hello/)).toBeNull();
  });

  it('shows a table named "Upcoming Bills" with the five column headers', async () => {
    await openBills();

    const shown = await table();
    expect(shown).toHaveAccessibleName('Upcoming Bills');
    const headers = within(shown).getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual([
      'Due Date',
      'Logo',
      'Item Description',
      'Last Charge',
      'Amount',
    ]);
    for (const header of headers) expect(header).toHaveAttribute('scope', 'col');
  });

  it('lists the 4 demo bills in the order sent, the title over its description, not paginated', async () => {
    await openBills();

    const rows = await bodyRows();
    expect(rows.map(cellTexts)).toEqual(demoRows);
    for (const row of rows) {
      const [title, description] = within(row).getAllByRole('paragraph');
      expect(title).toHaveTextContent(/^(Figma|Adobe Inc) - Yearly Plan$/);
      expect(description).toHaveTextContent(demoBillDescription);
    }
    expect(within(section()).queryByRole('button')).toBeNull();
  });

  it('names each logo by its biller, as the exported component’s image', async () => {
    await openBills();

    const logos = (await bodyRows()).map((row) => within(row).getByRole('img'));
    expect(logos.map((logo) => logo.getAttribute('alt'))).toEqual(['Figma', 'Adobe', 'Figma', 'Adobe']);
    expect(logos.map((logo) => logo.getAttribute('src'))).toEqual([figmaUrl, adobeUrl, figmaUrl, adobeUrl]);
  });

  it('gives the due date and the last charge as time elements with their plain dates', async () => {
    await openBills();

    const rows = await bodyRows();
    expect(rows.map((row) => [...row.querySelectorAll('time')].map((time) => time.dateTime))).toEqual(
      demoBills.bills.map((bill) => [bill.dueDate, bill.lastChargeDate]),
    );
  });

  it('draws a divider under every row but the last', async () => {
    await openBills();

    expect((await bodyRows()).map((row) => row.classList.contains(itemStyles.divided!))).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  // Once, also through StrictMode's second mount.
  it('asks for the bills once, with the browser’s time zone', async () => {
    await openBills();
    await table();

    expect(billZones).toEqual([Intl.DateTimeFormat().resolvedOptions().timeZone]);
  });

  it('opens from the sidebar', async () => {
    server.use(me.signedIn(), today.answers());
    const { user, url } = renderApp('/transactions');

    await user.click(
      await within(await screen.findByRole('navigation', { name: 'Main' })).findByRole('link', { name: 'Bills' }),
    );

    expect(url()).toBe('/bills');
    expect((await bodyRows()).map(cellTexts)).toEqual(demoRows);
  });
});

// T7: AC3, AC8 and AC17, other lists: 3, one, none and the long data (#6, #106, #111 b, #115 b).
describe('the number of bills', () => {
  it('shows 3 bills in the order sent', async () => {
    await openBills(upcomingBills.answers(threeBills));

    const rows = await bodyRows();
    expect(rows.map((row) => row.querySelector('time')!.dateTime)).toEqual(['2026-11-01', '2026-12-01', '2027-01-01']);
    expect(rows.map((row) => within(row).getAllByRole('paragraph')[0]!.textContent)).toEqual([
      'First bill',
      'Second bill',
      'Third bill',
    ]);
    expect(rows.map((row) => row.classList.contains(itemStyles.divided!))).toEqual([true, true, false]);
  });

  it('shows one bill with no divider', async () => {
    await openBills(upcomingBills.one());

    const rows = await bodyRows();
    expect(rows.map(cellTexts)).toEqual([
      ['Jun16', '', `Adobe Inc - Yearly Plan${demoBillDescription}`, '17 Jun, 2027', '$559.00'],
    ]);
    expect(rows[0]!.classList.contains(itemStyles.divided!)).toBe(false);
  });

  it('shows "No upcoming bills" in the card, with the title and no table', async () => {
    await openBills(upcomingBills.none());

    expect(await within(card()).findByText('No upcoming bills')).toBeInTheDocument();
    expect(within(section()).queryByRole('table')).toBeNull();
    expect(within(section()).getByRole('heading', { level: 2 })).toHaveTextContent('Upcoming Bills');
  });

  it('shows the long titles, descriptions and amounts as sent', async () => {
    await openBills(upcomingBills.answers(longBills));

    const rows = await bodyRows();
    expect(
      rows.map((row) =>
        within(row)
          .getAllByRole('paragraph')
          .map((text) => text.textContent),
      ),
    ).toEqual([
      [longBillWords, longBillWords],
      [longBillNoSpace, longBillNoSpace],
      ['Figma - Yearly Plan', demoBillDescription],
    ]);
    expect(rows.map((row) => cellTexts(row)[4])).toEqual(['$1,000,000,000.00', '$1,000,000,000.00', '$150.00']);
  });

  // The title and the description are the user's text: shown as text, never as HTML (security-review).
  it('shows markup in a title or description as text', async () => {
    const markup = '<img src=x onerror="alert(1)"><b>Bold</b>';
    await openBills(upcomingBills.answers({ bills: [{ ...demoBills.bills[0]!, title: markup, description: markup }] }));

    const [row] = await bodyRows();
    expect(
      within(row!)
        .getAllByRole('paragraph')
        .map((text) => text.textContent),
    ).toEqual([markup, markup]);
    expect(row!.querySelector('b')).toBeNull();
    expect(row!.querySelectorAll('img')).toHaveLength(1);
  });
});

// T8: AC12, the states (#6, #88, #89, #114).
describe('the Bills states', () => {
  it('shows the title and the skeleton, busy, while the bills load', async () => {
    await openBills(upcomingBills.pending());

    await waitFor(() => expect(card().querySelector('[aria-busy="true"]')).not.toBeNull());
    expect(within(section()).queryByRole('table')).toBeNull();
    expect(within(section()).getByRole('heading', { level: 2 })).toHaveTextContent('Upcoming Bills');
  });

  it('shows the error state in the card after the request and its 3 retries fail, and Retry loads the bills', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await openBills(upcomingBills.failsThenAnswers());

    await vi.advanceTimersByTimeAsync(30_000);

    expect(billRequests()).toBe(4);
    expect(within(card()).getByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(within(section()).queryByRole('table')).toBeNull();

    await user.click(within(card()).getByRole('button', { name: 'Retry' }));

    expect((await bodyRows()).map(cellTexts)).toEqual(demoRows);
    expect(within(card()).queryByRole('alert')).toBeNull();
  });

  it('keeps focus in the card on a keyboard Retry, never the page body (#114)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await openBills(upcomingBills.failsThenAnswers());
    await vi.advanceTimersByTimeAsync(30_000);
    within(card()).getByRole('button', { name: 'Retry' }).focus();

    await user.keyboard('{Enter}');

    expect(await table()).toBeInTheDocument();
    expect(dataStateRootIn(card())).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
  });

  it('keeps the bills, with no message, when a later refetch fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openBills();
    await table();
    server.use(upcomingBills.fails());
    const before = billRequests();

    refocusWindow();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(billRequests() - before).toBe(4);
    expect((await bodyRows()).map(cellTexts)).toEqual(demoRows);
    expect(within(card()).queryByRole('alert')).toBeNull();
  });
});

// T9: AC13, no bill actions: nothing focusable or clickable, no hover (#28).
describe('no bill actions', () => {
  it('has nothing focusable in the card: Tab goes from the header’s search field out of the content', async () => {
    const { user } = await openBills();
    await table();
    const main = screen.getByRole('main');

    expect(card().querySelectorAll('a, button, input, select, textarea, [tabindex]')).toHaveLength(0);
    search().focus();
    await user.tab();
    expect(main.contains(document.activeElement)).toBe(false);
  });

  it('changes nothing on a hover or a click on a row', async () => {
    const { user, url } = await openBills();
    const rows = await bodyRows();
    const before = card().innerHTML;
    const sent = requests.length;

    for (const row of rows) {
      await user.hover(row);
      await user.click(row);
      await user.click(within(row).getByRole('img'));
    }

    expect(card().innerHTML).toBe(before);
    expect(url()).toBe('/bills');
    expect(requests).toHaveLength(sent);
  });
});

// T10: AC5 and AC19, Overview and Bills share one answer; Overview's card shows no description (#28, #41).
describe('Overview and Bills', () => {
  it('shows Overview’s two rows as Bills’ first two, from the one cached answer', async () => {
    server.use(me.signedIn(), today.answers());
    const { user, url } = renderApp('/overview', undefined, { strict: true });
    const overviewCard = await screen.findByRole('region', { name: 'Upcoming Bill' });
    const overviewRows = await within(overviewCard).findAllByRole('listitem');
    const fromOverview = overviewRows.map((row) => ({
      dates: [...row.querySelectorAll('time')].map((time) => time.dateTime),
      logo: within(row).getByRole('img').getAttribute('aria-label') ?? within(row).getByRole('img').getAttribute('alt'),
      title: row.querySelector('p')!.textContent,
      amount: row.querySelector(':scope > div > span')?.textContent,
    }));
    expect(overviewCard).not.toHaveTextContent(demoBillDescription);
    // From here the bills request never answers: Bills can only show the cached answer.
    server.use(upcomingBills.pending());

    await user.click(within(overviewCard).getByRole('link', { name: 'View All' }));

    expect(url()).toBe('/bills');
    const rows = await bodyRows();
    const fromBills = rows.slice(0, 2).map((row) => ({
      dates: [...row.querySelectorAll('time')].map((time) => time.dateTime),
      logo: within(row).getByRole('img').getAttribute('alt'),
      title: within(row).getAllByRole('paragraph')[0]!.textContent,
      amount: cellTexts(row)[4],
    }));
    expect(fromBills).toEqual(fromOverview);
    expect(rows).toHaveLength(4);
  });
});

/** A frontend source file's text, by its path under `frontend/src`. */
const srcDir = resolve(import.meta.dirname, '../../src');
const source = (path: string) => readFileSync(join(srcDir, path), 'utf8');

// T11: AC15, the frontend shows every bill sent in the order sent and only formats (#11, #74).
describe('the Bills sources', () => {
  const files = [
    'app/pages/BillsPage.tsx',
    'components/BillTable/BillTable.tsx',
    'components/BillItem/BillItem.tsx',
    'api/bills.ts',
  ];
  // As tasks 016 and 020's guards: no money or date arithmetic, no sort, filter or slice of the bills.
  const calculating =
    /\bcents\b|Math\.|new Date|\bDate\.|getTime|parseInt|parseFloat|Number\(|toFixed|toLocaleString|Intl\.|\.(filter|sort|toSorted|reduce|slice|splice|reverse|toReversed)\(|\b(dueDate|lastChargeDate)\s*[-+*/<>]/;

  it.each(files)('%s sorts, filters, slices and calculates nothing', (file) => {
    expect(source(file)).not.toMatch(calculating);
  });

  it.each([
    'const total = bill.amount.cents * 2;',
    'bills.toSorted((a, b) => a.dueDate.localeCompare(b.dueDate))',
    'bills.filter((bill) => bill.dueDate >= today)',
    'new Date(bill.dueDate)',
    'bills.slice(0, 2)',
    'const late = bill.dueDate < today;',
  ])('flags %s', (code) => {
    expect(code).toMatch(calculating);
  });

  it('formats a row only through the shared formatters: the date box, the amount box and formatDate', () => {
    const item = source('components/BillItem/BillItem.tsx');

    expect(item).toMatch(/<DateBox\b[^>]*size="large"/);
    expect(item).toMatch(/<AmountBox\b[^>]*size="large"/);
    expect(item).toMatch(/formatDate\(bill\.lastChargeDate\)/);
  });

  it('draws no hover and no pointer in the rows (#28)', () => {
    for (const file of ['components/BillTable/BillTable.module.css', 'components/BillItem/BillItem.module.css']) {
      expect(source(file)).not.toMatch(/:hover|cursor\s*:/);
    }
  });
});
