import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { focusManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import chartStyles from '../../src/components/ComparisonBarChart/ComparisonBarChart.module.css';
import {
  dataStateRootIn,
  me,
  renderApp,
  signedInDefaults,
  today,
  upcomingBills,
  weeklyComparison,
} from '../support/app';

const server = setupServer(...signedInDefaults());

/** Every request the app sends, as `METHOD /path`. */
let requests: string[] = [];

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  requests = [];
  server.events.on('request:start', ({ request }) => {
    requests.push(`${request.method} ${new URL(request.url).pathname}`);
  });
});
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
  vi.useRealTimers();
  focusManager.setFocused(undefined);
});
afterAll(() => server.close());

/** Overview signed in, with `handlers` first (the demo weekly comparison by default), once the section shows. */
async function openOverview(...handlers: Parameters<typeof server.use>) {
  server.use(me.signedIn(), today.answers(), ...handlers);
  const view = renderApp('/overview');
  await screen.findByRole('region', { name: 'Statistics' });
  return view;
}

const statistics = () => screen.getByRole('region', { name: 'Statistics' });
const control = () => within(statistics()).getByRole('combobox', { name: 'Statistics' });
const legend = () => within(statistics()).getByRole('list');
/** Waits until the card shows the chart's table. */
const table = () => within(statistics()).findByRole('table', { name: 'Expenses per day, this week and last week' });
const bars = (series: 'previous' | 'current') => statistics().querySelectorAll(`path.${chartStyles[series]}`);
const yLabels = () =>
  [...statistics().querySelectorAll(`text.${chartStyles.yLabel}`)].map((label) => label.textContent);
/** The table's rows as text: the label, then Last week and This week. */
const tableRows = (element: HTMLElement) =>
  within(element)
    .getAllByRole('row')
    .map((row) => [...row.children].map((cell) => cell.textContent));

const weeklyPath = 'GET /api/statistics/weekly-comparison';
const count = (request: string) => requests.filter((sent) => sent === request).length;

const refocusWindow = () =>
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });

/** A frontend source file's text, by its path under `frontend/src`. */
const srcDir = resolve(import.meta.dirname, '../../src');
const source = (path: string) => readFileSync(join(srcDir, path), 'utf8');

/** A first login's table on 22 Oct 2026 (demo-data.md, "What a first login shows"; AC1). */
const firstLoginRows = [
  ['', 'Last week', 'This week'],
  ['19 Mon', '$58.80', '$10.64'],
  ['20 Tue', '$10.64', '$24.64'],
  ['21 Wed', '$20.16', '$17.64'],
  ['22 Thu', '$322.00', '$266.00'],
  ['23 Fri', '$14.78', ''],
  ['24 Sat', '$188.16', ''],
  ['25 Sun', '$147.84', ''],
];

// T11: AC1, AC15, the first login's card (#20, #55, #91, #113 b; demo-data.md).
describe('the Statistics card', () => {
  it('shows "Weekly Comparison" as a combobox named Statistics and the legend "This week" and "Last week"', async () => {
    await openOverview();

    expect(control()).toHaveTextContent(/^Weekly Comparison$/);
    expect(
      within(legend())
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['This week', 'Last week']);
    expect(within(statistics()).getByRole('heading', { level: 2 })).toHaveTextContent('Statistics');
  });

  it('carries the values in the table: a row per day by its label, amounts in full, an empty cell after today', async () => {
    await openOverview();

    expect(tableRows(await table())).toEqual(firstLoginRows);
  });

  it('draws 7 gray bars, 4 teal bars to Thursday and the y labels $0 to $400, the SVG hidden', async () => {
    await openOverview();
    await table();

    expect(bars('previous')).toHaveLength(7);
    expect(bars('current')).toHaveLength(4);
    expect(yLabels()).toEqual(['$0', '$100', '$200', '$300', '$400']);
    expect(statistics().querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect([...statistics().querySelectorAll(`text.${chartStyles.xLabel}`)].map((label) => label.textContent)).toEqual([
      '19 Mon',
      '20 Tue',
      '21 Wed',
      '22 Thu',
      '23 Fri',
      '24 Sat',
      '25 Sun',
    ]);
  });

  it('asks for the weekly comparison once, with the browser’s time zone', async () => {
    const zones: (string | null)[] = [];
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname === '/api/statistics/weekly-comparison') {
        zones.push(request.headers.get('x-time-zone'));
      }
    });
    await openOverview();
    await table();

    expect(zones).toEqual([Intl.DateTimeFormat().resolvedOptions().timeZone]);
  });

  // AC8: no tooltip, no hover and nothing focusable in the chart (#20).
  it('has nothing focusable in the chart and changes nothing on a hover or a click on a bar', async () => {
    const { user } = await openOverview();
    const chartTable = await table();
    const chart = chartTable.parentElement!;
    const before = statistics().innerHTML;

    await user.hover(bars('current')[3]!);
    await user.click(bars('previous')[3]!);

    expect(statistics().innerHTML).toBe(before);
    expect(chart.querySelectorAll('a, button, input, select, textarea, [tabindex]')).toHaveLength(0);
    expect(within(statistics()).queryByRole('tooltip')).toBeNull();
  });
});

// T12: AC7, the one comparison: the shared list with "Weekly Comparison" only (#20, #60, #90 a).
describe('the "Weekly Comparison" control', () => {
  it('opens the list on a click with one option, selected; choosing it closes the list and sends nothing', async () => {
    const { user } = await openOverview();
    const chartTable = await table();
    const sent = count(weeklyPath);

    await user.click(control());
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Weekly Comparison']);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await user.click(options[0]!);

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(control()).toHaveTextContent('Weekly Comparison');
    expect(tableRows(chartTable)).toEqual(firstLoginRows);
    expect(count(weeklyPath)).toBe(sent);
  });

  it.each(['{Enter}', ' ', '{ArrowDown}', '{ArrowUp}'])(
    'opens by keyboard with %s and closes on Escape',
    async (key) => {
      const { user } = await openOverview();
      await table();
      const sent = count(weeklyPath);
      control().focus();

      await user.keyboard(key);
      expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1);
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('listbox')).toBeNull();
      await waitFor(() => expect(control()).toHaveFocus());
      expect(control()).toHaveTextContent('Weekly Comparison');
      expect(count(weeklyPath)).toBe(sent);
    },
  );
});

// T13: AC6, AC12: empty, a quiet week, loading, error and a failed refetch (#6, #55, #88, #89, #91 c).
describe('the Statistics card states', () => {
  it('shows "No expenses this week or last week" under the header row when every value is 0', async () => {
    await openOverview(weeklyComparison.allZero());

    expect(await within(statistics()).findByText('No expenses this week or last week')).toBeInTheDocument();
    expect(within(statistics()).queryByRole('table')).toBeNull();
    expect(control()).toHaveTextContent('Weekly Comparison');
    expect(legend()).toBeInTheDocument();
  });

  it('shows last week’s gray bars and no teal bar when this week is all 0', async () => {
    await openOverview(weeklyComparison.quietWeek());
    const chartTable = await table();

    expect(bars('previous')).toHaveLength(7);
    expect(bars('current')).toHaveLength(0);
    expect(
      tableRows(chartTable)
        .slice(1, 5)
        .map((row) => row[2]),
    ).toEqual(['$0.00', '$0.00', '$0.00', '$0.00']);
  });

  it('shows the skeleton under the header row while the request runs, the other sections in place', async () => {
    await openOverview(weeklyComparison.pending());

    await waitFor(() => expect(statistics().querySelector('[aria-busy="true"]')).not.toBeNull());
    expect(control()).toHaveTextContent('Weekly Comparison');
    expect(legend()).toBeInTheDocument();
    expect(within(statistics()).queryByRole('table')).toBeNull();
    expect(screen.getByRole('region', { name: 'Recent Transaction' })).toBeInTheDocument();
  });

  it('shows the error state after the request and its 3 retries fail, the header row working, and Retry loads it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await openOverview(weeklyComparison.fails());

    await vi.advanceTimersByTimeAsync(30_000);

    expect(count(weeklyPath)).toBe(4);
    expect(within(statistics()).getByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(within(statistics()).queryByRole('table')).toBeNull();
    expect(await screen.findByText('$130,254.67')).toBeInTheDocument();
    await user.click(control());
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1);
    await user.keyboard('{Escape}');

    server.use(weeklyComparison.answers());
    await user.click(within(statistics()).getByRole('button', { name: 'Retry' }));

    expect(tableRows(await table())).toEqual(firstLoginRows);
    expect(within(statistics()).queryByRole('alert')).toBeNull();
  });

  it('keeps the chart, with no message, when a later refetch fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openOverview();
    await table();
    server.use(weeklyComparison.fails());
    const before = count(weeklyPath);

    refocusWindow();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(count(weeklyPath) - before).toBe(4);
    expect(tableRows(await table())).toEqual(firstLoginRows);
    expect(within(statistics()).queryByRole('alert')).toBeNull();
  });
});

const widgets = [
  {
    name: 'Statistics',
    fails: weeklyComparison.fails,
    pending: weeklyComparison.pending,
    answers: () => weeklyComparison.answers(),
    content: () => within(statistics()).findByRole('table'),
    // Expenses Breakdown's first right arrow (task 018).
    nextHasFocus: () => document.activeElement === screen.getByRole('link', { name: 'Housing expenses' }),
  },
  {
    name: 'Upcoming Bill',
    fails: upcomingBills.fails,
    pending: upcomingBills.pending,
    answers: () => upcomingBills.answers(),
    content: () => within(screen.getByRole('region', { name: 'Upcoming Bill' })).findByRole('list'),
    nextHasFocus: () =>
      document.activeElement ===
      within(screen.getByRole('region', { name: 'Recent Transaction' })).getByRole('link', { name: 'View All' }),
  },
] as const;

// T14: AC13, follow-up 2 of the task 016 gate: Retry never drops focus to the page body; the shared DataState keeps
// it in the widget (#6, #87).
describe.each(widgets)('Retry in $name', ({ name, fails, pending, answers, content, nextHasFocus }) => {
  const region = () => screen.getByRole('region', { name });
  const retry = () => within(region()).getByRole('button', { name: 'Retry' });

  /** Overview with this widget in its error state, after the request and its 3 retries fail. */
  async function openFailed() {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const view = await openOverview(fails());
    await vi.advanceTimersByTimeAsync(30_000);
    expect(within(region()).getByRole('alert')).toBeInTheDocument();
    return view;
  }

  it('moves focus into the widget on a keyboard Retry and keeps it there through the skeleton', async () => {
    const { user } = await openFailed();
    retry().focus();
    server.use(pending());

    await user.keyboard('{Enter}');
    await act(() => vi.advanceTimersByTimeAsync(1_000));

    const root = dataStateRootIn(region());
    expect(root).toHaveAttribute('aria-busy', 'true');
    expect(root).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
  });

  it('keeps focus on the widget’s root when the retried data shows, and Tab goes on from there', async () => {
    const { user } = await openFailed();
    retry().focus();
    server.use(answers());

    await user.keyboard('{Enter}');

    expect(await content()).toBeInTheDocument();
    const root = dataStateRootIn(region());
    expect(root).toHaveFocus();
    expect(root).toHaveAttribute('tabindex', '-1');
    expect(document.activeElement).not.toBe(document.body);
    await user.tab();
    expect(nextHasFocus()).toBe(true);
  });

  it('moves focus to the new Retry when the retry fails again', async () => {
    const { user } = await openFailed();
    retry().focus();

    await user.keyboard('{Enter}');
    await act(() => vi.advanceTimersByTimeAsync(30_000));

    expect(within(region()).getByRole('alert')).toBeInTheDocument();
    await waitFor(() => expect(retry()).toHaveFocus());
  });

  it('moves focus to the widget’s root on a click on Retry too', async () => {
    const { user } = await openFailed();
    server.use(answers());

    await user.click(retry());

    expect(dataStateRootIn(region())).toHaveFocus();
    expect(await content()).toBeInTheDocument();
    expect(dataStateRootIn(region())).toHaveFocus();
  });
});

// T15: AC15, the Tab order: Recent Transaction's panel, the control, then Expenses Breakdown's first right arrow
// (task 018) (#87, #112).
describe('the Statistics Tab order', () => {
  it('tabs from Recent Transaction’s panel to the control, then to Expenses Breakdown; Shift+Tab goes back', async () => {
    const { user } = await openOverview();
    await table();
    const housing = await screen.findByRole('link', { name: 'Housing expenses' });
    const panel = within(screen.getByRole('region', { name: 'Recent Transaction' })).getByRole('tabpanel');

    panel.focus();
    await user.tab();
    expect(control()).toHaveFocus();
    await user.tab();
    expect(housing).toHaveFocus();

    control().focus();
    await user.tab({ shift: true });
    expect(panel).toHaveFocus();
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

// T16: AC5, AC11, the frontend maps the response into the chart's props and formats the labels; it calculates
// nothing (#11, #55, #74).
describe('the Statistics sources', () => {
  const files = ['components/Statistics/Statistics.tsx', 'api/statistics.ts'];
  const calculating =
    /\bcents\b|Math\.|\bDate\b|getTime|parseInt|parseFloat|Number\(|\.sort\(|\.toSorted\(|\.reduce\(|\.every\(|\.some\(|[-+*/]\s*\d|\d\s*[-+*/]/;
  const usesAxisTicks = /\baxisTicks\s*\(|import\s*\{[^}]*\baxisTicks\b[^}]*\}\s*from|\baxisTicks\s*[,}]/;

  it('never calculates with cents, dates or the ticks', () => {
    expect(files.filter((file) => calculating.test(source(file)))).toEqual([]);
  });

  it('never imports or calls axisTicks anywhere in frontend/src', () => {
    const offenders = sourceFiles(srcDir)
      .filter((file) => usesAxisTicks.test(readFileSync(file, 'utf8')))
      .map((file) => relative(srcDir, file).replaceAll('\\', '/'));

    expect(sourceFiles(srcDir).length).toBeGreaterThan(20);
    expect(offenders).toEqual([]);
  });

  it('formats the labels with formatDayLabel and takes the empty state from the backend’s null ticks', () => {
    const statisticsSource = source('components/Statistics/Statistics.tsx');

    expect(statisticsSource).toMatch(/\bformatDayLabel\(/);
    expect(statisticsSource).toMatch(/\bticks === null\b/);
    expect(statisticsSource).toMatch(/<ComparisonBarChart\b/);
  });

  it.each([
    ['const top = Math.max(...values);', true],
    ['const total = day.lastWeek.cents + day.thisWeek.cents;', true],
    ['const sorted = days.toSorted(byDate);', true],
    ['const empty = days.every((day) => day.lastWeek.cents === 0);', true],
    ['const next = index + 1;', true],
    ['const label = formatDayLabel(day.date);', false],
  ])('the calculation check on %s: %s', (code, flagged) => {
    expect(calculating.test(code)).toBe(flagged);
  });

  it.each([
    ["import { axisTicks, formatMoney } from '@finebank/shared';", true],
    ['const ticks = axisTicks(highest);', true],
    ['/** The y-axis ticks from the backend’s `axisTicks`. */', false],
  ])('the axisTicks check on %s: %s', (code, flagged) => {
    expect(usesAxisTicks.test(code)).toBe(flagged);
  });
});
