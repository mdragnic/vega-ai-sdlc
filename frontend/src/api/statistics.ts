import { statisticsContract } from '@finebank/shared';
import { useQuery } from '@tanstack/react-query';

import { apiRequest } from './client';

const weeklyComparisonQueryKey = ['statistics', 'weekly-comparison'] as const;

/**
 * The signed-in user's expenses per day, this week against last week, Monday to Sunday, with the axis ticks, all
 * calculated by the backend with today from its clock in the browser's time zone (#20, #54, #55, #80). The app's
 * query defaults apply: asked for again when the window gets focus back, 3 retries. Removed with every cached query
 * when a session starts or ends (#39).
 */
export function useWeeklyComparison() {
  return useQuery({
    queryKey: weeklyComparisonQueryKey,
    queryFn: () => apiRequest(statisticsContract.weeklyComparison),
  });
}
