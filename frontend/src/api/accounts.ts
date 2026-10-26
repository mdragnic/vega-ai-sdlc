import { accountsContract } from '@finebank/shared';
import { useQuery } from '@tanstack/react-query';

import { apiRequest } from './client';

const accountsQueryKey = ['accounts'] as const;

/**
 * The signed-in user's accounts and Total Balance, calculated by the backend for today in the browser's time zone
 * (#17, #53, #54). The app's query defaults apply: asked for again when the window gets focus back, 3 retries.
 * Removed with every cached query when a session starts or ends (#39).
 */
export function useAccounts() {
  return useQuery({ queryKey: accountsQueryKey, queryFn: () => apiRequest(accountsContract.list) });
}
