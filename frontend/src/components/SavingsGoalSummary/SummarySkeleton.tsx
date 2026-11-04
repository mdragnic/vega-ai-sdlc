import { Skeleton } from '../Skeleton/Skeleton';
import styles from './SummarySkeleton.module.css';

/** One icon with its label and amount lines. */
function AmountSkeleton() {
  return (
    <div className={styles.amount}>
      <Skeleton shape="block" className={styles.icon} />
      <div className={styles.lines}>
        <Skeleton shape="text" className={styles.label} />
        <Skeleton shape="text" className={styles.value} />
      </div>
    </div>
  );
}

/**
 * The loading shapes of `SavingsGoalSummary`, for the skeletons of Overview's Goals card (`GoalsSkeleton`) and the Goals
 * page's Savings Goal card (`SavingsGoalSkeleton`). Not designed: two icon-and-two-line groups on the left, the gauge's
 * half circle with its three label lines on the right. No text.
 */
export function SummarySkeleton({ className }: { className?: string }) {
  return (
    <div className={[styles.summary, className].filter(Boolean).join(' ')}>
      <div className={styles.amounts}>
        <AmountSkeleton />
        <AmountSkeleton />
      </div>
      <div className={styles.gauge}>
        <div className={styles.arc}>
          <Skeleton shape="circle" className={styles.circle} />
        </div>
        <div className={styles.gaugeLabels}>
          <Skeleton shape="text" className={styles.limit} />
          <Skeleton shape="text" className={styles.gaugeValue} />
          <Skeleton shape="text" className={styles.limit} />
        </div>
      </div>
    </div>
  );
}
