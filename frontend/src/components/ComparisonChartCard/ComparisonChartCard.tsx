import type { Money } from '@finebank/shared';

import { ChartLegend } from '../ChartLegend/ChartLegend';
import { ComparisonBarChart } from '../ComparisonBarChart/ComparisonBarChart';
import { ComparisonBarChartSkeleton } from '../ComparisonBarChartSkeleton/ComparisonBarChartSkeleton';
import { DataState, type DataStateQuery } from '../DataState/DataState';
import { Dropdown } from '../Dropdown/Dropdown';
import styles from './ComparisonChartCard.module.css';

/** What the chart draws, as the backend sent it: one label per group, the two periods' values and the ticks. */
type ComparisonChartData = {
  labels: string[];
  /** The earlier period's values, one per label. */
  previous: (Money | null)[];
  /** The current period's values, one per label; `null` for a period still to come. */
  current: (Money | null)[];
  /** The backend's ticks; `null` when every value of both periods is 0 (#55). */
  ticks: Money[] | null;
};

/** One use of the card: what it shows around the chart and how a response becomes the chart. */
export type ComparisonChartDescription<TData> = {
  /** The one comparison: the control shows it and its list offers nothing else (#20, #29). */
  option: { value: string; label: string };
  /** The control's accessible name. */
  name: string;
  /** The legend's names, which also name the two periods in the hidden table. */
  legend: { current: string; previous: string };
  /** How many groups the skeleton draws: as many as the chart will. */
  groups: number;
  /** The hidden table's caption: what the chart shows (#113 b). */
  title: string;
  /** Shown when the backend sends no ticks (#91 c). */
  emptyMessage: string;
  /** Maps and formats the response; calculates nothing (#11, #55). */
  toChart: (data: TData) => ComparisonChartData;
};

export type ComparisonChartCardProps<TData> = {
  /** The comparison's query: the groups and the ticks, as the backend calculated them. */
  query: DataStateQuery<TData>;
  comparison: ComparisonChartDescription<TData>;
};

/**
 * The content of a comparison chart card (104 Statistics, 109 "Expenses Comparison"): the header row, with the one
 * comparison's control (`Dropdown` `comparison`) at the left and the legend at the right, in every state (#93 a); under
 * it the chart's box (188 high, #92) with `DataState`: the skeleton of the described groups, the error state, the empty
 * message when the backend sends no ticks (#91 c), or the bar chart of the current period against the earlier one. The
 * header row and the box keep their size and place at the top of a taller card (#113 a). The data is drawn as sent:
 * `toChart` formats the labels, nothing is calculated (#11, #55); the chart's hidden table carries the values for
 * screen readers (#113 b). Nothing in the chart is focusable or reacts (#20, #29).
 */
export function ComparisonChartCard<TData>({ query, comparison }: ComparisonChartCardProps<TData>) {
  const { option, name, legend, groups, title, emptyMessage, toChart } = comparison;
  return (
    <div className={styles.content}>
      <div className={styles.header}>
        <Dropdown
          variant="comparison"
          options={[option]}
          value={option.value}
          // The only option is the selected one: choosing it again changes nothing (#20, #29).
          onValueChange={() => undefined}
          aria-label={name}
        />
        <ChartLegend current={legend.current} previous={legend.previous} />
      </div>
      <div className={styles.chartBox}>
        <DataState
          query={query}
          skeleton={<ComparisonBarChartSkeleton groups={groups} />}
          empty={{ isEmpty: (data) => toChart(data).ticks === null, message: emptyMessage }}
        >
          {(data) => {
            const chart = toChart(data);
            return (
              <ComparisonBarChart
                title={title}
                labels={chart.labels}
                previous={{ name: legend.previous, values: chart.previous }}
                current={{ name: legend.current, values: chart.current }}
                ticks={chart.ticks ?? []}
              />
            );
          }}
        </DataState>
      </div>
    </div>
  );
}
