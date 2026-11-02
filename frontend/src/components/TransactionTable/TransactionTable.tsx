import type { TransactionsPage } from '@finebank/shared';
import { useLayoutEffect, useRef, useState } from 'react';

import { ButtonPrimary } from '../ButtonPrimary/ButtonPrimary';
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
 * the columns in 107's proportions at any width (#94). Under it, while the last page has a `nextCursor`, "Load More";
 * hidden after the last page (#27). While the next page loads the button shows the loading pattern and keeps focus;
 * when the rows arrive, focus moves to the first new row, also when the last page hides the button, so it never falls
 * to the page body (#117 a). A failed "Load More" keeps the rows and shows "Something went wrong." above the button,
 * which asks for the same page again (#88, #117 b).
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
  // The index of the first row the last "Load More" asked for, and whether it still has to take focus.
  const [firstNewRow, setFirstNewRow] = useState<number | null>(null);
  const focusPending = useRef(false);
  const newRow = useRef<HTMLTableRowElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  // After every render: the first new row is there once its page has arrived.
  useLayoutEffect(() => {
    const row = newRow.current;
    if (!focusPending.current || row === null) return;
    focusPending.current = false;
    // Only from the button (or from the body, where it fell when the last page removed the button): focus the user
    // moved elsewhere while the page loaded stays there.
    const active = document.activeElement;
    if (active === null || active === document.body || active === button.current) row.focus({ preventScroll: true });
  });

  function loadMore() {
    setFirstNewRow(rows.length);
    focusPending.current = true;
    onLoadMore();
  }

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
              ref={index === firstNewRow ? newRow : undefined}
              transaction={transaction}
              divided={index !== rows.length - 1}
              focusTarget={index === firstNewRow}
            />
          ))}
        </tbody>
      </table>
      {hasMore && (
        <div className={styles.loadMore}>
          {/* A polite live region, there before its message, so the failure is announced (#117 b); a new message node
              for each failure, so a repeated failure is announced again. */}
          <p role="status" className={styles.loadMoreError}>
            {loadMoreFailure !== null && <span key={loadMoreFailure}>Something went wrong.</span>}
          </p>
          <div className={styles.loadMoreButton}>
            <ButtonPrimary ref={button} loading={loadingMore} onClick={loadMore}>
              Load More
            </ButtonPrimary>
          </div>
        </div>
      )}
    </div>
  );
}
