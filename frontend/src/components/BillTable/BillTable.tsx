import type { UpcomingBillsResponse } from '@finebank/shared';

import { BillItem } from '../BillItem/BillItem';
import styles from './BillTable.module.css';

type BillTableProps = {
  /** Every upcoming bill, soonest first, as the backend sent them (#28, #41). */
  bills: UpcomingBillsResponse['bills'];
  /** The table's name: the section title, "Upcoming Bills". */
  label: string;
};

/**
 * The Bills table (108; the rows Figma `Bill item`, no table component): the header row Due Date, Logo, Item
 * Description, Last Charge and Amount (`th scope="col"`, the Gray/06 divider 24 under it), then one `BillItem` per bill,
 * every bill sent in the order sent, not paginated (the frontend sorts, filters, slices and calculates nothing; #11,
 * #28, #41). The Amount column is as wide as its widest box; the other four share the rest in 108's proportions at any
 * width (#94). Nothing in it is focusable or clickable (#28).
 */
export function BillTable({ bills, label }: BillTableProps) {
  return (
    <div className={styles.body}>
      <table className={styles.table} aria-label={label}>
        <thead className={styles.group}>
          <tr className={styles.headerRow}>
            <th scope="col" className={styles.dueDateHeader}>
              Due Date
            </th>
            <th scope="col" className={styles.logoHeader}>
              Logo
            </th>
            <th scope="col">Item Description</th>
            <th scope="col" className={styles.lastChargeHeader}>
              Last Charge
            </th>
            <th scope="col" className={styles.amountHeader}>
              Amount
            </th>
          </tr>
        </thead>
        <tbody className={styles.group}>
          {bills.map((bill, index) => (
            // No ID in the contract (#28: no route takes a bill): the row's position is its key.
            <BillItem key={index} bill={bill} divided={index !== bills.length - 1} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
