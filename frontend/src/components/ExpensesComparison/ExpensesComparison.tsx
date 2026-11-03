import { formatMonthAxisLabel, type MonthlyComparisonResponse } from '@finebank/shared';

import { ChartLegend } from '../ChartLegend/ChartLegend';
import { ComparisonBarChart } from '../ComparisonBarChart/ComparisonBarChart';
import { ComparisonBarChartSkeleton } from '../ComparisonBarChartSkeleton/ComparisonBarChartSkeleton';
import { DataState, type DataStateQuery } from '../DataState/DataState';
import { Dropdown } from '../Dropdown/Dropdown';
import styles from './ExpensesComparison.module.css';

/** The one comparison (#29): the control shows it and its list offers nothing else. */
const comparisons = [{ value: 'monthly', label: 'Monthly Comparison' }] as const;

/** #91 c. The backend sends no ticks exactly when every value of both years is 0 (#55). */
const noExpenses = {
  isEmpty: (data: MonthlyComparisonResponse) => data.ticks === null,
  message: 'No expenses this year or last year',
};

type ExpensesComparisonProps = {
  /** The monthly comparison query: the 12 months and the ticks, as the backend calculated them. */
  query: DataStateQuery<MonthlyComparisonResponse>;
};

/**
 * The content of the Expenses chart card (109, "Expenses Comparison"), as `Statistics` is 104's: the header row, with
 * the "Monthly Comparison" control at the left and the legend "This year" / "Last year" at the right, in every state
 * (#29, #93 a); under it the chart's box (188 high, #92) with `DataState`: the skeleton of 12 groups, the error state,
 * "No expenses this year or last year", or the bar chart of this year against last year, Jan to Dec (#29, #55). The
 * months and ticks are drawn as sent: the labels are formatted, nothing is calculated (#11, #55); the chart's hidden
 * table carries the values for screen readers (#113 b). Nothing in the chart is focusable or reacts (#29).
 */
export function ExpensesComparison({ query }: ExpensesComparisonProps) {
  return (
    <div className={styles.content}>
      <div className={styles.header}>
        <Dropdown
          variant="comparison"
          options={comparisons}
          value="monthly"
          // The only option is the selected one: choosing it again changes nothing (US-15 criterion 6, #29).
          onValueChange={() => undefined}
          aria-label="Expenses Comparison"
        />
        <ChartLegend current="This year" previous="Last year" />
      </div>
      <div className={styles.chartBox}>
        <DataState query={query} skeleton={<ComparisonBarChartSkeleton groups={12} />} empty={noExpenses}>
          {({ months, ticks }) => (
            <ComparisonBarChart
              title="Expenses per month, this year and last year"
              labels={months.map((month) => formatMonthAxisLabel(month.month))}
              previous={{ name: 'Last year', values: months.map((month) => month.lastYear) }}
              current={{ name: 'This year', values: months.map((month) => month.thisYear) }}
              ticks={ticks ?? []}
            />
          )}
        </DataState>
      </div>
    </div>
  );
}
