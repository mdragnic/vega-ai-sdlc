import { type SavingsGoalRequest, type SavingsGoalResponse, savingsGoalsContract } from '@finebank/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from './client';
import { useUserWrite } from './session';

const savingsGoalsQueryKey = ['savings-goals'] as const;
const currentSavingsGoalQueryKey = [...savingsGoalsQueryKey, 'current'] as const;
const savingsGoalMonthsQueryKey = [...savingsGoalsQueryKey, 'months'] as const;
const savingsGoalQueryKey = (month: string) => [...savingsGoalsQueryKey, 'month', month] as const;
const saveSavingsGoalMutationKey = [...savingsGoalsQueryKey, 'save'] as const;

/**
 * The signed-in user's savings goal for the current month, the month from the backend's clock in the browser's time
 * zone (#54, #58, #80): Overview's card. The app's query defaults apply: asked for again when the window gets focus
 * back, 3 retries. Removed with every cached query when a session starts or ends (#39).
 */
export function useCurrentSavingsGoal() {
  return useQuery({
    queryKey: currentSavingsGoalQueryKey,
    queryFn: () => apiRequest(savingsGoalsContract.current),
  });
}

/**
 * The months the user can choose on Goals, newest first, from the current month in the browser's zone back to the
 * earliest (#60, #123 a): the Savings Goal selector's list (and task 026's). The app's query defaults apply, so the list
 * is fetched again on window focus and moves to a new month after midnight.
 */
export function useSavingsGoalMonths() {
  return useQuery({
    queryKey: savingsGoalMonthsQueryKey,
    queryFn: () => apiRequest(savingsGoalsContract.months),
  });
}

/** One month's goal (`goal: null` without one), asked for once a month is known (#30, #58). */
export function useSavingsGoal(month: string | undefined) {
  return useQuery({
    queryKey: savingsGoalQueryKey(month ?? ''),
    queryFn: () => apiRequest(savingsGoalsContract.month, { month: month! }),
    enabled: month !== undefined,
  });
}

/**
 * `PUT /api/savings-goals`: creates or updates the goal of the month the popup opened with (#18, #58 d), through the
 * shared write helper (#119; a late answer after a session end changes nothing, #39). On success the response goes into
 * its month's query, and into the current goal's (Overview's card) only when that query's month is the response's: a
 * past month's answer never reaches Overview (Marko's notes). Then only the goal queries are asked for again: the
 * accounts, the date and the session are not (#74).
 */
export function useSaveSavingsGoal() {
  const queryClient = useQueryClient();
  return useUserWrite({
    mutationKey: saveSavingsGoalMutationKey,
    entry: savingsGoalsContract.save,
    args: (request: SavingsGoalRequest) => [request],
    onSuccess: (response) => {
      queryClient.setQueryData(savingsGoalQueryKey(response.month), response);
      const current = queryClient.getQueryData<SavingsGoalResponse>(currentSavingsGoalQueryKey);
      if (current?.month === response.month) queryClient.setQueryData(currentSavingsGoalQueryKey, response);
      void queryClient.invalidateQueries({ queryKey: savingsGoalsQueryKey });
    },
  });
}
