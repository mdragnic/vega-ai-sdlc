import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { AccountsResponse } from '@finebank/shared';
import { focusManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import sliderStyles from '../../src/components/SliderOption/SliderOption.module.css';
import totalBalanceStyles from '../../src/components/TotalBalance/TotalBalance.module.css';
import { accounts, demoAccounts, me, renderApp, signedInDefaults, today } from '../support/app';

const server = setupServer(...signedInDefaults());

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
  vi.useRealTimers();
  focusManager.setFocused(undefined);
});
afterAll(() => server.close());

const accountsPath = '/api/accounts';

/** A frontend source file's text. */
const source = (path: string) => readFileSync(resolve(import.meta.dirname, '../../src', path), 'utf8');

/** Counts the requests to one path. */
function countRequests(path: string): () => number {
  let count = 0;
  server.events.on('request:start', ({ request }) => {
    if (new URL(request.url).pathname === path) count += 1;
  });
  return () => count;
}

const refocusWindow = () =>
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });

/** Overview signed in, with `handlers` for its requests (the demo accounts by default), once its sections show. */
async function openOverview(...handlers: Parameters<typeof server.use>) {
  server.use(me.signedIn(), today.answers(), ...handlers);
  const view = renderApp('/overview');
  await screen.findByRole('region', { name: 'Total Balance' });
  return view;
}

const region = (name: string) => screen.getByRole('region', { name });
const totalBalance = () => region('Total Balance');
const slide = () => within(totalBalance()).getByRole('group', { name: /^Account \d+ of \d+$/ });
const previousButton = () => within(totalBalance()).getByRole('button', { name: 'Previous' });
const nextButton = () => within(totalBalance()).getByRole('button', { name: 'Next' });
const dots = () => [...totalBalance().querySelectorAll(`.${sliderStyles.dot}`)];
const activeDot = () => dots().findIndex((dot) => dot.classList.contains(sliderStyles.active!));

/** What the shown slide says, in reading order, with the logo's name. */
function shown() {
  const group = slide();
  return {
    name: group.getAttribute('aria-label'),
    text: [...group.querySelectorAll('p')].map((p) => p.textContent),
    logo: within(group).queryByRole('img')?.getAttribute('alt') ?? null,
  };
}

/** The 5 slides of AC1 and AC2 (#24, #25, demo-data.md). */
const demoSlides = [
  {
    name: 'Account 1 of 5',
    text: ['Account Type', 'Credit Card', '**** **** **** 2598', '$21,019.18'],
    logo: 'Mastercard',
  },
  { name: 'Account 2 of 5', text: ['Account Type', 'Checking', '**** **** **** 7310', '$33,362.48'], logo: 'VISA' },
  { name: 'Account 3 of 5', text: ['Account Type', 'Savings', '**** **** **** 4421', '$27,356.80'], logo: null },
  { name: 'Account 4 of 5', text: ['Account Type', 'Investment', '**** **** **** 6652', '$29,503.00'], logo: null },
  { name: 'Account 5 of 5', text: ['Account Type', 'Loan', '**** **** **** 9083', '$19,013.21'], logo: null },
];

const oneAccount: AccountsResponse = {
  totalBalance: demoAccounts.accounts[0]!.balance,
  accounts: [demoAccounts.accounts[0]!],
};

// T9: the first login's Total Balance and first slide (AC1; #11, #17, #57).
describe('the Total Balance card', () => {
  it('shows the total, "All Accounts" to Balances and the first account', async () => {
    await openOverview();

    expect(await within(totalBalance()).findByText('$130,254.67')).toBeInTheDocument();
    expect(within(totalBalance()).getByRole('link', { name: 'All Accounts' })).toHaveAttribute('href', '/balances');
    expect(shown()).toEqual(demoSlides[0]);
    expect(within(slide()).getByRole('img', { name: 'Mastercard' }).getAttribute('src')).toMatch(/Mastercard/);
    // The round arrow is drawn, hidden from assistive technology.
    expect(slide().querySelector('svg')?.closest('[aria-hidden="true"]')).not.toBeNull();
    // The shown account's logo is the one image of the card (the other accounts' cards are hidden, #107).
    expect(
      within(totalBalance())
        .getAllByRole('img')
        .map((img) => img.getAttribute('alt')),
    ).toEqual(['Mastercard']);
  });

  // T24: every account's card in one cell, so the tallest sets the height; only the shown one is announced (#107).
  it('lays out every account in the slides’ cell, the others hidden from view and assistive technology', async () => {
    const { user } = await openOverview();
    await within(totalBalance()).findByText('$130,254.67');
    const live = () => totalBalance().querySelector('[aria-live="polite"]')!;
    const groups = () => [...totalBalance().querySelectorAll('[role="group"]')];

    for (const position of [1, 2]) {
      const names = groups().map((group) => group.getAttribute('aria-label') ?? '');
      expect(names.toSorted((a, b) => a.localeCompare(b))).toEqual(demoSlides.map((expected) => expected.name));
      expect([...live().querySelectorAll('[role="group"]')]).toEqual([slide()]);
      expect(slide()).toHaveAccessibleName(`Account ${position} of 5`);
      for (const other of groups().filter((group) => group !== slide())) {
        const hidden = other.closest('[aria-hidden="true"]')!;
        expect(hidden).toHaveClass(totalBalanceStyles.hidden!);
        expect(hidden.parentElement).toBe(live().parentElement);
        expect(live().contains(hidden)).toBe(false);
      }
      await user.click(nextButton());
    }
  });

  // T10: the carousel (AC2, AC3, AC4; #17, #24).
  it('shows the accounts in order with Next, and goes back with Previous', async () => {
    const { user } = await openOverview();
    await within(totalBalance()).findByText('$130,254.67');

    for (const [index, expected] of demoSlides.entries()) {
      expect(shown()).toEqual(expected);
      expect(activeDot()).toBe(index);
      expect(within(totalBalance()).getByText('$130,254.67')).toBeInTheDocument();
      if (index < demoSlides.length - 1) await user.click(nextButton());
    }
    await user.click(previousButton());

    expect(shown()).toEqual(demoSlides[3]);
    expect(activeDot()).toBe(3);
  });

  it('shows one dot per account, the active one teal', async () => {
    await openOverview();
    await within(totalBalance()).findByText('$130,254.67');

    expect(dots()).toHaveLength(5);
    expect(dots().filter((dot) => dot.classList.contains(sliderStyles.active!))).toHaveLength(1);
    expect(dots()[0]!.parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('disables Previous on the first account and Next on the last; a click on a disabled one changes nothing', async () => {
    const { user } = await openOverview();
    await within(totalBalance()).findByText('$130,254.67');

    expect(previousButton()).toHaveAttribute('aria-disabled', 'true');
    expect(previousButton()).toHaveClass(sliderStyles.disabled!);
    expect(nextButton()).not.toHaveAttribute('aria-disabled');
    expect(nextButton()).not.toHaveClass(sliderStyles.disabled!);
    await user.click(previousButton());
    expect(shown().name).toBe('Account 1 of 5');
    expect(previousButton()).toHaveFocus();

    for (let step = 0; step < 4; step += 1) await user.click(nextButton());
    // Next became disabled under the pointer and keeps focus (aria-disabled, not disabled).
    expect(nextButton()).toHaveAttribute('aria-disabled', 'true');
    expect(nextButton()).toHaveClass(sliderStyles.disabled!);
    expect(nextButton()).toHaveFocus();
    expect(previousButton()).not.toHaveAttribute('aria-disabled');
    await user.click(nextButton());

    expect(shown().name).toBe('Account 5 of 5');
    expect(activeDot()).toBe(4);
  });

  it('shows one dot and disables both buttons with one account', async () => {
    const { user } = await openOverview(accounts.answers(oneAccount));
    await within(totalBalance()).findByRole('group', { name: 'Account 1 of 1' });

    // The total and the one balance.
    expect(within(totalBalance()).getAllByText('$21,019.18')).toHaveLength(2);
    expect(dots()).toHaveLength(1);
    expect(activeDot()).toBe(0);
    expect(previousButton()).toHaveAttribute('aria-disabled', 'true');
    expect(nextButton()).toHaveAttribute('aria-disabled', 'true');
    await user.click(nextButton());
    expect(shown().name).toBe('Account 1 of 1');
  });

  it('moves to the last account when new data has fewer accounts', async () => {
    const { user } = await openOverview();
    await within(totalBalance()).findByText('$130,254.67');
    for (let step = 0; step < 4; step += 1) await user.click(nextButton());
    server.use(accounts.answers({ ...demoAccounts, accounts: demoAccounts.accounts.slice(0, 2) }));

    refocusWindow();

    await waitFor(() => expect(shown().name).toBe('Account 2 of 2'));
    expect(shown()).toEqual({ ...demoSlides[1], name: 'Account 2 of 2' });
    expect(nextButton()).toHaveAttribute('aria-disabled', 'true');
  });

  it('starts at the first account every time Overview opens', async () => {
    const { user, router } = await openOverview();
    await within(totalBalance()).findByText('$130,254.67');
    await user.click(nextButton());
    await user.click(nextButton());

    await act(() => router.navigate('/bills'));
    await act(() => router.navigate('/overview'));

    expect(shown().name).toBe('Account 1 of 5');
  });

  // T11: keyboard and screen readers (AC4, AC6; #87).
  it('tabs from "All Accounts" to Previous and Next, and Enter and Space show the next account', async () => {
    const { user } = await openOverview();
    const allAccounts = await within(totalBalance()).findByRole('link', { name: 'All Accounts' });

    allAccounts.focus();
    await user.tab();
    expect(previousButton()).toHaveFocus();
    await user.tab();
    expect(nextButton()).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(shown().name).toBe('Account 2 of 5');
    await user.keyboard(' ');
    expect(shown().name).toBe('Account 3 of 5');
    await user.keyboard('{Enter}{Enter}');
    expect(shown().name).toBe('Account 5 of 5');
    expect(nextButton()).toHaveFocus();
    expect(nextButton()).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{Enter} ');
    expect(shown().name).toBe('Account 5 of 5');
  });

  it('puts the slide in a polite live region, named by its position', async () => {
    const { user } = await openOverview();
    await within(totalBalance()).findByText('$130,254.67');

    await user.click(nextButton());

    const live = slide().closest('[aria-live]');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(within(live as HTMLElement).getByRole('group', { name: 'Account 2 of 5' })).toBe(slide());
  });

  it('gives the round arrow and the dots no tab stop and no behavior', async () => {
    const { user, url } = await openOverview();
    await within(totalBalance()).findByText('$130,254.67');
    const arrow = slide().querySelector('svg')!;
    const arrowBox = arrow.closest('[aria-hidden="true"]') as HTMLElement;

    expect(arrowBox.tagName).not.toBe('BUTTON');
    expect(arrowBox.closest('a, button')).toBeNull();
    expect(arrowBox.querySelector('a, button, [tabindex]')).toBeNull();
    expect(dots()[0]!.parentElement!.querySelector('a, button, [tabindex]')).toBeNull();
    // Only the link and the two buttons are focusable in the card.
    expect([...totalBalance().querySelectorAll('a, button, [tabindex]')].map((element) => element.textContent)).toEqual(
      ['All Accounts', 'Previous', 'Next'],
    );

    await user.click(arrowBox);
    expect(url()).toBe('/overview');
    expect(shown().name).toBe('Account 1 of 5');
  });

  // T13: the frontend formats the cents it gets and adds nothing (AC11; #11).
  it('shows the total as sent, not the sum of the balances', async () => {
    await openOverview(accounts.answers({ ...demoAccounts, totalBalance: { cents: 1, currency: 'USD' } }));

    expect(await within(totalBalance()).findByText('$0.01')).toBeInTheDocument();
  });
});

// T12: loading, error, refetch and empty (AC12; #6, #88, #89, #105 b).
describe('the Total Balance card states', () => {
  it('shows the skeleton while the accounts load, with the other sections in place', async () => {
    await openOverview(accounts.pending());
    await screen.findByText('Hello Tanzir');

    await waitFor(() => expect(totalBalance().querySelector('[aria-busy="true"]')).not.toBeNull());
    expect(within(totalBalance()).queryByRole('link', { name: 'All Accounts' })).toBeNull();
    expect(within(totalBalance()).queryByRole('button')).toBeNull();
    expect(within(region('Upcoming Bill')).getByRole('link', { name: 'View All' })).toBeInTheDocument();
  });

  it('shows the error state after the request and its 3 retries fail, and Retry loads the data', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const requests = countRequests(accountsPath);
    const { user } = await openOverview(accounts.fails());
    await screen.findByText('Hello Tanzir');

    await vi.advanceTimersByTimeAsync(30_000);

    expect(requests()).toBe(4);
    expect(within(totalBalance()).getByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(within(totalBalance()).queryByRole('link', { name: 'All Accounts' })).toBeNull();
    // The rest of the page keeps working.
    expect(within(region('Recent Transaction')).getByRole('link', { name: 'View All' })).toBeInTheDocument();

    server.use(accounts.answers());
    await user.click(within(totalBalance()).getByRole('button', { name: 'Retry' }));

    expect(await within(totalBalance()).findByText('$130,254.67')).toBeInTheDocument();
    expect(within(totalBalance()).queryByRole('alert')).toBeNull();
  });

  it('keeps the data, with no message, when a later refetch fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openOverview();
    await within(totalBalance()).findByText('$130,254.67');
    const requests = countRequests(accountsPath);
    server.use(accounts.fails());

    refocusWindow();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(requests()).toBe(4);
    expect(within(totalBalance()).getByText('$130,254.67')).toBeInTheDocument();
    expect(shown().name).toBe('Account 1 of 5');
    expect(within(totalBalance()).queryByRole('alert')).toBeNull();
  });

  it('shows "No accounts yet" in place of the whole content when there are none', async () => {
    await openOverview(accounts.answers({ totalBalance: { cents: 0, currency: 'USD' }, accounts: [] }));

    expect(await within(totalBalance()).findByText('No accounts yet')).toBeInTheDocument();
    expect(within(totalBalance()).queryByText('$0.00')).toBeNull();
    expect(within(totalBalance()).queryByRole('link')).toBeNull();
    expect(within(totalBalance()).queryByRole('button')).toBeNull();
    expect(within(totalBalance()).queryByRole('group')).toBeNull();
  });

  it('asks for the accounts with the browser’s time zone', async () => {
    const zones: (string | null)[] = [];
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname === accountsPath) zones.push(request.headers.get('x-time-zone'));
    });
    await openOverview();
    await within(totalBalance()).findByText('$130,254.67');

    expect(zones).toEqual([Intl.DateTimeFormat().resolvedOptions().timeZone]);
  });
});

// T13: the page grid of 104 with its six sections (AC13; #48, #49, #94, #105 a).
describe('the Overview page', () => {
  // Goals and Upcoming Bill have their content from tasks 014 and 015 (overview-goals.test.tsx,
  // overview-upcoming-bill.test.tsx); the other three stay empty until theirs.
  it('shows the six sections in 104’s order, the links and the note, and the three unbuilt cards empty', async () => {
    await openOverview();
    await within(totalBalance()).findByText('$130,254.67');
    const main = screen.getByRole('main');
    const regions = within(main).getAllByRole('region');

    expect(regions.map((section) => within(section).getByRole('heading', { level: 2 }).textContent)).toEqual([
      'Total Balance',
      'Goals',
      'Upcoming Bill',
      'Recent Transaction',
      'Statistics',
      'Expenses Breakdown',
    ]);
    expect(within(region('Upcoming Bill')).getByRole('link', { name: 'View All' })).toHaveAttribute('href', '/bills');
    expect(within(region('Recent Transaction')).getByRole('link', { name: 'View All' })).toHaveAttribute(
      'href',
      '/transactions',
    );
    expect(within(region('Expenses Breakdown')).getByText('*Compare to last month')).toBeInTheDocument();
    expect(within(main).getAllByRole('link', { name: 'View All' })).toHaveLength(2);
    for (const name of ['Recent Transaction', 'Statistics', 'Expenses Breakdown']) {
      expect(region(name).lastElementChild).toBeEmptyDOMElement();
    }
  });

  it('opens Bills and Transactions from their "View All" in the shell', async () => {
    const { user, url } = await openOverview();
    await within(totalBalance()).findByText('$130,254.67');

    await user.click(within(region('Upcoming Bill')).getByRole('link', { name: 'View All' }));
    expect(url()).toBe('/bills');
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Overview' }));
    await user.click(within(await screen.findByRole('region', { name: 'Recent Transaction' })).getByRole('link'));
    expect(url()).toBe('/transactions');
  });

  it('never calculates with cents: the Overview sources only format the amounts they get', () => {
    const files = [
      'app/pages/OverviewPage.tsx',
      'components/TotalBalance/TotalBalance.tsx',
      'components/AccountTypeSlide/AccountTypeSlide.tsx',
      'components/SliderOption/SliderOption.tsx',
      'api/accounts.ts',
    ];

    expect(files.filter((file) => /\bcents\b/.test(source(file)))).toEqual([]);
  });
});
