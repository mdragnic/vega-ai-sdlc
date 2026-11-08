import type { Money } from '@finebank/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ComparisonChartCard } from '../../src/components';
import type { ComparisonChartDescription, DataStateQuery } from '../../src/components';
import skeletonStyles from '../../src/components/ComparisonBarChartSkeleton/ComparisonBarChartSkeleton.module.css';

const usd = (cents: number): Money => ({ cents, currency: 'USD' });

/** A response shape no screen uses, so the card is shown to work for any response it is described for. */
type Quarters = { quarters: { name: string; before: Money; after: Money | null }[]; ticks: Money[] | null };

const answered: Quarters = {
  quarters: [
    { name: 'q1', before: usd(12_000), after: usd(26_650) },
    { name: 'q2', before: usd(9_550), after: usd(7_536) },
    { name: 'q3', before: usd(32_200), after: null },
  ],
  ticks: [0, 10_000, 20_000, 30_000, 40_000].map(usd),
};

const allZero: Quarters = {
  quarters: answered.quarters.map(({ name }) => ({ name, before: usd(0), after: usd(0) })),
  ticks: null,
};

const description = (
  toChart: ComparisonChartDescription<Quarters>['toChart'] = mapQuarters,
): ComparisonChartDescription<Quarters> => ({
  option: { value: 'quarterly', label: 'Quarterly Comparison' },
  name: 'Quarters',
  legend: { current: 'This year', previous: 'Last year' },
  groups: 3,
  title: 'Expenses per quarter, this year and last year',
  emptyMessage: 'No expenses in any quarter',
  toChart,
});

/** The description's mapping: the labels formatted, the values and ticks passed on as sent. */
function mapQuarters({ quarters, ticks }: Quarters) {
  return {
    labels: quarters.map((quarter) => quarter.name.toUpperCase()),
    previous: quarters.map((quarter) => quarter.before),
    current: quarters.map((quarter) => quarter.after),
    ticks,
  };
}

const never = () => new Promise<never>(() => undefined);

const held: DataStateQuery<Quarters> = { status: 'pending', data: undefined, fetchStatus: 'fetching', refetch: never };
const success = (data: Quarters): DataStateQuery<Quarters> => ({
  status: 'success',
  data,
  fetchStatus: 'idle',
  refetch: never,
});

function renderCard(query: DataStateQuery<Quarters>, comparison = description()) {
  const user = userEvent.setup();
  const view = render(
    <StrictMode>
      <ComparisonChartCard query={query} comparison={comparison} />
    </StrictMode>,
  );
  return { user, ...view };
}

const control = () => screen.getByRole('combobox', { name: 'Quarters' });
const legendItems = () =>
  within(screen.getByRole('list'))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

/** The header row the card shows in every state (#93 a). */
function expectHeaderRow() {
  expect(control()).toHaveTextContent(/^Quarterly Comparison$/);
  expect(legendItems()).toEqual(['This year', 'Last year']);
}

// T2: the shared comparison chart card behind Statistics and the Expenses chart (task 031 AC2).
describe('ComparisonChartCard', () => {
  it('shows the option as a combobox with the given name, the legend and the chart from toChart', () => {
    const toChart = vi.fn<typeof mapQuarters>(mapQuarters);
    renderCard(success(answered), description(toChart));

    expectHeaderRow();
    expect(toChart).toHaveBeenCalledWith(answered);
    const table = screen.getByRole('table', { name: 'Expenses per quarter, this year and last year' });
    const rows = within(table)
      .getAllByRole('row')
      .map((row) => [...row.children].map((cell) => cell.textContent));
    // The series carry the legend's names; the values are exactly what toChart returned, formatted (#11).
    expect(rows).toEqual([
      ['', 'Last year', 'This year'],
      ['Q1', '$120.00', '$266.50'],
      ['Q2', '$95.50', '$75.36'],
      ['Q3', '$322.00', ''],
    ]);
  });

  it('offers only its one option in the list', async () => {
    const { user } = renderCard(success(answered));

    await user.click(control());

    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option')).toHaveTextContent('Quarterly Comparison');
  });

  it('shows the skeleton with as many groups as described while the query loads, under the header row', () => {
    const { container } = renderCard(held);

    const busy = container.querySelector('[aria-busy="true"]');
    expect(busy).not.toBeNull();
    expect(busy!.querySelectorAll(`.${skeletonStyles.group}`)).toHaveLength(3);
    expect(screen.queryByRole('table')).toBeNull();
    expectHeaderRow();
  });

  it('shows the error state with Retry when the query failed, and Retry asks for it again', async () => {
    const refetch = vi.fn<DataStateQuery<Quarters>['refetch']>(never);
    const { user } = renderCard({ status: 'error', data: undefined, fetchStatus: 'idle', refetch });

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(screen.queryByRole('table')).toBeNull();
    expectHeaderRow();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(refetch).toHaveBeenCalledOnce();
  });

  it('shows the empty message when toChart returns no ticks (#91 c)', () => {
    renderCard(success(allZero));

    expect(screen.getByText('No expenses in any quarter')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expectHeaderRow();
  });
});
