import { type RefObject, useLayoutEffect, useRef, useState } from 'react';

import { ButtonPrimary } from '../ButtonPrimary/ButtonPrimary';
import styles from './LoadMore.module.css';

/**
 * The focus move of a paged table's "Load More" (#117 a, #118 a). `rowCount` is the number of rows shown; the click
 * (`loadMore`) records it as the index of the first row the next page adds, and calls `onLoadMore`. When that row is there (its
 * `newRowRef` attached), it takes focus, without scrolling, only when focus is still on the button or has fallen to the
 * page body (where it goes when the last page removes the button): focus the user moved elsewhere while the page
 * loaded stays there. The table makes the row at `firstNewRow` focusable by script only (`tabindex="-1"`).
 */
export function useLoadMore(rowCount: number, onLoadMore: () => void) {
  const [firstNewRow, setFirstNewRow] = useState<number | null>(null);
  const focusPending = useRef(false);
  const newRowRef = useRef<HTMLTableRowElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // After every render: the first new row is there once its page has arrived.
  useLayoutEffect(() => {
    const row = newRowRef.current;
    if (!focusPending.current || row === null) return;
    focusPending.current = false;
    const active = document.activeElement;
    if (active === null || active === document.body || active === buttonRef.current) row.focus({ preventScroll: true });
  });

  function loadMore() {
    setFirstNewRow(rowCount);
    focusPending.current = true;
    onLoadMore();
  }
  return { firstNewRow, newRowRef, buttonRef, loadMore };
}

type LoadMoreProps = {
  /** From `useLoadMore`: the button, for its focus check. */
  buttonRef: RefObject<HTMLButtonElement | null>;
  /** From `useLoadMore`: asks for the next page. */
  onClick: () => void;
  /** While the next page loads: the loading pattern (#6, #27). */
  loading: boolean;
  /**
   * When the last "Load More" failed after its retries (#117 b): a number that changes with each failure, so a second
   * failure is announced again; null otherwise.
   */
  failure: number | null;
  /** The gaps around it, which each table sets. */
  className?: string;
};

/**
 * "Load More" under a paged table (107, 106): `ButtonPrimary`, 192 wide and centred, with the loading pattern while the
 * next page loads (the gray look, the spinner, `aria-busy`, its name kept, clicks ignored, focus kept; #6, #27). Above
 * it a polite live region where a failed "Load More" shows "Something went wrong." (#88), the rows kept and the button
 * asking for the same page again (#117 b). Rendered only while there is a next page (#27).
 */
export function LoadMore({ buttonRef, onClick, loading, failure, className }: LoadMoreProps) {
  return (
    <div className={className === undefined ? styles.loadMore : `${styles.loadMore} ${className}`}>
      {/* There before its message, so the failure is announced; a new message node for each failure, so a repeated
          failure is announced again. */}
      <p role="status" className={styles.error}>
        {failure !== null && <span key={failure}>Something went wrong.</span>}
      </p>
      <div className={styles.button}>
        <ButtonPrimary ref={buttonRef} loading={loading} onClick={onClick}>
          Load More
        </ButtonPrimary>
      </div>
    </div>
  );
}
