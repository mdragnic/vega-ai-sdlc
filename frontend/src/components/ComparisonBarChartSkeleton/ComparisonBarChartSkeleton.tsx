import { TICK_COUNT } from '../ComparisonBarChart/geometry';
import { Skeleton } from '../Skeleton/Skeleton';
import styles from './ComparisonBarChartSkeleton.module.css';

type ComparisonBarChartSkeletonProps = {
  /** As many groups as the chart will draw: 7 days (104), 12 months (109). */
  groups: number;
};

/**
 * The loading skeleton of `ComparisonBarChart` for `DataState` (#6). Not designed: the chart's box, so nothing
 * moves when the data arrives, with the y-axis label lines on the left and per group two bar blocks over a
 * label line. No text. `DataState` hides it from assistive technology.
 */
export function ComparisonBarChartSkeleton({ groups }: ComparisonBarChartSkeletonProps) {
  return (
    <div className={styles.skeleton}>
      <div className={styles.axis}>
        {Array.from({ length: TICK_COUNT }, (_, line) => (
          <Skeleton key={line} shape="text" className={styles.axisLabel} />
        ))}
      </div>
      <div className={styles.plot}>
        {Array.from({ length: groups }, (_, group) => (
          <div key={group} className={styles.group}>
            <div className={styles.bars}>
              <Skeleton shape="block" className={styles.bar} />
              <Skeleton shape="block" className={styles.bar} />
            </div>
            <Skeleton shape="text" className={styles.groupLabel} />
          </div>
        ))}
      </div>
    </div>
  );
}
