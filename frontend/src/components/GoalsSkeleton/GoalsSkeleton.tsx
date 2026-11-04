import { SummarySkeleton } from '../SavingsGoalSummary/SummarySkeleton';
import { Skeleton } from '../Skeleton/Skeleton';
import styles from './GoalsSkeleton.module.css';

/**
 * The loading skeleton of the Goals card for `DataState` (#6). Not designed: the card's own layout, so nothing moves
 * when the goal arrives. A line for the Target and a block for the pencil, a line for the month, the divider, two
 * icon-and-two-line groups on the left, and the gauge's half circle with its three label lines on the right. No text;
 * `DataState` hides it from assistive technology.
 */
export function GoalsSkeleton() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.header}>
        <div className={styles.targetRow}>
          <Skeleton shape="text" className={styles.target} />
          <Skeleton shape="block" className={styles.edit} />
        </div>
        <Skeleton shape="text" className={styles.month} />
      </div>
      <SummarySkeleton className={styles.body} />
    </div>
  );
}
