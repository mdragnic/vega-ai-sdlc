import { type AccountDetailsRequest, accountsContract } from '@finebank/shared';
import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { useUpdateAccountDetails } from '../../src/api/accounts';
import { ApiError, apiRequest } from '../../src/api/client';
import { createQueryClient, sessionQueryKey } from '../../src/api/session';
import {
  demoAccountDetails,
  demoAccounts,
  demoAllPage1,
  demoAllPage2,
  demoCheckingHistoryPage1,
  demoCheckingHistoryPage2,
  demoExpensesBreakdown,
  demoExpensesPage1,
  demoGoal,
  demoRecentTransactions,
  demoRevenuePage1,
  demoWeeklyComparison,
  signedInUser,
} from '../support/app';

/** Every request sent, as `METHOD /path`. */
const sent: string[] = [];

const checking = demoAccountDetails[2]!;

const server = setupServer(
  http.patch('*/api/accounts/:accountId', async ({ request }) => {
    const body = (await request.json()) as AccountDetailsRequest;
    return HttpResponse.json({ ...checking, ...body });
  }),
);

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
  server.events.on('request:start', ({ request }) => {
    sent.push(`${request.method} ${new URL(request.url).pathname}`);
  });
});
afterEach(() => {
  sent.length = 0;
});
afterAll(() => server.close());

const pages = <T,>(...list: T[]) => ({
  pages: list,
  pageParams: list.map((_, index) => (index === 0 ? null : `c${index}`)),
});

/** Every screen's data in the cache, keyed as the app keys it, as after visiting every page. */
const screens: [readonly unknown[], unknown][] = [
  [sessionQueryKey, signedInUser],
  [['calendar', 'today'], { today: '2026-10-22' }],
  [['accounts'], demoAccounts],
  [['accounts', 1], demoAccountDetails[1]],
  [['accounts', 2], checking],
  [['transactions', 'list', 'all'], pages(demoAllPage1, demoAllPage2)],
  [['transactions', 'list', 'revenue'], pages(demoRevenuePage1, demoRevenuePage1)],
  [['transactions', 'list', 'expenses'], pages(demoExpensesPage1, demoExpensesPage1)],
  [['transactions', 'recent'], demoRecentTransactions],
  [['transactions', 'history', 2], pages(demoCheckingHistoryPage1, demoCheckingHistoryPage2)],
  [['savings-goals', 'current'], demoGoal],
  [['statistics', 'weekly-comparison'], demoWeeklyComparison],
  [['expenses', 'breakdown'], demoExpensesBreakdown],
  [['bills', 'upcoming'], { bills: [] }],
];

const key = (queryKey: readonly unknown[]) => JSON.stringify(queryKey);

/** Each query's data, update time and invalidation, by key. */
function snapshot(queryClient: QueryClient) {
  return Object.fromEntries(
    queryClient
      .getQueryCache()
      .getAll()
      .map((query) => [
        key(query.queryKey),
        { data: query.state.data, dataUpdatedAt: query.state.dataUpdatedAt, isInvalidated: query.state.isInvalidated },
      ]),
  );
}

/** A query client holding every screen's data, and the hook for Checking. */
function setup() {
  const queryClient = createQueryClient();
  for (const [queryKey, data] of screens) queryClient.setQueryData(queryKey, data);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useUpdateAccountDetails(2), { wrapper });
  return { queryClient, result };
}

const unchanged: AccountDetailsRequest = {
  bankName: checking.bankName,
  branchName: checking.branchName,
  accountType: checking.accountType,
};

// T17: AC13, after a save exactly the queries that show a changed value change (US-12 criterion 18, #57, #74).
describe('useUpdateAccountDetails', () => {
  it.each<[string, AccountDetailsRequest, string[]]>([
    ['only the Branch Name', { ...unchanged, branchName: 'Harbour Branch' }, []],
    ['only the Bank Name', { ...unchanged, bankName: 'Nordic Bank' }, ['["accounts"]']],
    [
      'only the type',
      { ...unchanged, accountType: 'savings' },
      [
        '["accounts"]',
        '["transactions","list","all"]',
        '["transactions","list","revenue"]',
        '["transactions","list","expenses"]',
      ],
    ],
    [
      'all three',
      { bankName: 'Nordic Bank', branchName: 'Harbour Branch', accountType: 'loan' },
      [
        '["accounts"]',
        '["transactions","list","all"]',
        '["transactions","list","revenue"]',
        '["transactions","list","expenses"]',
      ],
    ],
    ['nothing', unchanged, []],
  ])(
    'after a save changing %s: the details from the response, and only those dropped',
    async (_case, request, dropped) => {
      const { queryClient, result } = setup();
      const before = snapshot(queryClient);

      await act(() => result.current.mutateAsync(request));

      const after = snapshot(queryClient);
      expect(queryClient.getQueryData(['accounts', 2])).toEqual({ ...checking, ...request });
      for (const name of dropped) {
        expect({ name, ...after[name] }).toEqual({ name, data: undefined, dataUpdatedAt: 0, isInvalidated: false });
      }
      const kept = Object.keys(before).filter((name) => name !== '["accounts",2]' && !dropped.includes(name));
      expect(kept.length).toBe(screens.length - 1 - dropped.length);
      for (const name of kept) expect({ name, ...after[name] }).toEqual({ name, ...before[name] });
      expect(sent).toEqual(['PATCH /api/accounts/2']);
    },
  );

  // Code review of task 022: a refetch of the details sent before the save (window focus) must not bring the old
  // values back when it answers after the save.
  it('keeps the response’s details when a refetch of them, sent before the save, answers after it', async () => {
    const { queryClient, result } = setup();
    const { promise: held, resolve: release } = Promise.withResolvers<void>();
    server.use(
      http.get('*/api/accounts/:accountId', async () => {
        await held;
        return HttpResponse.json(checking);
      }),
    );
    const refetch = queryClient
      .fetchQuery({
        queryKey: ['accounts', 2],
        queryFn: () => apiRequest(accountsContract.details, { accountId: '2' }),
        staleTime: 0,
      })
      .catch(() => undefined);
    await waitFor(() => expect(sent).toEqual(['GET /api/accounts/2']));
    const request = { ...unchanged, bankName: 'Nordic Bank', accountType: 'loan' } as const;

    await act(() => result.current.mutateAsync(request));
    release();
    await act(() => refetch);

    expect(queryClient.getQueryData(['accounts', 2])).toEqual({ ...checking, ...request });
  });

  it('removes the save and its typed names from the mutation cache once nothing observes it', async () => {
    const { queryClient, result } = setup();

    await act(() => result.current.mutateAsync({ ...unchanged, bankName: 'Nordic Bank' }));
    act(() => result.current.reset());

    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toEqual([]));
  });

  it('changes no cache when the answer comes after the session changed', async () => {
    const { queryClient, result } = setup();
    const { promise: held, resolve: release } = Promise.withResolvers<void>();
    server.use(
      http.patch('*/api/accounts/:accountId', async () => {
        await held;
        return HttpResponse.json({ ...checking, bankName: 'Late Bank', accountType: 'loan' });
      }),
    );

    const saving = result.current.mutateAsync({ ...unchanged, bankName: 'Late Bank', accountType: 'loan' });
    await waitFor(() => expect(sent).toEqual(['PATCH /api/accounts/2']));
    // The session ends (a 401 on another request clears the tab's data, task 014), then the late answer arrives.
    await act(async () => {
      await queryClient
        .fetchQuery({
          queryKey: ['probe'],
          queryFn: () => Promise.reject(new ApiError(401, { message: 'Authentication required' }, true)),
          retry: false,
        })
        .catch(() => undefined);
    });
    expect(queryClient.getQueryData(['accounts', 2])).toBeUndefined();
    queryClient.setQueryData(['accounts'], demoAccounts);
    const before = snapshot(queryClient);
    release();
    await act(() => saving.catch(() => undefined));

    expect(queryClient.getQueryData(['accounts', 2])).toBeUndefined();
    expect(snapshot(queryClient)).toEqual(before);
  });
});
