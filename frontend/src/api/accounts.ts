import { type AccountDetailsRequest, type AccountDetailsResponse, accountsContract } from '@finebank/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError, apiRequest } from './client';
import { retryQuery, sendWrite, sessionEpoch } from './session';

const accountsQueryKey = ['accounts'] as const;

const accountQueryKey = (accountId: number) => ['accounts', accountId] as const;

/** The three Transactions tabs' lists, which show each row's Payment Method, its account's type (#57). */
const transactionListsQueryKey = ['transactions', 'list'] as const;

/**
 * The app's retry rule (3 retries, none for a 401) with one more exception for the account routes: their 404 is the
 * answer for an account that is not the user's (#39), so asking again would only delay Balances.
 */
export function retryUnlessNotFound(failureCount: number, error: unknown): boolean {
  return !isAccountNotFound(error) && retryQuery(failureCount, error);
}

/** Whether a query failed with the account routes' 404: the account is not the user's (#39). */
export function isAccountNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.fromServer && error.status === 404;
}

/**
 * The signed-in user's accounts and Total Balance, calculated by the backend for today in the browser's time zone
 * (#17, #53, #54). The app's query defaults apply: asked for again when the window gets focus back, 3 retries.
 * Removed with every cached query when a session starts or ends (#39).
 */
export function useAccounts() {
  return useQuery({ queryKey: accountsQueryKey, queryFn: () => apiRequest(accountsContract.list) });
}

/**
 * One of the signed-in user's accounts for Account Details (US-12 criterion 2), its balance calculated by the backend
 * for today in the browser's time zone (#53, #54, #57). The app's query defaults apply (asked for again when the
 * window gets focus back, 3 retries), except that the backend's 404 is not retried. Removed with every cached query
 * when a session starts or ends (#39).
 */
export function useAccount(accountId: number) {
  return useQuery({
    queryKey: accountQueryKey(accountId),
    queryFn: () => apiRequest(accountsContract.details, { accountId: String(accountId) }),
    retry: retryUnlessNotFound,
  });
}

/**
 * `PATCH /api/accounts/:accountId`, Edit Details (#26), sent through `sendWrite` with the tab's user (#119) and not
 * retried; the typed names leave the mutation cache once nothing observes the save (`gcTime: 0`). On success exactly
 * the queries that show a changed value change (US-12 criterion 18, #57): the account's details are set from the
 * response (no request; a refetch of them still running is cancelled first, so it cannot bring the old values back);
 * the accounts list (the Overview carousel, the Balances cards) is reset when the Bank Name or
 * the type differs from the details shown before the save; the three Transactions tabs' lists (Payment Method) are reset
 * when the type differs. Reset, not invalidated: the data is dropped, so a screen opened after the save shows its
 * skeleton and then the stored values, never the old ones (#6). Nothing else is asked for again: the history shows no
 * account field. A save that ends after its session did (a logout, a 401, another user) changes nothing (#39).
 */
export function useUpdateAccountDetails(accountId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...accountQueryKey(accountId), 'update'],
    mutationFn: (request: AccountDetailsRequest) =>
      sendWrite(queryClient, accountsContract.updateDetails, { accountId: String(accountId) }, request),
    gcTime: 0,
    onMutate: () => ({
      epoch: sessionEpoch(queryClient),
      shown: queryClient.getQueryData<AccountDetailsResponse>(accountQueryKey(accountId)),
    }),
    onSuccess: async (details, _request, started) => {
      if (started.epoch !== sessionEpoch(queryClient)) return;
      // A refetch of the details sent before the save (window focus) would bring the old values back: cancelled first.
      await queryClient.cancelQueries({ queryKey: accountQueryKey(accountId), exact: true });
      if (started.epoch !== sessionEpoch(queryClient)) return;
      queryClient.setQueryData(accountQueryKey(accountId), details);
      const typeChanged = started.shown?.accountType !== details.accountType;
      if (typeChanged || started.shown?.bankName !== details.bankName) {
        void queryClient.resetQueries({ queryKey: accountsQueryKey, exact: true });
      }
      if (typeChanged) void queryClient.resetQueries({ queryKey: transactionListsQueryKey });
    },
  });
}
