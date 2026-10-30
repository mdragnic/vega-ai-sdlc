import { type AccountSummary, accountTypeLabel, formatMoney } from '@finebank/shared';
import { useId } from 'react';

import { cardNetworkLogos } from '../../assets/brand';
import { accountDetailsPath } from '../../routes/paths';
import { Button } from '../Button/Button';
import { Card } from '../Card/Card';
import styles from './AccountType.module.css';

type AccountTypeProps = {
  /** One account as the backend sends it: the number already masked (#25), the balance calculated (#57). */
  account: AccountSummary;
};

/**
 * Figma `Account Type` (410:5353), one account on Balances (105): the type, the Bank Name and the card network's logo
 * when it has one (#24) over the divider; the masked number and the balance, each with its label under it; "Remove",
 * visual only (#23), and "Details" to the account's Account Details (#50). Where the Bank Name and its logo do not
 * fit beside the type, they move under it, right-aligned, and the card grows (#106, #108 b, #111 a, #115 b). Shows
 * the account as sent.
 */
export function AccountType({ account }: AccountTypeProps) {
  const typeId = useId();
  const bankNameId = useId();
  const logo = account.cardNetwork === null ? null : cardNetworkLogos[account.cardNetwork];

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <h3 id={typeId} className={styles.type}>
          {accountTypeLabel(account.accountType)}
        </h3>
        <div className={styles.bank}>
          <p id={bankNameId} className={styles.bankName}>
            {account.bankName}
          </p>
          {logo && <img className={styles.logo} src={logo.src} alt={logo.name} />}
        </div>
      </div>
      {/* Each label is read before its value and drawn under it, as in 105. */}
      <dl className={styles.values}>
        <div className={styles.value}>
          <dt className={styles.label}>Account Number</dt>
          <dd className={styles.number}>{account.maskedNumber}</dd>
        </div>
        <div className={styles.value}>
          <dt className={styles.label}>Total amount</dt>
          <dd className={styles.balance}>{formatMoney(account.balance)}</dd>
        </div>
      </dl>
      <div className={styles.bottomRow}>
        <span className={styles.remove} aria-hidden="true">
          Remove
        </span>
        <Button to={accountDetailsPath(String(account.id))} aria-describedby={`${typeId} ${bankNameId}`}>
          Details
        </Button>
      </div>
    </Card>
  );
}
