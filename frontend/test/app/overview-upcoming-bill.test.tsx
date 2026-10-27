import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { focusManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import styles from '../../src/components/UpcomingBill/UpcomingBill.module.css';
import { demoBills, demoFigmaBill, me, renderApp, signedInDefaults, today, upcomingBills } from '../support/app';

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

/** Overview signed in, with `handlers` first (the demo bills by default), once the Upcoming Bill section shows. */
async function openOverview(...handlers: Parameters<typeof server.use>) {
  server.use(me.signedIn(), today.answers(), ...handlers);
  const view = renderApp('/overview');
  await screen.findByRole('region', { name: 'Upcoming Bill' });
  return view;
}

const bills = () => screen.getByRole('region', { name: 'Upcoming Bill' });
/** The Upcoming Bill card: the section's element after its title row. */
const billsCard = () => bills().lastElementChild as HTMLElement;
/** Waits until the card shows its list of bills. */
const billList = () => within(bills()).findByRole('list');
const rows = () => within(bills()).getAllByRole('listitem');

const count = (request: string) => requests.filter((sent) => sent === request).length;

const refocusWindow = () =>
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });

/** A frontend source file's text. */
const source = (path: string) => readFileSync(resolve(import.meta.dirname, '../../src', path), 'utf8');

/** A bill due on this day, with its last charge a year before. */
const billDue = (title: string, dueDate: string) => ({
  ...demoFigmaBill(2027),
  title,
  dueDate,
  lastChargeDate: `${Number(dueDate.slice(0, 4)) - 1}${dueDate.slice(4)}`,
});

// T7: the first login's Upcoming Bill card (AC1, AC2, AC12; #11, #28, #88, demo-data.md).
describe('the Upcoming Bill card', () => {
  it('shows the next 2 demo bills in a list, soonest first, as drawn: date box, logo, title, last charge, amount', async () => {
    await openOverview();
    const list = await billList();

    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(rows().map((row) => row.textContent)).toEqual([
      'May15Figma - Yearly PlanLast Charge - 14 May, 2026$150.00',
      'Jun16Adobe Inc - Yearly PlanLast Charge - 17 Jun, 2026$559.00',
    ]);
    expect(within(bills()).getByRole('heading', { level: 2 })).toHaveTextContent('Upcoming Bill');
    expect(within(bills()).getByRole('link', { name: 'View All' })).toHaveAttribute('href', '/bills');
  });

  it('names each logo by its biller', async () => {
    await openOverview();
    await billList();

    const [figmaLogo, adobeLogo] = rows().map((row) => within(row).getByRole('img'));
    expect(figmaLogo).toHaveAccessibleName('Figma');
    expect(adobeLogo).toHaveAccessibleName('Adobe');
  });

  it('gives the due date and the last charge date as time elements with their plain dates', async () => {
    await openOverview();
    await billList();

    expect(rows().map((row) => [...row.querySelectorAll('time')].map((time) => time.dateTime))).toEqual([
      ['2027-05-15', '2026-05-14'],
      ['2027-06-16', '2026-06-17'],
    ]);
  });

  it('draws one divider, between the two rows', async () => {
    await openOverview();
    await billList();

    expect(rows().map((row) => row.classList.contains(styles.divided!))).toEqual([false, true]);
  });

  it('has nothing focusable or clickable in the rows: Tab goes from the Goals pencil to "View All" (#28)', async () => {
    const { user } = await openOverview();
    await billList();
    const pencil = await screen.findByRole('button', { name: 'Edit savings goal' });

    expect(billsCard().querySelectorAll('a, button, input, [tabindex]')).toHaveLength(0);
    pencil.focus();
    await user.tab();
    expect(within(bills()).getByRole('link', { name: 'View All' })).toHaveFocus();
  });

  it('asks for the bills with the browser’s time zone', async () => {
    const zones: (string | null)[] = [];
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname === '/api/bills/upcoming') zones.push(request.headers.get('x-time-zone'));
    });
    await openOverview();
    await billList();

    expect(zones).toEqual([Intl.DateTimeFormat().resolvedOptions().timeZone]);
  });
});

// T8: more than 2, one and no upcoming bills (AC2, AC5; #6, #28, #105 a, #111 b).
describe('the number of bills', () => {
  it.each([
    ['3 bills', [billDue('First', '2026-11-01'), billDue('Second', '2026-12-01'), billDue('Third', '2027-01-01')]],
    ['the 4 demo bills', demoBills.bills],
  ])('shows the first 2 of %s in the order sent', async (_case, sent) => {
    await openOverview(upcomingBills.answers({ bills: sent }));
    await billList();

    expect(rows()).toHaveLength(2);
    expect(rows().map((row) => row.querySelector('time')!.dateTime)).toEqual([sent[0]!.dueDate, sent[1]!.dueDate]);
  });

  it('shows one bill at the top with no divider', async () => {
    await openOverview(upcomingBills.one());
    await billList();

    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent('Jun16Adobe Inc - Yearly PlanLast Charge - 17 Jun, 2027$559.00');
    expect(rows()[0]!.classList.contains(styles.divided!)).toBe(false);
  });

  it('shows "No upcoming bills" with the title and "View All", and no list', async () => {
    await openOverview(upcomingBills.none());

    expect(await within(bills()).findByText('No upcoming bills')).toBeInTheDocument();
    expect(within(bills()).queryByRole('list')).toBeNull();
    expect(within(bills()).getByRole('heading', { level: 2 })).toHaveTextContent('Upcoming Bill');
    expect(within(bills()).getByRole('link', { name: 'View All' })).toBeInTheDocument();
  });
});

// T9: loading, error and a failed refetch (AC10; #6, #88, #89).
describe('the Upcoming Bill card states', () => {
  it('shows the skeleton while the bills load, with the other sections in place', async () => {
    await openOverview(upcomingBills.pending());

    await waitFor(() => expect(billsCard().querySelector('[aria-busy="true"]')).not.toBeNull());
    expect(within(bills()).queryByRole('list')).toBeNull();
    expect(screen.getByRole('region', { name: 'Total Balance' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Goals' })).toBeInTheDocument();
  });

  it('shows the error state after the request and its 3 retries fail, and Retry loads the bills', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await openOverview(upcomingBills.fails());

    await vi.advanceTimersByTimeAsync(30_000);

    expect(count('GET /api/bills/upcoming')).toBe(4);
    expect(within(bills()).getByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(within(bills()).queryByRole('list')).toBeNull();
    expect(await screen.findByText('$130,254.67')).toBeInTheDocument();

    server.use(upcomingBills.answers());
    await user.click(within(bills()).getByRole('button', { name: 'Retry' }));

    expect(await billList()).toBeInTheDocument();
    expect(rows()).toHaveLength(2);
    expect(within(bills()).queryByRole('alert')).toBeNull();
  });

  it('keeps the bills, with no message, when a later refetch fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openOverview();
    await billList();
    server.use(upcomingBills.fails());
    const before = count('GET /api/bills/upcoming');

    refocusWindow();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(count('GET /api/bills/upcoming') - before).toBe(4);
    expect(rows()).toHaveLength(2);
    expect(rows()[0]).toHaveTextContent('$150.00');
    expect(within(bills()).queryByRole('alert')).toBeNull();
  });
});

// T10: AC11, the frontend selects and formats; it calculates nothing from the amounts or the dates (#11, #74).
describe('the Upcoming Bill sources', () => {
  const files = [
    'components/UpcomingBill/UpcomingBill.tsx',
    'components/UpcomingBillLogo/UpcomingBillLogo.tsx',
    'api/bills.ts',
  ];
  const calculating =
    /\bcents\b|Math\.|\bDate\b|getTime|parseInt|parseFloat|Number\(|\b(due|lastCharge)Date\s*[-+*/<>]/;

  it('never calculates with cents or dates', () => {
    expect(files.filter((file) => calculating.test(source(file)))).toEqual([]);
  });

  it('formats with the shared formatters and takes the first two bills of the response', () => {
    const upcomingBill = source('components/UpcomingBill/UpcomingBill.tsx');

    expect(upcomingBill).toMatch(/\bformatDate\(/);
    expect(upcomingBill).toMatch(/<DateBox\b/);
    expect(upcomingBill).toMatch(/<AmountBox\b/);
    expect(upcomingBill).toMatch(/\.slice\(0, 2\)/);
  });

  it.each([
    ['const total = bill.amount.cents * 2;', true],
    ['const days = Date.parse(bill.dueDate);', true],
    ['const late = bill.dueDate < today;', true],
    ['formatDate(bill.lastChargeDate)', false],
  ])('the calculation check on %s: %s', (code, flagged) => {
    expect(calculating.test(code)).toBe(flagged);
  });
});
