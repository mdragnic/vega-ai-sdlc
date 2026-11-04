import { type CategoryLimitRequest, type CategoryLimitsResponse, categoryLimitsContract } from '@finebank/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from './client';
import { useUserWrite } from './session';

const categoryLimitsQueryKey = ['category-limits'] as const;
const saveCategoryLimitMutationKey = [...categoryLimitsQueryKey, 'save'] as const;

/**
 * The signed-in user's spending limit for each of the six categories, one value for every month (#32): Goals' category
 * cards. No month and no zone in the request. The app's query defaults apply: asked for again when the window gets focus
 * back, 3 retries. Removed with every cached query when a session starts or ends (#39).
 */
export function useCategoryLimits() {
  return useQuery({
    queryKey: categoryLimitsQueryKey,
    queryFn: () => apiRequest(categoryLimitsContract.list),
  });
}

/**
 * `PUT /api/category-limits`: creates or updates one category's limit (#31, #125 b), through the shared write helper
 * (#119; a late answer after a session end changes nothing, #39). On success the answer replaces its category in the
 * limits query, then only the limits are asked for again: nothing else shows a limit (#32).
 */
export function useSaveCategoryLimit() {
  const queryClient = useQueryClient();
  return useUserWrite({
    mutationKey: saveCategoryLimitMutationKey,
    entry: categoryLimitsContract.save,
    args: (request: CategoryLimitRequest) => [request],
    onSuccess: (response) => {
      queryClient.setQueryData<CategoryLimitsResponse>(categoryLimitsQueryKey, (current) =>
        current === undefined
          ? current
          : {
              limits: current.limits.map((entry) =>
                entry.category === response.category ? { category: response.category, limit: response.limit } : entry,
              ),
            },
      );
      void queryClient.invalidateQueries({ queryKey: categoryLimitsQueryKey, exact: true });
    },
  });
}
