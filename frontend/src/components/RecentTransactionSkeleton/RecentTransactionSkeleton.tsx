import { Skeleton } from '../Skeleton/Skeleton';
import styles from './RecentTransactionSkeleton.module.css';

/** The rows of the skeleton: as many as a tab lists at most (#40). */
const ROWS = [0, 1, 2, 3, 4];

/** One row: the tile's block, the item and shop lines, and the amount and date lines at the right. */
function RowSkeleton({ divided }: { divided: boolean }) {
  return (
    <div className={divided ? `${styles.row} ${styles.divided}` : styles.row}>
      <Skeleton shape="block" className={styles.tile} />
      <div className={styles.lines}>
        <Skeleton shape="text" className={styles.item} />
        <Skeleton shape="text" className={styles.shop} />
      </div>
      <div className={`${styles.lines} ${styles.end}`}>
        <Skeleton shape="text" className={styles.amount} />
        <Skeleton shape="text" className={styles.date} />
      </div>
    </div>
  );
}

/**
 * The loading skeleton of the Recent Transaction panel for `DataState` (#6), under the real tabs. Not designed: the
 * rows' own layout, so nothing moves when the transactions arrive. Five rows, each a block in the tile's place, two
 * lines for the item and the shop, and two right-aligned lines for the amount and the date, with the divider between
 * them. No text; `DataState` hides it from assistive technology.
 */
export function RecentTransactionSkeleton() {
  return (
    <div>
      {ROWS.map((row) => (
        <RowSkeleton key={row} divided={row !== ROWS.length - 1} />
      ))}
    </div>
  );
}
