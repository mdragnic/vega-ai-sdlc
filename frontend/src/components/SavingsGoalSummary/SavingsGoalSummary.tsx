import { formatMoney, type SavingsGoal } from '@finebank/shared';

import { Award, OcticonGoal16 } from '../../assets/icons';
import { TargetVsAchievementMeter } from '../TargetVsAchievementMeter/TargetVsAchievementMeter';
import styles from './SavingsGoalSummary.module.css';

type SavingsGoalSummaryProps = {
  /** The month's goal as the backend sent it (#18, #31). */
  goal: SavingsGoal;
  /** Placement from the card: the space above it. */
  className?: string;
};

/**
 * The amounts and the gauge of a month's goal, shared by Overview's Goals card (104) and the Goals page's Savings Goal
 * card (110): "Target Achieved" (the Present) and "This month Target" with their icons on the left, the gauge at the
 * progress the backend sent on the right (#18, #31). Where they do not fit side by side, the gauge moves under the
 * amounts, right-aligned (#108 b). The amounts are shown as sent; nothing is calculated here (#11).
 */
export function SavingsGoalSummary({ goal, className }: SavingsGoalSummaryProps) {
  return (
    <div className={[styles.summary, className].filter(Boolean).join(' ')}>
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
  );
}
