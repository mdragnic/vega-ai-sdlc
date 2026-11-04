/**
 * The Saving Summary line chart's internal geometry in SVG user units, which are CSS px (#92), measured on PNG 110 at
 * 2x and halved. The chart is a row of two SVGs: the y labels' column (`AXIS_WIDTH`, the token
 * `--size-saving-summary-axis-width`) and the plot, which takes the rest of the width (#94). In the plot, x positions
 * are percentages of its width, y positions px from the chart box's top; the lines sit in a nested SVG whose x units
 * are the month's days from 0 and whose y units are px, stretched over the plot's width.
 */

/** The chart's box, the token `--size-saving-summary-chart-height`: the 32 header row's end to the x labels' descent. */
export const CHART_HEIGHT = 216;

/** The y labels' column, the token `--size-saving-summary-axis-width`: the plot starts here (110: the line at x 792). */
export const AXIS_WIDTH = 72;
/** The y labels end here, right-aligned (110: x 766.5, 46.5 from the content's edge; 48 as the bar chart's). */
export const AXIS_LABEL_RIGHT = 48;

/** The top tick's centre under the box's top (110: the top label's centre y 241.5, the header row ending at 204). */
export const TICK_TOP = 37.5;
/** From the top tick to the lowest, whatever their count (110: 4 labels, y 241.5 to 391.5; #124 c). */
export const PLOT_HEIGHT = 150;
/** The x labels' baseline under the lowest tick (110: the baseline about y 414.5). */
const X_LABEL_GAP = 23;
export const X_LABEL_BASELINE = TICK_TOP + PLOT_HEIGHT + X_LABEL_GAP;

/** The 1px Gray/05 vertical grid line (110: 2 px at 2x). */
export const GRID_LINE = 1;
/** The days that carry an x label and a grid line, where the month has them (#124 b). */
export const GRID_DAYS = [1, 5, 10, 15, 20, 25, 30] as const;

/** The dashed line's dash and gap (110: 12 and 4 px at 2x along a flat stretch, square ends). */
export const DASH = 6;
export const DASH_GAP = 2;

/** The nested SVG of the lines spans the plot's whole width. */
export const LINES_WIDTH = '100%';

/** The fill's gradient runs top to bottom over the area's box. */
export const FILL_GRADIENT = { x1: 0, y1: 0, x2: 0, y2: 1 } as const;

/** The fill's gradient stops, from the area's top to the plot's bottom (110's fade: about 35%, 14% halfway, 0). */
export const FILL_STOP_TOP = 0;
export const FILL_STOP_MIDDLE = 0.5;
export const FILL_STOP_BOTTOM = 1;

/** Decimals kept in path coordinates: far below a device pixel. */
const PATH_DECIMALS = 3;

/** The centre of the tick at `index` of `count`, ascending from the lowest: spread evenly over the plot (#124 c). */
export function tickY(index: number, count: number): number {
  return TICK_TOP + ((count - 1 - index) / (count - 1)) * PLOT_HEIGHT;
}

/** The x of the day at `index` of `count` as a percentage of the plot's width: the 1st at 0, the last day at 100. */
export function dayPercent(index: number, count: number): number {
  return (index / (count - 1)) * 100;
}

/** The nested SVG's units: the month's days from 0 across, px down from the top tick to the lowest. */
export function linesViewBox(dayCount: number): string {
  return `0 0 ${dayCount - 1} ${PLOT_HEIGHT}`;
}

/** A value's y inside the plot, from 0 at the top tick to `PLOT_HEIGHT` at the lowest: a drawing position only. */
export function valueY(cents: number, lowest: number, highest: number): number {
  return ((highest - cents) / (highest - lowest)) * PLOT_HEIGHT;
}

const round = (value: number) => Number(value.toFixed(PATH_DECIMALS));
const point = (x: number, y: number) => `${round(x)},${round(y)}`;

/**
 * The tangents of a monotone cubic through points one x unit apart (Fritsch-Carlson, as d3's `curveMonotoneX`): 0 at a
 * peak or a dip, never steeper than three times the smaller neighbouring slope, so the curve never passes the values
 * of two neighbouring days.
 */
function monotoneTangents(ys: number[]): number[] {
  const slopes = ys.slice(1).map((y, index) => y - ys[index]!);
  const tangents = ys.map((_, index) => {
    const before = slopes[index - 1];
    const after = slopes[index];
    if (before === undefined || after === undefined) return Number.NaN;
    if (before * after <= 0) return 0;
    return (
      (Math.sign(before) + Math.sign(after)) * Math.min(Math.abs(before), Math.abs(after), Math.abs(before + after) / 4)
    );
  });
  // The ends: the slope that makes the end segment's curvature 0, as d3's.
  const last = tangents.length - 1;
  tangents[0] = slopes.length > 1 ? (3 * slopes[0]! - tangents[1]!) / 2 : (slopes[0] ?? 0);
  tangents[last] = slopes.length > 1 ? (3 * slopes.at(-1)! - tangents[last - 1]!) / 2 : (slopes.at(-1) ?? 0);
  return tangents;
}

/**
 * A smooth line through `ys`, one per day from x 0, as a path in the nested SVG's units (#124 b): a monotone cubic, so
 * no peak or dip is drawn that the data does not have. A single value is a zero-length path, which the line's round
 * cap draws as a dot.
 */
export function linePath(ys: number[]): string {
  const [first] = ys;
  if (first === undefined) return '';
  if (ys.length === 1) return `M${point(0, first)}h0`;
  const tangents = monotoneTangents(ys);
  const third = 1 / 3;
  let d = `M${point(0, first)}`;
  for (let index = 1; index < ys.length; index += 1) {
    const x0 = index - 1;
    const y0 = ys[x0]!;
    const y1 = ys[index]!;
    d += `C${point(x0 + third, y0 + tangents[x0]! * third)},${point(index - third, y1 - tangents[index]! * third)},${point(index, y1)}`;
  }
  return d;
}

/** The area under a line of `count` days, closed at the plot's bottom (#124 f). */
export function areaPath(line: string, count: number): string {
  return `${line}L${count - 1},${PLOT_HEIGHT}L0,${PLOT_HEIGHT}Z`;
}
