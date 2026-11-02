import { Skeleton } from '../Skeleton/Skeleton';
import styles from './TransactionsHistorySkeleton.module.css';

/** The rows of the skeleton: a first page's (#27). */
const ROWS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** The header labels, as drawn (106). */
const HEADERS = ['Date', 'Status', 'Transaction Type', 'Receipt', 'Amount'];

/** One row on the table's columns: a line per cell, aligned as the cells. */
function RowSkeleton({ divided }: { divided: boolean }) {
  return (
    <div className={divided ? `${styles.row} ${styles.divided}` : styles.row}>
      {HEADERS.map((header) => (
        <div key={header} className={styles.cell}>
          <Skeleton shape="text" className={styles.line} />
        </div>
      ))}
    </div>
  );
}

/**
 * The loading skeleton of an account's Transactions History for `DataState` (#6). Not designed: the table's own
 * layout, so nothing moves when the first page arrives: the header row as drawn, 10 rows of 56 on the table's columns,
 * a line per cell, the dividers between them, and a block in the place of "Load More": a first page's 748. `DataState`
 * hides it from assistive technology.
 */
export function TransactionsHistorySkeleton() {
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
