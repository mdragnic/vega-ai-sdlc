import { act, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { DataStateQuery } from '../../src/components';
import { useGatedQuery } from '../../src/components/DataState/useGatedQuery';

type Months = { months: string[] };
type Goal = { month: string };

const never = () => new Promise<never>(() => undefined);

const gate = (
  state: Pick<DataStateQuery<Months>, 'fetchStatus'> &
    ({ status: 'success'; data: Months } | { status: 'pending' | 'error'; data: undefined }),
  refetch: DataStateQuery<Months>['refetch'] = never,
): DataStateQuery<Months> => ({ ...state, refetch });

const months: Months = { months: ['2026-10', '2026-09'] };
const loaded = gate({ status: 'success', data: months, fetchStatus: 'idle' });

const goalQuery = (
  state: Pick<DataStateQuery<Goal>, 'fetchStatus'> &
    ({ status: 'success'; data: Goal } | { status: 'pending' | 'error'; data: undefined }),
): DataStateQuery<Goal> => ({ ...state, refetch: never });

function renderGated(gateQuery: DataStateQuery<Months>, query: DataStateQuery<Goal>) {
  return renderHook(() => useGatedQuery(gateQuery, query), { wrapper: StrictMode });
}

// T5: the months-gated card state shared by the Savings Goal and Saving Summary cards (task 031 AC4).
describe('useGatedQuery', () => {
  it('answers pending, with the gate’s fetch status, while the gate loads', () => {
    const { result } = renderGated(
      gate({ status: 'pending', data: undefined, fetchStatus: 'fetching' }),
      goalQuery({ status: 'success', data: { month: '2026-10' }, fetchStatus: 'idle' }),
    );

    expect(result.current).toMatchObject({ status: 'pending', data: undefined, fetchStatus: 'fetching' });
  });

  it.each([
    ['pending', { status: 'pending', data: undefined }],
    ['error', { status: 'error', data: undefined }],
  ] as const)(
    'answers error when the gate failed; Retry calls the gate’s refetch once and answers %s',
    async (_, outcome) => {
      const refetch = vi.fn<DataStateQuery<Months>['refetch']>(() =>
        Promise.resolve(outcome.status === 'pending' ? { status: 'success' as const, data: months } : outcome),
      );
      const { result } = renderGated(
        gate({ status: 'error', data: undefined, fetchStatus: 'idle' }, refetch),
        goalQuery({ status: 'pending', data: undefined, fetchStatus: 'idle' }),
      );

      expect(result.current).toMatchObject({ status: 'error', data: undefined, fetchStatus: 'idle' });
      let retried: Awaited<ReturnType<DataStateQuery<Goal>['refetch']>> | undefined;
      await act(async () => {
        retried = await result.current.refetch();
      });

      expect(refetch).toHaveBeenCalledOnce();
      expect(retried).toEqual(outcome);
    },
  );

  it.each([
    ['pending', goalQuery({ status: 'pending', data: undefined, fetchStatus: 'fetching' })],
    ['failed', goalQuery({ status: 'error', data: undefined, fetchStatus: 'idle' })],
    ['answered', goalQuery({ status: 'success', data: { month: '2026-10' }, fetchStatus: 'idle' })],
    ['refetching', goalQuery({ status: 'success', data: { month: '2026-10' }, fetchStatus: 'fetching' })],
  ])('answers the query itself once the gate has data, the query %s', (_, query) => {
    const { result } = renderGated(loaded, query);

    expect(result.current).toBe(query);
  });

  // `DataState` compares the query it is given by identity; TanStack gives a new result object on every render.
  it('keeps the gated answer the same object while the gate’s state is the same, a new one when it changes', () => {
    const pendingGate = gate({ status: 'pending', data: undefined, fetchStatus: 'fetching' });
    const query = goalQuery({ status: 'pending', data: undefined, fetchStatus: 'idle' });
    const { result, rerender } = renderHook(({ gateQuery }) => useGatedQuery(gateQuery, query), {
      wrapper: StrictMode,
      initialProps: { gateQuery: pendingGate },
    });
    const first = result.current;

    rerender({ gateQuery: { ...pendingGate } });
    expect(result.current).toBe(first);

    rerender({ gateQuery: { ...pendingGate, fetchStatus: 'paused' } });
    expect(result.current).not.toBe(first);
    expect(result.current).toMatchObject({ status: 'pending', fetchStatus: 'paused' });
  });
});
