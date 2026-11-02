import { type AccountDetailsResponse, accountTypeLabel, formatMoney } from '@finebank/shared';

import styles from './AccountDetailsCard.module.css';

type AccountDetailsCardProps = {
  /** One account as the backend sends it: the number already masked (#25), the balance calculated (#57). */
  account: AccountDetailsResponse;
};

/**
 * The content of the Account Details card (106; no Figma component), inside a white `Card` the page draws: the five
 * values of US-12 criterion 2, each under its label, as a description list read label first, in 106's three columns:
 * Bank Name, Account Type and Balance, then Branch Name and Account Number. Under them "Edit Details" (the
 * `Button/primary` look) and "Remove", visual only (#23; "Edit Details" until task 022): no button, no Tab stop, nothing
 * on a click and hidden from assistive technology. A Bank Name or Branch Name longer than its column wraps inside it and
 * the card grows; the balance and the masked number stay on one line (#106, #108 b, #111 a, #115 b). Shows the account
 * as sent and only formats it (#11, #25).
 */
export function AccountDetailsCard({ account }: AccountDetailsCardProps) {
  return (
    <div className={styles.content}>
      <dl className={styles.values}>
        <div className={styles.value}>
          <dt className={styles.label}>Bank Name</dt>
          <dd className={styles.text}>{account.bankName}</dd>
        </div>
        <div className={styles.value}>
          <dt className={styles.label}>Account Type</dt>
          <dd className={styles.text}>{accountTypeLabel(account.accountType)}</dd>
        </div>
        <div className={styles.value}>
          <dt className={styles.label}>Balance</dt>
          <dd className={styles.oneLine}>{formatMoney(account.balance)}</dd>
        </div>
        <div className={styles.value}>
          <dt className={styles.label}>Branch Name</dt>
          <dd className={styles.text}>{account.branchName}</dd>
        </div>
        <div className={styles.value}>
          <dt className={styles.label}>Account Number</dt>
          <dd className={styles.oneLine}>{account.maskedNumber}</dd>
        </div>
      </dl>
      {/* Visual only (#23, task 022): inert and hidden from assistive technology, so no keyboard or screen reader user
          meets a control that does nothing. */}
      <div className={styles.actions} aria-hidden="true" inert>
        <span className={styles.editDetails}>Edit Details</span>
        <span className={styles.remove}>Remove</span>
      </div>
    </div>
  );
}
