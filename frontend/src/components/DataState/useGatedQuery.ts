import { useMemo } from 'react';

import type { DataStateQuery } from './DataState';

/**
 * A query and the query it waits for, as one query for `DataState` (#6): while `gate` has no data, a pending query, or
 * a failed one when the gate failed, whose Retry asks for the gate again; once the gate has data, `query` as it is. So
 * the skeleton shows while either loads, also after the gate's data changes the query, and the error state when either
 * first load fails. The Goals cards gate the selected month's query on the months (task 025, task 026; shared since
 * task 031). The gated answer stays the same object while the gate's state does not change.
 */
export function useGatedQuery<TGate, TData>(
  gate: DataStateQuery<TGate>,
  query: DataStateQuery<TData>,
): DataStateQuery<TData> {
  const gateLoaded = gate.data !== undefined;
  const { status: gateStatus, fetchStatus: gateFetchStatus, refetch: refetchGate } = gate;
  const gated = useMemo<DataStateQuery<TData>>(
    () => ({
      status: gateStatus === 'error' ? 'error' : 'pending',
      data: undefined,
      fetchStatus: gateFetchStatus,
      refetch: async () => {
        const { status } = await refetchGate();
        return { status: status === 'error' ? 'error' : 'pending', data: undefined };
      },
    }),
    [gateStatus, gateFetchStatus, refetchGate],
  );
  return gateLoaded ? query : gated;
}
