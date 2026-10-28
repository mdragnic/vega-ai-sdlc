import type { Money } from '@finebank/shared';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useState, type ReactNode } from 'react';
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

/** A widget between two buttons, its DataState on a real query that never retries by itself. */
function RetryWidget({ queryFn }: { queryFn: () => Promise<string> }) {
  const text = useQuery({ queryKey: ['retry-widget'], queryFn, retry: false });
  return (
    <>
      <button type="button">Before</button>
      <section aria-label="widget">
        <DataState query={text} skeleton={<span>Loading the widget</span>}>
          {(data) => <p>{data}</p>}
        </DataState>
      </section>
      <button type="button">After</button>
    </>
  );
}

/** In StrictMode, as the app renders: React then also detaches and attaches the refs of every new element once. */
function renderRetryWidget(queryFn: () => Promise<string>) {
  const user = userEvent.setup();
  const client = new QueryClient();
  render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <RetryWidget queryFn={queryFn} />
      </QueryClientProvider>
    </StrictMode>,
  );
  const widget = screen.getByRole('region', { name: 'widget' });
  /** DataState's root: the one element the widget's section holds. */
  const root = () => {
    expect(widget.children).toHaveLength(1);
    return widget.firstElementChild as HTMLElement;
  };
  return { user, widget, root, client };
}

// T14 (task 017, follow-up 2 of the task 016 gate): Retry never drops focus to the page body; focus stays in the
// widget, on DataState's root, through the skeleton and the result (#6, #87).
describe('DataState focus after Retry', () => {
  it('renders one root in every state, the same element, focusable by script only', async () => {
    const pending = deferred<string>();
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockReturnValueOnce(pending.promise);
    const { user, widget, root } = renderRetryWidget(queryFn);
    const first = root();
    expect(within(widget).getByText('Loading the widget')).toBeInTheDocument();

    expect(await within(widget).findByRole('alert')).toBeInTheDocument();
    expect(root()).toBe(first);
    await user.click(within(widget).getByRole('button', { name: 'Retry' }));
    expect(within(widget).getByText('Loading the widget')).toBeInTheDocument();
    expect(root()).toBe(first);
    pending.resolve('Ready');
    expect(await within(widget).findByText('Ready')).toBeInTheDocument();

    expect(root()).toBe(first);
    expect(first).toHaveAttribute('tabindex', '-1');
    expect(first.tabIndex).toBe(-1);
  });

  it('moves focus to the root on a keyboard Retry and keeps it there through the skeleton and the data', async () => {
    const pending = deferred<string>();
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockReturnValueOnce(pending.promise);
    const { user, widget, root } = renderRetryWidget(queryFn);
    await within(widget).findByRole('alert');
    screen.getByRole('button', { name: 'Before' }).focus();
    await user.tab();
    expect(within(widget).getByRole('button', { name: 'Retry' })).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(within(widget).getByText('Loading the widget')).toBeInTheDocument();
    expect(root()).toHaveFocus();
    pending.resolve('Ready');
    expect(await within(widget).findByText('Ready')).toBeInTheDocument();
    expect(root()).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);

    // Tab goes on from the widget to the next focusable element.
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  });

  it('moves focus to the root on Space too, and to the new Retry when the retry fails again', async () => {
    const pending = deferred<string>();
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockReturnValueOnce(pending.promise);
    const { user, widget, root } = renderRetryWidget(queryFn);
    await within(widget).findByRole('alert');
    within(widget).getByRole('button', { name: 'Retry' }).focus();

    await user.keyboard(' ');
    expect(root()).toHaveFocus();
    pending.reject(new Error('still offline'));

    expect(await within(widget).findByRole('alert')).toHaveTextContent('Something went wrong.');
    await waitFor(() => expect(within(widget).getByRole('button', { name: 'Retry' })).toHaveFocus());
    await waitFor(() => expect(root()).not.toHaveAttribute('tabindex'));
  });

  it('moves focus to the root on a click on Retry', async () => {
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('Ready');
    const { user, widget, root } = renderRetryWidget(queryFn);

    await user.click(await within(widget).findByRole('button', { name: 'Retry' }));

    expect(root()).toHaveFocus();
    expect(await within(widget).findByText('Ready')).toBeInTheDocument();
    expect(root()).toHaveFocus();
  });

  // Safari and Firefox on macOS don't focus a button on a click, as fireEvent.click doesn't: Retry focuses itself
  // first, so focus moves to the root in every browser.
  it('focuses Retry on a click, before it retries, where the click does not', () => {
    const refetch = vi.fn<DataStateQuery<number[]>['refetch']>(never);
    const { container } = render(
      <StrictMode>
        <DataState
          query={query({ status: 'error', fetchStatus: 'idle', data: undefined }, refetch)}
          skeleton={skeleton}
        >
          {(rows) => <p>{rows.length} rows</p>}
        </DataState>
      </StrictMode>,
    );
    const retry = screen.getByRole('button', { name: 'Retry' });
    const focus = vi.spyOn(retry, 'focus');

    fireEvent.click(retry);

    expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    expect(focus).toHaveBeenCalledBefore(refetch);
    expect(container.firstElementChild).toHaveFocus();
  });

  it('is never a Tab stop: Tab goes from the button before the widget to the one after it', async () => {
    const { user, widget, root } = renderRetryWidget(() => Promise.resolve('Ready'));
    await within(widget).findByText('Ready');
    screen.getByRole('button', { name: 'Before' }).focus();

    await user.tab();

    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    expect(root()).not.toHaveFocus();
  });

  it('leaves focus where it is when the data arrives without a Retry', async () => {
    const pending = deferred<string>();
    const { widget } = renderRetryWidget(() => pending.promise);
    screen.getByRole('button', { name: 'Before' }).focus();

    pending.resolve('Ready');

    expect(await within(widget).findByText('Ready')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus();
  });
});

// A tabindex="-1" element takes focus from a click too: until a Retry needs it, the root has none, so a click in a
// widget focuses what it did before (task 016: a click in the Recent Transaction panel focuses the panel).
describe('DataState root before a Retry', () => {
  it('has no tabindex until a Retry focuses it, then keeps tabindex="-1"', async () => {
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('Ready');
    const { user, widget, root } = renderRetryWidget(queryFn);
    expect(root()).not.toHaveAttribute('tabindex');
    await within(widget).findByRole('alert');
    expect(root()).not.toHaveAttribute('tabindex');

    await user.click(within(widget).getByRole('button', { name: 'Retry' }));
    expect(await within(widget).findByText('Ready')).toBeInTheDocument();

    expect(root()).toHaveAttribute('tabindex', '-1');
  });

  it('leaves a click in the content to focus its focusable ancestor, as without DataState', async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <div tabIndex={0} aria-label="panel" role="region">
          <RetryWidget queryFn={() => Promise.resolve('Ready')} />
        </div>
      </QueryClientProvider>,
    );

    await user.click(await screen.findByText('Ready'));

    expect(screen.getByRole('region', { name: 'panel' })).toHaveFocus();
  });
});

// Code review of task 017: the root is focusable by script only, so it keeps its tabindex only while it holds the
// focus Retry gave it; a window blur keeps it, so focus comes back to it with the window.
describe('DataState root after the Retry focus moves on', () => {
  it('drops the tabindex once focus moves to another element in the page', async () => {
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('Ready');
    const { user, widget, root } = renderRetryWidget(queryFn);
    await user.click(await within(widget).findByRole('button', { name: 'Retry' }));
    expect(await within(widget).findByText('Ready')).toBeInTheDocument();
    expect(root()).toHaveFocus();

    await user.tab();

    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    await waitFor(() => expect(root()).not.toHaveAttribute('tabindex'));
  });

  it('keeps the tabindex when the window loses focus, so focus can come back to the root', async () => {
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('Ready');
    const { user, widget, root } = renderRetryWidget(queryFn);
    await user.click(await within(widget).findByRole('button', { name: 'Retry' }));
    expect(await within(widget).findByText('Ready')).toBeInTheDocument();

    // The window's blur: the root stays the active element.
    fireEvent.blur(root());
    await act(() => new Promise((done) => setTimeout(done, 20)));

    expect(root()).toHaveFocus();
    expect(root()).toHaveAttribute('tabindex', '-1');
  });

  // Chromium fires no blur while the page has no system focus (DevTools or another window active), so the root's blur
  // handler never runs: the new Retry takes the tabindex away when it takes the focus.
  it('drops the tabindex when the new Retry takes focus, with no blur from the root', async () => {
    const pending = deferred<string>();
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockReturnValueOnce(pending.promise);
    const { user, widget, root } = renderRetryWidget(queryFn);
    await within(widget).findByRole('alert');
    within(widget).getByRole('button', { name: 'Retry' }).focus();
    await user.keyboard('{Enter}');
    expect(root()).toHaveAttribute('tabindex', '-1');
    root().addEventListener('focusout', (event) => event.stopPropagation());

    pending.reject(new Error('still offline'));

    await waitFor(() => expect(within(widget).getByRole('button', { name: 'Retry' })).toHaveFocus());
    expect(root()).not.toHaveAttribute('tabindex');
  });

  it('moves focus to the new Retry when the retried data fails to render', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = new QueryClient();
    const queryFn = vi
      .fn<() => Promise<Money>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ cents: 12.5, currency: 'USD' });
    render(
      <StrictMode>
        <QueryClientProvider client={client}>
          <AmountWidget name="first" queryFn={queryFn} />
        </QueryClientProvider>
      </StrictMode>,
    );
    const retry = await screen.findByRole('button', { name: 'Retry' });
    retry.focus();

    await user.keyboard('{Enter}');

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toHaveFocus());
    const root = screen.getByRole('region', { name: 'first' }).firstElementChild;
    await waitFor(() => expect(root).not.toHaveAttribute('tabindex'));
  });
});

/** The window's return, as TanStack Query hears it: a visibilitychange on the window refetches the stale queries. */
function windowRegainsFocus() {
  act(() => {
    window.dispatchEvent(new Event('visibilitychange'));
  });
}

/** Renders the widget in its error state, with Retry focused by Tab from the button before it. */
async function retryFocusedByKeyboard(queryFn: () => Promise<string>) {
  const rendered = renderRetryWidget(queryFn);
  await within(rendered.widget).findByRole('alert');
  screen.getByRole('button', { name: 'Before' }).focus();
  await rendered.user.tab();
  expect(within(rendered.widget).getByRole('button', { name: 'Retry' })).toHaveFocus();
  return rendered;
}

// #114 (c), task 017 gate: whenever the focused Retry leaves the page, for any reason, focus moves to the root with
// the same tabindex handling as after a Retry press, never to the page body.
describe('DataState focus when the focused Retry leaves without a press', () => {
  it('moves focus to the root when a refetch on window focus replaces the focused Retry and succeeds', async () => {
    const pending = deferred<string>();
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockReturnValueOnce(pending.promise);
    const { user, widget, root } = await retryFocusedByKeyboard(queryFn);

    windowRegainsFocus();

    expect(await within(widget).findByText('Loading the widget')).toBeInTheDocument();
    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(root()).toHaveFocus();
    expect(root()).toHaveAttribute('tabindex', '-1');
    pending.resolve('Ready');
    expect(await within(widget).findByText('Ready')).toBeInTheDocument();
    expect(root()).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);

    // Tab goes on from the widget, and the root is a plain element again.
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    await waitFor(() => expect(root()).not.toHaveAttribute('tabindex'));
  });

  it('moves focus to the new Retry when the refetch on window focus fails again', async () => {
    const pending = deferred<string>();
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockReturnValueOnce(pending.promise);
    const { widget, root } = await retryFocusedByKeyboard(queryFn);

    windowRegainsFocus();
    expect(await within(widget).findByText('Loading the widget')).toBeInTheDocument();
    expect(root()).toHaveFocus();
    pending.reject(new Error('still offline'));

    expect(await within(widget).findByRole('alert')).toHaveTextContent('Something went wrong.');
    await waitFor(() => expect(within(widget).getByRole('button', { name: 'Retry' })).toHaveFocus());
    await waitFor(() => expect(root()).not.toHaveAttribute('tabindex'));
  });

  // The widget may be out of view when a refetch on window focus replaces its Retry: focus moves, the page stays.
  it('moves focus to the root and to the new Retry without scrolling the page', async () => {
    const pending = deferred<string>();
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockReturnValueOnce(pending.promise);
    const { widget, root } = await retryFocusedByKeyboard(queryFn);
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');

    windowRegainsFocus();
    expect(await within(widget).findByText('Loading the widget')).toBeInTheDocument();
    pending.reject(new Error('still offline'));
    const retry = await within(widget).findByRole('button', { name: 'Retry' });
    await waitFor(() => expect(retry).toHaveFocus());

    expect(focus.mock.contexts).toContain(root());
    expect(focus.mock.contexts).toContain(retry);
    for (const args of focus.mock.calls) expect(args).toEqual([{ preventScroll: true }]);
  });

  it('moves focus to the root when data arrives without a refetch', async () => {
    const { widget, root, client } = await retryFocusedByKeyboard(() => Promise.reject(new Error('offline')));

    act(() => {
      client.setQueryData(['retry-widget'], 'Set elsewhere');
    });

    expect(await within(widget).findByText('Set elsewhere')).toBeInTheDocument();
    expect(root()).toHaveFocus();
    expect(root()).toHaveAttribute('tabindex', '-1');
  });

  it('leaves focus where it is when Retry leaves without focus', async () => {
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('Ready');
    const { widget, root } = renderRetryWidget(queryFn);
    await within(widget).findByRole('alert');
    screen.getByRole('button', { name: 'Before' }).focus();

    windowRegainsFocus();

    expect(await within(widget).findByText('Ready')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus();
    expect(root()).not.toHaveAttribute('tabindex');
  });
});

// Code review of #114 (c): a Retry that comes in takes focus only from the root, never from where the user is.
describe('DataState focus when a Retry comes in', () => {
  it('leaves focus where it is when the first load fails', async () => {
    const pending = deferred<string>();
    const { widget, root } = renderRetryWidget(() => pending.promise);
    screen.getByRole('button', { name: 'Before' }).focus();

    pending.reject(new Error('offline'));

    expect(await within(widget).findByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus();
    expect(root()).not.toHaveAttribute('tabindex');
  });

  it('leaves focus where it is when new data fails to render and the error state comes in', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = new QueryClient();
    render(
      <StrictMode>
        <QueryClientProvider client={client}>
          <button type="button">Before</button>
          <AmountWidget name="first" queryFn={() => Promise.resolve(good)} />
        </QueryClientProvider>
      </StrictMode>,
    );
    expect(await screen.findByText('$150.00')).toBeInTheDocument();
    screen.getByRole('button', { name: 'Before' }).focus();

    act(() => {
      client.setQueryData(['amount', 'first'], bad);
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus();
    expectOnlyTheBadAmountLogged(consoleError);
  });
});
