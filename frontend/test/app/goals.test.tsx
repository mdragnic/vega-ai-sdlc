import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  type CurrentUser,
  type ErrorResponse,
  goalMessages,
  type SavingsGoalResponse,
  writeGuardMessages,
} from '@finebank/shared';
import { focusManager, type QueryClient, useQueryClient } from '@tanstack/react-query';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useEffect } from 'react';
import { Outlet, type RouteObject } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { routes } from '../../src/app/routes';
import inputStyles from '../../src/components/PopupInputSmall/PopupInputSmall.module.css';
import {
  authenticationRequired,
  dataStateRootIn,
  demoGoal,
  demoGoalOf,
  goalsBackend,
  me,
  renderApp,
  savingsGoalForMonth,
  savingsGoalMonths,
  signedInDefaults,
  today,
} from '../support/app';

const server = setupServer(...signedInDefaults());

/** Every request the app sends, as `METHOD /path?query`. */
let requests: string[] = [];

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  requests = [];
  server.events.on('request:start', ({ request }) => {
    const { pathname, search } = new URL(request.url);
    requests.push(`${request.method} ${pathname}${search}`);
  });
});
afterEach(() => {
  // Unmount first: a focus change while the app is still mounted would send its refetches into the next test.
  cleanup();
  server.resetHandlers();
  server.events.removeAllListeners();
  vi.useRealTimers();
  focusManager.setFocused(undefined);
});
afterAll(() => server.close());

const usd = (cents: number) => ({ cents, currency: 'USD' as const });

/** The query client the app uses, captured from inside it. */
let appClient: QueryClient | undefined;

function ClientProbe() {
  const client = useQueryClient();
  useEffect(() => {
    appClient = client;
  }, [client]);
  return null;
}

/** The app's routes under a probe that captures the query client. */
const probedRoutes: RouteObject[] = [
  {
    element: (
      <>
        <ClientProbe />
        <Outlet />
      </>
    ),
    children: routes,
  },
];

type User = ReturnType<typeof userEvent.setup>;

/**
 * Goals signed in, with `handlers` first (the demo answers by default), once its sections show. In StrictMode, as the
 * app runs in development and e2e.
 */
async function openGoals(...handlers: Parameters<typeof server.use>) {
  server.use(me.signedIn(), today.answers(), ...handlers);
  const view = renderApp('/goals', probedRoutes, { strict: true });
  await screen.findByRole('region', { name: 'Goals' });
  return view;
}

const goals = () => screen.getByRole('region', { name: 'Goals' });
const categories = () => screen.getByRole('region', { name: 'Expenses Goals by Category' });
const sidebar = () => screen.getByRole('navigation', { name: 'Main' });
const search = () => screen.getByRole('searchbox', { name: 'Search' });
/** The two cards of the top row: the section's element after its title row holds them. */
const topCards = () => [...(goals().lastElementChild as HTMLElement).children] as HTMLElement[];
const savingsGoalCard = () => topCards()[0]!;
const savingSummaryCard = () => topCards()[1]!;
const selector = () => within(goals()).getByRole('combobox', { name: 'Savings Goal' });
const adjustButton = () => within(goals()).getByRole('button', { name: 'Adjust Goal' });
const meter = () => within(goals()).getByRole('meter', { name: 'Target vs Achievement' });
const dialogFor = (label: string) => screen.getByRole('dialog', { name: `Adjust goal for ${label}` });
const dialog = () => screen.getByRole('dialog');
const targetField = () => within(dialog()).getByRole('textbox', { name: 'Target Amounts' });
const presentField = () => within(dialog()).getByRole('textbox', { name: 'Present Amounts' });
const saveButton = () => within(dialog()).getByRole('button', { name: 'Save' });

/** The card's amounts as terms and their definitions, in reading order. */
const amounts = () =>
  within(goals())
    .getAllByRole('term')
    .map((term) => [term.textContent, term.nextElementSibling?.textContent]);

/** Waits until the card shows a goal's meter. */
const goalShown = () => within(goals()).findByRole('meter', { name: 'Target vs Achievement' });

/** Waits until the card shows the month's amounts. */
const expectAmounts = (achieved: string, target: string) =>
  waitFor(() =>
    expect(amounts()).toEqual([
      ['Target Achieved', achieved],
      ['This month Target', target],
    ]),
  );

/** Picks a month in the selector with the mouse. */
async function pick(user: User, label: string) {
  await user.click(await within(goals()).findByRole('combobox', { name: 'Savings Goal' }));
  await user.click(await screen.findByRole('option', { name: label }));
  await waitFor(() => expect(selector()).toHaveTextContent(label));
}

/** Opens the popup with "Adjust Goal", once the card shows it. */
async function openPopup(user: User) {
  await user.click(await within(goals()).findByRole('button', { name: 'Adjust Goal' }));
  return screen.findByRole('dialog');
}

/** Replaces a field's text. */
async function retype(user: User, field: HTMLElement, text: string) {
  await user.clear(field);
  if (text) await user.type(field, text);
}

const count = (request: string) => requests.filter((sent) => sent === request).length;
const monthRequests = () => requests.filter((sent) => sent.startsWith('GET /api/savings-goals?'));
const puts = () => count('PUT /api/savings-goals');

/** Gives the app time to act on an answer it might act on wrongly. */
const settle = () => new Promise((done) => setTimeout(done, 50));

const refocusWindow = () =>
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });

/** A frontend source file's text. */
const source = (path: string) => readFileSync(resolve(import.meta.dirname, '../../src', path), 'utf8');

/** Every cached query key, as JSON. */
const queryKeys = () =>
  appClient!
    .getQueryCache()
    .getAll()
    .map((query) => JSON.stringify(query.queryKey));

/** Every mutation in the cache, with its key and variables. */
const mutations = () =>
  appClient!
    .getMutationCache()
    .getAll()
    .map((mutation) => ({ key: mutation.options.mutationKey, variables: mutation.state.variables }));

// T13: AC1 and AC2, the first login's Goals page (US-16 criteria 1 and 2; #11, #18, #30, #58, #60, #105 a).
describe('the Goals page', () => {
  it('shows Goals active and the sections "Goals" and "Expenses Goals by Category"', async () => {
    await openGoals();

    const current = within(sidebar())
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.textContent)).toEqual(['Goals']);
    expect(screen.queryByText(/Hello/)).toBeNull();
    expect(
      within(screen.getByRole('main'))
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(['Goals', 'Expenses Goals by Category']);
  });

  it('shows the Savings Goal card: the title, Oct, 2026, the amounts, the meter and "Adjust Goal"', async () => {
    await openGoals();
    await goalShown();

    expect(within(savingsGoalCard()).getByRole('heading', { level: 3 })).toHaveTextContent('Savings Goal');
    expect(selector()).toHaveTextContent('Oct, 2026');
    await expectAmounts('$16,250.00', '$20,000.00');
    for (const term of within(goals()).getAllByRole('term')) {
      expect(term.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }
    expect(meter()).toHaveAttribute('aria-valuenow', '0.8125');
    expect([...meter().querySelectorAll('text')].map((text) => text.textContent)).toEqual(['$0', '$16.2k', '$20k']);
    expect(adjustButton()).toHaveAttribute('type', 'button');
    expect(adjustButton().querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(savingsGoalCard().textContent).toMatch(/^Savings GoalOct, 2026Target Achieved\$16,250\.00/);
    expect(savingsGoalCard().textContent).toMatch(/Adjust Goal$/);
  });

  it('asks for the months, then October’s goal, once each, with the browser’s time zone', async () => {
    const zones: (string | null)[] = [];
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname.startsWith('/api/savings-goals'))
        zones.push(request.headers.get('x-time-zone'));
    });
    await openGoals();
    await goalShown();

    expect(requests.filter((sent) => sent.startsWith('GET /api/savings-goals'))).toEqual([
      'GET /api/savings-goals/months',
      'GET /api/savings-goals?month=2026-10',
    ]);
    expect(zones).toEqual([
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ]);
  });

  it('shows the Saving Summary card and six category cards, white and empty, with nothing focusable', async () => {
    await openGoals();
    await goalShown();

    expect(topCards()).toHaveLength(2);
    expect(savingSummaryCard().textContent).toBe('');
    const categoryCards = [...(categories().lastElementChild as HTMLElement).children];
    expect(categoryCards).toHaveLength(6);
    expect(within(categories()).getByRole('heading', { level: 2 })).toHaveTextContent('Expenses Goals by Category');
    for (const card of [savingSummaryCard(), ...categoryCards]) {
      expect(card.textContent).toBe('');
      expect(card.querySelectorAll('a, button, input, select, textarea, [tabindex], [role]')).toHaveLength(0);
    }
  });
});

// T14: AC3 and AC4, the selector's one list and a picked month (US-16 criteria 4 to 6; #30, #60, #123 a).
describe('the month selector', () => {
  it('opens one list of the 58 months, newest first, Oct, 2026 selected and nothing after it', async () => {
    const { user } = await openGoals();
    await goalShown();

    await user.click(selector());

    const options = within(await screen.findByRole('listbox')).getAllByRole('option');
    expect(options).toHaveLength(58);
    expect(options.slice(0, 3).map((option) => option.textContent)).toEqual(['Oct, 2026', 'Sep, 2026', 'Aug, 2026']);
    expect(options.at(-1)).toHaveTextContent('Jan, 2022');
    expect(screen.getByRole('option', { name: 'Oct, 2026' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('option', { name: 'Nov, 2026' })).toBeNull();
    expect(screen.getAllByRole('listbox')).toHaveLength(1);
  });

  it('shows March 2026’s goal, then December 2025’s whole arc, asking only for each month’s goal', async () => {
    const { user } = await openGoals();
    await goalShown();
    const before = requests.length;

    await pick(user, 'Mar, 2026');
    await expectAmounts('$11,000.00', '$20,000.00');
    expect(meter()).toHaveAttribute('aria-valuenow', '0.55');
    expect(within(meter()).getByText('$11k')).toBeInTheDocument();

    await pick(user, 'Dec, 2025');
    await expectAmounts('$21,000.00', '$20,000.00');
    expect(meter()).toHaveAttribute('aria-valuenow', '1');
    expect(within(meter()).getByText('$21k')).toBeInTheDocument();

    await settle();
    expect(requests.slice(before)).toEqual([
      'GET /api/savings-goals?month=2026-03',
      'GET /api/savings-goals?month=2025-12',
    ]);
  });

  it('changes only the Savings Goal card: the other sections and the page title stay', async () => {
    const { user } = await openGoals();
    await goalShown();
    const summary = savingSummaryCard();
    const categoryList = categories().lastElementChild;

    await pick(user, 'Mar, 2026');
    await expectAmounts('$11,000.00', '$20,000.00');

    expect(savingSummaryCard()).toBe(summary);
    expect(categories().lastElementChild).toBe(categoryList);
  });
});

// T15: AC7, the default month follows the list; a picked month stays (#30; the default month, settled at detailing).
describe('the default month', () => {
  it('moves to November when the list fetched again on window focus starts there', async () => {
    await openGoals();
    await goalShown();

    server.use(savingsGoalMonths.belgradeMidnight());
    refocusWindow();

    await waitFor(() => expect(selector()).toHaveTextContent('Nov, 2026'));
    await expectAmounts('$17,000.00', '$20,000.00');
    expect(count('GET /api/savings-goals?month=2026-11')).toBe(1);
  });

  it('keeps a picked month when the list moves on', async () => {
    const { user } = await openGoals();
    await goalShown();
    await pick(user, 'Mar, 2026');
    await expectAmounts('$11,000.00', '$20,000.00');

    server.use(savingsGoalMonths.belgradeMidnight());
    refocusWindow();
    await waitFor(() => expect(count('GET /api/savings-goals/months')).toBe(2));
    await settle();

    expect(selector()).toHaveTextContent('Mar, 2026');
    await expectAmounts('$11,000.00', '$20,000.00');
    expect(count('GET /api/savings-goals?month=2026-11')).toBe(0);
  });

  // Code review: as Overview's popup (task 014), the open popup keeps its month and its typing while the default month
  // moves behind it, and the save names that month. The card behind it stays on that month, and after the popup closes
  // the month stays selected as if picked: the card shows the saved values and "Adjust Goal" keeps the focus.
  it('keeps an open popup on its month and typing when the list moves on, and saves that month', async () => {
    const backend = goalsBackend();
    const { user } = await openGoals(...backend.handlers);
    await goalShown();
    // The page behind the popup is hidden from assistive technology while it is open (#35): found before.
    const card = savingsGoalCard();
    await openPopup(user);
    await retype(user, targetField(), '30000');

    server.use(savingsGoalMonths.belgradeMidnight());
    refocusWindow();
    await waitFor(() => expect(count('GET /api/savings-goals/months')).toBe(2));
    await settle();

    expect(dialogFor('Oct, 2026')).toBeInTheDocument();
    expect(targetField()).toHaveValue('30000');
    expect(within(card).getAllByText('$20,000.00')).toHaveLength(1);
    expect(count('GET /api/savings-goals?month=2026-11')).toBe(0);
    await user.click(saveButton());

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(backend.saved.map((body) => body.month)).toEqual(['2026-10']);
    await waitFor(() => expect(adjustButton()).toHaveFocus());
    expect(selector()).toHaveTextContent('Oct, 2026');
    await expectAmounts('$16,250.00', '$30,000.00');

    // Held as picked: the next fetch of the list keeps it.
    refocusWindow();
    await waitFor(() => expect(count('GET /api/savings-goals/months')).toBeGreaterThanOrEqual(3));
    await settle();
    expect(selector()).toHaveTextContent('Oct, 2026');
    expect(count('GET /api/savings-goals?month=2026-11')).toBe(0);
  });

  it('still follows the list after a popup opened and closed while the list stayed', async () => {
    const { user } = await openGoals();
    await goalShown();
    await openPopup(user);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    server.use(savingsGoalMonths.belgradeMidnight());
    refocusWindow();

    await waitFor(() => expect(selector()).toHaveTextContent('Nov, 2026'));
    await expectAmounts('$17,000.00', '$20,000.00');
  });
});

// T16: AC8, a month with no goal (US-16 criterion 11, US-17 criterion 8; #58, #69, #71, #84, #85, #90 b, #108 c).
describe('a month with no goal', () => {
  it('shows "No goal for this month" under the divider with "Adjust Goal", and no amounts or meter', async () => {
    await openGoals(savingsGoalForMonth.none());

    expect(await within(goals()).findByText('No goal for this month')).toBeInTheDocument();
    expect(savingsGoalCard().textContent).toBe('Savings GoalOct, 2026No goal for this monthAdjust Goal');
    expect(within(goals()).queryByRole('meter')).toBeNull();
    expect(within(goals()).queryByRole('term')).toBeNull();
    expect(adjustButton()).toBeInTheDocument();
  });

  it('opens the popup empty, requires the Target, and with 500 creates that month’s goal and shows it', async () => {
    const backend = goalsBackend();
    const { user } = await openGoals(...backend.handlers);
    await goalShown();
    backend.set({ month: '2025-07', goal: null });
    await pick(user, 'Jul, 2025');
    await within(goals()).findByText('No goal for this month');
    await openPopup(user);

    expect(dialogFor('Jul, 2025')).toBeInTheDocument();
    expect(targetField()).toHaveValue('');
    expect(targetField()).not.toHaveAttribute('placeholder');
    expect(presentField()).toHaveValue('');
    expect(presentField()).toHaveAttribute('placeholder', 'Write present amount here');

    await user.click(saveButton());
    expect(await within(dialog()).findByText(goalMessages.targetRequired)).toBeInTheDocument();
    expect(backend.saved).toEqual([]);

    await user.type(targetField(), '500');
    await user.click(saveButton());

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(backend.saved).toEqual([{ month: '2025-07', target: usd(50_000), present: usd(0) }]);
    await expectAmounts('$0.00', '$500.00');
    expect(within(goals()).queryByText('No goal for this month')).toBeNull();
    expect(selector()).toHaveTextContent('Jul, 2025');
  });
});

// T17: AC9, AC10 and AC20, popup 110.1 on a past month (US-16 criterion 9, US-17 criteria 1, 3, 4 and 9; #31, #35).
describe('the Adjust Goal popup', () => {
  it('opens for the selected month, named by it, prefilled with its goal, focus on Target', async () => {
    const { user } = await openGoals();
    await goalShown();
    await pick(user, 'Mar, 2026');
    await expectAmounts('$11,000.00', '$20,000.00');

    await openPopup(user);

    expect(dialogFor('Mar, 2026')).toBeInTheDocument();
    expect(targetField()).toHaveValue('20000');
    expect(presentField()).toHaveValue('11000');
    expect(targetField()).toHaveFocus();
    expect(saveButton()).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  const closers = {
    X: async (user: User) => user.click(within(dialog()).getByRole('button', { name: 'Close' })),
    Esc: async (user: User) => user.keyboard('{Escape}'),
    'the dimmed area': async (user: User) => user.click(dialog().previousElementSibling!),
  };

  it.each(Object.keys(closers) as (keyof typeof closers)[])(
    'closes with %s, saves nothing, returns focus to "Adjust Goal" and reopens with the saved values',
    async (closer) => {
      const { user } = await openGoals();
      await goalShown();
      await pick(user, 'Mar, 2026');
      await expectAmounts('$11,000.00', '$20,000.00');
      await openPopup(user);
      await retype(user, targetField(), '99');
      await retype(user, presentField(), '1');

      await closers[closer](user);

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await waitFor(() => expect(adjustButton()).toHaveFocus());
      expect(puts()).toBe(0);
      await openPopup(user);
      expect(targetField()).toHaveValue('20000');
      expect(presentField()).toHaveValue('11000');
    },
  );
});

// T18: AC11 and AC12, a past month's save: the request, the card and the caches (US-17 criterion 5; #11, #58 d, #119).
describe('saving a past month', () => {
  it('sends the month and the cents with the tab’s user and zone, closes and shows the answer', async () => {
    const backend = goalsBackend();
    const headers: Record<string, string | null>[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'PUT') {
        headers.push({
          expectedUser: request.headers.get('x-expected-user'),
          zone: request.headers.get('x-time-zone'),
        });
      }
    });
    const { user } = await openGoals(...backend.handlers);
    await goalShown();
    await pick(user, 'Mar, 2026');
    await expectAmounts('$11,000.00', '$20,000.00');
    await openPopup(user);
    await retype(user, targetField(), '25000.5');
    await retype(user, presentField(), '12000');

    await user.click(saveButton());

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(backend.saved).toEqual([{ month: '2026-03', target: usd(2_500_050), present: usd(1_200_000) }]);
    expect(headers).toEqual([
      { expectedUser: 'tanzir@example.com', zone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    ]);
    await expectAmounts('$12,000.00', '$25,000.50');
    expect(selector()).toHaveTextContent('Mar, 2026');
  });

  it('puts the answer into that month’s query and never into Overview’s current goal', async () => {
    const backend = goalsBackend();
    const { user } = await openGoals(...backend.handlers);
    await goalShown();
    act(() => {
      appClient!.setQueryData(['savings-goals', 'current'], demoGoal);
    });
    await pick(user, 'Mar, 2026');
    await expectAmounts('$11,000.00', '$20,000.00');
    await openPopup(user);
    await retype(user, targetField(), '25000.5');
    await retype(user, presentField(), '12000');

    await user.click(saveButton());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    expect(appClient!.getQueryData<SavingsGoalResponse>(['savings-goals', 'month', '2026-03'])?.goal).toMatchObject({
      target: usd(2_500_050),
      present: usd(1_200_000),
    });
    await settle();
    expect(appClient!.getQueryData(['savings-goals', 'current'])).toEqual(demoGoal);
  });
});

/** Saves Target and Present for a month on Goals, then opens Overview from the sidebar. */
async function saveThenOpenOverview(user: User, monthLabel: string | null, target: string, present: string) {
  await goalShown();
  if (monthLabel !== null) await pick(user, monthLabel);
  await openPopup(user);
  await retype(user, targetField(), target);
  await retype(user, presentField(), present);
  await user.click(saveButton());
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await user.click(within(sidebar()).getByRole('link', { name: 'Overview' }));
  return screen.findByRole('region', { name: 'Goals' });
}

const overviewAmounts = (region: HTMLElement) =>
  within(region)
    .getAllByRole('term')
    .map((term) => term.nextElementSibling?.textContent);

// T19: AC12, Overview after a save on Goals (#58; Marko's notes).
describe('Overview after a save on Goals', () => {
  it('shows the new values for the current month', async () => {
    const backend = goalsBackend();
    const { user } = await openGoals(...backend.handlers);

    const overviewGoals = await saveThenOpenOverview(user, null, '30000', '17000');

    await waitFor(() => expect(overviewAmounts(overviewGoals)).toEqual(['$17,000.00', '$30,000.00']));
    expect(within(overviewGoals).getByText('Oct, 2026')).toBeInTheDocument();
  });

  it('still shows October’s $16,250.00 after a September save', async () => {
    const backend = goalsBackend();
    const { user } = await openGoals(...backend.handlers);

    // Overview's own read is held, so whatever its card shows before the answer comes from the cache alone.
    const { promise: held, resolve: release } = Promise.withResolvers<void>();
    server.use(
      http.get('*/api/savings-goals/current', async () => {
        await held;
        return HttpResponse.json(demoGoal);
      }),
    );

    const overviewGoals = await saveThenOpenOverview(user, 'Sep, 2026', '30000', '17000');

    // Not even for a render before its own answer: September's values never reach Overview's card.
    await settle();
    expect(within(overviewGoals).queryByText('$30,000.00')).toBeNull();
    expect(within(overviewGoals).queryByText('Sep, 2026')).toBeNull();
    release();
    await waitFor(() => expect(overviewAmounts(overviewGoals)).toEqual(['$16,250.00', '$20,000.00']));
    expect(within(overviewGoals).queryByText('$30,000.00')).toBeNull();
    expect(within(overviewGoals).getByText('Oct, 2026')).toBeInTheDocument();
    expect(backend.saved.map((body) => body.month)).toEqual(['2026-09']);
  });
});

// T20: AC13, task 014's rules in the popup on Goals (US-17 criteria 6, 7 and 10; #6, #31, #64, #97 a, #108 a, #123 b).
describe('the popup’s rules and failures on Goals', () => {
  it.each([
    ['Target', '', '11000', goalMessages.targetRequired],
    ['Target', '.', '11000', goalMessages.targetRequired],
    ['Target', '0', '11000', goalMessages.targetPositive],
    ['Target', '1000000000.01', '11000', goalMessages.targetMax],
    ['Present', '20000', '1000000000.01', goalMessages.presentMax],
  ])('rejects %s with Target %j and Present %j: %s, and sends nothing', async (fieldName, target, present, message) => {
    const { user } = await openGoals(...goalsBackend().handlers);
    await goalShown();
    await pick(user, 'Mar, 2026');
    await openPopup(user);
    await retype(user, targetField(), target);
    await retype(user, presentField(), present);

    await user.click(saveButton());

    const field = fieldName === 'Target' ? targetField() : presentField();
    expect(await within(dialog()).findByText(message)).toBeInTheDocument();
    expect(field).toHaveAccessibleDescription(message);
    expect(field.parentElement).toHaveClass(inputStyles.invalid!);
    expect(puts()).toBe(0);
  });

  it('keeps only the characters #64 allows, typed or pasted', async () => {
    const { user } = await openGoals();
    await goalShown();
    await openPopup(user);
    await user.clear(targetField());

    await user.type(targetField(), '1a2,3-4.567');
    expect(targetField()).toHaveValue('1234.56');
    await user.clear(presentField());
    await user.click(presentField());
    await user.paste('12abc');
    expect(presentField()).toHaveValue('');
    await user.paste('12.5');
    expect(presentField()).toHaveValue('12.5');
  });

  it('sends one request while it runs: Save disabled with its spinner, keeping focus', async () => {
    const { promise: released, resolve: release } = Promise.withResolvers<void>();
    server.use(
      http.put('*/api/savings-goals', async () => {
        await released;
        return HttpResponse.json(demoGoalOf('2026-03'));
      }),
    );
    const { user } = await openGoals();
    await goalShown();
    await pick(user, 'Mar, 2026');
    await openPopup(user);

    await user.click(saveButton());
    await waitFor(() => expect(saveButton()).toHaveAttribute('aria-busy', 'true'));
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');
    expect(saveButton()).toHaveFocus();
    await user.click(saveButton());
    await user.type(targetField(), '{Enter}');

    expect(puts()).toBe(1);
    release();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(puts()).toBe(1);
  });

  const failures: [string, () => Response, string][] = [
    ['a 500', () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 }), 'Something went wrong.'],
    ['a network failure', () => HttpResponse.error(), 'Something went wrong.'],
    [
      'the 409 of a month the user cannot choose',
      () => HttpResponse.json({ message: goalMessages.monthUnavailable } satisfies ErrorResponse, { status: 409 }),
      goalMessages.monthUnavailable,
    ],
  ];

  it.each(failures)('shows the message above Save on %s and keeps the typed values', async (_case, answer, message) => {
    server.use(http.put('*/api/savings-goals', answer));
    const { user } = await openGoals();
    await goalShown();
    await pick(user, 'Mar, 2026');
    await openPopup(user);
    await retype(user, targetField(), '30000');

    await user.click(saveButton());

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(message);
    expect(targetField()).toHaveValue('30000');
    expect(presentField()).toHaveValue('11000');
    expect(saveButton()).not.toHaveAttribute('aria-disabled');
  });

  it('shows the write guard’s 409 above Save, then asks for the session at once', async () => {
    server.use(
      http.put('*/api/savings-goals', () =>
        HttpResponse.json({ message: writeGuardMessages.otherUser } satisfies ErrorResponse, { status: 409 }),
      ),
    );
    const { user } = await openGoals();
    await goalShown();
    await openPopup(user);
    const meBefore = count('GET /api/auth/me');

    await user.click(saveButton());

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(writeGuardMessages.otherUser);
    await waitFor(() => expect(count('GET /api/auth/me')).toBe(meBefore + 1));
  });

  it('shows a 400’s field errors under their fields', async () => {
    server.use(
      http.put('*/api/savings-goals', () =>
        HttpResponse.json(
          {
            message: 'Validation failed',
            fieldErrors: { target: goalMessages.invalidAmount, present: goalMessages.presentMax },
          } satisfies ErrorResponse,
          { status: 400 },
        ),
      ),
    );
    const { user } = await openGoals();
    await goalShown();
    await openPopup(user);

    await user.click(saveButton());

    await waitFor(() => expect(targetField()).toHaveAccessibleDescription(goalMessages.invalidAmount));
    expect(presentField()).toHaveAccessibleDescription(goalMessages.presentMax);
    expect(within(dialog()).queryByRole('alert')).toBeNull();
  });
});

/** Holds the PUT until `release`, then answers it with a goal no screen ever showed. */
function heldSave() {
  const { promise: released, resolve: release } = Promise.withResolvers<void>();
  const handler = http.put('*/api/savings-goals', async () => {
    await released;
    return HttpResponse.json({
      month: '2026-03',
      goal: { target: usd(9_900_000), present: usd(100), progress: 0 },
    } satisfies SavingsGoalResponse);
  });
  return { handler, release };
}

/** Sends a Mar, 2026 save that the backend holds, and closes the popup. */
async function sendHeldSave(user: User) {
  await goalShown();
  await pick(user, 'Mar, 2026');
  await openPopup(user);
  await retype(user, targetField(), '99000');
  await user.click(saveButton());
  await waitFor(() => expect(puts()).toBe(1));
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}

// T21: AC17, a save answered after its session ended changes no query or cache, on Goals and Overview (#39; row 025).
describe('a save answered after its session ended', () => {
  const otherUser: CurrentUser = { fullName: 'Ada Lovelace', email: 'ada@example.com', username: 'ada' };

  it('after a logout: only the session stays cached when the answer comes', async () => {
    const held = heldSave();
    server.use(
      held.handler,
      http.post('*/api/auth/logout', () => new HttpResponse(null, { status: 204 })),
    );
    const { user, url } = await openGoals();
    await sendHeldSave(user);

    server.use(me.signedOut());
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    await waitFor(() => expect(url()).toBe('/login'));
    held.release();
    await settle();

    expect(queryKeys()).toEqual(['["session"]']);
    expect(mutations().every((mutation) => mutation.key?.[0] === 'session')).toBe(true);
  });

  it('after a 401 on another request: only the session stays cached when the answer comes', async () => {
    const held = heldSave();
    server.use(held.handler);
    const { user, url } = await openGoals();
    await sendHeldSave(user);

    server.use(
      http.get('*/api/savings-goals/months', () => HttpResponse.json(authenticationRequired, { status: 401 })),
    );
    refocusWindow();
    await waitFor(() => expect(url()).toBe('/login?returnTo=%2Fgoals'));
    held.release();
    await settle();

    expect(queryKeys()).toEqual(['["session"]']);
  });

  it('after another user signed in in another tab: the new user’s goals stay, not the late answer', async () => {
    const held = heldSave();
    server.use(held.handler);
    const { user } = await openGoals();
    await sendHeldSave(user);

    server.use(http.get('*/api/auth/me', () => HttpResponse.json(otherUser)));
    refocusWindow();
    await waitFor(() => expect(selector()).toHaveTextContent('Oct, 2026'));
    await goalShown();
    held.release();
    await settle();

    expect(appClient!.getQueryData(['savings-goals', 'month', '2026-03'])).toBeUndefined();
    expect(queryKeys()).not.toContain('["savings-goals","month","2026-03"]');
    expect(screen.queryByText('$99,000.00')).toBeNull();
    await pick(user, 'Mar, 2026');
    await expectAmounts('$11,000.00', '$20,000.00');
  });

  it('sends every goal write through the one shared write helper', () => {
    const goalsApi = source('api/savings-goals.ts');

    expect(goalsApi).toMatch(/\buseUserWrite\(/);
    expect(goalsApi).not.toMatch(/\bsessionEpoch\b|\bsendWrite\b|\buseMutation\b/);
    expect(source('api/session.ts')).toMatch(/export function useUserWrite\b/);
  });
});

// T22: AC18, months are formatted only by `formatMonthLabel`, never split; no arithmetic on amounts or months.
describe('the Goals sources', () => {
  const files = [
    'components/SavingsGoal/SavingsGoal.tsx',
    'components/SavingsGoalSummary/SavingsGoalSummary.tsx',
    'components/Goals/Goals.tsx',
    'app/pages/GoalsPage.tsx',
    'app/dev/ComponentGallery.tsx',
  ];

  it.each(files)('%s never splits a month or slices one', (file) => {
    expect(source(file)).not.toMatch(
      /\.split\(\s*['"]-['"]\s*\)|\bmonth\.(slice|substring)\(|formatMonthLabel\([^)]*,/,
    );
  });

  it.each(files.slice(0, 4))('%s calculates nothing with cents, progress or months', (file) => {
    expect(source(file).replaceAll(/formatAmountInput\([\w.?]+\.cents\)/g, '')).not.toMatch(
      /\bcents\b|\bprogress\s*[-+*/]|Math\.|addMonths/,
    );
  });

  it.each(['components/SavingsGoal/SavingsGoal.tsx', 'components/Goals/Goals.tsx'])(
    '%s formats its months with formatMonthLabel',
    (file) => {
      expect(source(file)).toMatch(/formatMonthLabel\(/);
    },
  );
});

/** The skeleton under the divider, busy, inside the Savings Goal card. */
const busy = () => savingsGoalCard().querySelector('[aria-busy="true"]');

// T23: AC19, the states (#6, #88, #89, #114).
describe('the Savings Goal card states', () => {
  it('shows the title, a placeholder for the selector and the busy skeleton while the months load', async () => {
    await openGoals(savingsGoalMonths.pending());

    await waitFor(() => expect(busy()).not.toBeNull());
    expect(within(savingsGoalCard()).getByRole('heading', { level: 3 })).toHaveTextContent('Savings Goal');
    expect(within(goals()).queryByRole('combobox')).toBeNull();
    expect(within(goals()).queryByRole('button')).toBeNull();
    expect(savingsGoalCard().textContent).toBe('Savings Goal');
    expect(screen.getByRole('region', { name: 'Expenses Goals by Category' })).toBeInTheDocument();
  });

  it('shows the selector and the busy skeleton, no "Adjust Goal", while the month’s goal loads', async () => {
    await openGoals(savingsGoalForMonth.pending());

    await waitFor(() => expect(within(goals()).getByRole('combobox', { name: 'Savings Goal' })).toBeInTheDocument());
    await waitFor(() => expect(busy()).not.toBeNull());
    expect(selector()).toHaveTextContent('Oct, 2026');
    expect(within(goals()).queryByRole('button', { name: 'Adjust Goal' })).toBeNull();
    expect(within(goals()).queryByRole('meter')).toBeNull();
  });

  it.each([
    ['the months', () => savingsGoalMonths.failsThenAnswers(), 'GET /api/savings-goals/months'],
    ['the month’s goal', () => savingsGoalForMonth.failsThenAnswers(), 'GET /api/savings-goals?month=2026-10'],
  ])('shows the error state when %s fail after 3 retries; Retry loads the card', async (_case, handler, path) => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await openGoals(handler());

    await vi.advanceTimersByTimeAsync(30_000);

    expect(count(path)).toBe(4);
    expect(within(goals()).getByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(within(goals()).queryByRole('button', { name: 'Adjust Goal' })).toBeNull();
    expect(within(savingsGoalCard()).getByRole('heading', { level: 3 })).toHaveTextContent('Savings Goal');
    expect(categories()).toBeInTheDocument();

    await user.click(within(goals()).getByRole('button', { name: 'Retry' }));

    expect(await goalShown()).toHaveAttribute('aria-valuenow', '0.8125');
    expect(within(goals()).queryByRole('alert')).toBeNull();
    expect(selector()).toHaveTextContent('Oct, 2026');
    expect(count(path)).toBe(5);
  });

  it('moves focus from Retry into the card, not the page body', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await openGoals(savingsGoalForMonth.failsThenAnswers());
    await vi.advanceTimersByTimeAsync(30_000);

    await user.click(within(goals()).getByRole('button', { name: 'Retry' }));
    await goalShown();

    expect(document.activeElement).toBe(dataStateRootIn(savingsGoalCard()));
  });

  it('keeps the goal and the months, with no message, when a later refetch fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openGoals();
    await goalShown();
    server.use(savingsGoalMonths.fails(), savingsGoalForMonth.fails());
    const before = count('GET /api/savings-goals?month=2026-10');

    refocusWindow();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(count('GET /api/savings-goals?month=2026-10') - before).toBe(4);
    await expectAmounts('$16,250.00', '$20,000.00');
    expect(selector()).toHaveTextContent('Oct, 2026');
    expect(within(goals()).queryByRole('alert')).toBeNull();
  });

  it('keeps focus on the selector while a month picked with the keyboard loads', async () => {
    const { user } = await openGoals();
    await goalShown();
    server.use(savingsGoalForMonth.pending());
    selector().focus();

    await user.keyboard('{Enter}');
    await screen.findByRole('listbox');
    await user.keyboard('{ArrowDown}{Enter}');

    await waitFor(() => expect(selector()).toHaveTextContent('Sep, 2026'));
    await waitFor(() => expect(busy()).not.toBeNull());
    await settle();
    expect(selector()).toHaveFocus();
    expect(monthRequests()).toContain('GET /api/savings-goals?month=2026-09');
  });
});

// AC20: the keyboard path through the card and the popup (#35, #87).
describe('keyboard use', () => {
  it('tabs from the search field to the selector, then "Adjust Goal"; Enter opens the popup on Target', async () => {
    const { user } = await openGoals();
    await goalShown();

    search().focus();
    await user.tab();
    expect(selector()).toHaveFocus();
    await user.tab();
    expect(adjustButton()).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(await screen.findByRole('dialog', { name: 'Adjust goal for Oct, 2026' })).toBeInTheDocument();
    expect(targetField()).toHaveFocus();
    await user.tab();
    expect(presentField()).toHaveFocus();
    await user.tab();
    expect(saveButton()).toHaveFocus();
    await user.tab();
    expect(within(dialog()).getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(adjustButton()).toHaveFocus());

    await user.keyboard(' ');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('lists the months it was sent, nothing computed in the frontend', async () => {
    const { user } = await openGoals(savingsGoalMonths.answers(['2026-10', '2021-06']));
    await goalShown();

    await user.click(selector());

    expect(
      within(await screen.findByRole('listbox'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Oct, 2026', 'Jun, 2021']);
  });
});
