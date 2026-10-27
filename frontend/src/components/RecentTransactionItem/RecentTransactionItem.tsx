import { formatDate, formatSignedMoney, type RecentTransactionRow } from '@finebank/shared';

import { browserTimeZone } from '../../api/client';
import { CategoryIcon } from '../CategoryIcon/CategoryIcon';
import styles from './RecentTransactionItem.module.css';

type RecentTransactionItemProps = {
  /** One transaction as the backend sent it (#19, #40). */
  transaction: RecentTransactionRow;
  /** The Gray/06 divider under the row: every row but the last. */
  divided: boolean;
};

/**
 * Figma component `Item` (407:5649), one row of the Overview Recent Transaction card (104): the category icon on its
 * gray tile, the wallet for income (#56), named by the category, since the row shows no category text; the item over
 * the shop; and at the right the signed amount over the date in the browser's zone (#11, #19, #54). Where the text and
 * the right column do not fit side by side, the right column moves under the text, right-aligned, and a long item or
 * shop wraps (#111 a; Marko's notes for task 016). Nothing in the row is focusable or clickable (no row action is
 * designed). The amount and the date are formatted as sent; nothing is calculated here (#11).
 */
export function RecentTransactionItem({ transaction, divided }: RecentTransactionItemProps) {
  return (
    <li className={divided ? `${styles.row} ${styles.divided}` : styles.row}>
      <CategoryIcon category={transaction.category} variant="recent" />
      <div className={styles.body}>
        <div className={styles.text}>
          <p className={styles.item}>{transaction.item}</p>
          <p className={styles.shop}>{transaction.shopName}</p>
        </div>
        <div className={styles.end}>
          <p className={styles.amount}>{formatSignedMoney(transaction.amount, transaction.direction)}</p>
          <time className={styles.date} dateTime={transaction.occurredAt}>
            {formatDate(transaction.occurredAt, browserTimeZone())}
          </time>
        </div>
      </div>
    </li>
  );
}
