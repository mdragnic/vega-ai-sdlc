import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Money, SavingSummaryDay } from '@finebank/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SavingSummaryChart } from '../../src/components';
import styles from '../../src/components/SavingSummaryChart/SavingSummaryChart.module.css';
import {
  AXIS_LABEL_RIGHT,
  DASH,
  DASH_GAP,
  GRID_LINE,
  PLOT_HEIGHT,
  TICK_TOP,
  X_LABEL_BASELINE,
} from '../../src/components/SavingSummaryChart/geometry';

const usd = (cents: number): Money => ({ cents, currency: 'USD' });

const TITLE = 'Savings per day, this month and the same period last month';

/** A month's days from its values in cents: this month's (null after today) and the month before's (null if none). */
function daysOf(month: string, thisMonth: (number | null)[], lastMonth: (number | null)[]): SavingSummaryDay[] {
  return thisMonth.map((value, index) => ({
    date: `${month}-${String(index + 1).padStart(2, '0')}`,
    thisMonth: value === null ? null : usd(value),
    lastMonth: lastMonth[index] === null || lastMonth[index] === undefined ? null : usd(lastMonth[index]),
  }));
}

/** October 2026 at the fixed clock (demo data, task 026 References): to the 22nd, September's 30 days. */
const octoberThis = [
  55_216,
  -2_800,
  16_856,
  -28_336,
  -1_478,
  -1_764,
  -2_128,
  -2_464,
  -4_200,
  7_280,
  -3_192,
  -5_880,
  -1_064,
  -2_016,
  -23_800,
  -1_478,
  -896,
  -14_784,
  -1_064,
  -2_464,
  -1_764,
  -26_600,
  ...Array<null>(9).fill(null),
];
const septemberLast = [
  52_640,
  -2_352,
  16_800,
  -24_472,
  -1_277,
  -1_428,
  -2_240,
  -2_128,
  -3_528,
  4_480,
  -4_032,
  -4_760,
  -1_120,
  -2_240,
  -18_648,
  -1_277,
  2_688,
  -12_768,
  -1_120,
  -2_128,
  -1_428,
  -22_344,
  -1_277,
  15_232,
  -1_120,
  -2_352,
  48_160,
  2_352,
  -1_120,
  -1_428,
  null,
];
const october = {
  days: daysOf('2026-10', octoberThis, septemberLast),
  ticks: [-30_000, -15_000, 0, 15_000, 30_000, 45_000, 60_000].map(usd),
};

/** June 2022 (against May): 30 days, the 17th -$574.20, 10 ticks (the cap, #124 d2). */
const june = {
  days: daysOf(
    '2022-06',
    Array.from({ length: 30 }, (_, index) => (index === 16 ? -57_420 : 44_650)),
    Array.from({ length: 30 }, () => 0),
  ),
  ticks: [-62_500, -50_000, -37_500, -25_000, -12_500, 0, 12_500, 25_000, 37_500, 50_000].map(usd),
};

/** No day above $0 (#72): $0 at the top, 4 steps down. */
const belowZero = {
  days: daysOf(
    '2026-10',
    Array.from({ length: 31 }, (_, index) => (index < 10 ? -28_336 : null)),
    [...Array.from({ length: 30 }, () => -100), null],
  ),
  ticks: [-40_000, -30_000, -20_000, -10_000, 0].map(usd),
};

/** 1 Nov in Belgrade at 2026-10-31T23:30:00Z: one teal value, against October's 1st to 30th. */
const lonePoint = {
  days: daysOf(
    '2026-11',
    [51_352, ...Array<null>(29).fill(null)],
    octoberThis.slice(0, 22).concat(Array.from({ length: 8 }, () => 1_000)),
  ),
  ticks: [-30_000, -15_000, 0, 15_000, 30_000, 45_000, 60_000].map(usd),
};

/** February 2026 against January: 28 days, every value $100. */
const february = {
  days: daysOf(
    '2026-02',
    Array.from({ length: 28 }, () => 10_000),
    Array.from({ length: 28 }, () => 10_000),
  ),
  ticks: [0, 2_500, 5_000, 7_500, 10_000].map(usd),
};

type Props = Parameters<typeof SavingSummaryChart>[0];

function renderChart(props: Omit<Props, 'title'>) {
  const { container } = render(<SavingSummaryChart title={TITLE} {...props} />);
  return container;
}

const all = (root: Element, className: string | undefined) => [...root.querySelectorAll(`.${className}`)];
const yLabels = (root: Element) => all(root, styles.yLabel);
const xLabels = (root: Element) => all(root, styles.xLabel);
const gridLines = (root: Element) => all(root, styles.gridLine);
const path = (root: Element, className: string | undefined) => root.querySelector(`.${className}`)?.getAttribute('d');

/** The numbers of a path command's arguments. */
const numbers = (text: string) => text.split(/[ ,]+/).filter(Boolean).map(Number);

/** A path's points: the start and the end of each segment, as [x, y]. */
function endpoints(d: string): [number, number][] {
  const points: [number, number][] = [];
  for (const [, command, args] of d.matchAll(/([A-Za-z])([^A-Za-z]*)/g)) {
    const values = numbers(args!);
    if (command === 'M' || command === 'L') points.push([values[0]!, values[1]!]);
    if (command === 'C') points.push([values[4]!, values[5]!]);
  }
  return points;
}

/** Each cubic segment's two control points' y and the y of the points it joins. */
function segments(d: string) {
  const result: { from: number; to: number; controls: [number, number] }[] = [];
  let last = 0;
  for (const [, command, args] of d.matchAll(/([A-Za-z])([^A-Za-z]*)/g)) {
    const values = numbers(args!);
    if (command === 'M') last = values[1]!;
    if (command === 'C') {
      result.push({ from: last, to: values[5]!, controls: [values[1]!, values[3]!] });
      last = values[5]!;
    }
  }
  return result;
}

/** The y of a value inside the plot, hand-derived: the top tick at 0, the lowest at the plot's height. */
const yOf = (cents: number, lowest: number, highest: number) => ((highest - cents) / (highest - lowest)) * PLOT_HEIGHT;

const near = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 2);

// T11: AC1, AC5 and AC10, the y-axis drawn as sent: the labels from the top tick to the lowest, evenly (#124 c).
describe('SavingSummaryChart y-axis', () => {
  it('labels October’s 7 ticks -$300 to $600, from the bottom up', () => {
    const root = renderChart(october);

    expect(yLabels(root).map((label) => label.textContent)).toEqual([
      '-$300',
      '-$150',
      '$0',
      '$150',
      '$300',
      '$450',
      '$600',
    ]);
  });

  it.each([
    ['October’s 7 ticks', october, 25],
    ['June 2022’s 10 ticks', june, 150 / 9],
    ['the #72 shape’s 5 ticks', belowZero, 37.5],
  ])('spreads %s evenly from the top tick 37.5 down to the lowest 150 under it', (_case, props, step) => {
    const labels = yLabels(renderChart(props));
    const ys = labels.map((label) => Number(label.getAttribute('y')));

    near(ys.at(-1)!, 37.5);
    near(ys[0]!, 187.5);
    ys.slice(1).forEach((y, index) => near(ys[index]! - y, step));
    for (const label of labels) {
      expect(label).toHaveAttribute('x', String(AXIS_LABEL_RIGHT));
      expect(label).toHaveAttribute('text-anchor', 'end');
      expect(label).toHaveAttribute('dominant-baseline', 'central');
    }
    expect([TICK_TOP, PLOT_HEIGHT, AXIS_LABEL_RIGHT]).toEqual([37.5, 150, 48]);
  });

  it('labels every June 2022 tick exactly, -$625 to $500', () => {
    expect(yLabels(renderChart(june)).map((label) => label.textContent)).toEqual([
      '-$625',
      '-$500',
      '-$375',
      '-$250',
      '-$125',
      '$0',
      '$125',
      '$250',
      '$375',
      '$500',
    ]);
  });
});

// T11: AC1 and AC4, the x-axis: one point per day, labels and grid lines on days 1, 5 ... 30 (#84, #124 b).
describe('SavingSummaryChart x-axis', () => {
  it('labels days 1, 5, 10 ... 30 of October as 01 Oct ... 30 Oct, each on its grid line', () => {
    const root = renderChart(october);
    const labels = xLabels(root);
    const lines = gridLines(root);

    expect(labels.map((label) => label.textContent)).toEqual([
      '01 Oct',
      '05 Oct',
      '10 Oct',
      '15 Oct',
      '20 Oct',
      '25 Oct',
      '30 Oct',
    ]);
    // 31 days: day d at (d - 1) / 30 of the plot's width, in percent.
    const percents = labels.map((label) => label.getAttribute('x')!);
    expect(percents.every((x) => x.endsWith('%'))).toBe(true);
    [0, 13.333, 30, 46.667, 63.333, 80, 96.667].forEach((expected, index) =>
      near(Number.parseFloat(percents[index]!), expected),
    );
    lines.forEach((line, index) => {
      expect(line.getAttribute('x1')).toBe(labels[index]!.getAttribute('x'));
      expect(line.getAttribute('x2')).toBe(labels[index]!.getAttribute('x'));
      expect(Number(line.getAttribute('y1'))).toBe(37.5);
      expect(Number(line.getAttribute('y2'))).toBe(187.5);
      expect(line).toHaveAttribute('stroke-width', String(GRID_LINE));
    });
    for (const label of labels) {
      expect(label).toHaveAttribute('text-anchor', 'middle');
      expect(Number(label.getAttribute('y'))).toBe(X_LABEL_BASELINE);
    }
    expect(X_LABEL_BASELINE).toBe(210.5);
  });

  it('has no 30 in February: 6 labels and grid lines, day d at (d - 1) / 27', () => {
    const root = renderChart(february);

    expect(xLabels(root).map((label) => label.textContent)).toEqual([
      '01 Feb',
      '05 Feb',
      '10 Feb',
      '15 Feb',
      '20 Feb',
      '25 Feb',
    ]);
    expect(gridLines(root)).toHaveLength(6);
    near(Number.parseFloat(xLabels(root)[5]!.getAttribute('x')!), (24 / 27) * 100);
  });
});

// T11: AC1, AC4 and AC6, the lines: the 1st at the plot's left, the last day at its right, a null ends a line (#55,
// #124 a, f).
describe('SavingSummaryChart lines', () => {
  it('draws October’s teal line from the 1st to the 22nd and nothing after', () => {
    const root = renderChart(october);
    const points = endpoints(path(root, styles.thisMonth)!);

    expect(points).toHaveLength(22);
    expect(points[0]![0]).toBe(0);
    near(points[0]![1], yOf(55_216, -30_000, 60_000));
    expect(points.at(-1)![0]).toBe(21);
    near(points.at(-1)![1], yOf(-26_600, -30_000, 60_000));
    near(points[3]![1], yOf(-28_336, -30_000, 60_000));
  });

  it('draws September’s dashed line from the 1st to the 30th, none on the 31st, under the teal line', () => {
    const root = renderChart(october);
    const dashed = root.querySelector(`.${styles.lastMonth}`)!;
    const points = endpoints(dashed.getAttribute('d')!);

    expect(points).toHaveLength(30);
    expect(points.at(-1)![0]).toBe(29);
    near(points.at(-1)![1], yOf(-1_428, -30_000, 60_000));
    expect(dashed).toHaveAttribute('stroke-dasharray', `${DASH} ${DASH_GAP}`);
    expect([DASH, DASH_GAP]).toEqual([6, 2]);
    // Drawn first: the teal line and its fill come after it.
    const order = [...root.querySelectorAll('path')].map((each) => each.getAttribute('class'));
    expect(order).toEqual([styles.lastMonth, styles.fill, styles.thisMonth]);
  });

  it('puts the last day at the plot’s right edge: the plot’s x units are the month’s days from 0', () => {
    const root = renderChart(october);
    const plot = root.querySelector(`.${styles.lines}`)!;

    expect(plot).toHaveAttribute('viewBox', `0 0 30 ${PLOT_HEIGHT}`);
    expect(plot).toHaveAttribute('preserveAspectRatio', 'none');
    expect(plot).toHaveAttribute('width', '100%');
    expect(Number(plot.getAttribute('y'))).toBe(TICK_TOP);
  });

  it('closes the fill under the teal line at the plot’s bottom, with a vertical gradient (#124 f)', () => {
    const root = renderChart(october);
    const fill = path(root, styles.fill)!;
    const line = path(root, styles.thisMonth)!;

    expect(fill.startsWith(line)).toBe(true);
    expect(fill.slice(line.length)).toBe(`L21,${PLOT_HEIGHT}L0,${PLOT_HEIGHT}Z`);
    const gradient = root.querySelector('linearGradient')!;
    expect(root.querySelector(`.${styles.fill}`)).toHaveAttribute('fill', `url(#${gradient.id})`);
    expect([...gradient.querySelectorAll('stop')].map((stop) => stop.getAttribute('class'))).toEqual([
      styles.fillTop,
      styles.fillMiddle,
      styles.fillBottom,
    ]);
    expect(gradient).toHaveAttribute('x2', '0');
    expect(gradient).toHaveAttribute('y2', '1');
  });

  // The curve is smooth, a monotone cubic: no peak or dip that the data does not have.
  it.each([
    ['October', october, styles.thisMonth],
    ['September', october, styles.lastMonth],
    ['June 2022', june, styles.thisMonth],
  ])('never takes %s’s curve beyond two neighbouring days', (_case, props, className) => {
    for (const { from, to, controls } of segments(path(renderChart(props), className)!)) {
      for (const control of controls) {
        expect(control).toBeGreaterThanOrEqual(Math.min(from, to) - 1e-6);
        expect(control).toBeLessThanOrEqual(Math.max(from, to) + 1e-6);
      }
    }
  });

  it('draws a lone point on the 1st as a dot, with no fill', () => {
    const root = renderChart(lonePoint);
    const dot = path(root, styles.thisMonth)!;

    expect(dot).toMatch(/^M0,[\d.]+h0$/);
    // Not designed: the 2px round cap alone is a speck, so the point's stroke is the dot's size (dataviz: 8px at least).
    expect(root.querySelector(`.${styles.thisMonth}`)).toHaveClass(styles.point!);
    near(endpoints(dot)[0]![1], yOf(51_352, -30_000, 60_000));
    expect(root.querySelector(`.${styles.fill}`)).toBeNull();
    expect(endpoints(path(root, styles.lastMonth)!)).toHaveLength(30);
  });

  it('draws every value of the #72 shape inside the plot', () => {
    const points = endpoints(path(renderChart(belowZero), styles.thisMonth)!);

    expect(points).toHaveLength(10);
    near(points[0]![1], yOf(-28_336, -40_000, 0));
  });
});

// T11: AC2, the hidden table carries the data (#113 b).
describe('SavingSummaryChart table', () => {
  it('names the table by its title, with a row per day and the legend’s two columns', () => {
    renderChart(october);

    const table = screen.getByRole('table', { name: TITLE });
    const rows = within(table).getAllByRole('row');
    expect(
      within(rows[0]!)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['This month', 'Same period last month']);
    const body = rows.slice(1).map((row) => [...row.children].map((cell) => cell.textContent));
    expect(body).toHaveLength(31);
    expect(body[0]).toEqual(['01 Oct', '$552.16', '$526.40']);
    expect(body[3]).toEqual(['04 Oct', '-$283.36', '-$244.72']);
    expect(body[15]).toEqual(['16 Oct', '-$14.78', '-$12.77']);
    expect(body[22]).toEqual(['23 Oct', '', '-$12.77']);
    expect(body[30]).toEqual(['31 Oct', '', '']);
    expect(within(rows[1]!).getByRole('rowheader')).toHaveTextContent('01 Oct');
  });

  it('hides the drawing from assistive technology and has nothing to focus', () => {
    const root = renderChart(october);

    const svgs = [...root.querySelectorAll(':scope > div > svg')];
    expect(svgs.length).toBeGreaterThanOrEqual(2);
    for (const svg of svgs) {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg).toHaveAttribute('focusable', 'false');
    }
    expect(root.querySelectorAll('a, button, input, select, [tabindex]')).toHaveLength(0);
  });
});

// T11: AC10, the chart draws only an axis of the contract's shape, and only values on it (#55, #124 d).
describe('SavingSummaryChart rejects', () => {
  it.each<[string, number[]]>([
    ['4 ticks', [0, 15_000, 30_000, 45_000]],
    ['11 ticks', [-90_000, -75_000, -60_000, -45_000, -30_000, -15_000, 0, 15_000, 30_000, 45_000, 60_000]],
    ['ticks without $0', [-29_000, -14_000, 1_000, 16_000, 31_000, 46_000, 61_000]],
    ['unequal steps', [-30_000, -15_000, 0, 15_000, 30_000, 45_000, 70_000]],
    ['descending ticks', [60_000, 45_000, 30_000, 15_000, 0, -15_000, -30_000]],
    ['a value above the top', [-37_500, -25_000, -12_500, 0, 12_500, 25_000, 37_500, 50_000]],
    ['a value below the lowest', [-15_000, 0, 15_000, 30_000, 45_000, 60_000]],
  ])('throws a RangeError for %s', (_case, ticks) => {
    expect(() => render(<SavingSummaryChart title={TITLE} days={october.days} ticks={ticks.map(usd)} />)).toThrow(
      RangeError,
    );
  });
});

// Code review: Vitest's CSS-module stub answers any class name, so a class the module does not define would pass every
// test above and be `undefined` in the build. Each class the chart uses has a rule in its module.
describe('SavingSummaryChart classes', () => {
  const folder = resolve(import.meta.dirname, '../../src/components/SavingSummaryChart');
  const used = [
    ...new Set(
      [...readFileSync(resolve(folder, 'SavingSummaryChart.tsx'), 'utf8').matchAll(/styles\.(\w+)/g)].map((m) => m[1]!),
    ),
  ];
  const css = readFileSync(resolve(folder, 'SavingSummaryChart.module.css'), 'utf8');
  /** The class names a rule's selector names: `.lastMonth,` and `.thisMonth {` alike. */
  const defined = new Set([...css.matchAll(/\.([A-Za-z]\w*)\b(?=[^{}]*\{)/g)].map((m) => m[1]!));

  it('finds the classes the chart uses', () => {
    expect(used.length).toBeGreaterThan(5);
  });

  it.each(used)('defines .%s in SavingSummaryChart.module.css', (name) => {
    expect(defined.has(name)).toBe(true);
  });
});
