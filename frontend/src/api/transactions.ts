import { transactionsContract, type TransactionsTab } from '@finebank/shared';
import { type InfiniteData, type QueryKey, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { retryUnlessNotFound } from './accounts';
import { apiRequest } from './client';

const recentTransactionsQueryKey = ['transactions', 'recent'] as const;

const transactionsQueryKey = (tab: TransactionsTab) => ['transactions', 'list', tab] as const;

const accountTransactionsQueryKey = (accountId: number) => ['transactions', 'history', accountId] as const;

/**
 * The signed-in user's latest 5 transactions for each Recent Transaction tab (All, Revenue, Expenses), newest first,
 * dated up to today from the backend's clock in the browser's time zone (#19, #40, #53, #54, #80). One request answers
 * every tab, so switching tabs asks for nothing. The app's query defaults apply: asked for again when the window gets
 * focus back, 3 retries. Removed with every cached query when a session starts or ends (#39).
 */
export function useRecentTransactions() {
  return useQuery({
    queryKey: recentTransactionsQueryKey,
    queryFn: () => apiRequest(transactionsContract.recent),
  });
}

/**
 * The Transactions pages of a tab (#27, #74): the first without a cursor, each next one ("Load More") with the
 * `nextCursor` of the last page loaded, none after a page whose `nextCursor` is null. The backend filters, orders and
 * pages; today is its clock's in the browser's zone (#53, #54). The app's query defaults apply: asked for again when
 * the window gets focus back (every loaded page in turn from the first, each with its new cursor), 3 retries. Removed
 * with every cached query when a session starts or ends (#39). The pages after the first are dropped when the tab is
 * left and when the page closes, so a tab opens on its first 10 (#117 c).
 */
export function useTransactions(tab: TransactionsTab) {
  const queryClient = useQueryClient();
  useEffect(() => () => void keepFirstPage(queryClient, transactionsQueryKey(tab)), [queryClient, tab]);
  return useInfiniteQuery({
    queryKey: transactionsQueryKey(tab),
    queryFn: ({ pageParam }) =>
      apiRequest(transactionsContract.list, pageParam === null ? { tab } : { tab, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

/**
 * The Transactions History pages of one of the user's accounts (106; #27, #74), as `useTransactions` pages a tab: the
 * first without a cursor, each next one with the last page's `nextCursor`, none after `null`. The app's query defaults
 * apply (asked for again when the window gets focus back, 3 retries), except that the backend's 404, an account that is
 * not the user's (#39), is not retried. Removed with every cached query when a session starts or ends (#39). The pages
 * after the first are dropped when the page closes, so the history opens on its first 10 (#117 c).
 */
export function useAccountTransactions(accountId: number) {
  const queryClient = useQueryClient();
  useEffect(
    () => () => void keepFirstPage(queryClient, accountTransactionsQueryKey(accountId)),
    [queryClient, accountId],
  );
  return useInfiniteQuery({
    queryKey: accountTransactionsQueryKey(accountId),
    queryFn: ({ pageParam }) =>
      apiRequest(
        transactionsContract.history,
        { accountId: String(accountId) },
        pageParam === null ? {} : { cursor: pageParam },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    retry: retryUnlessNotFound,
  });
}

/**
 * Leaves only the first page of a paged list (a tab's, or an account's history), when it has more or a Load More ran:
 * a request still running is cancelled first, so its pages cannot come back, and a failed Load More's error goes with
 * the pages after the first (#117 b, c). A first page still loading carries on, also through StrictMode's second mount.
 */
async function keepFirstPage(queryClient: ReturnType<typeof useQueryClient>, queryKey: QueryKey): Promise<void> {
  const state = queryClient.getQueryState<InfiniteData<unknown, string | null>>(queryKey);
  const laterPages = (state?.data?.pages.length ?? 0) > 1;
  const loadMoreRan = state?.fetchMeta?.fetchMore !== undefined;
  if (state?.data === undefined || (!laterPages && !loadMoreRan)) return;
  // Running or paused offline: either would bring its pages back.
  if (state.fetchStatus !== 'idle') await queryClient.cancelQueries({ queryKey, exact: true });
  const data = queryClient.getQueryData<InfiniteData<unknown, string | null>>(queryKey);
  const [firstPage] = data?.pages ?? [];
  if (data === undefined || firstPage === undefined) return;
  queryClient.setQueryData<InfiniteData<unknown, string | null>>(queryKey, {
    pages: [firstPage],
    pageParams: [null],
  });
}
