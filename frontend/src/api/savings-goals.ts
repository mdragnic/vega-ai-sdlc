import { type SavingsGoalRequest, savingsGoalsContract } from '@finebank/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from './client';
import { sessionEpoch } from './session';

const savingsGoalsQueryKey = ['savings-goals'] as const;
const currentSavingsGoalQueryKey = [...savingsGoalsQueryKey, 'current'] as const;
const saveSavingsGoalMutationKey = [...savingsGoalsQueryKey, 'save'] as const;

/**
 * The signed-in user's savings goal for the current month, the month from the backend's clock in the browser's time
 * zone (#54, #58, #80). The app's query defaults apply: asked for again when the window gets focus back, 3 retries.
 * Removed with every cached query when a session starts or ends (#39).
 */
export function useCurrentSavingsGoal() {
  return useQuery({
    queryKey: currentSavingsGoalQueryKey,
    queryFn: () => apiRequest(savingsGoalsContract.current),
  });
}

/**
 * `PUT /api/savings-goals`: creates or updates the month's goal (#18, #58). The amounts leave the mutation cache as
 * soon as no popup shows the save (`gcTime: 0`). On success the response goes into the current goal's query and only
 * the goal queries are asked for again: the accounts, the date and the session are not (#74). A save that ends after
 * its session did (a logout, a 401, another user in another tab) changes nothing in the caches (#39).
 */
export function useSaveSavingsGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: saveSavingsGoalMutationKey,
    mutationFn: (request: SavingsGoalRequest) => apiRequest(savingsGoalsContract.save, request),
    gcTime: 0,
    onMutate: () => ({ epoch: sessionEpoch(queryClient) }),
    onSuccess: (response, _request, started) => {
      if (started.epoch !== sessionEpoch(queryClient)) return;
      queryClient.setQueryData(currentSavingsGoalQueryKey, response);
      void queryClient.invalidateQueries({ queryKey: savingsGoalsQueryKey });
    },
  });
}
