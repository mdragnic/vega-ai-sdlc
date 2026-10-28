import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';

import { ButtonSmall } from '../ButtonSmall/ButtonSmall';
import styles from './DataState.module.css';
import { WidgetErrorBoundary } from './WidgetErrorBoundary';

type QueryStatus = 'pending' | 'error' | 'success';

/** The part of a TanStack Query result that `DataState` reads. A successful query has its data. */
export type DataStateQuery<TData> = {
  fetchStatus: 'fetching' | 'paused' | 'idle';
  /** Resolves with the refetched result, as TanStack Query's `refetch` does. */
  refetch: () => Promise<{ status: QueryStatus; data: TData | undefined }>;
} & ({ status: 'success'; data: TData } | { status: 'pending' | 'error'; data: TData | undefined });

type DataStateProps<TData> = {
  query: DataStateQuery<TData>;
  /** The widget's loading skeleton, built from `Skeleton`. */
  skeleton: ReactNode;
  /** When the data is empty, the widget's message shows instead of the content. */
  empty?: { isEmpty: (data: TData) => boolean; message: string };
  children: (data: TData) => ReactNode;
};

/** A retry in progress; `settled` once its refetch has resolved, with the result and the query shown then. */
type Retry<TData> = {
  settled?: { status: QueryStatus; data: TData | undefined; query: DataStateQuery<TData> };
};

/**
 * The shared states of one widget, list, table or chart (#6): the skeleton while loading, the empty message,
 * and the error state, "Something went wrong." above Retry (#88), when there is no data to show or the content
 * fails to render. A background refetch that fails keeps the data on screen, with no indicator (#89).
 *
 * Every state renders inside one root that stays the same element, focusable by script only. Whenever the focused
 * Retry leaves the page, for any reason (a press, a refetch on window focus, any other refetch), focus moves to the
 * root before the button goes, so it stays in the widget through the skeleton and the result instead of falling to
 * the page body (task 016 gate, #114); when the error state comes back, its new Retry takes the focus. A
 * tabindex="-1" element also takes focus from a click, so the root has one only while it holds the focus a leaving
 * Retry gave it: otherwise a click in a widget focuses what it always did. Each state renders as an item of the
 * root's flex column.
 */
export function DataState<TData>({ query, skeleton, empty, children }: DataStateProps<TData>) {
  const [retry, setRetry] = useState<Retry<TData> | null>(null);
  const shownQuery = useRef(query);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    shownQuery.current = query;
  });

  // TanStack Query resolves `refetch` before it renders the widget with the result, so the retry ends when
  // the query on screen shows that result, or at the first newer query after it settled.
  const settled = retry?.settled;
  const retryDone =
    settled !== undefined &&
    (query !== settled.query ||
      (query.status === settled.status && query.data === settled.data && query.fetchStatus !== 'fetching'));
  if (retryDone) setRetry(null);
  const retrying = retry !== null && !retryDone;

  // The Retry button's ref. It is stable, so React runs its cleanup only when the button leaves the page (and once
  // on mount in StrictMode, attaching it again at once), while the button is still in it. Only a leaving Retry gives
  // the root focus, so a new Retry that comes in while the root has it, the error state back, takes it back (#114),
  // and with it the root's tabindex: a page without system focus fires no blur on the root. Focus never scrolls the
  // page, as the widget may be out of view when a refetch on window focus replaces Retry.
  // React never calls it with null: the cleanup takes the place of that call.
  const attachRetryButton = useCallback((button: HTMLButtonElement) => {
    if (root.current !== null && document.activeElement === root.current) {
      button.focus({ preventScroll: true });
      root.current.removeAttribute('tabindex');
    }
    return () => {
      const element = root.current;
      if (element === null || document.activeElement !== button) return;
      element.tabIndex = -1;
      element.focus({ preventScroll: true });
    };
  }, []);

  function onRetry(event: MouseEvent<HTMLButtonElement>) {
    // Safari and Firefox on macOS don't focus a button on a click: Retry takes focus itself, so it gives it to the
    // root when it leaves, as in every browser.
    event.currentTarget.focus({ preventScroll: true });
    const attempt: Retry<TData> = {};
    setRetry(attempt);
    query.refetch().then(
      ({ status, data }) =>
        setRetry((current) =>
          current === attempt ? { settled: { status, data, query: shownQuery.current } } : current,
        ),
      () => setRetry((current) => (current === attempt ? null : current)),
    );
  }

  const errorState = (
    <div className={styles.message}>
      <p role="alert" className={styles.errorText}>
        Something went wrong.
      </p>
      <ButtonSmall ref={attachRetryButton} onClick={onRetry}>
        Retry
      </ButtonSmall>
    </div>
  );

  const loading =
    retrying || query.status === 'pending' || (query.data === undefined && query.fetchStatus === 'fetching');
  let state: ReactNode;
  if (loading) {
    state = <div aria-hidden="true">{skeleton}</div>;
  } else if (query.data === undefined) {
    // No data to show: the first load failed. With data, a failed background refetch keeps it (#89).
    state = errorState;
  } else {
    // Everything that reads the data renders inside the boundary: a render error shows this widget's error state.
    state = (
      <WidgetErrorBoundary resetKey={query.data} fallback={errorState}>
        <Content data={query.data} empty={empty}>
          {children}
        </Content>
      </WidgetErrorBoundary>
    );
  }

  return (
    <div
      ref={root}
      // The tabindex="-1" a leaving Retry gave the root goes once focus has moved on in the page. A window that loses
      // focus keeps the root active, to come back to.
      onBlur={(event) => {
        const element = event.currentTarget;
        if (event.target !== element) return;
        setTimeout(() => {
          if (document.activeElement !== element) element.removeAttribute('tabindex');
        });
      }}
      aria-busy={loading || undefined}
      className={styles.root}
    >
      {state}
    </div>
  );
}

function Content<TData>({
  data,
  empty,
  children,
}: Pick<DataStateProps<TData>, 'empty' | 'children'> & { data: TData }) {
  if (empty?.isEmpty(data)) {
    return (
      <div className={styles.message}>
        <p className={styles.emptyText}>{empty.message}</p>
      </div>
    );
  }
  return children(data);
}
