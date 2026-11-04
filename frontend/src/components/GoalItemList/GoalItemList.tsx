import type { CategoryLimitsResponse } from '@finebank/shared';

import { Card } from '../Card/Card';
import { DataState, type DataStateQuery } from '../DataState/DataState';
import { GoalItem } from '../GoalItem/GoalItem';
import { GoalItemSkeleton } from '../GoalItemSkeleton/GoalItemSkeleton';
import styles from './GoalItemList.module.css';

type GoalItemListProps = {
  /** The limits query (`['category-limits']`): the six categories with the user's limits, as the backend sent them. */
  query: DataStateQuery<CategoryLimitsResponse>;
};

/**
 * The Expenses Goals by Category section's content (110): `DataState` with the six skeleton cards, the error state in
 * one white card across the grid at least the grid's 224 high (#6, #105 a, #116), or a list of the six categories as
 * `GoalItem` cards in the order sent, on 110's 3x2 grid (#56, #61). No empty state: the six always show (#61). A failed
 * refetch keeps the cards (#89). Maps the response into the cards; sums, sorts, filters and calculates nothing (#11,
 * #32).
 */
export function GoalItemList({ query }: GoalItemListProps) {
  return (
    <div className={styles.content}>
      <DataState query={query} skeleton={<GoalItemSkeleton />}>
        {({ limits }) => (
          <ul className={styles.grid}>
            {limits.map((item) => (
              <li key={item.category} className={styles.cell}>
                <Card className={styles.card}>
                  <GoalItem item={item} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </DataState>
    </div>
  );
}
