import { formatCompactMoney, formatMoney, type Money } from '@finebank/shared';
import { VisuallyHidden } from 'radix-ui';

import styles from './ComparisonBarChart.module.css';
import {
  AXIS_LABEL_RIGHT,
  barBottom,
  barPath,
  CURRENT_BAR_X,
  GRID_LEFT,
  GRID_LINE,
  GROUP_CENTER,
  groupPosition,
  lineCenter,
  PLOT_RIGHT,
  plotHeight,
  PREVIOUS_BAR_X,
  TICK_COUNT,
  xLabelBaseline,
} from './geometry';

/** One period: its name ("Last week", "This year") and one value per label; `null` for a period still to come. */
type Series = { name: string; values: (Money | null)[] };

type ComparisonBarChartProps = {
  /** The accessible name: the caption of the table that carries the data. */
  title: string;
  /** One x-axis label per group, in order ("19 Mon", "Jan"). */
  labels: string[];
  /** The earlier period, drawn in Gray/05. */
  previous: Series;
  /** The current period, drawn in Primary. */
  current: Series;
  /** The y-axis ticks from the backend's `axisTicks`, ascending from $0 (#55, #91). */
  ticks: Money[];
};

/**
 * The top tick, which every bar is measured against. The labels come from all the ticks, so they must have the
 * shape of `axisTicks`: five, from $0, in equal steps above $0 (#55), which is also what the chart's box fits.
 */
function axisTop(ticks: Money[]): Money {
  const step = ticks[1]?.cents ?? 0;
  const top = ticks.at(-1);
  if (
    top === undefined ||
    step <= 0 ||
    ticks.length !== TICK_COUNT ||
    ticks.some((tick, index) => tick.cents !== index * step)
  ) {
    const cents = ticks.map((tick) => tick.cents).join(', ');
    throw new RangeError(`A chart axis has ${TICK_COUNT} ticks from $0 in equal steps, got ${cents}`);
  }
  return top;
}

/** A period has one value per label, each from $0 to the top tick. */
function checkSeries({ name, values }: Series, labelCount: number, top: Money) {
  if (values.length !== labelCount) {
    throw new RangeError(`${name} has ${values.length} values for ${labelCount} labels`);
  }
  for (const value of values) {
    if (value !== null && (value.cents < 0 || value.cents > top.cents)) {
      throw new RangeError(`${name} has ${value.cents} cents, outside the axis from 0 to ${top.cents}`);
    }
  }
}

/**
 * The bar chart of 104 Statistics and 109 Monthly Comparison: per label a Gray/05 bar for the earlier period
 * and a Primary bar for the current one, on a linear axis with the ticks it is given (#20, #29, #55). It draws
 * and computes nothing else (#11). No interaction (#20). The SVG is hidden from assistive technology; a visually
 * hidden table carries the data, values in `formatMoney`.
 */
export function ComparisonBarChart({ title, labels, previous, current, ticks }: ComparisonBarChartProps) {
  const top = axisTop(ticks);
  checkSeries(previous, labels.length, top);
  checkSeries(current, labels.length, top);

  const rows = ticks.length - 1;
  const bar = (value: Money | null, x: number, className: string | undefined) =>
    value === null || value.cents === 0 ? null : (
      <path className={className} d={barPath(x, barBottom(rows), (value.cents / top.cents) * plotHeight(rows))} />
    );

  return (
    <div className={styles.chart}>
      <VisuallyHidden.Root asChild>
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <td />
              <th scope="col">{previous.name}</th>
              <th scope="col">{current.name}</th>
            </tr>
          </thead>
          <tbody>
            {labels.map((label, index) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{formatOptional(previous.values[index])}</td>
                <td>{formatOptional(current.values[index])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden.Root>

      <svg className={styles.plot} aria-hidden="true" focusable="false">
        {ticks.map((tick, index) => {
          const y = lineCenter(rows - index);
          return (
            <g key={tick.cents}>
              <line className={styles.gridLine} x1={GRID_LEFT} x2={PLOT_RIGHT} y1={y} y2={y} strokeWidth={GRID_LINE} />
              <text className={styles.yLabel} x={AXIS_LABEL_RIGHT} y={y} textAnchor="end" dominantBaseline="central">
                {formatCompactMoney(tick)}
              </text>
            </g>
          );
        })}
        {labels.map((label, index) => {
          const { percent, offset } = groupPosition(index, labels.length);
          return (
            <svg key={label} x={`${percent}%`} overflow="visible">
              <g transform={`translate(${offset})`}>
                {bar(previous.values[index] ?? null, PREVIOUS_BAR_X, styles.previous)}
                {bar(current.values[index] ?? null, CURRENT_BAR_X, styles.current)}
                <text className={styles.xLabel} x={GROUP_CENTER} y={xLabelBaseline(rows)} textAnchor="middle">
                  {label}
                </text>
              </g>
            </svg>
          );
        })}
      </svg>
    </div>
  );
}

/** A table cell's amount; empty for a period still to come. */
function formatOptional(value: Money | null | undefined): string {
  return value ? formatMoney(value) : '';
}
