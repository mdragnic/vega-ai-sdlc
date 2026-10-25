/**
 * The bar chart's internal geometry in SVG user units, which are CSS px: the SVG has no viewBox because its
 * width follows the card (#92). Measured on PNG 104 Statistics and 109 Monthly Comparison at 2x, halved.
 * Rows count from the top grid line; the last row is the $0 line.
 */

/** The SVG's height, the token `--size-chart-height`: below a 24px header row, down to the x labels' descent. */
export const CHART_HEIGHT = 188;

/** Ticks on every axis: $0 and 4 equal steps (#55). The height fits their 4 rows. */
export const TICK_COUNT = 5;

/** The y labels end here, right-aligned in a 48 wide column (104: glyphs end at x 752, the content at 704). */
export const AXIS_LABEL_RIGHT = 48;
/** From the label column to the grid's left end (104: x 752 to 768). */
const AXIS_GAP = 16;
export const GRID_LEFT = AXIS_LABEL_RIGHT + AXIS_GAP;
/** The grid runs to the plot's right edge. */
export const PLOT_RIGHT = '100%';

/** The top grid line's top edge (104: y 511, 15 below the 24px header row that ends at y 496). */
export const GRID_TOP = 15;
/** Grid lines 36 apart (104: y 511, 547, 583, 619, 655). */
export const GRID_STEP = 36;
/** The 1px Gray/06 grid line. */
export const GRID_LINE = 1;

export const BAR_WIDTH = 16;
export const BAR_GAP = 8;
/** The rounded top corners; the bottom is square on the $0 line. */
const BAR_RADIUS = 4;
/** The gray bar, the gap and the teal bar. */
export const GROUP_WIDTH = BAR_WIDTH + BAR_GAP + BAR_WIDTH;
/** The bars' left edges in their group: the earlier period first. */
export const PREVIOUS_BAR_X = 0;
export const CURRENT_BAR_X = BAR_WIDTH + BAR_GAP;
/** The group's middle, where its x label is centered. */
export const GROUP_CENTER = GROUP_WIDTH / 2;

/** From the grid's left end to the first group (104: x 768 to 790; 109: x 392 to 414). */
const GROUPS_START = 22;
/** From the last group to the plot's right edge (104 and 109: x 1334 to 1384). */
const GROUPS_END = 50;

/** The x labels' baseline below the $0 line's top edge (104: line y 655, glyphs y 671 to 681). */
const X_LABEL_BASELINE = 26;

/** Path flags for a corner arc: the small arc, drawn clockwise. */
const CORNER_ARC = '0 0 1';

/** The top edge of a grid line. */
export function lineTop(row: number): number {
  return GRID_TOP + row * GRID_STEP;
}

/** The middle of a grid line, where the line is stroked and its y label is centered. */
export function lineCenter(row: number): number {
  return lineTop(row) + GRID_LINE / 2;
}

/** The plot's height: the top line to the $0 line, 144 with 5 ticks. A bar of the top tick's value is as high. */
export function plotHeight(rows: number): number {
  return rows * GRID_STEP;
}

/** Where the bars stand: the $0 line's lower edge, so a bar covers the line, as in 104. */
export function barBottom(rows: number): number {
  return lineTop(rows) + GRID_LINE;
}

/** The x labels' baseline. */
export function xLabelBaseline(rows: number): number {
  return lineTop(rows) + X_LABEL_BASELINE;
}

/**
 * A group's left edge, spread evenly between GROUPS_START and GROUPS_END so the pitch follows the plot width
 * (84 for 7 groups in 680, 80 for 12 in 1056): a percentage of the plot width plus a fixed offset.
 */
export function groupPosition(index: number, count: number): { percent: number; offset: number } {
  const share = count > 1 ? index / (count - 1) : 0;
  const first = GRID_LEFT + GROUPS_START;
  return { percent: share * 100, offset: first - share * (first + GROUPS_END + GROUP_WIDTH) };
}

/** A bar standing on `bottom`, `height` high, with rounded top corners and a square bottom (dataviz). */
export function barPath(x: number, bottom: number, height: number): string {
  const radius = Math.min(BAR_RADIUS, height);
  const top = bottom - height;
  const right = x + BAR_WIDTH;
  return (
    `M${x},${bottom}V${top + radius}` +
    `A${radius},${radius} ${CORNER_ARC} ${x + radius},${top}H${right - radius}` +
    `A${radius},${radius} ${CORNER_ARC} ${right},${top + radius}V${bottom}Z`
  );
}
