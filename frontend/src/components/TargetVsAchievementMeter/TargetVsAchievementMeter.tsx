import { formatCompactMoney, type Money } from '@finebank/shared';
import { useId } from 'react';

import {
  arcPath,
  CENTER_X,
  CENTER_Y,
  DOT_RADIUS,
  LIMIT_BASELINE,
  LIMIT_MAX_X,
  LIMIT_MIN_X,
  NEEDLE_POINTS,
  needleRotation,
  STROKE_WIDTH,
  TRACK_PATH,
  VALUE_BASELINE,
  VIEW_BOX,
} from './geometry';
import styles from './TargetVsAchievementMeter.module.css';

/** The gauge's minimum label: always $0. */
const ZERO: Money = { cents: 0, currency: 'USD' };

type TargetVsAchievementMeterProps = {
  /** The amount saved so far, shown in the center (#18). */
  present: Money;
  /** The goal, shown at the right end (#18). */
  target: Money;
  /** Present / Target from 0 to 1, from the backend's `goalProgress` (#11, #31). */
  progress: number;
};

/**
 * The gauge of 104 Goals and 110 Savings Goal (Figma frame `Target vs Achievement Meter`): a Gray/05 half circle
 * with a Primary arc and needle at the progress it is given, `$0` and the Target under the ends, the Present
 * between them, in the compact format (#11, #18, #31). A meter named by its caption; the drawing is hidden.
 */
export function TargetVsAchievementMeter({ present, target, progress }: TargetVsAchievementMeterProps) {
  if (!(progress >= 0 && progress <= 1)) {
    throw new RangeError(`A goal progress is from 0 to 1, got ${progress}`);
  }
  const captionId = useId();
  const value = formatCompactMoney(present);

  return (
    <div
      role="meter"
      aria-labelledby={captionId}
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={progress}
      aria-valuetext={value}
      className={styles.meter}
    >
      <svg className={styles.gauge} viewBox={VIEW_BOX} aria-hidden="true" focusable="false">
        <path className={styles.track} d={TRACK_PATH} strokeWidth={STROKE_WIDTH} strokeLinecap="round" />
        {progress > 0 && (
          <path className={styles.progress} d={arcPath(progress)} strokeWidth={STROKE_WIDTH} strokeLinecap="round" />
        )}
        <polygon
          className={styles.needle}
          points={NEEDLE_POINTS}
          transform={`rotate(${needleRotation(progress)} ${CENTER_X} ${CENTER_Y})`}
        />
        <circle className={styles.dot} cx={CENTER_X} cy={CENTER_Y} r={DOT_RADIUS} />
        <text className={styles.limitMin} x={LIMIT_MIN_X} y={LIMIT_BASELINE} textAnchor="middle">
          {formatCompactMoney(ZERO)}
        </text>
        <text className={styles.value} x={CENTER_X} y={VALUE_BASELINE} textAnchor="middle">
          {value}
        </text>
        <text className={styles.limitMax} x={LIMIT_MAX_X} y={LIMIT_BASELINE} textAnchor="middle">
          {formatCompactMoney(target)}
        </text>
      </svg>
      <p id={captionId} className={styles.caption}>
        Target vs Achievement
      </p>
    </div>
  );
}
