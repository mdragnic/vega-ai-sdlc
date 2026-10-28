import { formatDayLabel, type WeeklyComparisonResponse } from '@finebank/shared';

import { ChartLegend } from '../ChartLegend/ChartLegend';
import { ComparisonBarChart } from '../ComparisonBarChart/ComparisonBarChart';
import { ComparisonBarChartSkeleton } from '../ComparisonBarChartSkeleton/ComparisonBarChartSkeleton';
import { DataState, type DataStateQuery } from '../DataState/DataState';
import { Dropdown } from '../Dropdown/Dropdown';
import styles from './Statistics.module.css';

/** The one comparison (#20): the control shows it and its list offers nothing else. */
const comparisons = [{ value: 'weekly', label: 'Weekly Comparison' }] as const;

/** #91 c. The backend sends no ticks exactly when every value of both weeks is 0 (#55). */
const noExpenses = {
  isEmpty: (data: WeeklyComparisonResponse) => data.ticks === null,
  message: 'No expenses this week or last week',
};

type StatisticsProps = {
  /** The weekly comparison query: the 7 days and the ticks, as the backend calculated them. */
  query: DataStateQuery<WeeklyComparisonResponse>;
};

/**
 * The content of the Overview Statistics card (104, Figma section `Statistics` 66:4933): the header row, with the
 * "Weekly Comparison" control at the left and the legend at the right, in every state (#93 a); under it the chart's
 * box (188 high, #92) with `DataState`: the skeleton, the error state, "No expenses this week or last week", or the
 * bar chart of this week against last week (#20). The header row and the box keep their size and place at the top of
 * a taller card (#113 a). The days and ticks are drawn as sent: the labels are formatted, nothing is calculated
 * (#11, #55); the chart's hidden table carries the values for screen readers (#113 b).
 */
export function Statistics({ query }: StatisticsProps) {
  return (
    <div className={styles.content}>
      <div className={styles.header}>
        <Dropdown
          variant="comparison"
          options={comparisons}
          value="weekly"
          // The only option is the selected one: choosing it again changes nothing (#20).
          onValueChange={() => undefined}
          aria-label="Statistics"
        />
        <ChartLegend current="This week" previous="Last week" />
      </div>
      <div className={styles.chartBox}>
        <DataState query={query} skeleton={<ComparisonBarChartSkeleton groups={7} />} empty={noExpenses}>
          {({ days, ticks }) => (
            <ComparisonBarChart
              title="Expenses per day, this week and last week"
              labels={days.map((day) => formatDayLabel(day.date))}
              previous={{ name: 'Last week', values: days.map((day) => day.lastWeek) }}
              current={{ name: 'This week', values: days.map((day) => day.thisWeek) }}
              ticks={ticks ?? []}
            />
          )}
        </DataState>
      </div>
    </div>
  );
}
