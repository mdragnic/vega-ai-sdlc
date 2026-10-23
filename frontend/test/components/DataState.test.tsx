import type { Money } from '@finebank/shared';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AmountBox, DataState, MenuTab } from '../../src/components';
import type { DataStateQuery } from '../../src/components';

afterEach(() => {
  vi.restoreAllMocks();
});

type Settled<T> = Awaited<ReturnType<DataStateQuery<T>['refetch']>>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const never = () => new Promise<never>(() => undefined);

type QueryState<T> = { fetchStatus: DataStateQuery<T>['fetchStatus'] } & (
  { status: 'success'; data: T } | { status: 'pending' | 'error'; data: undefined }
);

const query = <T,>(state: QueryState<T>, refetch: DataStateQuery<T>['refetch'] = never): DataStateQuery<T> => ({
  ...state,
  refetch,
});

type Rows = (rows: number[]) => ReactNode;

const skeleton = <span>Skeleton shape</span>;
const empty = { isEmpty: (rows: number[]) => rows.length === 0, message: 'No transactions yet' };

function renderRows(state: DataStateQuery<number[]>, children: Rows = (rows) => <p>{rows.length} rows</p>) {
  return render(
    <DataState query={state} skeleton={skeleton} empty={empty}>
      {children}
    </DataState>,
  );
}

// T12: loading, empty and ready (AC12, AC13, #6).
describe('DataState', () => {
  it.each([
    ['pending, first fetch', 'pending', 'fetching'],
    ['pending, offline', 'pending', 'paused'],
    ['retrying after an error', 'error', 'fetching'],
  ] as const)(
    'shows the skeleton while %s, hidden inside a busy container, without the children',
    (_, status, fetchStatus) => {
      const children = vi.fn<Rows>((rows) => <p>{rows.length} rows</p>);
      renderRows(query({ status, fetchStatus, data: undefined }), children);
      const shape = screen.getByText('Skeleton shape');

      expect(shape.closest('[aria-hidden="true"]')).not.toBeNull();
      expect(shape.closest('[aria-busy="true"]')).not.toBeNull();
      expect(children).not.toHaveBeenCalled();
      expect(screen.queryByRole('alert')).toBeNull();
    },
  );

  it('shows the empty message, with no Retry, when the data is empty', () => {
    const children = vi.fn<Rows>((rows) => <p>{rows.length} rows</p>);
    renderRows(query({ status: 'success', fetchStatus: 'idle', data: [] }), children);

    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('Skeleton shape')).toBeNull();
    expect(children).not.toHaveBeenCalled();
  });

  it('renders the children with the data when it is not empty', () => {
    const children = vi.fn<Rows>((rows) => <p>{rows.length} rows</p>);
    renderRows(query({ status: 'success', fetchStatus: 'idle', data: [1] }), children);

    expect(screen.getByText('1 rows')).toBeInTheDocument();
    expect(children).toHaveBeenCalledWith([1]);
    expect(screen.queryByText('Skeleton shape')).toBeNull();
    expect(document.querySelector('[aria-busy]')).toBeNull();
  });

  it('renders the children without an empty rule', () => {
    render(
      <DataState query={query({ status: 'success', fetchStatus: 'idle', data: [] as number[] })} skeleton={skeleton}>
        {(rows) => <p>{rows.length} rows</p>}
      </DataState>,
    );

    expect(screen.getByText('0 rows')).toBeInTheDocument();
  });

  // A background refetch keeps the data on screen.
  it('keeps showing the data while it refetches in the background', () => {
    renderRows(query({ status: 'success', fetchStatus: 'fetching', data: [1, 2] }));

    expect(screen.getByText('2 rows')).toBeInTheDocument();
    expect(screen.queryByText('Skeleton shape')).toBeNull();
  });
});

// T13: the error state and Retry (AC14, #88).
describe('DataState error', () => {
  const failed = query<number[]>({ status: 'error', fetchStatus: 'idle', data: undefined });

  it('shows "Something went wrong." as an alert with Retry below it', () => {
    renderRows(failed);
    const alert = screen.getByRole('alert');
    const retry = screen.getByRole('button', { name: 'Retry' });

    expect(alert).toHaveTextContent(/^Something went wrong\.$/);
    expect(alert.compareDocumentPosition(retry)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.queryByText('Skeleton shape')).toBeNull();
  });

  it('calls refetch once on Retry and shows the skeleton until the refetch settles and shows', async () => {
    const user = userEvent.setup();
    const pending = deferred<Settled<number[]>>();
    const refetch = vi.fn<DataStateQuery<number[]>['refetch']>(() => pending.promise);
    const { rerender } = renderRows({ ...failed, refetch });

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Skeleton shape')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();

    // The query reports the fetch, then its result, before the refetch promise settles.
    const rows = [1, 2, 3];
    rerender(
      <DataState query={{ ...failed, fetchStatus: 'fetching', refetch }} skeleton={skeleton} empty={empty}>
        {(data) => <p>{data.length} rows</p>}
      </DataState>,
    );
    expect(screen.getByText('Skeleton shape')).toBeInTheDocument();
    rerender(
      <DataState
        query={{ status: 'success', fetchStatus: 'idle', data: rows, refetch }}
        skeleton={skeleton}
        empty={empty}
      >
        {(data) => <p>{data.length} rows</p>}
      </DataState>,
    );
    expect(screen.getByText('Skeleton shape')).toBeInTheDocument();

    pending.resolve({ status: 'success', data: rows });

    expect(await screen.findByText('3 rows')).toBeInTheDocument();
    expect(screen.queryByText('Skeleton shape')).toBeNull();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  // TanStack Query settles the refetch promise before it re-renders the widget with the result,
  // so the skeleton stays until the query on screen shows that result: no flash of the old state.
  it('keeps the skeleton when the refetch settles before the query shows its result', async () => {
    const user = userEvent.setup();
    const pending = deferred<Settled<number[]>>();
    const refetch = vi.fn<DataStateQuery<number[]>['refetch']>(() => pending.promise);
    const { rerender } = renderRows({ ...failed, refetch });
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    const rows = [1];

    // act flushes the render that follows the settled refetch.
    await act(async () => {
      pending.resolve({ status: 'success', data: rows });
      await pending.promise;
    });

    expect(screen.getByText('Skeleton shape')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();

    rerender(
      <DataState
        query={{ status: 'success', fetchStatus: 'idle', data: rows, refetch }}
        skeleton={skeleton}
        empty={empty}
      >
        {(data) => <p>{data.length} rows</p>}
      </DataState>,
    );
    expect(await screen.findByText('1 rows')).toBeInTheDocument();
  });

  it('shows the skeleton while the retry fetches, then the error again when it fails', async () => {
    const user = userEvent.setup();
    const pending = deferred<Settled<number[]>>();
    const refetch = vi.fn<DataStateQuery<number[]>['refetch']>(() => pending.promise);
    renderRows({ ...failed, refetch });

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Skeleton shape')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    await act(async () => {
      pending.resolve({ status: 'error', data: undefined });
      await pending.promise;
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('ends the retry when its refetch rejects', async () => {
    const user = userEvent.setup();
    const pending = deferred<Settled<number[]>>();
    const refetch = vi.fn<DataStateQuery<number[]>['refetch']>(() => pending.promise);
    renderRows({ ...failed, refetch });

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Skeleton shape')).toBeInTheDocument();
    await act(async () => {
      pending.reject(new Error('offline'));
      await pending.promise.catch(() => undefined);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');
  });

  // #89: a background refetch that fails while data is on screen keeps that data, with no error state and no
  // indicator; the query then reports an error and still has the data.
  it.each(['idle', 'fetching'] as const)(
    'keeps showing the data when a refetch fails while data is on screen (then %s)',
    (fetchStatus) => {
      const { rerender } = renderRows(query({ status: 'success', fetchStatus: 'idle', data: [1, 2] }));
      expect(screen.getByText('2 rows')).toBeInTheDocument();

      rerender(
        <DataState
          query={{ status: 'error', fetchStatus, data: [1, 2], refetch: never }}
          skeleton={skeleton}
          empty={empty}
        >
          {(rows) => <p>{rows.length} rows</p>}
        </DataState>,
      );

      expect(screen.getByText('2 rows')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.queryByRole('button')).toBeNull();
      expect(screen.queryByText('Skeleton shape')).toBeNull();
    },
  );

  it('shows the empty message when a refetch fails while the empty message is on screen', () => {
    renderRows({ status: 'error', fetchStatus: 'idle', data: [], refetch: never });

    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

const bad: Money = { cents: 12.5, currency: 'USD' };
const good: Money = { cents: 15000, currency: 'USD' };
const badMessage = 'Money must be integer cents, got 12.5';

/** Every console.error call carries the expected RangeError: nothing else is logged. */
function expectOnlyTheBadAmountLogged(consoleError: { mock: { calls: unknown[][] } }) {
  expect(consoleError.mock.calls.length).toBeGreaterThan(0);
  for (const args of consoleError.mock.calls) {
    expect(args.some((arg: unknown) => arg instanceof RangeError && arg.message === badMessage)).toBe(true);
  }
}

function AmountWidget({ name, queryFn }: { name: string; queryFn: () => Promise<Money> }) {
  const amount = useQuery({ queryKey: ['amount', name], queryFn, retry: false });
  return (
    <section aria-label={name}>
      <DataState query={amount} skeleton={<span>Loading {name}</span>}>
        {(data) => <AmountBox amount={data} size="compact" />}
      </DataState>
    </section>
  );
}

function TabWidget() {
  const [value, setValue] = useState<'all' | 'income'>('all');
  const tabs = [
    { value: 'all', label: 'All' },
    { value: 'income', label: 'Revenue' },
  ] as const;
  return (
    <section aria-label="second">
      <MenuTab label="Second" tabs={tabs} value={value} onChange={setValue} panelId="second-panel" />
      <p id="second-panel">Showing {value}</p>
      <AmountBox amount={{ cents: 55900, currency: 'USD' }} size="compact" />
    </section>
  );
}

// T14: a render error shows that widget's error state; the rest of the page keeps working (AC15).
describe('DataState error boundary', () => {
  it('shows the error state in the broken widget only, and Retry renders it again with the fetched data', async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = new QueryClient();
    let next = bad;
    const firstFn = vi.fn<() => Promise<Money>>(() => Promise.resolve(next));
    render(
      <QueryClientProvider client={client}>
        <AmountWidget name="first" queryFn={firstFn} />
        <TabWidget />
      </QueryClientProvider>,
    );
    const first = screen.getByRole('region', { name: 'first' });
    const second = screen.getByRole('region', { name: 'second' });

    expect(await within(first).findByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(within(second).getByText('$559.00')).toBeInTheDocument();
    await user.click(within(second).getByRole('tab', { name: 'Revenue' }));
    expect(within(second).getByText('Showing income')).toBeInTheDocument();
    expectOnlyTheBadAmountLogged(consoleError);

    // Retry fetches valid data: the widget renders again.
    next = good;
    await user.click(within(first).getByRole('button', { name: 'Retry' }));
    expect(await within(first).findByText('$150.00')).toBeInTheDocument();
    expect(within(first).queryByRole('alert')).toBeNull();
    expect(firstFn).toHaveBeenCalledTimes(2);

    // Bad data again: the error state shows again, and a Retry that fetches bad data renders it again,
    // which throws again (one more logged RangeError) and shows the error state again.
    client.setQueryData(['amount', 'first'], bad);
    expect(await within(first).findByRole('alert')).toBeInTheDocument();
    const loggedBefore = consoleError.mock.calls.length;
    next = bad;
    await user.click(within(first).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(firstFn).toHaveBeenCalledTimes(3));
    expect(await within(first).findByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(consoleError.mock.calls.length).toBeGreaterThan(loggedBefore);
    expect(within(second).getByText('$559.00')).toBeInTheDocument();
    expectOnlyTheBadAmountLogged(consoleError);
  });

  // A widget in its error state renders again when new data arrives without Retry, such as from a refetch.
  it('renders the content again when new data arrives after a render error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <AmountWidget name="first" queryFn={() => Promise.resolve(bad)} />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    act(() => {
      client.setQueryData(['amount', 'first'], good);
    });

    expect(await screen.findByText('$150.00')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  // #89 with a real query: the refetch fails (no retries), the query reports an error, the amount stays.
  it('keeps the amount on screen when a background refetch fails', async () => {
    const client = new QueryClient();
    const queryFn = vi
      .fn<() => Promise<Money>>()
      .mockResolvedValueOnce(good)
      .mockRejectedValueOnce(new Error('The server is down'));
    render(
      <QueryClientProvider client={client}>
        <AmountWidget name="first" queryFn={queryFn} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('$150.00')).toBeInTheDocument();

    await act(() => client.refetchQueries({ queryKey: ['amount', 'first'] }));

    await waitFor(() => expect(client.getQueryState(['amount', 'first'])?.status).toBe('error'));
    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(screen.getByText('$150.00')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Loading first')).toBeNull();
  });

  it('shows the skeleton while the retry is fetching', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = new QueryClient();
    const pending = deferred<Money>();
    const queryFn = vi.fn<() => Promise<Money>>().mockResolvedValueOnce(bad).mockReturnValueOnce(pending.promise);
    render(
      <QueryClientProvider client={client}>
        <AmountWidget name="first" queryFn={queryFn} />
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Loading first')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    pending.resolve(good);
    expect(await screen.findByText('$150.00')).toBeInTheDocument();
  });
});
