import { Card } from '../Card/Card';
import { Skeleton } from '../Skeleton/Skeleton';
import styles from './AccountTypeSkeleton.module.css';

/**
 * The loading skeleton of one Balances card (`AccountType`) for `DataState` (#6). Not designed: the card's own layout
 * at its 288, so nothing moves when the data arrives. Lines for the type and the Bank Name over the divider, two
 * lines each for the number and the balance with their labels, a line for "Remove" and a block in the "Details" box.
 * No text; `DataState` hides it from assistive technology.
 */
export function AccountTypeSkeleton() {
  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <Skeleton shape="text" className={styles.type} />
        <Skeleton shape="text" className={styles.bankName} />
      </div>
      <div className={styles.value}>
        <Skeleton shape="text" className={styles.amount} />
        <Skeleton shape="text" className={styles.label} />
      </div>
      <div className={styles.value}>
        <Skeleton shape="text" className={styles.amount} />
        <Skeleton shape="text" className={styles.label} />
      </div>
      <div className={styles.bottomRow}>
        <Skeleton shape="text" className={styles.remove} />
        <Skeleton shape="block" className={styles.details} />
      </div>
    </Card>
  );
}
