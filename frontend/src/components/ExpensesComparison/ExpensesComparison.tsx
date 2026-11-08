import { formatMonthAxisLabel, type MonthlyComparisonResponse } from '@finebank/shared';

import {
  ComparisonChartCard,
  type ComparisonChartCardProps,
  type ComparisonChartDescription,
} from '../ComparisonChartCard/ComparisonChartCard';

/** The monthly comparison of 109 (#29): the months and the ticks drawn as the backend sent them (#55). */
const monthly: ComparisonChartDescription<MonthlyComparisonResponse> = {
  option: { value: 'monthly', label: 'Monthly Comparison' },
  name: 'Expenses Comparison',
  legend: { current: 'This year', previous: 'Last year' },
  groups: 12,
  title: 'Expenses per month, this year and last year',
  emptyMessage: 'No expenses this year or last year',
  toChart: ({ months, ticks }) => ({
    labels: months.map((month) => formatMonthAxisLabel(month.month)),
    previous: months.map((month) => month.lastYear),
    current: months.map((month) => month.thisYear),
    ticks,
  }),
};

/**
 * The content of the Expenses chart card (109, "Expenses Comparison"), as `Statistics` is 104's: `ComparisonChartCard`
 * with "Monthly Comparison", the legend "This year" / "Last year" and the bar chart of Jan to Dec, labelled by
 * `formatMonthAxisLabel`; "No expenses this year or last year" when the backend sends no ticks.
 */
export function ExpensesComparison({ query }: Pick<ComparisonChartCardProps<MonthlyComparisonResponse>, 'query'>) {
  return <ComparisonChartCard query={query} comparison={monthly} />;
}
