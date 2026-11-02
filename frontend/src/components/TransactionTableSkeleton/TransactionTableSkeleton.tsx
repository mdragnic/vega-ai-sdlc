import { Skeleton } from '../Skeleton/Skeleton';
import styles from './TransactionTableSkeleton.module.css';

/** The rows of the skeleton: a first page's (#27). */
const ROWS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** The header labels, as drawn (107). */
const HEADERS = ['Items', 'Shop Name', 'Date', 'Payment Method', 'Amount'];

/** One row on the table's columns: a block in the icon's place and a line per cell, aligned as the cells. */
function RowSkeleton({ divided }: { divided: boolean }) {
  return (
    <div className={divided ? `${styles.row} ${styles.divided}` : styles.row}>
      <div className={`${styles.cell} ${styles.itemsCell}`}>
        <Skeleton shape="block" className={styles.icon} />
        <Skeleton shape="text" className={styles.item} />
      </div>
      <div className={styles.cell}>
        <Skeleton shape="text" className={styles.line} />
      </div>
      <div className={styles.cell}>
        <Skeleton shape="text" className={styles.line} />
      </div>
      <div className={styles.cell}>
        <Skeleton shape="text" className={styles.line} />
      </div>
      <div className={`${styles.cell} ${styles.amountCell}`}>
        <Skeleton shape="text" className={styles.line} />
      </div>
    </div>
  );
}

/**
 * The loading skeleton of the Transactions table for `DataState` (#6), under the real tabs. Not designed: the table's
 * own layout, so nothing moves when a first page arrives: the header row as drawn, 10 rows on the table's columns,
 * each a block in the icon's place and a line per cell, the dividers between them, and a block in the place of
 * "Load More". `DataState` hides it from assistive technology.
 */
export function TransactionTableSkeleton() {
  return (
    <div className={styles.body}>
      <div className={styles.header}>
        {HEADERS.map((header) => (
          <span key={header} className={styles.headerCell}>
            {header}
          </span>
        ))}
      </div>
      {ROWS.map((row) => (
        <RowSkeleton key={row} divided={row !== ROWS.length - 1} />
      ))}
      <div className={styles.loadMore}>
        <Skeleton shape="block" className={styles.button} />
      </div>
    </div>
  );
}
