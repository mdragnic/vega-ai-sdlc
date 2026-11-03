import { expensesContract } from '@finebank/shared';
import { useQuery } from '@tanstack/react-query';

import { apiRequest } from './client';

const expensesBreakdownQueryKey = ['expenses', 'breakdown'] as const;
const monthlyComparisonQueryKey = ['expenses', 'monthly-comparison'] as const;

/**
 * The signed-in user's expenses per category, this month up to today with the change against all of last month and
 * the 2 most recent items, all calculated by the backend with the month from its clock in the browser's time zone
 * (#21, #54, #61, #80). One query for Overview's Expenses Breakdown and the Expenses cards, so both pages show one
 * answer (task 024). The app's query defaults apply: asked for again when the window gets focus back, 3 retries.
 * Removed with every cached query when a session starts or ends (#39).
 */
export function useExpensesBreakdown() {
  return useQuery({
    queryKey: expensesBreakdownQueryKey,
    queryFn: () => apiRequest(expensesContract.breakdown),
  });
}

/**
 * The signed-in user's expenses per month, January to December of this year against last year, with the axis ticks,
 * all calculated by the backend with the year and the month from its clock in the browser's time zone (#29, #54, #55,
 * #80). The app's query defaults apply: asked for again when the window gets focus back, 3 retries. Removed with
 * every cached query when a session starts or ends (#39).
 */
export function useMonthlyComparison() {
  return useQuery({
    queryKey: monthlyComparisonQueryKey,
    queryFn: () => apiRequest(expensesContract.monthlyComparison),
  });
}
