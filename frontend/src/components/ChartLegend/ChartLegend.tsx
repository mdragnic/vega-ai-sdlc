import styles from './ChartLegend.module.css';

type ChartLegendProps = {
  /** The current period's label, shown first with the Primary swatch: "This week", "This year". */
  current: string;
  /** The earlier period's label, with the Gray/05 swatch: "Last week", "Last year". */
  previous: string;
};

/**
 * The legend at the right of a chart card's header row (104 Statistics, 109 Monthly Comparison, 110 Saving
 * Summary). Each label follows a swatch in its series color; the text keeps the Secondary text color (dataviz).
 */
export function ChartLegend({ current, previous }: ChartLegendProps) {
  return (
    <ul className={styles.legend}>
      <li className={styles.item}>
        <span className={`${styles.swatch} ${styles.current}`} aria-hidden="true" />
        {current}
      </li>
      <li className={styles.item}>
        <span className={`${styles.swatch} ${styles.previous}`} aria-hidden="true" />
        {previous}
      </li>
    </ul>
  );
}
