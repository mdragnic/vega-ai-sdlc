import type { TransactionsPage } from '@finebank/shared';

import { LoadMore, useLoadMore } from '../LoadMore/LoadMore';
import { TransactionItem } from '../TransactionItem/TransactionItem';
import styles from './TransactionTable.module.css';

type TransactionTableProps = {
  /** The pages loaded so far, in the order sent, the first page first (#27). */
  pages: readonly TransactionsPage[];
  /** The id of the element that names the table: the selected tab. */
  labelledBy: string;
  /** While the next page loads: "Load More" shows the loading pattern (#6, #27). */
  loadingMore: boolean;
  /**
   * When the last "Load More" failed after its retries (#117 b): a number that changes with each failure, so a second
   * failure is announced again; null otherwise.
   */
  loadMoreFailure: number | null;
  /** Asks for the page after the last one. */
  onLoadMore: () => void;
};

/**
 * The Transactions table (107): the header row Items, Shop Name, Date, Payment Method and Amount, then one
 * `TransactionItem` per row of every page, as sent (the frontend sorts, filters and calculates nothing; #11, #19, #27),
 * the columns in 107's proportions at any width (#94). Under it, while the last page has a `nextCursor`, the shared
 * `LoadMore` (task 021): the loading pattern, focus on the first new row when it arrives (#117 a, #118 a), and a failed
 * "Load More" keeping the rows with "Something went wrong." above the button (#88, #117 b); hidden after the last page
 * (#27).
 */
export function TransactionTable({
  pages,
  labelledBy,
  loadingMore,
  loadMoreFailure,
  onLoadMore,
}: TransactionTableProps) {
  const rows = pages.flatMap((page) => page.transactions);
  const hasMore = (pages.at(-1)?.nextCursor ?? null) !== null;
  const { firstNewRow, newRowRef, buttonRef, loadMore } = useLoadMore(rows.length, onLoadMore);

  return (
    <div className={styles.body}>
      <table className={styles.table} aria-labelledby={labelledBy}>
        <colgroup>
          <col className={styles.itemsColumn} />
          <col className={styles.shopColumn} />
          <col className={styles.dateColumn} />
          <col className={styles.methodColumn} />
          <col className={styles.amountColumn} />
        </colgroup>
        <thead>
          <tr className={styles.headerRow}>
            <th scope="col" className={styles.itemsHeader}>
              Items
            </th>
            <th scope="col">Shop Name</th>
            <th scope="col">Date</th>
            <th scope="col">Payment Method</th>
            <th scope="col" className={styles.amountHeader}>
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((transaction, index) => (
            // No ID in the contract (no route takes a transaction): the row's position is its key.
            <TransactionItem
              key={index}
              ref={index === firstNewRow ? newRowRef : undefined}
              transaction={transaction}
              divided={index !== rows.length - 1}
              focusTarget={index === firstNewRow}
            />
          ))}
        </tbody>
      </table>
      {hasMore && (
        <LoadMore
          buttonRef={buttonRef}
          onClick={loadMore}
          loading={loadingMore}
          failure={loadMoreFailure}
          className={styles.loadMore}
        />
      )}
    </div>
  );
}
