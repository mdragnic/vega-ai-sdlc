import type { ExpensesBreakdownResponse } from '@finebank/shared';

import { DataState, type DataStateQuery } from '../DataState/DataState';
import { ExpensesBreakdown } from '../ExpensesBreakdown/ExpensesBreakdown';
import { ExpensesBreakdownSkeleton } from '../ExpensesBreakdownSkeleton/ExpensesBreakdownSkeleton';
import styles from './ExpensesBreakdownList.module.css';

type ExpensesBreakdownListProps = {
  /**
   * The expenses breakdown query, the one Overview's Expenses Breakdown reads (`['expenses', 'breakdown']`): the six
   * categories with their totals, changes and items, as the backend calculated them.
   */
  query: DataStateQuery<ExpensesBreakdownResponse>;
};

/**
 * The Expenses Breakdown section's content (109): `DataState` with the skeleton, the error state in one white card
 * across the grid (#6, #116), or the six categories as `ExpensesBreakdown` cards in the order sent, on 109's 3x2 grid
 * (#56, #61). No empty state: the six always show (#61). A failed refetch keeps the cards (#89). Maps the response into
 * the cards; sums, sorts, filters, slices and calculates nothing (#11, #74).
 */
export function ExpensesBreakdownList({ query }: ExpensesBreakdownListProps) {
  return (
    <div className={styles.content}>
      <DataState query={query} skeleton={<ExpensesBreakdownSkeleton />}>
        {({ categories }) => (
          <ul className={styles.grid}>
            {categories.map((category) => (
              <ExpensesBreakdown key={category.category} item={category} />
            ))}
          </ul>
        )}
      </DataState>
    </div>
  );
}
