import { formatMoney, type Money } from '@finebank/shared';

import styles from './AmountBox.module.css';

type AmountBoxProps = {
  amount: Money;
  /** `compact` in 104 Upcoming Bill, `large` in 108 Bills. */
  size: 'compact' | 'large';
};

/**
 * The bordered amount box of the bill rows, `$150.00` (#11; Figma's `$150` predates it). The Figma width is
 * the minimum: a longer amount widens the box and stays on one line.
 */
export function AmountBox({ amount, size }: AmountBoxProps) {
  return <span className={`${styles.box} ${styles[size]}`}>{formatMoney(amount)}</span>;
}
