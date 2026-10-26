import { formatMoney, formatMonthLabel, type SavingsGoalResponse } from '@finebank/shared';
import { useState } from 'react';

import { Award, Edit, OcticonGoal16 } from '../../assets/icons';
import { SavingsGoalPopup } from '../SavingsGoalPopup/SavingsGoalPopup';
import { TargetVsAchievementMeter } from '../TargetVsAchievementMeter/TargetVsAchievementMeter';
import styles from './Goals.module.css';

type GoalsProps = {
  /** The current month in the user's zone and its goal, as the backend sent them (#54, #58). */
  data: SavingsGoalResponse;
};

/** The popup's state: open or not, and how many times it opened, so each opening starts a fresh form (#35). */
type PopupState = { open: boolean; opened: number };

/**
 * The content of the Overview Goals card (104, Figma frame `Goals` 405:5491): the Target, the pencil that opens
 * `SavingsGoalPopup` (#18) and the month over the divider; then "Target Achieved" (the Present) and "This month
 * Target" on the left and the gauge at the progress the backend sent on the right (#18, #31). Without a goal the
 * pencil and the month stay and "No goal for this month" fills the rest (#58, #108 c). Where a line does not fit,
 * its right part moves under it (#108 b). The amounts are shown as sent; nothing is calculated here (#11).
 */
export function Goals({ data }: GoalsProps) {
  const { month, goal } = data;
  const [popup, setPopup] = useState<PopupState>({ open: false, opened: 0 });
  const [year, monthNumber] = month.split('-').map(Number);

  return (
    <div className={styles.goals}>
      <div className={styles.header}>
        <div className={styles.targetRow}>
          {goal && <p className={styles.target}>{formatMoney(goal.target)}</p>}
          <button
            type="button"
            className={styles.edit}
            aria-label="Edit savings goal"
            onClick={() => setPopup(({ opened }) => ({ open: true, opened: opened + 1 }))}
          >
            <Edit aria-hidden="true" />
          </button>
        </div>
        <p className={styles.month}>{formatMonthLabel(year!, monthNumber!)}</p>
      </div>
      {goal ? (
        <div className={styles.body}>
          <dl className={styles.amounts}>
            <div className={styles.amount}>
              <dt className={styles.label}>
                <Award className={styles.icon} aria-hidden="true" />
                Target Achieved
              </dt>
              <dd className={styles.value}>{formatMoney(goal.present)}</dd>
            </div>
            <div className={styles.amount}>
              <dt className={styles.label}>
                <OcticonGoal16 className={styles.icon} aria-hidden="true" />
                This month Target
              </dt>
              <dd className={styles.value}>{formatMoney(goal.target)}</dd>
            </div>
          </dl>
          <div className={styles.gauge}>
            <TargetVsAchievementMeter present={goal.present} target={goal.target} progress={goal.progress} />
          </div>
        </div>
      ) : (
        <div className={styles.empty}>
          <p className={styles.emptyText}>No goal for this month</p>
        </div>
      )}
      <SavingsGoalPopup
        key={popup.opened}
        open={popup.open}
        onOpenChange={(open) => setPopup(({ opened }) => ({ open, opened }))}
        month={month}
        goal={goal}
      />
    </div>
  );
}
