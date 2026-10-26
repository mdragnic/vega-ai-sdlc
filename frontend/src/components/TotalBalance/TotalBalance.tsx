import { type AccountsResponse, formatMoney } from '@finebank/shared';
import { useState } from 'react';
import { Link } from 'react-router';

import { paths } from '../../routes/paths';
import { AccountTypeSlide } from '../AccountTypeSlide/AccountTypeSlide';
import { SliderOption } from '../SliderOption/SliderOption';
import styles from './TotalBalance.module.css';

type TotalBalanceProps = {
  /** The total and the accounts, oldest first, as the backend calculated them (#17, #24); at least one account. */
  data: AccountsResponse;
};

/**
 * The content of the Total Balance card (104, Figma 405:5461): the total with "All Accounts" to Balances, then one
 * account at a time with Previous, a dot per account and Next (#17). It starts at the first account each time it
 * mounts; when new data has fewer accounts, it moves to the last one. The amounts are shown as sent (#11). Every
 * account's card is laid out in one cell, so the tallest one sets the height and paging never moves the page (#107).
 */
export function TotalBalance({ data }: TotalBalanceProps) {
  const { totalBalance, accounts } = data;
  const [position, setPosition] = useState(0);
  const last = accounts.length - 1;
  if (last >= 0 && position > last) setPosition(last);
  const shown = Math.min(position, last);
  const account = accounts[shown];
  // `DataState` shows its empty message instead (#105 b).
  if (account === undefined) return null;
  const label = (index: number) => `Account ${index + 1} of ${accounts.length}`;

  return (
    <div className={styles.totalBalance}>
      <div className={styles.header}>
        <p className={styles.total}>{formatMoney(totalBalance)}</p>
        <Link to={paths.balances} className={styles.allAccounts}>
          All Accounts
        </Link>
      </div>
      <div className={styles.slides}>
        {/* A screen reader hears the new account after Previous or Next. */}
        <div aria-live="polite" className={styles.slide}>
          <AccountTypeSlide key={account.id} account={account} label={label(shown)} />
        </div>
        {/* The other accounts, never seen or announced: they only give the cell the tallest card's height. */}
        {accounts.map((other, index) =>
          index === shown ? null : (
            <div key={other.id} aria-hidden="true" className={`${styles.slide} ${styles.hidden}`}>
              <AccountTypeSlide account={other} label={label(index)} />
            </div>
          ),
        )}
      </div>
      <div className={styles.control}>
        <SliderOption
          count={accounts.length}
          position={shown}
          onPrevious={() => setPosition(shown - 1)}
          onNext={() => setPosition(shown + 1)}
        />
      </div>
    </div>
  );
}
