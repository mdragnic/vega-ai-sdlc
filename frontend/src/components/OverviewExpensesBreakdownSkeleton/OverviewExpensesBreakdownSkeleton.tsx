import { expenseCategorySchema } from '@finebank/shared';

import gridStyles from '../OverviewExpensesBreakdown/OverviewExpensesBreakdown.module.css';
import { Skeleton } from '../Skeleton/Skeleton';
import styles from './OverviewExpensesBreakdownSkeleton.module.css';

/** One item: the tile's block, the name, total and percentage lines, and the right arrow's block. */
function ItemSkeleton() {
  return (
    <div className={styles.item}>
      <Skeleton shape="block" className={styles.tile} />
      <div className={styles.body}>
        <div className={styles.lines}>
          <Skeleton shape="text" className={styles.name} />
          <Skeleton shape="text" className={styles.amount} />
          <Skeleton shape="text" className={styles.change} />
        </div>
        <Skeleton shape="block" className={styles.arrow} />
      </div>
    </div>
  );
}

/**
 * The loading skeleton of the Overview Expenses Breakdown card for `DataState` (#6). Not designed: the items' own grid
 * and lines, so nothing moves when the categories arrive. Six items, each a block in the tile's place, three lines for
 * the name, the total and the percentage, and a block in the right arrow's place. No text; `DataState` hides it from
 * assistive technology.
 */
export function OverviewExpensesBreakdownSkeleton() {
  return (
    <div className={gridStyles.grid}>
      {/* One placeholder per category: the six always show (#61). */}
      {expenseCategorySchema.options.map((category) => (
        <ItemSkeleton key={category} />
      ))}
    </div>
  );
}
