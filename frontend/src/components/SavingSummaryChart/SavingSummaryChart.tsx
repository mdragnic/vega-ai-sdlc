import {
  formatChartDayLabel,
  formatCompactMoney,
  formatMoney,
  type Money,
  type SavingSummaryDay,
  SIGNED_AXIS_MAX_TICKS,
  SIGNED_AXIS_MIN_TICKS,
} from '@finebank/shared';
import { VisuallyHidden } from 'radix-ui';
import { useId } from 'react';

import styles from './SavingSummaryChart.module.css';
import {
  areaPath,
  AXIS_LABEL_RIGHT,
  DASH,
  DASH_GAP,
  dayPercent,
  FILL_GRADIENT,
  FILL_STOP_BOTTOM,
  FILL_STOP_MIDDLE,
  FILL_STOP_TOP,
  GRID_DAYS,
  GRID_LINE,
  LINES_WIDTH,
  linePath,
  linesViewBox,
  PLOT_HEIGHT,
  TICK_TOP,
  tickY,
  valueY,
  X_LABEL_BASELINE,
} from './geometry';

type SavingSummaryChartProps = {
  /** The accessible name: the caption of the table that carries the data. */
  title: string;
  /** Every day of the month from the 1st, as the backend sent them (#42, #59). */
  days: SavingSummaryDay[];
  /** The y-axis from the backend's `signedAxisTicks`, ascending (#55, #68, #72, #124 d). */
  ticks: Money[];
};

/**
 * The lowest and the highest tick. The labels come from all the ticks and the lines from the lowest and the highest, so
 * the ticks must have the contract's shape: 5 to 10, ascending in equal steps, $0 among them.
 */
function axisRange(ticks: Money[]): { lowest: number; highest: number } {
  const step = (ticks[1]?.cents ?? 0) - (ticks[0]?.cents ?? 0);
  const zeroAt = ticks.findIndex((tick) => tick.cents === 0);
  if (
    ticks.length < SIGNED_AXIS_MIN_TICKS ||
    ticks.length > SIGNED_AXIS_MAX_TICKS ||
    step <= 0 ||
    zeroAt < 0 ||
    ticks.some((tick, index) => tick.cents !== (index - zeroAt) * step)
  ) {
    const cents = ticks.map((tick) => tick.cents).join(', ');
    throw new RangeError(
      `A Saving Summary axis has ${SIGNED_AXIS_MIN_TICKS} to ${SIGNED_AXIS_MAX_TICKS} equal steps through $0, got ${cents}`,
    );
  }
  return { lowest: ticks[0]!.cents, highest: ticks.at(-1)!.cents };
}

/** A line's values from the 1st up to its first null (#55: no point after today; #124 a: no day the month lacks). */
function valuesUntilNull(values: (Money | null)[]): Money[] {
  const end = values.indexOf(null);
  return (end < 0 ? values : values.slice(0, end)).filter((value): value is Money => value !== null);
}

/**
 * The line chart of 110 Saving Summary (#42, #59): the month before as a dashed Gray/05 line, drawn first, and this
 * month as a 2px Primary line over a Primary fill fading to the plot's bottom (#124 f), each a monotone cubic through one
 * point per day, the 1st at the plot's left and the last day at its right (#124 b); the y labels on the ticks it is
 * given, spread evenly over its fixed height (#124 c); x labels and grid lines on days 1, 5 ... 30. It draws what it is
 * sent and calculates no amount, day or month, only the drawing's positions (#11). No markers and no interaction (not
 * designed). The SVGs are hidden from assistive technology; a visually hidden table carries the data, amounts in
 * `formatMoney`, an empty cell where a line has no point.
 */
export function SavingSummaryChart({ title, days, ticks }: SavingSummaryChartProps) {
  const gradientId = useId();
  const { lowest, highest } = axisRange(ticks);
  for (const { thisMonth, lastMonth } of days) {
    for (const value of [thisMonth, lastMonth]) {
      if (value !== null && (value.cents < lowest || value.cents > highest)) {
        throw new RangeError(`A value of ${value.cents} cents is outside the axis from ${lowest} to ${highest}`);
      }
    }
  }
  if (days.length < 2) throw new RangeError(`A month has more than one day, got ${days.length}`);

  const y = (money: Money) => valueY(money.cents, lowest, highest);
  const thisMonth = valuesUntilNull(days.map((day) => day.thisMonth)).map(y);
  const lastMonth = valuesUntilNull(days.map((day) => day.lastMonth)).map(y);
  const thisMonthLine = linePath(thisMonth);
  const gridDays = GRID_DAYS.filter((day) => day <= days.length).map((day) => ({
    label: formatChartDayLabel(days[day - 1]!.date),
    x: `${dayPercent(day - 1, days.length)}%`,
  }));

  return (
    <div className={styles.chart}>
      {/* The hidden styles on a block around the table: a table's box is at least as tall as its 28 to 31 rows, so
          on the table itself its 1px height and overflow would not hold, and it would lengthen the page. */}
      <VisuallyHidden.Root asChild>
        <div>
          <table>
            <caption>{title}</caption>
            <thead>
              <tr>
                <td />
                <th scope="col">This month</th>
                <th scope="col">Same period last month</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.date}>
                  <th scope="row">{formatChartDayLabel(day.date)}</th>
                  <td>{day.thisMonth ? formatMoney(day.thisMonth) : ''}</td>
                  <td>{day.lastMonth ? formatMoney(day.lastMonth) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </VisuallyHidden.Root>

      <svg className={styles.axis} aria-hidden="true" focusable="false">
        {ticks.map((tick, index) => (
          <text
            key={tick.cents}
            className={styles.yLabel}
            x={AXIS_LABEL_RIGHT}
            y={tickY(index, ticks.length)}
            textAnchor="end"
            dominantBaseline="central"
          >
            {formatCompactMoney(tick)}
          </text>
        ))}
      </svg>

      <svg className={styles.plot} aria-hidden="true" focusable="false">
        {gridDays.map(({ label, x }) => (
          <g key={label}>
            <line
              className={styles.gridLine}
              x1={x}
              x2={x}
              y1={TICK_TOP}
              y2={TICK_TOP + PLOT_HEIGHT}
              strokeWidth={GRID_LINE}
            />
            <text className={styles.xLabel} x={x} y={X_LABEL_BASELINE} textAnchor="middle">
              {label}
            </text>
          </g>
        ))}
        <svg
          className={styles.lines}
          y={TICK_TOP}
          width={LINES_WIDTH}
          height={PLOT_HEIGHT}
          viewBox={linesViewBox(days.length)}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradientId} {...FILL_GRADIENT}>
              <stop className={styles.fillTop} offset={FILL_STOP_TOP} />
              <stop className={styles.fillMiddle} offset={FILL_STOP_MIDDLE} />
              <stop className={styles.fillBottom} offset={FILL_STOP_BOTTOM} />
            </linearGradient>
          </defs>
          {lastMonth.length > 0 && (
            <path className={styles.lastMonth} d={linePath(lastMonth)} strokeDasharray={`${DASH} ${DASH_GAP}`} />
          )}
          {thisMonth.length > 1 && (
            <path className={styles.fill} d={areaPath(thisMonthLine, thisMonth.length)} fill={`url(#${gradientId})`} />
          )}
          {thisMonth.length > 0 && (
            <path
              className={thisMonth.length > 1 ? styles.thisMonth : `${styles.thisMonth} ${styles.point}`}
              d={thisMonthLine}
            />
          )}
        </svg>
      </svg>
    </div>
  );
}
