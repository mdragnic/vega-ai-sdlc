import { type AccountSummary, accountTypeLabel, formatMoney } from '@finebank/shared';

import { cardNetworkLogos } from '../../assets/brand';
import { ArrowUpRight } from '../../assets/icons';
import styles from './AccountTypeSlide.module.css';

type AccountTypeSlideProps = {
  /** One account as the backend sends it: the number already masked (#25), the balance calculated (#57). */
  account: AccountSummary;
  /** The group's name: the position and the count, "Account 1 of 5". */
  label: string;
};

/**
 * Figma frame `Account type` (405:5469), the teal card in Total Balance (not the Balances card, `AccountType`):
 * "Account Type", the type, the masked number, the card network's logo when it has one (#24), the balance and the
 * round arrow, which is visual only (#17). Where the number and the balance do not fit on one line, the balance
 * and the arrow move to the next line and the card grows (#106).
 */
export function AccountTypeSlide({ account, label }: AccountTypeSlideProps) {
  const logo = account.cardNetwork === null ? null : cardNetworkLogos[account.cardNetwork];

  return (
    <div role="group" aria-label={label} className={styles.slide}>
      <p className={styles.caption}>Account Type</p>
      <p className={styles.type}>{accountTypeLabel(account.accountType)}</p>
      {logo && <img className={styles.logo} src={logo.src} alt={logo.name} />}
      <div className={styles.bottomLine}>
        <p className={styles.number}>{account.maskedNumber}</p>
        <div className={styles.amount}>
          <p className={styles.balance}>{formatMoney(account.balance)}</p>
          <span className={styles.roundArrow} aria-hidden="true">
            <ArrowUpRight className={styles.arrow} />
          </span>
        </div>
      </div>
    </div>
  );
}
