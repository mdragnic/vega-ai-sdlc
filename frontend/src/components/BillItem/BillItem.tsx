import { formatDate, type UpcomingBillsResponse } from '@finebank/shared';

import { billLogos } from '../../assets/brand';
import { AmountBox } from '../AmountBox/AmountBox';
import { DateBox } from '../DateBox/DateBox';
import styles from './BillItem.module.css';

type BillItemProps = {
  /** One upcoming bill as the backend sent it (#28). */
  bill: UpcomingBillsResponse['bills'][number];
  /** The Gray/06 divider under the row: every row but the last. */
  divided: boolean;
};

/**
 * Figma component `Bill item` (411:5746), one row of the Bills table (108): the due date's large box (`May` over `15`,
 * #88), the biller's logo as 108 draws it (an image named by the biller, at its own size and colors), the title
 * (Bold 18/24) over its description (Regular 14/22), the last charge date and the amount's large box at the row's
 * end, every cell centred on the row. The title, the description and the last charge wrap inside their columns and the
 * row grows; the boxes and the logo keep their sizes (#106, #111 a, #115 b). Nothing in the row is focusable or
 * clickable (#28: no bill actions). Everything is formatted as sent; nothing is calculated here (#11).
 */
export function BillItem({ bill, divided }: BillItemProps) {
  const logo = billLogos[bill.logo];

  return (
    <tr className={divided ? `${styles.row} ${styles.divided}` : styles.row}>
      <td className={styles.dueDate}>
        <DateBox date={bill.dueDate} size="large" />
      </td>
      <td className={styles.logo}>
        <img src={logo.src} alt={logo.name} className={styles.logoImage} />
      </td>
      <td className={styles.description}>
        <p className={styles.title}>{bill.title}</p>
        <p className={styles.text}>{bill.description}</p>
      </td>
      <td className={styles.lastCharge}>
        <time dateTime={bill.lastChargeDate}>{formatDate(bill.lastChargeDate)}</time>
      </td>
      <td className={styles.amount}>
        <AmountBox amount={bill.amount} size="large" />
      </td>
    </tr>
  );
}
