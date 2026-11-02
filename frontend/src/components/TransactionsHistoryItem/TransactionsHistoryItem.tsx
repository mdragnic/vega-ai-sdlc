import {
  formatDate,
  formatSignedMoney,
  type TransactionHistoryRow,
  transactionStatusLabel,
  transactionTypeLabel,
} from '@finebank/shared';
import type { Ref } from 'react';

import { browserTimeZone } from '../../api/client';
import styles from './TransactionsHistoryItem.module.css';

type TransactionsHistoryItemProps = {
  /** One row as the backend sent it (#27, #57). */
  transaction: TransactionHistoryRow;
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
 * One row of an account's Transactions History (106; no Figma component): the date in the browser's zone (#11, #54);
 * the status, every one listed (#57); the type, Credit or Debit from the direction (#27); the receipt as plain text,
 * no link or download (#27); the signed amount (#19). Each cell's text starts on the row's first line; the date and the
 * receipt wrap inside their columns and the row grows, the amount stays on one line (#106, #111 a, #115 b). Nothing in
 * the row is clickable and it has no hover style (not designed). Everything is formatted as sent (#11).
 */
export function TransactionsHistoryItem({
  transaction,
  divided,
  focusTarget = false,
  ref,
}: TransactionsHistoryItemProps) {
  return (
    <tr
      ref={ref}
      tabIndex={focusTarget ? -1 : undefined}
      className={divided ? `${styles.row} ${styles.divided}` : styles.row}
    >
      <td className={styles.date}>
        <time dateTime={transaction.occurredAt}>{formatDate(transaction.occurredAt, browserTimeZone())}</time>
      </td>
      <td className={styles.text}>{transactionStatusLabel(transaction.status)}</td>
      <td className={styles.text}>{transactionTypeLabel(transaction.direction)}</td>
      <td className={styles.text}>{transaction.receipt}</td>
      <td className={styles.amount}>{formatSignedMoney(transaction.amount, transaction.direction)}</td>
    </tr>
  );
}
