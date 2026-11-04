import { SIGNED_AXIS_MIN_TICKS } from '@finebank/shared';

import { GRID_DAYS } from '../SavingSummaryChart/geometry';
import { Skeleton } from '../Skeleton/Skeleton';
import styles from './SavingSummaryChartSkeleton.module.css';

/**
 * The loading skeleton of `SavingSummaryChart` for `DataState` (#6). Not designed: in the chart's box, so nothing moves
 * when the data arrives, lines in the y labels' column, a block in the plot's place and a line under it in each x
 * label's place. No text. `DataState` hides it from assistive technology.
 */
export function SavingSummaryChartSkeleton() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.axis}>
        {Array.from({ length: SIGNED_AXIS_MIN_TICKS }, (_, line) => (
          <Skeleton key={line} shape="text" className={styles.axisLabel} />
        ))}
      </div>
      <div className={styles.plot}>
        <Skeleton shape="block" className={styles.area} />
        <div className={styles.days}>
          {GRID_DAYS.map((day) => (
            <Skeleton key={day} shape="text" className={styles.dayLabel} />
          ))}
        </div>
      </div>
    </div>
  );
}
