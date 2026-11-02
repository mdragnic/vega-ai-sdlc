import { type AccountDetailsResponse, accountTypeLabel, formatMoney } from '@finebank/shared';
import type { Ref } from 'react';

import { ButtonPrimary } from '../ButtonPrimary/ButtonPrimary';
import styles from './AccountDetailsCard.module.css';

type AccountDetailsCardProps = {
  /** One account as the backend sends it: the number already masked (#25), the balance calculated (#57). */
  account: AccountDetailsResponse;
  /** "Edit Details": the page switches the card to edit mode (#26). */
  onEdit: () => void;
  /** The "Edit Details" button, which the page focuses after a save, Cancel or Escape. */
  editRef?: Ref<HTMLButtonElement>;
};

/**
 * The content of the Account Details card (106; no Figma component), inside a white `Card` the page draws: the five
 * values of US-12 criterion 2, each under its label, as a description list read label first, in 106's three columns:
 * Bank Name, Account Type and Balance, then Branch Name and Account Number. Under them "Edit Details", a
 * `ButtonPrimary` 160 wide that opens edit mode (#26, task 022), and "Remove", visual only (#23): no button, no Tab
 * stop, nothing on a click and hidden from assistive technology. A Bank Name or Branch Name longer than its column wraps
 * inside it and the card grows; the balance and the masked number stay on one line (#106, #108 b, #111 a, #115 b).
 * Shows the account as sent and only formats it (#11, #25).
 */
export function AccountDetailsCard({ account, onEdit, editRef }: AccountDetailsCardProps) {
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
      <div className={styles.actions}>
        <div className={styles.button}>
          <ButtonPrimary ref={editRef} onClick={onEdit}>
            Edit Details
          </ButtonPrimary>
        </div>
        {/* Visual only (#23): inert and hidden from assistive technology, so no keyboard or screen reader user meets a
            control that does nothing. */}
        <span className={styles.remove} aria-hidden="true" inert>
          Remove
        </span>
      </div>
    </div>
  );
}
