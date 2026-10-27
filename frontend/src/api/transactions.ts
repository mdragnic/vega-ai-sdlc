import { transactionsContract } from '@finebank/shared';
import { useQuery } from '@tanstack/react-query';

import { apiRequest } from './client';

const recentTransactionsQueryKey = ['transactions', 'recent'] as const;

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
