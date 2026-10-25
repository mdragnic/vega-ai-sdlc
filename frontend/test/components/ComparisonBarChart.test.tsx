import type { Money } from '@finebank/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ComparisonBarChart } from '../../src/components';
import styles from '../../src/components/ComparisonBarChart/ComparisonBarChart.module.css';
import {
  AXIS_LABEL_RIGHT,
  BAR_GAP,
  BAR_WIDTH,
  barBottom,
  barPath,
  GRID_LEFT,
  GRID_LINE,
  GRID_STEP,
  GROUP_WIDTH,
  groupPosition,
  lineTop,
  PLOT_RIGHT,
} from '../../src/components/ComparisonBarChart/geometry';

const usd = (cents: number): Money => ({ cents, currency: 'USD' });
const dollars = (amount: number) => usd(Math.round(amount * 100));
const amounts = (values: (number | null)[]) => values.map((value) => (value === null ? null : dollars(value)));

type Props = Parameters<typeof ComparisonBarChart>[0];

// The gallery's Statistics sample: last week's highest $322.00 on a $0 to $400 axis, no teal bar from Fri (#55, #91).
const statistics: Props = {
  title: 'Expenses this week and last week',
  labels: ['19 Mon', '20 Tue', '21 Wed', '22 Thu', '23 Fri', '24 Sat', '25 Sun'],
  previous: { name: 'Last week', values: amounts([180, 95.5, 240, 322, 150, 210.25, 60]) },
  current: { name: 'This week', values: amounts([120, 266, 75.36, 289.92, null, null, null]) },
  ticks: [0, 100, 200, 300, 400].map(dollars),
};

/** One group: a label and its two values, on a $0 to $500 axis. */
function single(previous: number | null, current: number | null): Props {
  return {
    title: 'One day',
    labels: ['19 Mon'],
    previous: { name: 'Last week', values: amounts([previous]) },
    current: { name: 'This week', values: amounts([current]) },
    ticks: [0, 125, 250, 375, 500].map(dollars),
  };
}

function renderChart(props: Props) {
  const { container } = render(<ComparisonBarChart {...props} />);
  return container.querySelector('svg')!;
}

const all = (root: Element, className: string | undefined) => [...root.querySelectorAll(`.${className}`)];
const yLabels = (svg: SVGSVGElement) => all(svg, styles.yLabel).map((label) => label.textContent);
/** The groups: one nested coordinate system each, in label order. */
const groups = (svg: SVGSVGElement) => [...svg.querySelectorAll(':scope > svg')];
/** The bars of a group or of the chart: the only paths it draws. */
const bars = (root: Element) => [...root.querySelectorAll('path')];

// T6, T8: the y-axis labels and grid lines (AC5, #11, #82, #91).
describe('ComparisonBarChart axis', () => {
  it.each([
    [
      [0, 100, 200, 300, 400],
      ['$0', '$100', '$200', '$300', '$400'],
    ],
    [
      [0, 125, 250, 375, 500],
      ['$0', '$125', '$250', '$375', '$500'],
    ],
    [
      [0, 12_500, 25_000, 37_500, 50_000],
      ['$0', '$12.5k', '$25k', '$37.5k', '$50k'],
    ],
    [
      [0, 62.5, 125, 187.5, 250],
      ['$0', '$62.50', '$125', '$187.50', '$250'],
    ],
  ])('labels the ticks %j from the bottom as %j', (ticks, expected) => {
    // No bars: only the axis is under test.
    const svg = renderChart({ ...single(0, 0), ticks: ticks.map(dollars) });

    expect(yLabels(svg)).toEqual(expected);
  });

  it('puts each label right-aligned on its grid line, from the bottom line up', () => {
    const svg = renderChart(statistics);
    const labels = all(svg, styles.yLabel);

    labels.forEach((label, index) => {
      expect(label).toHaveAttribute('x', String(AXIS_LABEL_RIGHT));
      expect(label).toHaveAttribute('y', String(lineTop(4 - index) + GRID_LINE / 2));
      expect(label).toHaveAttribute('text-anchor', 'end');
      expect(label).toHaveAttribute('dominant-baseline', 'central');
    });
  });

  it('draws one grid line per tick, 36 apart, from the label column to the right edge', () => {
    const svg = renderChart(statistics);
    const lines = all(svg, styles.gridLine);

    // From the $0 line (the last row) up to the top tick's line (row 0).
    expect(lines).toHaveLength(5);
    expect(lines.map((line) => Number(line.getAttribute('y1')))).toEqual(
      [4, 3, 2, 1, 0].map((row) => lineTop(row) + GRID_LINE / 2),
    );
    expect(lineTop(1) - lineTop(0)).toBe(36);
    for (const line of lines) {
      expect(line).toHaveAttribute('x1', String(GRID_LEFT));
      expect(line).toHaveAttribute('x2', PLOT_RIGHT);
      expect(line.getAttribute('y2')).toBe(line.getAttribute('y1'));
      expect(line).toHaveAttribute('stroke-width', String(GRID_LINE));
    }
    expect(GRID_LEFT - AXIS_LABEL_RIGHT).toBe(16);
  });
});

// T6, T9: bars per group, their heights, 0 and null (AC6, AC8, #55).
describe('ComparisonBarChart bars', () => {
  it('draws the gray bar then the teal bar of a group, 16 wide and 8 apart, from the $0 line', () => {
    const svg = renderChart(single(250, 500));
    const [previous, current] = bars(groups(svg)[0]!);

    expect(previous).toHaveClass(styles.previous!);
    expect(current).toHaveClass(styles.current!);
    // A $250 bar on a $500 axis is 72 high; $500 reaches the top line.
    expect(previous).toHaveAttribute('d', barPath(0, barBottom(4), 72));
    expect(current).toHaveAttribute('d', barPath(BAR_WIDTH + BAR_GAP, barBottom(4), 144));
    expect([BAR_WIDTH, BAR_GAP, GROUP_WIDTH]).toEqual([16, 8, 40]);
  });

  it('draws a rounded top and a square bottom on the $0 line', () => {
    // The bottom is the $0 line's lower edge, so the bar covers the line, as in 104.
    expect(barBottom(4)).toBe(lineTop(4) + GRID_LINE);
    expect(barPath(0, 155, 72)).toBe('M0,155V87A4,4 0 0 1 4,83H12A4,4 0 0 1 16,87V155Z');
    // Lower than the radius: the two top corners meet.
    expect(barPath(24, 155, 2)).toBe('M24,155V155A2,2 0 0 1 26,153H38A2,2 0 0 1 40,155V155Z');
  });

  it('draws no bar for a value of 0', () => {
    const svg = renderChart(single(0, 125));
    const drawn = bars(groups(svg)[0]!);

    expect(drawn).toHaveLength(1);
    expect(drawn[0]).toHaveClass(styles.current!);
  });

  it('draws the Statistics sample: 7 gray bars, 4 teal ones, heights relative to the top tick', () => {
    const svg = renderChart(statistics);
    const previous = all(svg, styles.previous);
    const current = all(svg, styles.current);

    expect(previous).toHaveLength(7);
    expect(current).toHaveLength(4);
    // Last Thursday's $322.00 on the $400 axis.
    expect(previous[3]).toHaveAttribute('d', barPath(0, barBottom(4), (322 / 400) * 144));
    expect(current[1]).toHaveAttribute('d', barPath(BAR_WIDTH + BAR_GAP, barBottom(4), (266 / 400) * 144));
  });

  it('keeps the label and the gray bar of a future day, with no teal bar', () => {
    const svg = renderChart(statistics);

    groups(svg).forEach((group, index) => {
      expect(all(group, styles.xLabel).map((label) => label.textContent)).toEqual([statistics.labels[index]]);
      expect(all(group, styles.previous)).toHaveLength(1);
      expect(all(group, styles.current)).toHaveLength(index < 4 ? 1 : 0);
    });
  });

  it.each([
    ['above the top tick', single(500.01, 0)],
    ['negative', single(-1, 0)],
  ])('rejects a value %s', (_, props) => {
    expect(() => render(<ComparisonBarChart {...props} />)).toThrow(RangeError);
  });

  // The labels come from the ticks and the bars from the top tick: only axisTicks' shape keeps them in step (#55).
  it.each([
    ['four ticks', [0, 125, 250, 375]],
    ['six ticks', [0, 100, 200, 300, 400, 500]],
    ['ticks that do not start at $0', [100, 200, 300, 400, 500]],
    ['unequal steps', [0, 100, 250, 375, 500]],
  ])('rejects %s', (_, ticks) => {
    const props = { ...single(0, 0), ticks: ticks.map(dollars) };

    expect(() => render(<ComparisonBarChart {...props} />)).toThrow(RangeError);
  });

  it('rejects an axis whose top tick is not above $0', () => {
    const props = { ...single(0, 0), ticks: [0, 0, 0, 0, 0].map(dollars) };

    expect(() => render(<ComparisonBarChart {...props} />)).toThrow(RangeError);
  });

  it('rejects a series without one value per label', () => {
    const props = { ...statistics, current: { name: 'This week', values: amounts([120]) } };

    expect(() => render(<ComparisonBarChart {...props} />)).toThrow(RangeError);
  });
});

/** A group's left edge in a chart of the given width: a share of the width plus a fixed offset. */
function groupLeft(index: number, count: number, width: number) {
  const { percent, offset } = groupPosition(index, count);
  return (percent / 100) * width + offset;
}

// T7 (unit): the groups spread with the width; the label centered under each group (AC7).
describe('ComparisonBarChart groups', () => {
  it.each([
    ['104: 7 groups in the 680 wide plot', 7, 680, 84],
    ['109: 12 groups in the 1056 wide plot', 12, 1056, 80],
  ])('spreads %s, %i px apart', (_, count, width, pitch) => {
    const lefts = Array.from({ length: count }, (__, index) => groupLeft(index, count, width));

    // The first gray bar 22 right of the grid's left end, the last teal bar 50 left of the right edge.
    expect(lefts[0]).toBeCloseTo(GRID_LEFT + 22);
    expect(width - (lefts.at(-1)! + GROUP_WIDTH)).toBeCloseTo(50);
    lefts.slice(1).forEach((left, index) => expect(left - lefts[index]!).toBeCloseTo(pitch));
  });

  it('places each group by its share of the width and centers its label under it', () => {
    const svg = renderChart(statistics);

    groups(svg).forEach((group, index) => {
      const { percent, offset } = groupPosition(index, 7);
      const label = all(group, styles.xLabel)[0]!;

      expect(group).toHaveAttribute('x', `${percent}%`);
      expect(group).toHaveAttribute('overflow', 'visible');
      expect(group.firstElementChild).toHaveAttribute('transform', `translate(${offset})`);
      expect(label).toHaveAttribute('x', String(GROUP_WIDTH / 2));
      expect(label).toHaveAttribute('text-anchor', 'middle');
    });
  });

  it('puts a single group at the start', () => {
    expect(groupPosition(0, 1)).toEqual(groupPosition(0, 7));
  });

  it('puts every x label on the same baseline below the $0 line', () => {
    const svg = renderChart(statistics);
    const baselines = new Set(all(svg, styles.xLabel).map((label) => label.getAttribute('y')));

    expect(baselines.size).toBe(1);
    expect(Number([...baselines][0])).toBeGreaterThan(lineTop(4) + GRID_STEP / 3);
  });
});

// T11: the SVG is hidden; a table carries the data (AC10, #11).
describe('ComparisonBarChart accessibility', () => {
  it('hides the drawing and lists the data in a table named by the title', () => {
    const svg = renderChart(statistics);
    const table = screen.getByRole('table', { name: statistics.title });
    const rows = within(table).getAllByRole('row');

    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(within(table).getAllByRole('rowheader')).toHaveLength(7);
    expect(
      within(rows[0]!)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Last week', 'This week']);
    expect(rows.slice(1).map((row) => [...row.querySelectorAll('th, td')].map((cell) => cell.textContent))).toEqual([
      ['19 Mon', '$180.00', '$120.00'],
      ['20 Tue', '$95.50', '$266.00'],
      ['21 Wed', '$240.00', '$75.36'],
      ['22 Thu', '$322.00', '$289.92'],
      ['23 Fri', '$150.00', ''],
      ['24 Sat', '$210.25', ''],
      ['25 Sun', '$60.00', ''],
    ]);
  });

  // T10 (unit): nothing to focus, no tooltip title (AC9, #20, #87).
  it('has no title and nothing focusable', () => {
    const { container } = render(<ComparisonBarChart {...statistics} />);

    expect(container.querySelector('title')).toBeNull();
    expect(container.querySelectorAll('a, button, input, [tabindex]')).toHaveLength(0);
    expect(container.querySelector('svg')).toHaveAttribute('focusable', 'false');
  });
});
