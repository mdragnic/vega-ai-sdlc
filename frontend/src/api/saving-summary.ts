import { savingSummaryContract } from '@finebank/shared';
import { useQuery } from '@tanstack/react-query';

import { apiRequest } from './client';

const savingSummaryQueryKey = (month: string) => ['saving-summary', month] as const;

/**
 * The signed-in user's savings per day for a month they can choose on Goals, against the same days of the month before,
 * with the axis ticks, all calculated by the backend with today from its clock in the browser's time zone (#42, #54,
 * #59, #80), asked for once a month is known. The app's query defaults apply: asked for again when the window gets focus
 * back, 3 retries. Removed with every cached query when a session starts or ends or the user changes (#39). Nothing
 * invalidates it: no write changes a day's saving, and a goal save is not linked to it (#59).
 */
export function useSavingSummary(month: string | undefined) {
  return useQuery({
    queryKey: savingSummaryQueryKey(month ?? ''),
    queryFn: () => apiRequest(savingSummaryContract.summary, { month: month! }),
    enabled: month !== undefined,
  });
}
