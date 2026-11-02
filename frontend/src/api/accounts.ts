import { accountsContract } from '@finebank/shared';
import { useQuery } from '@tanstack/react-query';

import { ApiError, apiRequest } from './client';
import { retryQuery } from './session';

const accountsQueryKey = ['accounts'] as const;

const accountQueryKey = (accountId: number) => ['accounts', accountId] as const;

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
