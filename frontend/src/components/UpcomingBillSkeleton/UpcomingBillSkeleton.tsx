import { Skeleton } from '../Skeleton/Skeleton';
import styles from './UpcomingBillSkeleton.module.css';

/** One row: the date box's block, the logo, title and last charge lines, and the amount box's block. */
function RowSkeleton({ divided }: { divided: boolean }) {
  return (
    <div className={divided ? `${styles.row} ${styles.divided}` : styles.row}>
      <Skeleton shape="block" className={styles.date} />
      <div className={styles.text}>
        <Skeleton shape="text" className={styles.logo} />
        <Skeleton shape="text" className={styles.title} />
        <Skeleton shape="text" className={styles.lastCharge} />
      </div>
      <Skeleton shape="block" className={styles.amount} />
    </div>
  );
}

/**
 * The loading skeleton of the Upcoming Bill card for `DataState` (#6). Not designed: the card's own layout, so
 * nothing moves when the bills arrive. Two rows, each a block in the date box's place, three lines for the logo, the
 * title and the last charge, and a block in the amount box's place, with the divider between them, inside the card's
 * 232 minimum. No text; `DataState` hides it from assistive technology.
 */
export function UpcomingBillSkeleton() {
  return (
    <div>
      <RowSkeleton divided={false} />
      <RowSkeleton divided />
    </div>
  );
}
