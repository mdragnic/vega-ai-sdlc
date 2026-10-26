import { Skeleton } from '../Skeleton/Skeleton';
import styles from './GoalsSkeleton.module.css';

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
      <div className={styles.body}>
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
    </div>
  );
}
