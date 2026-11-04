import { formatMonthLabel, type SavingsGoalMonthsResponse, type SavingsGoalResponse } from '@finebank/shared';
import { useId, useMemo, useState } from 'react';

import { AdjustButton } from '../AdjustButton/AdjustButton';
import { DataState, type DataStateQuery } from '../DataState/DataState';
import { Dropdown } from '../Dropdown/Dropdown';
import { SavingsGoalPopup } from '../SavingsGoalPopup/SavingsGoalPopup';
import { SavingsGoalSkeleton } from '../SavingsGoalSkeleton/SavingsGoalSkeleton';
import { SavingsGoalSummary } from '../SavingsGoalSummary/SavingsGoalSummary';
import { Skeleton } from '../Skeleton/Skeleton';
import styles from './SavingsGoal.module.css';

type SavingsGoalProps = {
  /** The months the user can choose, newest first, as the backend sent them (#60, #123 a). */
  months: DataStateQuery<SavingsGoalMonthsResponse>;
  /** The selected month, `YYYY-MM`: one of `months`, or `undefined` until they load. */
  selected: string | undefined;
  onSelect: (month: string) => void;
  /**
   * Called with `true` when "Adjust Goal" opens the popup and `false` when it closes, so the page keeps the selected
   * month while the popup is open: the card behind it, its "Adjust Goal" and the popup stay on the month it opened with.
   */
  onPopupOpenChange: (open: boolean) => void;
  /** The selected month's goal (`goal: null` without one), asked for once a month is selected (#30, #58). */
  goal: DataStateQuery<SavingsGoalResponse>;
};

/** The popup's state: open or not, and how many times it opened, so each opening starts a fresh form (#35). */
type PopupState = { open: boolean; opened: number };

/**
 * The months and the selected goal as one query for the `DataState` under the divider (#6): pending or failed while
 * the months have not loaded (Retry asks for them again), then the selected month's goal as it is. So the skeleton
 * shows while either loads, also after a month is picked, and the error state when either first load fails.
 */
function useCardQuery(
  months: DataStateQuery<SavingsGoalMonthsResponse>,
  goal: DataStateQuery<SavingsGoalResponse>,
): DataStateQuery<SavingsGoalResponse> {
  const monthsLoaded = months.data !== undefined;
  const { status: monthsStatus, fetchStatus: monthsFetchStatus, refetch: refetchMonths } = months;
  const monthsQuery = useMemo<DataStateQuery<SavingsGoalResponse>>(
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
  return monthsLoaded ? goal : monthsQuery;
}

/**
 * The content of 110's Savings Goal card: the header row with "Savings Goal" and the month selector (task 005's
 * `Dropdown` `box`, named by the title, its options the months as sent, #30, #60); the divider; then the selected
 * month's `SavingsGoalSummary`, or "No goal for this month" (#58, #108 c), and "Adjust Goal", which opens popup 110.1 for
 * that month and its goal, past months included (#58 d); while it is open the page keeps that month selected
 * (`onPopupOpenChange`), so a list fetched again behind it never swaps the card, its typing or its month. The title always shows; the selector holds its place with a
 * block while the months load and then stays through every state, so a month picked with the keyboard keeps focus on it
 * while it loads. Where the header row does not fit, the selector moves under the title, right-aligned; the body wraps
 * per #108 b. It shows what it is sent: no arithmetic on amounts or months (#11).
 */
export function SavingsGoal({ months, selected, onSelect, onPopupOpenChange, goal }: SavingsGoalProps) {
  const titleId = useId();
  const [popup, setPopup] = useState<PopupState>({ open: false, opened: 0 });
  const cardQuery = useCardQuery(months, goal);
  const options = useMemo(
    () => (months.data?.months ?? []).map((month) => ({ value: month, label: formatMonthLabel(month) })),
    [months.data],
  );

  return (
    <div className={styles.savingsGoal}>
      <div className={styles.header}>
        <h3 id={titleId} className={styles.title}>
          Savings Goal
        </h3>
        <div className={styles.selector}>
          {selected !== undefined ? (
            <Dropdown
              variant="box"
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
      </div>
      <div className={styles.body}>
        <DataState query={cardQuery} skeleton={<SavingsGoalSkeleton />}>
          {(data) => (
            <>
              {data.goal ? (
                <SavingsGoalSummary goal={data.goal} />
              ) : (
                <div className={styles.empty}>
                  <p className={styles.emptyText}>No goal for this month</p>
                </div>
              )}
              <div className={styles.adjust}>
                <AdjustButton
                  label="Adjust Goal"
                  onClick={() => {
                    onPopupOpenChange(true);
                    setPopup(({ opened }) => ({ open: true, opened: opened + 1 }));
                  }}
                />
              </div>
              <SavingsGoalPopup
                key={popup.opened}
                open={popup.open}
                onOpenChange={(open) => {
                  onPopupOpenChange(open);
                  setPopup(({ opened }) => ({ open, opened }));
                }}
                month={data.month}
                goal={data.goal}
                title={`Adjust goal for ${formatMonthLabel(data.month)}`}
              />
            </>
          )}
        </DataState>
      </div>
    </div>
  );
}
