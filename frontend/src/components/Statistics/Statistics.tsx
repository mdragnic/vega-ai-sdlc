import { formatDayLabel, type WeeklyComparisonResponse } from '@finebank/shared';

import {
  ComparisonChartCard,
  type ComparisonChartCardProps,
  type ComparisonChartDescription,
} from '../ComparisonChartCard/ComparisonChartCard';

/** The weekly comparison of 104 (#20): the days and the ticks drawn as the backend sent them (#55). */
const weekly: ComparisonChartDescription<WeeklyComparisonResponse> = {
  option: { value: 'weekly', label: 'Weekly Comparison' },
  name: 'Statistics',
  legend: { current: 'This week', previous: 'Last week' },
  groups: 7,
  title: 'Expenses per day, this week and last week',
  emptyMessage: 'No expenses this week or last week',
  toChart: ({ days, ticks }) => ({
    labels: days.map((day) => formatDayLabel(day.date)),
    previous: days.map((day) => day.lastWeek),
    current: days.map((day) => day.thisWeek),
    ticks,
  }),
};

/**
 * The content of the Overview Statistics card (104, Figma section `Statistics` 66:4933): `ComparisonChartCard` with
 * "Weekly Comparison", the legend "This week" / "Last week" and the bar chart of the 7 days, labelled by
 * `formatDayLabel` (the weekday only, #122 a); "No expenses this week or last week" when the backend sends no ticks.
 */
export function Statistics({ query }: Pick<ComparisonChartCardProps<WeeklyComparisonResponse>, 'query'>) {
  return <ComparisonChartCard query={query} comparison={weekly} />;
}
