import { useEffect, useRef, useState, type ReactNode } from 'react';

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
 */
export function DataState<TData>({ query, skeleton, empty, children }: DataStateProps<TData>) {
  const [retry, setRetry] = useState<Retry<TData> | null>(null);
  const shownQuery = useRef(query);
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

  function onRetry() {
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
      <ButtonSmall onClick={onRetry}>Retry</ButtonSmall>
    </div>
  );

  const loading =
    retrying || query.status === 'pending' || (query.data === undefined && query.fetchStatus === 'fetching');
  if (loading) {
    return (
      <div aria-busy="true">
        <div aria-hidden="true">{skeleton}</div>
      </div>
    );
  }
  // No data to show: the first load failed. With data, a failed background refetch keeps it (#89).
  if (query.data === undefined) return errorState;

  // Everything that reads the data renders inside the boundary: a render error shows this widget's error state.
  return (
    <WidgetErrorBoundary resetKey={query.data} fallback={errorState}>
      <Content data={query.data} empty={empty}>
        {children}
      </Content>
    </WidgetErrorBoundary>
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
