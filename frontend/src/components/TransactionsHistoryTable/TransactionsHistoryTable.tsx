import type { TransactionHistoryPage } from '@finebank/shared';

import { LoadMore, useLoadMore } from '../LoadMore/LoadMore';
import { TransactionsHistoryItem } from '../TransactionsHistoryItem/TransactionsHistoryItem';
import styles from './TransactionsHistoryTable.module.css';

type TransactionsHistoryTableProps = {
  /** The pages loaded so far, in the order sent, the first page first (#27). */
  pages: readonly TransactionHistoryPage[];
  /** The table's accessible name: the section's title. */
  label: string;
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
 * An account's Transactions History table (106; no Figma component): the header row Date, Status, Transaction Type,
 * Receipt and Amount, then one `TransactionsHistoryItem` per row of every page, page after page as sent (the frontend
 * sorts, filters, counts and calculates nothing; #11, #19, #27), the columns in 106's proportions at any width (#94).
 * Under it, while the last page has a `nextCursor`, the shared `LoadMore` (#117 a and b, #118 a); at the end it is
 * not drawn (#27) and the card ends 28 under the last row (not designed: the header's 28, mirrored).
 */
export function TransactionsHistoryTable({
  pages,
  label,
  loadingMore,
  loadMoreFailure,
  onLoadMore,
}: TransactionsHistoryTableProps) {
  const rows = pages.flatMap((page) => page.transactions);
  const hasMore = (pages.at(-1)?.nextCursor ?? null) !== null;
  const { firstNewRow, newRowRef, buttonRef, loadMore } = useLoadMore(rows.length, onLoadMore);

  return (
    <div className={hasMore ? styles.body : `${styles.body} ${styles.end}`}>
      <table className={styles.table} aria-label={label}>
        <colgroup>
          <col className={styles.dateColumn} />
          <col className={styles.statusColumn} />
          <col className={styles.typeColumn} />
          <col className={styles.receiptColumn} />
          <col className={styles.amountColumn} />
        </colgroup>
        <thead>
          <tr className={styles.headerRow}>
            <th scope="col" className={styles.dateHeader}>
              Date
            </th>
            <th scope="col">Status</th>
            <th scope="col">Transaction Type</th>
            <th scope="col">Receipt</th>
            <th scope="col" className={styles.amountHeader}>
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((transaction, index) => (
            // No ID in the contract (no route takes a transaction): the row's position is its key.
            <TransactionsHistoryItem
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
