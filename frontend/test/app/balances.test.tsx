import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { focusManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import skeletonStyles from '../../src/components/AccountTypeSkeleton/AccountTypeSkeleton.module.css';
import {
  accounts,
  dataStateRootIn,
  longBankNameInWords,
  longBankNameNoSpace,
  me,
  renderApp,
  signedInDefaults,
  today,
} from '../support/app';

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

/** Balances signed in, with `handlers` first (the demo accounts by default), once its section shows. */
async function openBalances(...handlers: Parameters<typeof server.use>) {
  server.use(me.signedIn(), today.answers(), ...handlers);
  const view = renderApp('/balances');
  await screen.findByRole('region', { name: 'Balances' });
  return view;
}

const balances = () => screen.getByRole('region', { name: 'Balances' });
/** Waits until the page shows its list of accounts. */
const list = () => within(balances()).findByRole('list');
/** The account cards: the list items with a heading (the Add Accounts cell is a list item too, #133). */
const cards = async () =>
  within(await list())
    .getAllByRole('listitem')
    .filter((item) => within(item).queryByRole('heading', { level: 3 }) !== null);
/** Every cell of the grid, the Add Accounts cell too. */
const cells = async () => [...(await list()).children];
const cardOf = async (type: string) =>
  (await cards()).find((card) => within(card).queryByRole('heading', { level: 3, name: type }) !== null)!;
const detailsOf = async (type: string) => within(await cardOf(type)).getByRole('link', { name: 'Details' });
const detailsLinks = () => within(balances()).getAllByRole('link', { name: 'Details' });
/** The buttons named `text`, which do nothing (#22, #23, #133). */
const controls = (text: string) => within(balances()).getAllByRole('button', { name: text });

const sidebar = () => screen.getByRole('navigation', { name: 'Main' });
const currentLinks = () =>
  within(sidebar())
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.textContent);
const search = () => screen.getByRole('searchbox', { name: 'Search' });

const accountsPath = 'GET /api/accounts';
const count = (request: string) => requests.filter((sent) => sent === request).length;

const refocusWindow = () =>
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });

/**
 * What assistive technology reads in an element, in order: its text, skipping what is hidden from it, and an image's
 * name in place of the image.
 */
function readOut(element: Element): string[] {
  if (element.getAttribute('aria-hidden') === 'true') return [];
  if (element instanceof HTMLImageElement) return [element.alt];
  return [...element.childNodes].flatMap((node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent!.trim() === '' ? [] : [node.textContent!.trim()];
    return node instanceof Element ? readOut(node) : [];
  });
}

/** A first login's five cards as a screen reader reads them (demo-data.md; AC2, AC10). */
const firstLoginReadOut = [
  ['Credit Card', 'Master Card', 'Mastercard', 'Account Number', '**** **** **** 2598', 'Total amount', '$21,019.18'],
  ['Checking', 'AB Bank Ltd', 'VISA', 'Account Number', '**** **** **** 7310', 'Total amount', '$33,362.48'],
  ['Savings', 'Brac Bank Ltd.', 'Account Number', '**** **** **** 4421', 'Total amount', '$27,356.80'],
  ['Investment', 'AB Bank Ltd', 'Account Number', '**** **** **** 6652', 'Total amount', '$29,503.00'],
  ['Loan', 'City Bank Ltd.', 'Account Number', '**** **** **** 9083', 'Total amount', '$19,013.21'],
].map((card) => [...card, 'Remove', 'Details']);

/** The type and the Bank Name of each card, which describe its "Details" (AC10). */
const descriptions = [
  'Credit Card Master Card',
  'Checking AB Bank Ltd',
  'Savings Brac Bank Ltd.',
  'Investment AB Bank Ltd',
  'Loan City Bank Ltd.',
];

// T7: AC1, AC2, AC3 and AC10, a first login's Balances (#10, #24, #25, #57; demo-data.md).
describe('the Balances page', () => {
  it('shows the title "Balances", Balances active in the sidebar and only the date in the header', async () => {
    await openBalances();

    expect(within(balances()).getByRole('heading', { level: 2, name: 'Balances' })).toBeInTheDocument();
    expect(currentLinks()).toEqual(['Balances']);
    expect(await within(screen.getByRole('banner')).findByText('22 Oct, 2026')).toBeInTheDocument();
    expect(screen.queryByText(/Hello/)).toBeNull();
  });

  it('lists the five accounts in the order sent, each read as its type, Bank Name, logo, number, balance and Details', async () => {
    await openBalances();

    expect((await cards()).map(readOut)).toEqual(firstLoginReadOut);
  });

  it('gives each card its type as a level-3 heading and its two values as a description list', async () => {
    await openBalances();

    for (const [index, card] of (await cards()).entries()) {
      const expected = firstLoginReadOut[index]!;
      expect(within(card).getByRole('heading', { level: 3 })).toHaveTextContent(expected[0]!);
      expect(
        within(card)
          .getAllByRole('term')
          .map((term) => term.textContent),
      ).toEqual(['Account Number', 'Total amount']);
      expect(
        within(card)
          .getAllByRole('definition')
          .map((value) => value.textContent),
      ).toEqual(expected.filter((text) => text.startsWith('*') || text.startsWith('$')));
    }
  });

  it('shows the Mastercard logo on Credit Card and the VISA logo on Checking only', async () => {
    await openBalances();

    const logos = (await cards()).map((card) =>
      within(card)
        .queryAllByRole('img')
        .map((img) => img.getAttribute('alt')),
    );
    expect(logos).toEqual([['Mastercard'], ['VISA'], [], [], []]);
    expect(
      within(await cardOf('Credit Card'))
        .getByRole('img')
        .getAttribute('src'),
    ).toMatch(/Mastercard/);
    expect(
      within(await cardOf('Checking'))
        .getByRole('img')
        .getAttribute('src'),
    ).toMatch(/Visacard/);
  });

  it('shows "Remove" on every card and the Add Accounts cell last, with "Edit Accounts"', async () => {
    await openBalances();

    const all = await cells();
    expect(all).toHaveLength(6);
    for (const card of all.slice(0, 5)) expect(within(card as HTMLElement).getByText('Remove')).toBeInTheDocument();
    const last = all[5] as HTMLElement;
    expect(within(last).getByText('Add Accounts')).toBeInTheDocument();
    expect(within(last).getByText('Edit Accounts')).toBeInTheDocument();
    expect(within(last).queryByText('Remove')).toBeNull();
  });

  it('asks for the accounts once, with the browser’s time zone', async () => {
    let zone: string | null = null;
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname === '/api/accounts') zone = request.headers.get('X-Time-Zone');
    });
    await openBalances();
    await list();

    expect(count(accountsPath)).toBe(1);
    expect(zone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('shows the accounts Overview loaded at once from the same query, opened from "All Accounts"', async () => {
    server.use(me.signedIn(), today.answers());
    const { user, url } = renderApp('/overview');
    const totalBalance = await screen.findByRole('region', { name: 'Total Balance' });
    await within(totalBalance).findByText('$130,254.67');
    // The refetch on opening Balances never answers: the cards come from the cache Overview filled.
    server.use(accounts.pending());

    await user.click(within(totalBalance).getByRole('link', { name: 'All Accounts' }));

    expect(url()).toBe('/balances');
    expect((await cards()).map(readOut)).toEqual(firstLoginReadOut);
  });
});

// T8: AC4, "Details" opens that account's Account Details, Balances active (#47, #50).
describe('the Details links', () => {
  it('opens /balances/<id> of the clicked card, with Balances active, on its Account Details (task 021)', async () => {
    const { user, url } = await openBalances();

    await user.click(await detailsOf('Checking'));

    expect(url()).toBe('/balances/2');
    expect(currentLinks()).toEqual(['Balances']);
    expect(await screen.findByRole('region', { name: 'Account Details' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Transactions History' })).toBeInTheDocument();
  });

  it('opens /balances/<id> on Enter', async () => {
    const { user, url } = await openBalances();

    (await detailsOf('Loan')).focus();
    await user.keyboard('{Enter}');

    expect(url()).toBe('/balances/5');
    expect(currentLinks()).toEqual(['Balances']);
  });

  it('links each card to its own account id, as sent', async () => {
    await openBalances(accounts.eight());
    await list();

    expect(detailsLinks().map((link) => link.getAttribute('href'))).toEqual(
      ['1', '2', '3', '4', '5', '12', '17', '30'].map((id) => `/balances/${id}`),
    );
  });
});

// T9: AC5, "Remove", "Add Accounts" and "Edit Accounts" do nothing (#22, #23). Task 032 T11 (#133): they are buttons
// shown disabled and described as "Not available", where task 019 drew them as hidden text with no Tab stop.
describe('the controls that do nothing', () => {
  it.each(['Remove', 'Add Accounts', 'Edit Accounts'])('does nothing on a click on "%s"; focus on it', async (text) => {
    const { user, url } = await openBalances();
    await list();
    const target = controls(text)[0]!;
    const sent = requests.length;

    await user.click(target);

    expect(url()).toBe('/balances');
    expect(target).toHaveFocus();
    expect(requests).toHaveLength(sent);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((await cards()).map(readOut)).toEqual(firstLoginReadOut);
  });

  it.each(['Remove', 'Add Accounts', 'Edit Accounts'])('does nothing on Enter or Space on "%s"', async (text) => {
    const { user, url } = await openBalances();
    await list();
    const target = controls(text)[0]!;
    target.focus();
    const sent = requests.length;

    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(url()).toBe('/balances');
    expect(target).toHaveFocus();
    expect(requests).toHaveLength(sent);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((await cards()).map(readOut)).toEqual(firstLoginReadOut);
  });

  it.each(['Remove', 'Add Accounts', 'Edit Accounts'])(
    'makes "%s" a button shown disabled, described as "Not available", a Tab stop seen by assistive technology',
    async (text) => {
      await openBalances();
      await list();

      for (const control of controls(text)) {
        expect(control).toHaveAttribute('type', 'button');
        expect(control).toHaveAttribute('aria-disabled', 'true');
        expect(control).not.toBeDisabled();
        expect(control.tabIndex).toBe(0);
        expect(control).toHaveAccessibleDescription('Not available');
        expect(control).not.toHaveAttribute('title');
        expect(control.closest('[aria-hidden="true"], [inert]')).toBeNull();
      }
    },
  );

  it('has seven buttons, a "Remove" on each card, then "Add Accounts" and "Edit Accounts", and the five "Details" links', async () => {
    await openBalances();
    await list();

    expect(
      within(balances())
        .getAllByRole('button', { hidden: true })
        .map((button) => button.textContent),
    ).toEqual([...Array.from({ length: 5 }, () => 'Remove'), 'Add Accounts', 'Edit Accounts']);
    expect(
      within(balances())
        .getAllByRole('link', { hidden: true })
        .map((link) => link.textContent),
    ).toEqual(Array.from({ length: 5 }, () => 'Details'));
  });
});

// T10: AC3 and AC12, the grid with other numbers of accounts and with none (#24, #116 a).
describe('the grid', () => {
  it.each([
    ['one account', accounts.one, 2],
    ['six accounts', accounts.six, 7],
    ['eight accounts', accounts.eight, 9],
  ])('with %s, puts the Add Accounts cell last', async (_case, handler, cellCount) => {
    await openBalances(handler());

    const all = await cells();
    expect(all).toHaveLength(cellCount);
    expect(await cards()).toHaveLength(cellCount - 1);
    // Every cell is a list item assistive technology reads, the Add Accounts cell too (#133).
    expect(within(await list()).getAllByRole('listitem')).toHaveLength(cellCount);
    expect(within(all.at(-1) as HTMLElement).getByText('Add Accounts')).toBeInTheDocument();
  });

  it('shows "No accounts yet" with the title and no Add Accounts cell when there are none', async () => {
    await openBalances(accounts.none());

    expect(await within(balances()).findByText('No accounts yet')).toBeInTheDocument();
    expect(within(balances()).getByRole('heading', { level: 2, name: 'Balances' })).toBeInTheDocument();
    expect(within(balances()).queryByRole('list')).toBeNull();
    expect(within(balances()).queryByText('Add Accounts')).toBeNull();
    expect(within(balances()).queryByText('Edit Accounts')).toBeNull();
  });

  it.each([
    ['in words', accounts.longBankName, longBankNameInWords],
    ['with no space', accounts.longBankNameNoSpace, longBankNameNoSpace],
  ])('shows a 100-character Bank Name %s whole', async (_case, handler, name) => {
    await openBalances(handler());

    expect(readOut(await cardOf('Checking')).slice(0, 3)).toEqual(['Checking', name, 'VISA']);
    expect(await detailsOf('Checking')).toHaveAccessibleDescription(`Checking ${name}`);
  });
});

// T11: AC10, the keyboard and the links' names and descriptions (#87).
describe('the Balances Tab order', () => {
  it('names each "Details" link "Details", described by its card’s type and Bank Name', async () => {
    await openBalances();
    await list();

    for (const [index, link] of detailsLinks().entries()) {
      expect(link).toHaveAccessibleName('Details');
      expect(link).toHaveAccessibleDescription(descriptions[index]!);
    }
  });

  // Task 032 (#133): each card's "Remove" before its "Details", then "Add Accounts" and "Edit Accounts".
  it('tabs from the search field through each card’s "Remove" and "Details", "Add Accounts", "Edit Accounts" and out; Shift+Tab goes back', async () => {
    const { user } = await openBalances();
    await list();
    const main = screen.getByRole('main');
    const removes = within(balances()).getAllByRole('button', { name: 'Remove' });
    const stops = [
      ...detailsLinks().flatMap((link, index) => [removes[index]!, link]),
      within(balances()).getByRole('button', { name: 'Add Accounts' }),
      within(balances()).getByRole('button', { name: 'Edit Accounts' }),
    ];
    expect(stops).toHaveLength(12);

    search().focus();
    for (const stop of stops) {
      await user.tab();
      expect(stop).toHaveFocus();
    }
    await user.tab();
    expect(main.contains(document.activeElement)).toBe(false);

    for (const stop of stops.toReversed()) {
      await user.tab({ shift: true });
      expect(stop).toHaveFocus();
    }
    await user.tab({ shift: true });
    expect(search()).toHaveFocus();
  });
});

// T12: AC11, the loading, error and refetch states (#6, #88, #89, #114).
describe('the Balances states', () => {
  it('shows three skeleton cards, busy, while the request runs, and no Add Accounts cell', async () => {
    await openBalances(accounts.pending());

    await waitFor(() => expect(balances().querySelector('[aria-busy="true"]')).not.toBeNull());
    expect(balances().querySelectorAll(`.${skeletonStyles.card}`)).toHaveLength(3);
    expect(within(balances()).queryByRole('list')).toBeNull();
    expect(within(balances()).queryByText('Add Accounts')).toBeNull();
  });

  it('shows the error state after the request and its 3 retries fail, and Retry loads the cards', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await openBalances(accounts.failsThenAnswers());

    await vi.advanceTimersByTimeAsync(30_000);

    expect(count(accountsPath)).toBe(4);
    expect(within(balances()).getByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(within(balances()).queryByRole('list')).toBeNull();
    expect(within(balances()).queryByText('Add Accounts')).toBeNull();

    await user.click(within(balances()).getByRole('button', { name: 'Retry' }));

    expect((await cards()).map(readOut)).toEqual(firstLoginReadOut);
    expect(within(balances()).queryByRole('alert')).toBeNull();
  });

  // Task 032 (#133): the first Tab stop in the cards is the first card's "Remove", before its "Details".
  it('keeps focus in the region on a keyboard Retry, never the page body, and Tab goes on to the first "Remove"', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await openBalances(accounts.failsThenAnswers());
    await vi.advanceTimersByTimeAsync(30_000);
    within(balances()).getByRole('button', { name: 'Retry' }).focus();

    await user.keyboard('{Enter}');

    expect(await list()).toBeInTheDocument();
    expect(dataStateRootIn(balances())).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
    await user.tab();
    expect(within(await cardOf('Credit Card')).getByRole('button', { name: 'Remove' })).toHaveFocus();
    await user.tab();
    expect(await detailsOf('Credit Card')).toHaveFocus();
  });

  it('keeps the cards, with no message, when a later refetch fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openBalances();
    await list();
    server.use(accounts.fails());
    const before = count(accountsPath);

    refocusWindow();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(count(accountsPath) - before).toBe(4);
    expect((await cards()).map(readOut)).toEqual(firstLoginReadOut);
    expect(within(balances()).queryByRole('alert')).toBeNull();
  });
});

/** A frontend source file's text, by its path under `frontend/src`. */
const srcDir = resolve(import.meta.dirname, '../../src');
const source = (path: string) => readFileSync(join(srcDir, path), 'utf8');

// T13: AC9, the frontend maps the response into the cards and formats it; it calculates, sorts and filters nothing
// (#11, #25, #74).
describe('the Balances sources', () => {
  const files = [
    'app/pages/BalancesPage.tsx',
    'components/AccountType/AccountType.tsx',
    'components/AddAccountsCell/AddAccountsCell.tsx',
    'components/AddAccountsButtonBig/AddAccountsButtonBig.tsx',
    'components/Button/Button.tsx',
    'api/accounts.ts',
  ];
  // Operators beside a digit, or spaced between two words (`index + 1`, `a - b`); import paths and `aria-*` names
  // have no spaces around their slashes and hyphens.
  const calculating =
    /Math\.|\.cents\b|parseInt|parseFloat|Number\(|\.sort\(|\.toSorted\(|\.filter\(|\.reduce\(|\.reverse\(|\.toReversed\(|\.slice\(|\.replace|\.padStart\(|[-+*/%]\s*\d|\d\s*[-+*/%]|\w\s+[-+*/%]\s+\w/;

  it('never calculates, sorts, filters or masks', () => {
    expect(files.filter((file) => calculating.test(source(file).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')))).toEqual(
      [],
    );
  });

  it('formats the money and the type with the shared formatters, and shows the number and Bank Name as sent', () => {
    const card = source('components/AccountType/AccountType.tsx');

    expect(card).toMatch(/\bformatMoney\(account\.balance\)/);
    expect(card).toMatch(/\baccountTypeLabel\(account\.accountType\)/);
    expect(card).toMatch(/\{account\.maskedNumber\}/);
    expect(card).toMatch(/\{account\.bankName\}/);
  });

  it.each([
    ['const total = Math.round(balance);', true],
    ['const dollars = account.balance.cents / 100;', true],
    ['const sorted = data.accounts.toSorted(byId);', true],
    ['const shown = data.accounts.filter((account) => account.cardNetwork);', true],
    ['const last = account.maskedNumber.slice(-4);', true],
    ['const position = index + 1;', true],
    ['const left = total - spent;', true],
    ['const money = formatMoney(account.balance);', false],
    ['<Button to={accountDetailsPath(String(account.id))}>', false],
    ["import { Card } from '../Card/Card';", false],
    ['<Button aria-describedby={describedBy}>', false],
  ])('the calculation check on %s: %s', (code, flagged) => {
    expect(calculating.test(code)).toBe(flagged);
  });
});
