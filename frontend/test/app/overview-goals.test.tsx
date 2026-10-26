import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  type CurrentUser,
  type ErrorResponse,
  goalMessages,
  type SavingsGoalRequest,
  type SavingsGoalResponse,
} from '@finebank/shared';
import { focusManager, type QueryClient, useQueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useEffect } from 'react';
import { createMemoryRouter, Outlet, type RouteObject } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '../../src/app/AppProviders';
import { AppShell } from '../../src/app/AppShell';
import { routes } from '../../src/app/routes';
import { RequireAuth } from '../../src/routes/RequireAuth';
import inputStyles from '../../src/components/PopupInputSmall/PopupInputSmall.module.css';
import { arcPath } from '../../src/components/TargetVsAchievementMeter/geometry';
import meterStyles from '../../src/components/TargetVsAchievementMeter/TargetVsAchievementMeter.module.css';
import {
  authenticationRequired,
  demoGoal,
  goalBackend,
  me,
  noGoal,
  renderApp,
  savingsGoal,
  signedInDefaults,
  signedInUser,
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

const usd = (cents: number) => ({ cents, currency: 'USD' as const });
const goalOf = (target: number, present: number, progress: number): SavingsGoalResponse => ({
  month: '2026-10',
  goal: { target: usd(target), present: usd(present), progress },
});

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

/** Overview signed in, with `handlers` first (the demo goal by default), once the Goals section shows. */
async function openOverview(...handlers: Parameters<typeof server.use>) {
  server.use(me.signedIn(), today.answers(), ...handlers);
  const router = createMemoryRouter(probedRoutes, { initialEntries: ['/overview'] });
  const user = userEvent.setup();
  render(<AppProviders router={router} />);
  await screen.findByRole('region', { name: 'Goals' });
  const url = () => `${router.state.location.pathname}${router.state.location.search}`;
  return { user, router, url };
}

const goals = () => screen.getByRole('region', { name: 'Goals' });
/** The Goals card: the section's element after its title row. */
const goalsCard = () => goals().lastElementChild as HTMLElement;
const pencil = () => within(goals()).getByRole('button', { name: 'Edit savings goal' });
const dialog = () => screen.getByRole('dialog', { name: 'Edit savings goal' });
const targetField = () => within(dialog()).getByRole('textbox', { name: 'Target Amounts' });
const presentField = () => within(dialog()).getByRole('textbox', { name: 'Present Amounts' });
const saveButton = () => within(dialog()).getByRole('button', { name: 'Save' });

/** The card's amounts as terms and their definitions, in reading order. */
const amounts = () =>
  within(goals())
    .getAllByRole('term')
    .map((term) => [term.textContent, term.nextElementSibling?.textContent]);

/** Waits until the card shows its goal. */
const goalShown = () => within(goals()).findByRole('meter', { name: 'Target vs Achievement' });

/** Opens the popup with the pencil, once the card shows. */
async function openPopup(user: ReturnType<typeof userEvent.setup>) {
  await within(goals()).findByRole('button', { name: 'Edit savings goal' });
  await user.click(pencil());
  return screen.findByRole('dialog', { name: 'Edit savings goal' });
}

/** Replaces a field's text. */
async function retype(user: ReturnType<typeof userEvent.setup>, field: HTMLElement, text: string) {
  await user.clear(field);
  if (text) await user.type(field, text);
}

const count = (request: string) => requests.filter((sent) => sent === request).length;
const puts = () => count('PUT /api/savings-goals');

/** Gives the app time to act on an answer it might act on wrongly. */
const settle = () => new Promise((done) => setTimeout(done, 50));

const refocusWindow = () =>
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });

/** Whether the elements come in this order in the document. */
const inOrder = (...elements: Element[]) =>
  elements.every(
    (element, index) =>
      index === 0 || Boolean(elements[index - 1]!.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING),
  );

/** A frontend source file's text. */
const source = (path: string) => readFileSync(resolve(import.meta.dirname, '../../src', path), 'utf8');

// T11: the first login's Goals card (AC1, AC2, AC14; #11, #18, #58, demo-data.md).
describe('the Goals card', () => {
  it('shows the Target with the pencil, the month, and the amounts with their icons', async () => {
    await openOverview();
    await goalShown();

    // The header row: the Target, the pencil after it, the month on the right.
    const [target] = within(goals()).getAllByText('$20,000.00');
    expect(goalsCard().textContent).toMatch(/^\$20,000\.00Oct, 2026Target Achieved/);
    expect(inOrder(target!, pencil(), within(goals()).getByText('Oct, 2026'))).toBe(true);
    expect(pencil()).toHaveAttribute('type', 'button');
    expect(pencil().querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(amounts()).toEqual([
      ['Target Achieved', '$16,250.00'],
      ['This month Target', '$20,000.00'],
    ]);
    for (const term of within(goals()).getAllByRole('term')) {
      expect(term.parentElement!.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('draws the meter at the progress the backend sent, with the compact labels', async () => {
    await openOverview();

    const gauge = await goalShown();

    expect(gauge).toHaveAttribute('aria-valuenow', '0.8125');
    expect(gauge).toHaveAttribute('aria-valuetext', '$16.2k');
    expect(gauge.querySelector(`.${meterStyles.progress}`)).toHaveAttribute('d', arcPath(0.8125));
    expect([...gauge.querySelectorAll('text')].map((text) => text.textContent)).toEqual(['$0', '$16.2k', '$20k']);
  });

  // T12: AC2, the gauge at the progress it gets (#31).
  it('draws the whole arc and $25k for a Present above the Target', async () => {
    await openOverview(savingsGoal.answers(goalOf(2_000_000, 2_500_000, 1)));

    const gauge = await goalShown();

    expect(gauge).toHaveAttribute('aria-valuenow', '1');
    expect(gauge.querySelector(`.${meterStyles.progress}`)).toHaveAttribute(
      'd',
      gauge.querySelector(`.${meterStyles.track}`)!.getAttribute('d'),
    );
    expect(within(gauge).getByText('$25k')).toBeInTheDocument();
    expect(amounts()[0]).toEqual(['Target Achieved', '$25,000.00']);
  });

  it('draws no arc and $0 in the center for a Present of $0.00', async () => {
    await openOverview(savingsGoal.answers(goalOf(2_000_000, 0, 0)));

    const gauge = await goalShown();

    expect(gauge).toHaveAttribute('aria-valuenow', '0');
    expect(gauge.querySelector(`.${meterStyles.progress}`)).toBeNull();
    expect([...gauge.querySelectorAll('text')].map((text) => text.textContent)).toEqual(['$0', '$0', '$20k']);
    expect(amounts()[0]).toEqual(['Target Achieved', '$0.00']);
  });

  it('shows the progress it gets, never one of its own', async () => {
    await openOverview(savingsGoal.answers(goalOf(2_000_000, 1_625_000, 0.25)));

    expect(await goalShown()).toHaveAttribute('aria-valuenow', '0.25');
  });

  it('asks for the goal with the browser’s time zone', async () => {
    const zones: (string | null)[] = [];
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname === '/api/savings-goals/current')
        zones.push(request.headers.get('x-time-zone'));
    });
    await openOverview();
    await goalShown();

    expect(zones).toEqual([Intl.DateTimeFormat().resolvedOptions().timeZone]);
  });

  // AC14: the frontend formats the cents it gets and reads typed text; it calculates nothing (#11, #18).
  it('never calculates with amounts: cents only go to formatAmountInput', () => {
    const files = [
      'components/Goals/Goals.tsx',
      'components/SavingsGoalPopup/SavingsGoalPopup.tsx',
      'api/savings-goals.ts',
      'app/pages/OverviewPage.tsx',
    ];
    const otherUses = files.filter((file) =>
      /\bcents\b|\bprogress\s*[-+*/]|Math\./.test(source(file).replaceAll(/formatAmountInput\([\w.?]+\.cents\)/g, '')),
    );

    expect(otherUses).toEqual([]);
  });
});

// T13: the popup opens prefilled, and X, Esc and the dimmed area close it with nothing saved (AC4, AC5, AC19; #35).
describe('the edit goal popup', () => {
  it('opens prefilled with the goal, focus on the Target field', async () => {
    const { user } = await openOverview();

    await openPopup(user);

    expect(targetField()).toHaveValue('20000');
    expect(presentField()).toHaveValue('16250');
    expect(targetField()).toHaveFocus();
    expect(saveButton()).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('shows decimals only when they are not zero: $1,250.50 as 1250.50', async () => {
    const { user } = await openOverview(savingsGoal.answers(goalOf(125_050, 125_000, 1)));

    await openPopup(user);

    expect(targetField()).toHaveValue('1250.50');
    expect(presentField()).toHaveValue('1250');
  });

  const closers = {
    X: async (user: ReturnType<typeof userEvent.setup>) =>
      user.click(within(dialog()).getByRole('button', { name: 'Close' })),
    Esc: async (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}'),
    'the dimmed area': async (user: ReturnType<typeof userEvent.setup>) => user.click(dialog().previousElementSibling!),
  };

  it.each(Object.keys(closers) as (keyof typeof closers)[])(
    'closes with %s, saves nothing, returns focus to the pencil and reopens with the saved values',
    async (closer) => {
      const { user } = await openOverview();
      await openPopup(user);
      await retype(user, targetField(), '99');
      await retype(user, presentField(), '1');

      await closers[closer](user);

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await waitFor(() => expect(pencil()).toHaveFocus());
      expect(puts()).toBe(0);
      await user.click(pencil());
      expect(await screen.findByRole('dialog', { name: 'Edit savings goal' })).toBeInTheDocument();
      expect(targetField()).toHaveValue('20000');
      expect(presentField()).toHaveValue('16250');
    },
  );

  it('opens with Enter and Space on the pencil, and tabs Target, Present, Save, X', async () => {
    const { user } = await openOverview();
    await goalShown();
    pencil().focus();

    await user.keyboard('{Enter}');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(targetField()).toHaveFocus();
    await user.tab();
    expect(presentField()).toHaveFocus();
    await user.tab();
    expect(saveButton()).toHaveFocus();
    await user.tab();
    expect(within(dialog()).getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(pencil()).toHaveFocus());

    await user.keyboard(' ');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(targetField()).toHaveFocus();
  });
});

// T14: a save sends integer cents, closes the popup and shows the answer; only the goal is asked again (AC6, AC15).
describe('saving the goal', () => {
  it('sends the amounts in cents, closes, shows the saved goal and asks again for the goal only', async () => {
    const backend = goalBackend();
    const { user } = await openOverview(...backend.handlers);
    await openPopup(user);
    await retype(user, targetField(), '25000.5');
    await retype(user, presentField(), '');
    const before = [...requests];

    await user.click(saveButton());

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(backend.saved).toEqual([
      { month: '2026-10', target: usd(2_500_050), present: usd(0) },
    ] satisfies SavingsGoalRequest[]);
    expect(within(goals()).getAllByText('$25,000.50')).toHaveLength(2);
    expect(amounts()).toEqual([
      ['Target Achieved', '$0.00'],
      ['This month Target', '$25,000.50'],
    ]);
    await waitFor(() => expect(requests.slice(before.length)).toContain('GET /api/savings-goals/current'));
    const after = requests.slice(before.length);
    expect(after.filter((sent) => sent === 'PUT /api/savings-goals')).toHaveLength(1);
    for (const path of ['/api/accounts', '/api/calendar/today', '/api/auth/me']) {
      expect(after).not.toContain(`GET ${path}`);
    }
    await waitFor(() => expect(pencil()).toHaveFocus());

    await user.click(pencil());
    await screen.findByRole('dialog');
    expect(targetField()).toHaveValue('25000.50');
    expect(presentField()).toHaveValue('0');
  });

  it('saves the maximum Target and a Present above the Target (#31)', async () => {
    const backend = goalBackend();
    const { user } = await openOverview(...backend.handlers);
    await openPopup(user);
    await retype(user, targetField(), '1000000000');
    await retype(user, presentField(), '1000000000');

    await user.click(saveButton());

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(backend.saved).toEqual([{ month: '2026-10', target: usd(100_000_000_000), present: usd(100_000_000_000) }]);
    expect(within(goals()).getAllByText('$1,000,000,000.00')).toHaveLength(3);
  });

  it('removes the save and its amounts from the mutation cache once the popup has closed', async () => {
    const backend = goalBackend();
    const { user } = await openOverview(...backend.handlers);
    await openPopup(user);

    await user.click(saveButton());

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(appClient!.getMutationCache().getAll()).toEqual([]));
  });
});

// T15: a broken rule sends nothing and shows its message under its field (AC7; #6, #87, #108 a).
describe('the amount rules in the popup', () => {
  it.each([
    ['Target', '', '16250', goalMessages.targetRequired],
    ['Target', '.', '16250', goalMessages.targetRequired],
    ['Target', '0', '16250', goalMessages.targetPositive],
    ['Target', '1000000000.01', '16250', goalMessages.targetMax],
    ['Present', '20000', '1000000000.01', goalMessages.presentMax],
  ])('rejects %s with Target %j and Present %j: %s', async (fieldName, target, present, message) => {
    const { user } = await openOverview(...goalBackend().handlers);
    await openPopup(user);
    await retype(user, targetField(), target);
    await retype(user, presentField(), present);

    await user.click(saveButton());

    const field = fieldName === 'Target' ? targetField() : presentField();
    const other = fieldName === 'Target' ? presentField() : targetField();
    expect(await within(dialog()).findByText(message)).toBeInTheDocument();
    expect(field).toHaveAccessibleDescription(message);
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field.parentElement).toHaveClass(inputStyles.invalid!);
    expect(other).not.toHaveAttribute('aria-invalid');
    expect(puts()).toBe(0);
    expect(dialog()).toBeInTheDocument();
  });
});

// T16: saving, and a failed save (AC9; #6, #97 a).
describe('a save in flight and a failed save', () => {
  it('sends one request while it runs: Save disabled with its spinner, keeping focus', async () => {
    const { promise: released, resolve: release } = Promise.withResolvers<void>();
    server.use(
      http.put('*/api/savings-goals', async () => {
        await released;
        return HttpResponse.json(demoGoal);
      }),
    );
    const { user } = await openOverview();
    await openPopup(user);

    await user.click(saveButton());
    await waitFor(() => expect(saveButton()).toHaveAttribute('aria-busy', 'true'));
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');
    expect(saveButton()).toHaveFocus();
    await user.click(saveButton());
    await user.type(targetField(), '{Enter}');
    await user.type(presentField(), '{Enter}');

    expect(puts()).toBe(1);
    release();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(puts()).toBe(1);
  });

  const failures: [string, () => Response, string][] = [
    ['a 500', () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 }), 'Something went wrong.'],
    ['a network failure', () => HttpResponse.error(), 'Something went wrong.'],
    [
      'a 409 in the shared shape',
      () => HttpResponse.json({ message: goalMessages.monthEnded } satisfies ErrorResponse, { status: 409 }),
      goalMessages.monthEnded,
    ],
  ];

  it.each(failures)('shows the message above Save on %s and keeps the typed values', async (_case, answer, message) => {
    server.use(http.put('*/api/savings-goals', answer));
    const { user } = await openOverview();
    // The page behind the popup is hidden from assistive technology while it is open (#35): found before.
    const card = goalsCard();
    await openPopup(user);
    await retype(user, targetField(), '30000');

    await user.click(saveButton());

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(message);
    expect(targetField()).toHaveValue('30000');
    expect(presentField()).toHaveValue('16250');
    expect(saveButton()).not.toHaveAttribute('aria-disabled');
    expect(within(card).getAllByText('$20,000.00')).toHaveLength(2);
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
    const { user } = await openOverview();
    await openPopup(user);

    await user.click(saveButton());

    await waitFor(() => expect(targetField()).toHaveAccessibleDescription(goalMessages.invalidAmount));
    expect(presentField()).toHaveAccessibleDescription(goalMessages.presentMax);
    expect(within(dialog()).queryByRole('alert')).toBeNull();
    expect(dialog()).toBeInTheDocument();
  });

  // Code review: a refetch behind the open popup must not move the save to the new month (#108 d).
  it('saves the month the popup opened for when the card moves to the next month behind it, and shows the 409', async () => {
    const bodies: SavingsGoalRequest[] = [];
    server.use(
      http.put('*/api/savings-goals', async ({ request }) => {
        const body = (await request.json()) as SavingsGoalRequest;
        bodies.push(body);
        return body.month === '2026-11'
          ? HttpResponse.json({ ...goalOf(body.target.cents, body.present.cents, 1), month: '2026-11' })
          : HttpResponse.json({ message: goalMessages.monthEnded } satisfies ErrorResponse, { status: 409 });
      }),
    );
    const { user } = await openOverview();
    await openPopup(user);
    await retype(user, targetField(), '30000');

    // Past midnight on 31 Oct: the window gets focus back and the card's goal is now November's.
    server.use(savingsGoal.answers({ ...goalOf(2_000_000, 1_700_000, 0.85), month: '2026-11' }));
    refocusWindow();
    await waitFor(() =>
      expect(appClient!.getQueryData<SavingsGoalResponse>(['savings-goals', 'current'])?.month).toBe('2026-11'),
    );
    await user.click(saveButton());

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(goalMessages.monthEnded);
    expect(bodies.map((body) => body.month)).toEqual(['2026-10']);
    expect(targetField()).toHaveValue('30000');
  });

  it('clears the message when the next save starts', async () => {
    let answers = 0;
    server.use(
      http.put('*/api/savings-goals', () => {
        answers += 1;
        return answers === 1
          ? HttpResponse.json({ message: 'Internal server error' }, { status: 500 })
          : HttpResponse.json(demoGoal);
      }),
    );
    const { user } = await openOverview();
    await openPopup(user);
    await user.click(saveButton());
    await within(dialog()).findByRole('alert');

    await user.click(saveButton());

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(answers).toBe(2);
  });

  it('shows the new values on the card when a save ends after the popup closed', async () => {
    const { promise: released, resolve: release } = Promise.withResolvers<void>();
    server.use(
      http.put('*/api/savings-goals', async () => {
        await released;
        return HttpResponse.json(goalOf(3_000_000, 1_625_000, 0.541));
      }),
    );
    const { user } = await openOverview();
    await openPopup(user);
    await retype(user, targetField(), '30000');
    await user.click(saveButton());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    server.use(savingsGoal.answers(goalOf(3_000_000, 1_625_000, 0.541)));
    release();

    await waitFor(() => expect(within(goals()).getAllByText('$30,000.00')).toHaveLength(2));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows nothing when a save fails after the popup closed', async () => {
    const { promise: released, resolve: release } = Promise.withResolvers<void>();
    let answered = false;
    server.use(
      http.put('*/api/savings-goals', async () => {
        await released;
        answered = true;
        return HttpResponse.json({ message: 'Internal server error' }, { status: 500 });
      }),
    );
    const { user } = await openOverview();
    await openPopup(user);
    await retype(user, targetField(), '30000');
    await user.click(saveButton());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    release();
    await waitFor(() => expect(answered).toBe(true));
    await settle();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(within(goals()).getAllByText('$20,000.00')).toHaveLength(2);
  });
});

// T17: no goal for the month (AC10; #58, #69, #71, #84, #85, #90 b, #108 c).
describe('a month with no goal', () => {
  it('shows "No goal for this month" with the pencil and the month, and no amounts or gauge', async () => {
    await openOverview(savingsGoal.answers(noGoal));

    expect(await within(goals()).findByText('No goal for this month')).toBeInTheDocument();
    // The header row keeps the pencil at its left and the month on the right, then the message (#108 c).
    expect(goalsCard().textContent).toBe('Oct, 2026No goal for this month');
    expect(
      inOrder(pencil(), within(goals()).getByText('Oct, 2026'), within(goals()).getByText('No goal for this month')),
    ).toBe(true);
    expect(within(goals()).queryByRole('meter')).toBeNull();
    expect(within(goals()).queryByRole('term')).toBeNull();
  });

  it('opens with empty fields, requires the Target and creates the goal from the typed values', async () => {
    const backend = goalBackend(noGoal);
    const { user } = await openOverview(...backend.handlers);
    await within(goals()).findByText('No goal for this month');
    await openPopup(user);

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
    expect(backend.saved).toEqual([{ month: '2026-10', target: usd(50_000), present: usd(0) }]);
    expect(await within(goals()).findAllByText('$500.00')).toHaveLength(2);
    expect(amounts()[0]).toEqual(['Target Achieved', '$0.00']);
    expect(within(goals()).queryByText('No goal for this month')).toBeNull();
  });
});

// T18: loading, error and a failed refetch (AC18; #6, #88, #89).
describe('the Goals card states', () => {
  it('shows the skeleton while the goal loads, with the other sections in place', async () => {
    await openOverview(savingsGoal.pending());

    await waitFor(() => expect(goals().querySelector('[aria-busy="true"]')).not.toBeNull());
    expect(within(goals()).queryByRole('button')).toBeNull();
    expect(screen.getByRole('region', { name: 'Total Balance' })).toBeInTheDocument();
  });

  it('shows the error state after the request and its 3 retries fail, and Retry loads the goal', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await openOverview(savingsGoal.fails());

    await vi.advanceTimersByTimeAsync(30_000);

    expect(count('GET /api/savings-goals/current')).toBe(4);
    expect(within(goals()).getByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(within(goals()).queryByRole('button', { name: 'Edit savings goal' })).toBeNull();
    expect(await screen.findByText('$130,254.67')).toBeInTheDocument();

    server.use(savingsGoal.answers());
    await user.click(within(goals()).getByRole('button', { name: 'Retry' }));

    expect(await goalShown()).toBeInTheDocument();
    expect(within(goals()).queryByRole('alert')).toBeNull();
  });

  it('keeps the goal, with no message, when a later refetch fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openOverview();
    await goalShown();
    server.use(savingsGoal.fails());
    const before = count('GET /api/savings-goals/current');

    refocusWindow();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(count('GET /api/savings-goals/current') - before).toBe(4);
    expect(amounts()[0]).toEqual(['Target Achieved', '$16,250.00']);
    expect(within(goals()).queryByRole('alert')).toBeNull();
  });
});

/** Every mutation in the cache, with its key and variables. */
const mutations = () =>
  appClient!
    .getMutationCache()
    .getAll()
    .map((mutation) => ({ key: mutation.options.mutationKey, variables: mutation.state.variables }));

/** Every cached query key, as JSON. */
const queryKeys = () =>
  appClient!
    .getQueryCache()
    .getAll()
    .map((query) => JSON.stringify(query.queryKey));

// T19: a session end leaves no goal amounts and no pending write in the caches (AC16; #3, #39).
describe('a session end', () => {
  it('removes a pending save on logout, and its later answer changes nothing', async () => {
    const { promise: released, resolve: release } = Promise.withResolvers<void>();
    server.use(
      http.put('*/api/savings-goals', async () => {
        await released;
        return HttpResponse.json(goalOf(3_000_000, 1_625_000, 0.541));
      }),
      http.post('*/api/auth/logout', () => new HttpResponse(null, { status: 204 })),
    );
    const { user, url } = await openOverview();
    await openPopup(user);
    await retype(user, targetField(), '30000');
    await user.click(saveButton());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mutations()).toContainEqual({
      key: ['savings-goals', 'save'],
      variables: { month: '2026-10', target: usd(3_000_000), present: usd(1_625_000) },
    });

    server.use(me.signedOut());
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    await waitFor(() => expect(url()).toBe('/login'));

    expect(mutations().every((mutation) => mutation.key?.[0] === 'session')).toBe(true);
    expect(JSON.stringify(mutations())).not.toContain('3000000');
    release();
    await settle();
    expect(queryKeys()).toEqual(['["session"]']);
    expect(appClient!.getQueryData(['session'])).toBeNull();
    expect(mutations().every((mutation) => mutation.key?.[0] === 'session')).toBe(true);
  });

  it('removes the save and every cached query when the save gets 401', async () => {
    server.use(http.put('*/api/savings-goals', () => HttpResponse.json(authenticationRequired, { status: 401 })));
    const { user, url } = await openOverview();
    await openPopup(user);
    await retype(user, targetField(), '30000');

    await user.click(saveButton());

    await waitFor(() => expect(url()).toBe('/login?returnTo=%2Foverview'));
    expect(mutations()).toEqual([]);
    expect(queryKeys()).toEqual(['["session"]']);
  });
});

// T20: another tab switched the signed-in user: nothing of the earlier user stays in this tab (AC17; #3, #39).
describe('a user switch in another tab', () => {
  const otherUser: CurrentUser = { fullName: 'Ada Lovelace', email: 'ada@example.com', username: 'ada' };

  it('clears the caches, closes the popup and shows the new user’s goal when the focus check finds them', async () => {
    server.use(
      savingsGoal.answers(goalOf(3_000_000, 1_625_000, 0.541)),
      http.put('*/api/savings-goals', () => HttpResponse.json({ message: 'Internal server error' }, { status: 500 })),
    );
    const { user } = await openOverview();
    expect(await within(goals()).findAllByText('$30,000.00')).toHaveLength(2);
    act(() => {
      appClient!.setQueryData(['balance'], { cents: 2505600 });
    });
    await openPopup(user);
    await retype(user, targetField(), '45000');
    await user.click(saveButton());
    await within(dialog()).findByRole('alert');
    expect(mutations().some((mutation) => mutation.key?.[0] === 'savings-goals')).toBe(true);

    server.use(
      http.get('*/api/auth/me', () => HttpResponse.json(otherUser)),
      savingsGoal.answers(demoGoal),
    );
    refocusWindow();

    expect(await screen.findByText('Hello Ada')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(amounts()).toEqual([
        ['Target Achieved', '$16,250.00'],
        ['This month Target', '$20,000.00'],
      ]),
    );
    expect(screen.queryByText('$30,000.00')).toBeNull();
    expect(queryKeys()).not.toContain('["balance"]');
    expect(appClient!.getQueryData(['savings-goals', 'current'])).toEqual(demoGoal);
    expect(mutations().filter((mutation) => mutation.key?.[0] !== 'session')).toEqual([]);

    // The page remounted: the popup opens with the new user's goal, not the earlier typing.
    await user.click(pencil());
    await screen.findByRole('dialog');
    expect(targetField()).toHaveValue('20000');
  });

  // The shell keys the page on the user: state typed on any page, not only in a data widget, is gone.
  it('remounts the page, so nothing typed for the earlier user stays', async () => {
    const notePage: RouteObject[] = [
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppShell />,
            children: [
              {
                path: '/note',
                handle: { section: 'overview', greeting: true },
                element: (
                  <label>
                    Note
                    <input />
                  </label>
                ),
              },
            ],
          },
        ],
      },
    ];
    server.use(me.signedIn(), today.answers());
    const { user } = renderApp('/note', notePage);
    await user.type(await screen.findByRole('textbox', { name: 'Note' }), 'For Tanzir');

    server.use(http.get('*/api/auth/me', () => HttpResponse.json(otherUser)));
    refocusWindow();

    expect(await screen.findByText('Hello Ada')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveValue('');
  });

  it('keeps the caches when the focus check answers the same user', async () => {
    const { user } = await openOverview();
    await goalShown();
    act(() => {
      appClient!.setQueryData(['balance'], { cents: 2505600 });
    });
    await openPopup(user);
    await retype(user, targetField(), '45000');

    server.use(http.get('*/api/auth/me', () => HttpResponse.json({ ...signedInUser })));
    refocusWindow();
    await waitFor(() => expect(count('GET /api/auth/me')).toBe(2));
    await settle();

    expect(queryKeys()).toContain('["balance"]');
    expect(targetField()).toHaveValue('45000');
  });
});
