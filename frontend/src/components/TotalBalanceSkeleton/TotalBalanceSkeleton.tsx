import { Skeleton } from '../Skeleton/Skeleton';
import styles from './TotalBalanceSkeleton.module.css';

/**
 * The loading skeleton of the Total Balance card for `DataState` (#6). Not designed: the card's own layout, so
 * nothing moves when the data arrives. A line for the total and one for "All Accounts" over the divider, a block in
 * the account card's box and a line each for Previous and Next at the bottom. No text; `DataState` hides it from
 * assistive technology.
 */
export function TotalBalanceSkeleton() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.header}>
        <Skeleton shape="text" className={styles.total} />
        <Skeleton shape="text" className={styles.link} />
      </div>
      <Skeleton shape="block" className={styles.slide} />
      <div className={styles.control}>
        <Skeleton shape="text" className={styles.previous} />
        <Skeleton shape="text" className={styles.next} />
      </div>
    </div>
  );
}
