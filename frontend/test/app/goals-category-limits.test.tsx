import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { type CurrentUser, goalMessages, writeGuardMessages } from '@finebank/shared';
import { focusManager, type QueryClient, useQueryClient } from '@tanstack/react-query';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useEffect } from 'react';
import { Outlet, type RouteObject } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { routes } from '../../src/app/routes';
import categoryIconStyles from '../../src/components/CategoryIcon/CategoryIcon.module.css';
import goalItemStyles from '../../src/components/GoalItem/GoalItem.module.css';
import goalItemListStyles from '../../src/components/GoalItemList/GoalItemList.module.css';
import inputStyles from '../../src/components/PopupInputSmall/PopupInputSmall.module.css';
import {
  authenticationRequired,
  categoryLimits,
  categoryLimitsBackend,
  categoryLimitsWith,
  dataStateRootIn,
  demoCategoryLimits,
  me,
  renderApp,
  saveCategoryLimit,
  savingSummary,
  savingsGoalForMonth,
  signedInDefaults,
  signedInUser,
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

/** Goals signed in, with `handlers` first (the demo answers by default), once its sections show. In StrictMode. */
async function openGoals(...handlers: Parameters<typeof server.use>) {
  server.use(me.signedIn(), today.answers(), ...handlers);
  const view = renderApp('/goals', probedRoutes, { strict: true });
  await screen.findByRole('region', { name: 'Goals' });
  return view;
}

/** The clean category names in the designed order (#56, #61). */
const NAMES = ['Housing', 'Food', 'Transportation', 'Entertainment', 'Shopping', 'Others'];

const goals = () => screen.getByRole('region', { name: 'Goals' });
const categories = () => screen.getByRole('region', { name: 'Expenses Goals by Category' });
const search = () => screen.getByRole('searchbox', { name: 'Search' });
const cards = () => within(categories()).getAllByRole('listitem');
/** The card headed by a category's clean name. */
const cardOf = (name: string) =>
  cards().find((card) => within(card).queryByRole('heading', { level: 3, name }) !== null)!;
const adjustOf = (name: string) => within(cardOf(name)).getByRole('button', { name: 'Adjust' });
const adjustButtons = () => within(categories()).getAllByRole('button', { name: 'Adjust' });
/** Each card's amount line, as drawn. */
const amountOf = (name: string) => cardOf(name).querySelector(`.${goalItemStyles.amount}`)?.textContent;
const amounts = () => NAMES.map(amountOf);
/** Waits until the six cards show. */
const cardsShown = async () => {
  await waitFor(() => expect(within(categories()).getAllByRole('button', { name: 'Adjust' })).toHaveLength(6));
};
const dialog = () => screen.getByRole('dialog');
const targetField = () => within(dialog()).getByRole('textbox', { name: 'Target Amounts' });
const saveButton = () => within(dialog()).getByRole('button', { name: 'Save' });
const closeButton = () => within(dialog()).getByRole('button', { name: 'Close' });

/** Opens a category's popup with its "Adjust". */
async function openLimit(user: User, name: string) {
  await cardsShown();
  await user.click(adjustOf(name));
  return screen.findByRole('dialog', { name: `Adjust limit for ${name}` });
}

async function retype(user: User, field: HTMLElement, text: string) {
  await user.clear(field);
  if (text) await user.type(field, text);
}

const count = (request: string) => requests.filter((sent) => sent === request).length;
const limitPuts = () => count('PUT /api/category-limits');
const settle = () => new Promise((done) => setTimeout(done, 50));
const refocusWindow = () =>
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });

const source = (path: string) => readFileSync(resolve(import.meta.dirname, '../../src', path), 'utf8');

/** The code of a source: its comments left out. */
const code = (path: string) =>
  source(path)
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .replaceAll(/\/\/.*$/gm, '');

const queryKeys = () =>
  appClient!
    .getQueryCache()
    .getAll()
    .map((query) => JSON.stringify(query.queryKey));

const $250 = '$250.00';

// T11: AC1 and AC2, the six cards of a first login (US-16 criteria 7 and 8; #32, #56, #61).
describe('the Expenses Goals by Category cards', () => {
  it('shows six cards in the designed order, each headed by its clean name, with $250.00 and "Adjust"', async () => {
    await openGoals();
    await cardsShown();

    expect(within(categories()).getAllByRole('list')).toHaveLength(1);
    expect(cards()).toHaveLength(6);
    expect(cards().map((card) => within(card).getByRole('heading', { level: 3 }).textContent)).toEqual(NAMES);
    expect(amounts()).toEqual([$250, $250, $250, $250, $250, $250]);
    expect(adjustButtons()).toHaveLength(6);
    for (const card of cards()) {
      // The tile: CategoryIcon `goal`, hidden from assistive technology.
      const tile = card.querySelector(`.${categoryIconStyles.goal}`);
      expect(tile).not.toBeNull();
      expect(tile).toHaveAttribute('aria-hidden', 'true');
      expect(tile!.querySelector('svg')).not.toBeNull();
    }
  });

  it('shows the names with soft hyphens, hidden from assistive technology, beside the clean headings', async () => {
    await openGoals();
    await cardsShown();

    const shown = cards().map((card) => card.querySelector(`.${goalItemStyles.name}`)!);
    expect(shown.map((name) => name.textContent)).toEqual([
      'Hous­ing',
      'Food',
      'Trans­por­ta­tion',
      'En­ter­tain­ment',
      'Shop­ping',
      'Oth­ers',
    ]);
    for (const name of shown) expect(name).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows only the name, the limit and "Adjust": no spending, comparison, percentage or warning', async () => {
    await openGoals();
    await cardsShown();

    expect(cardOf('Food').textContent).toBe('FoodFood$250.00Adjust');
    expect(categories().textContent).not.toMatch(/%|spent|over|left|exceed|warning|\$252|\$510|\$282|\$658/i);
    expect(within(categories()).queryByRole('meter')).toBeNull();
    expect(within(categories()).queryByRole('progressbar')).toBeNull();
    expect(within(categories()).queryByRole('alert')).toBeNull();
  });

  it('asks only for the limits, once, with no month, and never for expenses or transactions', async () => {
    await openGoals();
    await cardsShown();
    await settle();

    expect(requests.filter((sent) => sent.includes('/category-limits'))).toEqual(['GET /api/category-limits']);
    expect(requests.filter((sent) => /\/api\/(expenses|transactions|statistics)/.test(sent))).toEqual([]);
  });
});

// T12: AC3, AC4 and AC15, popup 110.2 (US-16 criterion 10, US-17 criteria 2 to 4 and 9; #31, #35, #64).
describe('the Adjust popup', () => {
  it('opens for Food, named by it, with Target Amounts $250 alone, focus on it, Save and the X', async () => {
    const { user } = await openGoals();

    const opened = await openLimit(user, 'Food');

    expect(opened).toBe(dialog());
    expect(targetField()).toHaveValue('250');
    expect(targetField()).toHaveFocus();
    expect(within(dialog()).getAllByRole('textbox')).toHaveLength(1);
    expect(within(dialog()).queryByRole('textbox', { name: 'Present Amounts' })).toBeNull();
    expect(saveButton()).toBeInTheDocument();
    expect(closeButton()).toBeInTheDocument();
  });

  it('opens each card’s popup for its own category', async () => {
    const { user } = await openGoals(categoryLimits.foodChanged());

    await openLimit(user, 'Transportation');
    expect(targetField()).toHaveValue('250');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await openLimit(user, 'Food');
    expect(targetField()).toHaveValue('300.50');
  });

  const closers = {
    X: async (user: User) => user.click(closeButton()),
    Esc: async (user: User) => user.keyboard('{Escape}'),
    'the dimmed area': async (user: User) => user.click(dialog().previousElementSibling!),
  };

  it.each(Object.keys(closers) as (keyof typeof closers)[])(
    'closes with %s, saves nothing, returns focus to Food’s "Adjust" and reopens with $250',
    async (closer) => {
      const { user } = await openGoals();
      await openLimit(user, 'Food');
      await retype(user, targetField(), '999');

      await closers[closer](user);

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await waitFor(() => expect(adjustOf('Food')).toHaveFocus());
      expect(limitPuts()).toBe(0);
      await openLimit(user, 'Food');
      expect(targetField()).toHaveValue('250');
    },
  );
});

// T13: AC5 and AC6, a save: the request, the card, the queries after it (US-17 criterion 5; #11, #31, #119).
describe('saving a limit', () => {
  it('sends Food’s cents with the tab’s user, closes, shows $300.50 on Food only, and the same after a reload', async () => {
    const backend = categoryLimitsBackend();
    const { user, unmount } = await openGoals(...backend.handlers);
    await openLimit(user, 'Food');
    await retype(user, targetField(), '300.5');

    await user.click(saveButton());

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(backend.saved).toEqual([{ category: 'food', limit: usd(30_050) }]);
    expect(backend.expectedUsers).toEqual([signedInUser.email]);
    await waitFor(() => expect(amounts()).toEqual([$250, '$300.50', $250, $250, $250, $250]));
    await waitFor(() => expect(adjustOf('Food')).toHaveFocus());

    unmount();
    await openGoals(...backend.handlers);
    await cardsShown();
    expect(amounts()).toEqual([$250, '$300.50', $250, $250, $250, $250]);
  });

  it('puts the answer into the limits query, then asks again for the limits only', async () => {
    const backend = categoryLimitsBackend();
    const { user } = await openGoals(...backend.handlers);
    await within(goals()).findByRole('meter', { name: 'Target vs Achievement' });
    await within(goals()).findByRole('table');
    await openLimit(user, 'Food');
    await retype(user, targetField(), '300.5');
    const before = requests.length;

    await user.click(saveButton());

    await waitFor(() => expect(count('GET /api/category-limits')).toBe(2));
    await settle();
    expect(requests.slice(before)).toEqual(['PUT /api/category-limits', 'GET /api/category-limits']);
    expect(appClient!.getQueryData(['category-limits'])).toEqual(categoryLimitsWith('food', usd(30_050)));
  });

  it('leaves the Savings Goal and Saving Summary cards as they were', async () => {
    const backend = categoryLimitsBackend();
    const { user } = await openGoals(...backend.handlers);
    await within(goals()).findByRole('meter', { name: 'Target vs Achievement' });
    await within(goals()).findByRole('table');
    const topRow = goals().textContent;
    await openLimit(user, 'Food');
    await retype(user, targetField(), '300.5');

    await user.click(saveButton());

    await waitFor(() => expect(amountOf('Food')).toBe('$300.50'));
    await settle();
    expect(goals().textContent).toBe(topRow);
  });
});

/** Picks a month in one of the Goals selectors with the mouse. */
async function pick(user: User, selector: 'Savings Goal' | 'Saving Summary', label: string) {
  await user.click(await within(goals()).findByRole('combobox', { name: selector }));
  await user.click(await screen.findByRole('option', { name: label }));
  await waitFor(() => expect(within(goals()).getByRole('combobox', { name: selector })).toHaveTextContent(label));
}

// T14: AC7, one limit for every month (#32).
describe('the limits and the months', () => {
  it('keeps the cards when either selector picks another month, and asks for no limits with a month', async () => {
    const backend = categoryLimitsBackend();
    const { user } = await openGoals(...backend.handlers);
    await openLimit(user, 'Food');
    await retype(user, targetField(), '300.5');
    await user.click(saveButton());
    await waitFor(() => expect(amountOf('Food')).toBe('$300.50'));
    await settle();
    const limitRequests = requests.filter((sent) => sent.includes('/category-limits')).length;

    await pick(user, 'Savings Goal', 'Mar, 2026');
    await pick(user, 'Saving Summary', 'Mar, 2026');
    await settle();

    expect(amounts()).toEqual([$250, '$300.50', $250, $250, $250, $250]);
    expect(requests.filter((sent) => sent.includes('/category-limits'))).toHaveLength(limitRequests);
    expect(requests.filter((sent) => sent.includes('/category-limits') && sent.includes('?'))).toEqual([]);
  });
});

// T15: AC8, the Target rules and the failures (US-17 criteria 6, 7 and 10; #6, #31, #64, #84, #97 a, #108 a).
describe('the popup’s rules and failures', () => {
  it.each([
    ['empty', '', goalMessages.targetRequired],
    ['a lone point', '.', goalMessages.targetRequired],
    ['0', '0', goalMessages.targetPositive],
    ['one cent above the maximum', '1000000000.01', goalMessages.targetMax],
  ])('rejects %s under the field and sends nothing', async (_case, text, message) => {
    const { user } = await openGoals(saveCategoryLimit.echoes());
    await openLimit(user, 'Food');
    await retype(user, targetField(), text);

    await user.click(saveButton());

    expect(await within(dialog()).findByText(message)).toBeInTheDocument();
    expect(targetField()).toHaveAccessibleDescription(message);
    expect(targetField().parentElement).toHaveClass(inputStyles.invalid!);
    expect(limitPuts()).toBe(0);
  });

  it('saves the maximum, 1000000000, as 100,000,000,000 cents', async () => {
    const backend = categoryLimitsBackend();
    const { user } = await openGoals(...backend.handlers);
    await openLimit(user, 'Transportation');
    await retype(user, targetField(), '1000000000');

    await user.click(saveButton());

    await waitFor(() => expect(amountOf('Transportation')).toBe('$1,000,000,000.00'));
    expect(backend.saved).toEqual([{ category: 'transportation', limit: usd(100_000_000_000) }]);
  });

  it('keeps only the characters #64 allows, typed or pasted', async () => {
    const { user } = await openGoals();
    await openLimit(user, 'Food');
    await user.clear(targetField());

    await user.type(targetField(), '1a2,3-4.567');
    expect(targetField()).toHaveValue('1234.56');
    await user.clear(targetField());
    await user.paste('12abc');
    expect(targetField()).toHaveValue('');
    await user.paste('12.5');
    expect(targetField()).toHaveValue('12.5');
  });

  it('sends one request while it runs: Save disabled with its spinner, keeping focus', async () => {
    const held = saveCategoryLimit.held({ category: 'food', limit: usd(25_000) });
    const { user } = await openGoals(held.handler);
    await openLimit(user, 'Food');

    await user.click(saveButton());
    await waitFor(() => expect(saveButton()).toHaveAttribute('aria-busy', 'true'));
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');
    expect(saveButton()).toHaveFocus();
    await user.click(saveButton());
    await user.type(targetField(), '{Enter}');

    expect(limitPuts()).toBe(1);
    held.release();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(limitPuts()).toBe(1);
  });

  it.each([
    ['a 500', saveCategoryLimit.fails, 'Something went wrong.'],
    ['a network failure', saveCategoryLimit.networkError, 'Something went wrong.'],
    ['the write guard’s 409', saveCategoryLimit.otherUser, writeGuardMessages.otherUser],
  ])('shows the message above Save on %s and keeps the typed value', async (_case, handler, message) => {
    const { user } = await openGoals(handler());
    await openLimit(user, 'Food');
    await retype(user, targetField(), '300.5');

    await user.click(saveButton());

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(message);
    expect(targetField()).toHaveValue('300.5');
    expect(saveButton()).not.toHaveAttribute('aria-disabled');
    // The page behind the open popup is hidden from the role queries: the limits as cached.
    expect(appClient!.getQueryData(['category-limits'])).toEqual(demoCategoryLimits);
  });

  it('asks for the session at once after the write guard’s 409', async () => {
    const { user } = await openGoals(saveCategoryLimit.otherUser());
    await openLimit(user, 'Food');
    const meBefore = count('GET /api/auth/me');

    await user.click(saveButton());

    await within(dialog()).findByRole('alert');
    await waitFor(() => expect(count('GET /api/auth/me')).toBe(meBefore + 1));
  });

  it('shows a 400’s field error under the field, with no message above Save', async () => {
    const { user } = await openGoals(saveCategoryLimit.fieldError(goalMessages.invalidAmount));
    await openLimit(user, 'Food');

    await user.click(saveButton());

    await waitFor(() => expect(targetField()).toHaveAccessibleDescription(goalMessages.invalidAmount));
    expect(within(dialog()).queryByRole('alert')).toBeNull();
    expect(targetField()).toHaveValue('250');
  });

  it('clears the last message when the next try starts', async () => {
    const { user } = await openGoals(saveCategoryLimit.fails());
    await openLimit(user, 'Food');
    await user.click(saveButton());
    await within(dialog()).findByRole('alert');
    const held = saveCategoryLimit.held({ category: 'food', limit: usd(25_000) });
    server.use(held.handler);

    await user.click(saveButton());

    await waitFor(() => expect(within(dialog()).queryByRole('alert')).toBeNull());
    held.release();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

/** Sends a Food save that the backend holds, and closes the popup. */
async function sendHeldSave(user: User) {
  await openLimit(user, 'Food');
  await retype(user, targetField(), '99000');
  await user.click(saveButton());
  await waitFor(() => expect(limitPuts()).toBe(1));
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}

// T17: AC12, a save answered after its session ended changes no query or cache (#39; row 025).
describe('a limit save answered after its session ended', () => {
  const otherUser: CurrentUser = { fullName: 'Ada Lovelace', email: 'ada@example.com', username: 'ada' };

  it('after a logout: only the session stays cached when the answer comes', async () => {
    const held = saveCategoryLimit.held();
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
  });

  it('after a 401 on another request: only the session stays cached when the answer comes', async () => {
    const held = saveCategoryLimit.held();
    server.use(held.handler);
    const { user, url } = await openGoals();
    await sendHeldSave(user);

    server.use(http.get('*/api/category-limits', () => HttpResponse.json(authenticationRequired, { status: 401 })));
    refocusWindow();
    await waitFor(() => expect(url()).toBe('/login?returnTo=%2Fgoals'));
    held.release();
    await settle();

    expect(queryKeys()).toEqual(['["session"]']);
  });

  it('after another user signed in in another tab: the new user’s limits stay, not the late answer', async () => {
    const held = saveCategoryLimit.held();
    server.use(held.handler);
    const { user } = await openGoals();
    await sendHeldSave(user);
    const limitsBefore = count('GET /api/category-limits');

    server.use(http.get('*/api/auth/me', () => HttpResponse.json(otherUser)));
    refocusWindow();
    await waitFor(() => expect(count('GET /api/category-limits')).toBeGreaterThan(limitsBefore));
    await cardsShown();
    held.release();
    await settle();

    expect(appClient!.getQueryData(['category-limits'])).toEqual(demoCategoryLimits);
    expect(screen.queryByText('$99,000.00')).toBeNull();
    expect(amounts()).toEqual([$250, $250, $250, $250, $250, $250]);
  });

  it('sends the limit write through the one shared write helper', () => {
    const limitsApi = source('api/category-limits.ts');

    expect(limitsApi).toMatch(/\buseUserWrite\(/);
    expect(limitsApi).not.toMatch(
      /\bsessionEpoch\b|\bsendWrite\b|\buseMutation\b|\bapiRequest\(categoryLimitsContract\.save/,
    );
  });
});

// T16: AC8, the popup submit logic in one hook both popups use (Marko at the task 026 gate on copied code).
describe('the popups’ shared submit logic', () => {
  const popups = [
    'components/SavingsGoalPopup/SavingsGoalPopup.tsx',
    'components/CategoryLimitPopup/CategoryLimitPopup.tsx',
  ];

  it.each(popups)('%s submits through useGoalPopupSubmit and keeps no copy of it', (file) => {
    const text = source(file);

    expect(text).toMatch(/\buseGoalPopupSubmit\(/);
    expect(text).not.toMatch(/\buseRef\b|\bserverFieldErrors\b|\bformErrorFor\b|\.reset\(\)|submitting/);
  });

  it('keeps the hook next to GoalPopupInput, which stays presentational', () => {
    expect(source('components/GoalPopupInput/useGoalPopupSubmit.ts')).toMatch(/export function useGoalPopupSubmit\b/);
    expect(source('components/GoalPopupInput/GoalPopupInput.tsx')).not.toMatch(/useGoalPopupSubmit|useMutation|api\//);
  });
});

// T18: AC13, a category without a limit (#69, #85, #90 b, #108 a, #125).
describe('a category without a limit', () => {
  it('shows the tile, the name, "No limit set" in the amount’s place in the empty-message style, and "Adjust"', async () => {
    await openGoals(categoryLimits.noFoodLimit());
    await cardsShown();

    const food = cardOf('Food');
    expect(food.textContent).toBe('FoodFoodNo limit setAdjust');
    expect(food.querySelector(`.${categoryIconStyles.goal}`)).not.toBeNull();
    expect(within(food).getByText('No limit set')).toHaveClass(goalItemStyles.noLimit!);
    expect(amountOf('Food')).toBeUndefined();
    expect(amounts().filter((amount) => amount !== undefined)).toEqual([$250, $250, $250, $250, $250]);
  });

  it('draws "No limit set" as DataState’s empty message: Gray/01, Regular 14/20', () => {
    const css = readFileSync(resolve(import.meta.dirname, '../../src/components/GoalItem/GoalItem.module.css'), 'utf8');
    const rule = /\.noLimit\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';

    expect(rule).toMatch(/color:\s*var\(--color-gray-01\)/);
    expect(rule).toMatch(/font:\s*var\(--font-regular-14-20\)/);
  });

  it('opens the popup empty with no placeholder, requires the Target, and with 250 creates the limit', async () => {
    const backend = categoryLimitsBackend(categoryLimitsWith('food', null));
    const { user } = await openGoals(...backend.handlers);
    await openLimit(user, 'Food');

    expect(targetField()).toHaveValue('');
    expect(targetField()).not.toHaveAttribute('placeholder');

    await user.click(saveButton());
    expect(await within(dialog()).findByText(goalMessages.targetRequired)).toBeInTheDocument();
    expect(backend.saved).toEqual([]);

    await user.type(targetField(), '250');
    await user.click(saveButton());

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(backend.saved).toEqual([{ category: 'food', limit: usd(25_000) }]);
    await waitFor(() => expect(amountOf('Food')).toBe($250));
    expect(within(cardOf('Food')).queryByText('No limit set')).toBeNull();
  });
});

/** The section's busy skeleton. */
const busy = () => categories().querySelector('[aria-busy="true"]');

// T19: AC14, the states (#6, #88, #89, #105 a, #114, #116).
describe('the category cards’ states', () => {
  it('shows six skeleton cards, busy, with no "Adjust" while the limits load', async () => {
    await openGoals(categoryLimits.pending());

    await waitFor(() => expect(busy()).not.toBeNull());
    expect(busy()!.querySelectorAll(`.${goalItemListStyles.card}`)).toHaveLength(6);
    expect(within(categories()).queryByRole('button')).toBeNull();
    expect(within(categories()).getByRole('heading', { level: 2 })).toHaveTextContent('Expenses Goals by Category');
  });

  it('shows the error in one card when the first load fails after 3 retries; the rest works; Retry loads', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await openGoals(categoryLimits.failsThenAnswers());

    await vi.advanceTimersByTimeAsync(30_000);

    expect(count('GET /api/category-limits')).toBe(4);
    expect(within(categories()).getByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(within(categories()).queryByRole('listitem')).toBeNull();
    expect(within(categories()).getAllByRole('button')).toHaveLength(1);
    expect(within(goals()).getByRole('meter', { name: 'Target vs Achievement' })).toBeInTheDocument();
    expect(within(goals()).getByRole('button', { name: 'Adjust Goal' })).toBeInTheDocument();

    await user.click(within(categories()).getByRole('button', { name: 'Retry' }));

    await cardsShown();
    expect(within(categories()).queryByRole('alert')).toBeNull();
    expect(count('GET /api/category-limits')).toBe(5);
  });

  it('leaves focus on the state root after a Retry, never the page body', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await openGoals(categoryLimits.failsThenAnswers());
    await vi.advanceTimersByTimeAsync(30_000);
    within(categories()).getByRole('button', { name: 'Retry' }).focus();

    await user.keyboard('{Enter}');
    await cardsShown();

    expect(document.activeElement).toBe(dataStateRootIn(categories()));
  });

  it('keeps the cards with no message when a later refetch fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openGoals();
    await cardsShown();
    server.use(categoryLimits.fails());
    const before = count('GET /api/category-limits');

    refocusWindow();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(count('GET /api/category-limits') - before).toBe(4);
    expect(amounts()).toEqual([$250, $250, $250, $250, $250, $250]);
    expect(within(categories()).queryByRole('alert')).toBeNull();
  });

  // Task 027 code review: both top cards, as AC14 names them.
  it.each([
    ['the Savings Goal card', savingsGoalForMonth.fails, 0],
    ['the Saving Summary card', savingSummary.fails, 1],
  ])('keeps the category cards working when %s fails', async (_case, handler, failing) => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await openGoals(handler());
    await vi.advanceTimersByTimeAsync(30_000);

    const topCards = [...(goals().lastElementChild as HTMLElement).children] as HTMLElement[];
    expect(within(topCards[failing]!).getByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(within(topCards[1 - failing]!).queryByRole('alert')).toBeNull();
    await cardsShown();
    await user.click(adjustOf('Shopping'));
    expect(await screen.findByRole('dialog', { name: 'Adjust limit for Shopping' })).toBeInTheDocument();
  });
});

// T20: AC15 and AC16, the keyboard and assistive technology (#35, #87, #115 b).
describe('keyboard and assistive technology', () => {
  it('tabs after the two selectors and "Adjust Goal" to the six "Adjust" in order, each described by its category', async () => {
    const { user } = await openGoals();
    await within(goals()).findByRole('meter', { name: 'Target vs Achievement' });
    await cardsShown();

    search().focus();
    await user.tab();
    expect(within(goals()).getByRole('combobox', { name: 'Savings Goal' })).toHaveFocus();
    await user.tab();
    expect(within(goals()).getByRole('button', { name: 'Adjust Goal' })).toHaveFocus();
    await user.tab();
    expect(within(goals()).getByRole('combobox', { name: 'Saving Summary' })).toHaveFocus();
    for (const name of NAMES) {
      await user.tab();
      expect(adjustOf(name)).toHaveFocus();
      expect(adjustOf(name)).toHaveAccessibleName('Adjust');
      expect(adjustOf(name)).toHaveAccessibleDescription(name);
    }
  });

  it('opens with Enter on the field; Tab goes field, Save, X; Esc returns focus to that "Adjust"; Space opens it', async () => {
    const { user } = await openGoals();
    await cardsShown();
    adjustOf('Entertainment').focus();

    await user.keyboard('{Enter}');
    expect(await screen.findByRole('dialog', { name: 'Adjust limit for Entertainment' })).toBeInTheDocument();
    expect(targetField()).toHaveFocus();
    await user.tab();
    expect(saveButton()).toHaveFocus();
    await user.tab();
    expect(closeButton()).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(adjustOf('Entertainment')).toHaveFocus());

    await user.keyboard(' ');
    expect(await screen.findByRole('dialog', { name: 'Adjust limit for Entertainment' })).toBeInTheDocument();
  });

  it('reads each card as a list item headed by the clean name, the limit as shown, the icon hidden', async () => {
    await openGoals();
    await cardsShown();

    const list = within(categories()).getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(6);
    expect(
      within(categories())
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(NAMES);
    expect(within(cardOf('Transportation')).getByRole('heading', { level: 3 }).textContent).not.toContain('­');
    expect(within(cardOf('Transportation')).getByText($250)).toBeVisible();
    expect(within(categories()).queryAllByRole('img')).toEqual([]);
  });
});

// T21: AC2 and AC9, the cards show what they are sent: no arithmetic, no spending (#11, #32, #74).
describe('the category limit sources', () => {
  const files = [
    'components/GoalItem/GoalItem.tsx',
    'components/GoalItemList/GoalItemList.tsx',
    'components/CategoryLimitPopup/CategoryLimitPopup.tsx',
    'api/category-limits.ts',
  ];

  it.each(files)('%s calculates, sorts and filters nothing', (file) => {
    expect(code(file).replaceAll(/formatAmountInput\([\w.?]+\.cents\)/g, '')).not.toMatch(
      /\bcents\b|Math\.|\.reduce\(|\.sort\(|\.toSorted\(|\.filter\(|\blimit\s*[-+*/%]|[-+*/%]\s*limit\b/,
    );
  });

  it.each(files)('%s reads no spending: no expenses, transactions or statistics', (file) => {
    expect(source(file)).not.toMatch(/api\/(expenses|transactions|statistics)|expensesContract|useExpenses/);
  });

  it('formats the limit with formatMoney and the field with formatAmountInput', () => {
    expect(source('components/GoalItem/GoalItem.tsx')).toMatch(/formatMoney\(/);
    expect(source('components/CategoryLimitPopup/CategoryLimitPopup.tsx')).toMatch(/formatAmountInput\(/);
  });
});
