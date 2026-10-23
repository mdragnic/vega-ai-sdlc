import { formatDateBox } from '@finebank/shared';

import styles from './DateBox.module.css';

type DateBoxProps = {
  /** A plain date `YYYY-MM-DD`, such as a bill's due date. */
  date: string;
  /** `compact` in 104 Upcoming Bill, `large` in 108 Bills. */
  size: 'compact' | 'large';
};

/** The gray date box: the 3-letter month over the two-digit day, `May` over `15`, `Sep` over `05` (#88). */
export function DateBox({ date, size }: DateBoxProps) {
  const { month, day } = formatDateBox(date);

  return (
    <time dateTime={date} className={`${styles.box} ${styles[size]}`}>
      <span className={styles.month}>{month}</span>
      <span className={styles.day}>{day}</span>
    </time>
  );
}
