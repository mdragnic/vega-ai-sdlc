/**
 * The gauge's internal geometry in viewBox units, which are CSS px: the SVG is sized by the tokens
 * `--size-gauge-width` and `--size-gauge-height` (#92). Measured on PNG 104 Goals and 110 Savings Goal at 2x,
 * halved. Angles are in radians from the right end, counterclockwise, as in Math.cos and Math.sin.
 */

/** The arc's outer edge: a circle 128 across (104: radius 128.1 at 2x, ink x 1744 to 1999). */
export const GAUGE_WIDTH = 128;
/** The arc's top to the bottom of the center value's text. */
export const GAUGE_HEIGHT = 92;
export const VIEW_BOX = `0 0 ${GAUGE_WIDTH} ${GAUGE_HEIGHT}`;

/** The track's and the Primary arc's width (104: 25 px at 2x). */
export const STROKE_WIDTH = 12.5;
const OUTER_RADIUS = GAUGE_WIDTH / 2;
/** The arc's center line, half a stroke inside the outer edge. */
export const ARC_RADIUS = OUTER_RADIUS - STROKE_WIDTH / 2;
export const CENTER_X = OUTER_RADIUS;
export const CENTER_Y = OUTER_RADIUS;

/** The round caps end on the horizontal through the center: each end of the arc starts half a stroke above it. */
const CAP_ANGLE = Math.asin(STROKE_WIDTH / 2 / ARC_RADIUS);
const START_ANGLE = Math.PI - CAP_ANGLE;
const END_ANGLE = CAP_ANGLE;
/** Path flags for the arc: never more than half a circle, drawn clockwise over the top. */
const ARC_FLAGS = '0 0 1';

/** The dot the needle turns on (104: 24 px at 2x). */
export const DOT_RADIUS = 6;
/** The tapered needle, pointing right before it turns (104: tip 81 px from the center at 2x, base about 12 px). */
const NEEDLE_LENGTH = 41;
const NEEDLE_BASE = 6;
export const NEEDLE_POINTS = [
  [CENTER_X, CENTER_Y - NEEDLE_BASE / 2],
  [CENTER_X + NEEDLE_LENGTH, CENTER_Y],
  [CENTER_X, CENTER_Y + NEEDLE_BASE / 2],
]
  .map((point) => point.join(','))
  .join(' ');
/** Degrees in half a turn: the needle sweeps them from the left end to the right end. */
const HALF_TURN_DEGREES = 180;

/** Baselines of the labels under the arc (104: `$0` and `$20k` glyphs end at y 628, `12K` at y 632, at 2x). */
export const LIMIT_BASELINE = 86;
export const VALUE_BASELINE = 88;

/** The point on the arc's center line a `fraction` of the way from its left end to its right end. */
function arcPoint(fraction: number): { x: number; y: number } {
  const angle = START_ANGLE + fraction * (END_ANGLE - START_ANGLE);
  return { x: CENTER_X + ARC_RADIUS * Math.cos(angle), y: CENTER_Y - ARC_RADIUS * Math.sin(angle) };
}

/** The arc from the left end over a `fraction` of the track, clockwise; the whole track at 1. */
export function arcPath(fraction: number): string {
  const start = arcPoint(0);
  const end = arcPoint(fraction);
  return `M${start.x},${start.y}A${ARC_RADIUS},${ARC_RADIUS} ${ARC_FLAGS} ${end.x},${end.y}`;
}

/** The Gray/05 track: the whole half circle. */
export const TRACK_PATH = arcPath(1);

/** The limit labels are centered under the arc's ends. */
export const LIMIT_MIN_X = arcPoint(0).x;
export const LIMIT_MAX_X = arcPoint(1).x;

/** The needle's turn in degrees, clockwise from pointing right: left at 0, up at 0.5, right at 1. */
export function needleRotation(progress: number): number {
  return HALF_TURN_DEGREES * progress - HALF_TURN_DEGREES;
}
