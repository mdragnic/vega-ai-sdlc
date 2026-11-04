import { expenseCategorySchema } from '@finebank/shared';

import { Card } from '../Card/Card';
import itemStyles from '../GoalItem/GoalItem.module.css';
import listStyles from '../GoalItemList/GoalItemList.module.css';
import { Skeleton } from '../Skeleton/Skeleton';
import styles from './GoalItemSkeleton.module.css';

/** One card: a block in the tile's place, a line for the name over one for the limit, a block of "Adjust"'s size. */
function CardSkeleton() {
  return (
    <Card className={listStyles.card}>
      <div className={itemStyles.item}>
        <Skeleton shape="block" className={styles.tile} />
        <div className={itemStyles.body}>
          <div className={styles.lines}>
            <Skeleton shape="text" className={styles.name} />
            <Skeleton shape="text" className={styles.amount} />
          </div>
          <Skeleton shape="block" className={styles.button} />
        </div>
      </div>
    </Card>
  );
}

/**
 * The loading skeleton of the Expenses Goals by Category cards for `DataState` (#6). Not designed: six cards on the
 * cards' own grid at their 104, so nothing moves when the limits arrive; each a block in the tile's place, two lines for
 * the name and the limit, and a block of "Adjust"'s size at the right. `Skeleton` shapes and existing tokens only; no
 * text, no "Adjust". `DataState` hides it from assistive technology.
 */
export function GoalItemSkeleton() {
  return (
    <div className={listStyles.grid}>
      {/* One placeholder per category: the six always show (#61). */}
      {expenseCategorySchema.options.map((category) => (
        <CardSkeleton key={category} />
      ))}
    </div>
  );
}
