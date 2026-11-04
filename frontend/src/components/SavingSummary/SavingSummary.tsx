import { formatMonthLabel, type SavingSummaryResponse, type SavingsGoalMonthsResponse } from '@finebank/shared';
import { useId, useMemo } from 'react';

import { ChartLegend } from '../ChartLegend/ChartLegend';
import { DataState, type DataStateQuery } from '../DataState/DataState';
import { Dropdown } from '../Dropdown/Dropdown';
import { SavingSummaryChart } from '../SavingSummaryChart/SavingSummaryChart';
import { SavingSummaryChartSkeleton } from '../SavingSummaryChartSkeleton/SavingSummaryChartSkeleton';
import { Skeleton } from '../Skeleton/Skeleton';
import styles from './SavingSummary.module.css';

/** The hidden table's caption: what the chart shows, in the legend's words (#113 b). */
const CHART_TITLE = 'Savings per day, this month and the same period last month';

/** #124 e. The backend sends no ticks exactly when every value of both lines is 0 (#55). */
const noSavings = {
  isEmpty: (data: SavingSummaryResponse) => data.ticks === null,
  message: 'No savings this month or last month',
};

type SavingSummaryProps = {
  /** The months the user can choose, newest first, as the backend sent them: the Savings Goal selector's list (#60). */
  months: DataStateQuery<SavingsGoalMonthsResponse>;
  /** This card's own selected month, `YYYY-MM`: one of `months`, or `undefined` until they load (#30). */
  selected: string | undefined;
  onSelect: (month: string) => void;
  /** The selected month's savings per day, asked for once a month is selected (#42, #59). */
  summary: DataStateQuery<SavingSummaryResponse>;
};

/**
 * The months and the selected month's summary as one query for the chart's `DataState` (#6): pending or failed while
 * the months have not loaded (Retry asks for them again), then the summary as it is. So the skeleton shows while either
 * loads, also after a month is picked, and the error state when either first load fails.
 */
function useCardQuery(
  months: DataStateQuery<SavingsGoalMonthsResponse>,
  summary: DataStateQuery<SavingSummaryResponse>,
): DataStateQuery<SavingSummaryResponse> {
  const monthsLoaded = months.data !== undefined;
  const { status: monthsStatus, fetchStatus: monthsFetchStatus, refetch: refetchMonths } = months;
  const monthsQuery = useMemo<DataStateQuery<SavingSummaryResponse>>(
    () => ({
      status: monthsStatus === 'error' ? 'error' : 'pending',
      data: undefined,
      fetchStatus: monthsFetchStatus,
      refetch: async () => {
        const { status } = await refetchMonths();
        return { status: status === 'error' ? 'error' : 'pending', data: undefined };
      },
    }),
    [monthsStatus, monthsFetchStatus, refetchMonths],
  );
  return monthsLoaded ? summary : monthsQuery;
}

/**
 * The content of 110's Saving Summary card (Figma `66:5829` is flattened, no component): the 32 high header row with
 * "Saving Summary" (`h3`), its `Dropdown` `plain` named by it (its options the months as sent, `formatMonthLabel`) and
 * the legend "This month" / "Same period last month" at the right, in every state; where the row does not fit, the
 * legend moves under it, right-aligned (#106, #108 b). Under it the chart's box (216 high) with one `DataState` on the
 * months and the selected month's summary: `SavingSummaryChartSkeleton` while either loads, the error state when either
 * first load fails, "No savings this month or last month" when every value is 0 (#124 e), or `SavingSummaryChart` as
 * sent. The box stays at the card's top when the card is taller (#113 a). The selector holds its place with a block while
 * the months load and then stays through every state, so a month picked with the keyboard keeps focus on it. It shows
 * what it is sent: no arithmetic on amounts, days or months (#11).
 */
export function SavingSummary({ months, selected, onSelect, summary }: SavingSummaryProps) {
  const titleId = useId();
  const cardQuery = useCardQuery(months, summary);
  const options = useMemo(
    () => (months.data?.months ?? []).map((month) => ({ value: month, label: formatMonthLabel(month) })),
    [months.data],
  );

  return (
    <div className={styles.savingSummary}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h3 id={titleId} className={styles.title}>
            Saving Summary
          </h3>
          {selected !== undefined ? (
            <Dropdown
              variant="plain"
              aria-labelledby={titleId}
              options={options}
              value={selected}
              onValueChange={onSelect}
            />
          ) : (
            months.status !== 'error' && (
              <span aria-hidden="true" className={styles.selectorPlaceholder}>
                <Skeleton shape="block" className={styles.selectorBlock} />
              </span>
            )
          )}
        </div>
        <div className={styles.legend}>
          <ChartLegend current="This month" previous="Same period last month" />
        </div>
      </div>
      <div className={styles.chartBox}>
        <DataState query={cardQuery} skeleton={<SavingSummaryChartSkeleton />} empty={noSavings}>
          {({ days, ticks }) => <SavingSummaryChart title={CHART_TITLE} days={days} ticks={ticks ?? []} />}
        </DataState>
      </div>
    </div>
  );
}
