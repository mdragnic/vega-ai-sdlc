import { useAccounts } from '../../api/accounts';
import { AccountType, AccountTypeSkeleton, AddAccountsCell, DataState, Section } from '../../components';
import styles from './BalancesPage.module.css';

/**
 * Balances (105): the signed-in user's accounts as `AccountType` cards on Overview's grid (#94), in the order sent,
 * oldest first, then the Add Accounts cell, wrapping to more rows (#24). The data is Overview's accounts query, so one
 * request serves both pages. While it loads, three skeleton cards; with no accounts or after a failure, the message
 * in one white card across the grid (#6, #116 a).
 */
export function BalancesPage() {
  const accounts = useAccounts();

  return (
    <Section title="Balances" gap="lg">
      <div className={styles.content}>
        <DataState
          query={accounts}
          skeleton={
            <div className={styles.skeletonRow}>
              <AccountTypeSkeleton />
              <AccountTypeSkeleton />
              <AccountTypeSkeleton />
            </div>
          }
          empty={{ isEmpty: (data) => data.accounts.length === 0, message: 'No accounts yet' }}
        >
          {(data) => (
            <ul className={styles.grid}>
              {data.accounts.map((account) => (
                <li key={account.id} className={styles.cell}>
                  <AccountType account={account} />
                </li>
              ))}
              {/* Visual only (#22): hidden from assistive technology, so the list reads as the accounts. */}
              <li className={styles.cell} aria-hidden="true">
                <AddAccountsCell />
              </li>
            </ul>
          )}
        </DataState>
      </div>
    </Section>
  );
}
