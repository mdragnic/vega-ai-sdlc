import { Skeleton } from '../Skeleton/Skeleton';
import styles from './AccountDetailsCardSkeleton.module.css';

/** The five label and value places, in the card's reading order. */
const VALUES = ['bankName', 'accountType', 'balance', 'branchName', 'accountNumber'];

/**
 * The loading skeleton of the Account Details card for `DataState` (#6). Not designed: the card's own layout, so
 * nothing moves when the account arrives: the 32 inset, the three columns, a line in each label's and each value's 24
 * px line, the rows 40 apart, then a block in the place of "Edit Details" and a line in the place of "Remove", 292 high
 * in all. `DataState` hides it from assistive technology.
 */
export function AccountDetailsCardSkeleton() {
  return (
    <div className={styles.content}>
      <div className={styles.values}>
        {VALUES.map((value) => (
          <div key={value} className={styles.value}>
            <span className={styles.line}>
              <Skeleton shape="text" className={styles.label} />
            </span>
            <span className={styles.line}>
              <Skeleton shape="text" className={styles.text} />
            </span>
          </div>
        ))}
      </div>
      <div className={styles.actions}>
        <Skeleton shape="block" className={styles.editDetails} />
        <Skeleton shape="text" className={styles.remove} />
      </div>
    </div>
  );
}
