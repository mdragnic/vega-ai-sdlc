import { formatDate, type UpcomingBillsResponse } from '@finebank/shared';

import { AmountBox } from '../AmountBox/AmountBox';
import { DateBox } from '../DateBox/DateBox';
import { UpcomingBillLogo } from '../UpcomingBillLogo/UpcomingBillLogo';
import styles from './UpcomingBill.module.css';

type UpcomingBillProps = {
  /** The upcoming bills, soonest first, as the backend sent them (#28, #41). */
  data: UpcomingBillsResponse;
};

/**
 * The content of the Overview Upcoming Bill card (104, Figma section `Upcoming Bill` 405:5530; the rows `Bill one`,
 * no component): a list of the first 2 bills sent (#28), each the due date's box, the logo, the title, "Last Charge -
 * <date>" and the amount box at the right; the Gray/06 divider between two rows. Where the text and the amount box
 * do not fit side by side, the amount box moves under the text, right-aligned, and a long title or date wraps (#111
 * a). The rows hold no action (#28). The dates and the amounts are formatted as sent; nothing is calculated here
 * (#11).
 */
export function UpcomingBill({ data }: UpcomingBillProps) {
  return (
    <ul className={styles.list}>
      {data.bills.slice(0, 2).map((bill, index) => (
        // No ID in the contract (#28: no route takes a bill): the row's position is its key.
        <li key={index} className={index === 0 ? styles.row : `${styles.row} ${styles.divided}`}>
          <DateBox date={bill.dueDate} size="compact" />
          <div className={styles.body}>
            <div className={styles.text}>
              <UpcomingBillLogo logo={bill.logo} />
              <p className={styles.title}>{bill.title}</p>
              <p className={styles.lastCharge}>
                Last Charge - <time dateTime={bill.lastChargeDate}>{formatDate(bill.lastChargeDate)}</time>
              </p>
            </div>
            <AmountBox amount={bill.amount} size="compact" />
          </div>
        </li>
      ))}
    </ul>
  );
}
