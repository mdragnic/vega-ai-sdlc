import { type ExpenseLineItem, formatDate, formatMoney } from '@finebank/shared';

import { browserTimeZone } from '../../api/client';
import styles from './ExpensesLineItem.module.css';

type ExpensesLineItemProps = {
  /** One of a category's most recent Complete expenses of this month, as the backend sent it (#61). */
  item: ExpenseLineItem;
};

/**
 * One line item of an Expenses card (109 draws it inside `Expenses Breakdown`): the item name at the left, centred on
 * the item; at the right, right-aligned, the amount with no sign (every amount on the card is an expense, #122 b, a
 * named exception to #19) over the date in the browser's zone (`14 Oct, 2026`, #11, #54) in a `time` with its ISO
 * value. The name wraps inside its column beside them (#106, #115 b); nothing is cut. Not clickable (#29). Formats as
 * sent; calculates nothing (#11).
 */
export function ExpensesLineItem({ item }: ExpensesLineItemProps) {
  const { item: name, amount, occurredAt } = item;

  return (
    <li className={styles.item}>
      <p className={styles.name}>{name}</p>
      <div className={styles.right}>
        <p className={styles.amount}>{formatMoney(amount)}</p>
        <p className={styles.date}>
          <time dateTime={occurredAt}>{formatDate(occurredAt, browserTimeZone())}</time>
        </p>
      </div>
    </li>
  );
}
