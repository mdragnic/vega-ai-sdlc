import { expenseCategorySchema } from '@finebank/shared';

import { Card } from '../Card/Card';
import cardStyles from '../ExpensesBreakdown/ExpensesBreakdown.module.css';
import listStyles from '../ExpensesBreakdownList/ExpensesBreakdownList.module.css';
import { Skeleton } from '../Skeleton/Skeleton';
import styles from './ExpensesBreakdownSkeleton.module.css';

/** One item: a line for the name at the left, an amount line over a date line at the right. */
function ItemSkeleton() {
  return (
    <div className={styles.item}>
      <Skeleton shape="text" className={styles.itemName} />
      <div className={styles.right}>
        <Skeleton shape="text" className={styles.amount} />
        <Skeleton shape="text" className={styles.date} />
      </div>
    </div>
  );
}

/** One card: the gray header with the tile's block and two lines each side, the body with two items. */
function CardSkeleton() {
  return (
    <Card padding="none" className={`${cardStyles.card} ${styles.card}`}>
      <div className={cardStyles.header}>
        <Skeleton shape="block" className={`${styles.onHeader} ${styles.tile}`} />
        <div className={styles.headerText}>
          <div className={styles.lines}>
            <Skeleton shape="text" className={`${styles.onHeader} ${styles.name}`} />
            <Skeleton shape="text" className={`${styles.onHeader} ${styles.total}`} />
          </div>
          <div className={`${styles.lines} ${styles.rightLines}`}>
            <Skeleton shape="text" className={`${styles.onHeader} ${styles.change}`} />
            <Skeleton shape="text" className={`${styles.onHeader} ${styles.compare}`} />
          </div>
        </div>
      </div>
      <div className={cardStyles.body}>
        <ItemSkeleton />
        <ItemSkeleton />
      </div>
    </Card>
  );
}

/**
 * The loading skeleton of the Expenses cards for `DataState` (#6). Not designed: six cards on the cards' own grid at
 * their 238, so nothing moves when the categories arrive; each the gray header with a block in the tile's place, two
 * lines for the name and the total and two at the right, and the body with two items (a name line, an amount line
 * over a date line) and the divider between them. `Skeleton` shapes and existing tokens only; no text. `DataState`
 * hides it from assistive technology.
 */
export function ExpensesBreakdownSkeleton() {
  return (
    <div className={listStyles.grid}>
      {/* One placeholder per category: the six always show (#61). */}
      {expenseCategorySchema.options.map((category) => (
        <CardSkeleton key={category} />
      ))}
    </div>
  );
}
