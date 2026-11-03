import { Skeleton } from '../Skeleton/Skeleton';
import styles from './BillTableSkeleton.module.css';

/** Two rows, as 108 draws them: the card keeps 108's 420 while the bills load. */
const ROWS = [0, 1];

/** The header labels, as drawn (108). */
const HEADERS = ['Due Date', 'Logo', 'Item Description', 'Last Charge', 'Amount'];

/** The description's three lines, as 108 breaks the demo text. */
const DESCRIPTION_LINES = [0, 1, 2];

/** One row on the table's columns: a block in each box's and the logo's place, a line per text line. */
function RowSkeleton({ divided }: { divided: boolean }) {
  return (
    <div className={divided ? `${styles.row} ${styles.divided}` : styles.row}>
      <div className={styles.dueDate}>
        <Skeleton shape="block" className={styles.dateBox} />
      </div>
      <div className={styles.logo}>
        <Skeleton shape="block" className={styles.logoBlock} />
      </div>
      <div>
        <div className={styles.titleLine}>
          <Skeleton shape="text" className={styles.title} />
        </div>
        <div className={styles.textLines}>
          {DESCRIPTION_LINES.map((line) => (
            <div key={line} className={styles.textLine}>
              <Skeleton shape="text" className={styles.text} />
            </div>
          ))}
        </div>
      </div>
      <div className={`${styles.lastCharge} ${styles.textLineBox}`}>
        <Skeleton shape="text" className={styles.line} />
      </div>
      <div className={styles.amount}>
        <Skeleton shape="block" className={styles.amountBox} />
      </div>
    </div>
  );
}

/**
 * The loading skeleton of the Bills card for `DataState` (#6). Not designed: the table's own layout, so the card does
 * not move when two bills arrive: the header row as drawn, then 2 rows on the table's columns, each a block in the date
 * box's place, one in the logo's, a title line and three description lines, a line in the last charge's place and a
 * block in the amount box's, the divider between them, 108's 420 in all. `DataState` hides it from assistive
 * technology.
 */
export function BillTableSkeleton() {
  return (
    <div className={styles.body}>
      <div className={styles.table}>
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
      </div>
    </div>
  );
}
