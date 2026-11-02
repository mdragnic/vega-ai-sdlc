import { accountTypeLabel, formatDate, formatSignedMoney, type TransactionRow } from '@finebank/shared';
import type { Ref } from 'react';

import { browserTimeZone } from '../../api/client';
import { CategoryIcon } from '../CategoryIcon/CategoryIcon';
import styles from './TransactionItem.module.css';

type TransactionItemProps = {
  /** One transaction as the backend sent it (#19, #57). */
  transaction: TransactionRow;
  /** The Gray/06 divider under the row: every row but the last. */
  divided: boolean;
  /**
   * The first row a "Load More" added, which takes focus when it arrives: focusable by script only, never a Tab stop
   * (#117 a).
   */
  focusTarget?: boolean;
  ref?: Ref<HTMLTableRowElement>;
};

/**
 * Figma component `Transaction item` (411:5582), one row of the Transactions table (107): the category icon, the
 * wallet for income (#56), named by the category, since the row shows no category text, and the item; the shop; the
 * date in the browser's zone (#11, #54); the Payment Method, the account's type (#57); and the signed amount (#19).
 * Each cell's text starts on the row's first line; the item, the shop, the date and the Payment Method wrap inside
 * their columns and the row grows, the amount stays on one line (#106, #111 a, #115 b). Nothing in the row is
 * clickable (no row action is designed). Everything is formatted as sent; nothing is calculated here (#11).
 */
export function TransactionItem({ transaction, divided, focusTarget = false, ref }: TransactionItemProps) {
  return (
    <tr
      ref={ref}
      tabIndex={focusTarget ? -1 : undefined}
      className={divided ? `${styles.row} ${styles.divided}` : styles.row}
    >
      <td className={styles.items}>
        <span className={styles.itemCell}>
          <CategoryIcon category={transaction.category} variant="plain" />
          <span className={styles.item}>{transaction.item}</span>
        </span>
      </td>
      <td className={styles.text}>{transaction.shopName}</td>
      <td className={styles.text}>
        <time dateTime={transaction.occurredAt}>{formatDate(transaction.occurredAt, browserTimeZone())}</time>
      </td>
      <td className={styles.text}>{accountTypeLabel(transaction.paymentMethod)}</td>
      <td className={styles.amount}>{formatSignedMoney(transaction.amount, transaction.direction)}</td>
    </tr>
  );
}
