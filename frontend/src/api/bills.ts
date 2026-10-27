import { billsContract } from '@finebank/shared';
import { useQuery } from '@tanstack/react-query';

import { apiRequest } from './client';

const upcomingBillsQueryKey = ['bills', 'upcoming'] as const;

/**
 * The signed-in user's bills due today or later, soonest first, today from the backend's clock in the browser's time
 * zone (#28, #41, #54, #80). The app's query defaults apply: asked for again when the window gets focus back, 3
 * retries. Removed with every cached query when a session starts or ends (#39).
 */
export function useUpcomingBills() {
  return useQuery({ queryKey: upcomingBillsQueryKey, queryFn: () => apiRequest(billsContract.upcoming) });
}
