import { SummarySkeleton } from '../SavingsGoalSummary/SummarySkeleton';
import { Skeleton } from '../Skeleton/Skeleton';
import styles from './SavingsGoalSkeleton.module.css';

/**
 * The loading skeleton under the Savings Goal card's divider (110) for `DataState` (#6). Not designed: the card's own
 * layout, so nothing moves when the goal arrives: the summary's shapes (task 014's), then a block of "Adjust Goal"'s
 * size at the bottom, centred. No text; `DataState` hides it from assistive technology.
 */
export function SavingsGoalSkeleton() {
  return (
    <div className={styles.skeleton}>
      <SummarySkeleton className={styles.summary} />
      <Skeleton shape="block" className={styles.button} />
    </div>
  );
}
