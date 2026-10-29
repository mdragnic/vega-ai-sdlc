import type { ExpensesBreakdownResponse } from '@finebank/shared';

import { DataState, type DataStateQuery } from '../DataState/DataState';
import { ExpensesItem } from '../ExpensesItem/ExpensesItem';
import { OverviewExpensesBreakdownSkeleton } from '../OverviewExpensesBreakdownSkeleton/OverviewExpensesBreakdownSkeleton';
import styles from './OverviewExpensesBreakdown.module.css';

type OverviewExpensesBreakdownProps = {
  /** The expenses breakdown query: the six categories with their totals and changes, as the backend calculated them. */
  query: DataStateQuery<ExpensesBreakdownResponse>;
};

/**
 * The content of the Overview Expenses Breakdown card (104, Figma section `Expenses Breakdown` 66:4999): `DataState`
 * with the skeleton, the error state, or the six categories as `ExpensesItem` in the order sent, on 104's 3x2 grid with
 * a line in the middle of each gap (#21, #56, #61). No empty state: the six always show (#61). The grid keeps its size
 * and place at the top of a taller card (#112, #113 a). Maps the response into the items; calculates, sorts and
 * filters nothing (#11, #74).
 */
export function OverviewExpensesBreakdown({ query }: OverviewExpensesBreakdownProps) {
  return (
    <DataState query={query} skeleton={<OverviewExpensesBreakdownSkeleton />}>
      {({ categories }) => (
        <ul className={styles.grid}>
          {categories.map((item) => (
            <ExpensesItem key={item.category} item={item} />
          ))}
        </ul>
      )}
    </DataState>
  );
}
