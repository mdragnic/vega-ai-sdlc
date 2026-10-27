import type { RecentTransactionsResponse } from '@finebank/shared';
import { useId, useState } from 'react';

import { DataState, type DataStateQuery } from '../DataState/DataState';
import { MenuTab, menuTabId } from '../MenuTab/MenuTab';
import { RecentTransactionItem } from '../RecentTransactionItem/RecentTransactionItem';
import { RecentTransactionSkeleton } from '../RecentTransactionSkeleton/RecentTransactionSkeleton';
import styles from './RecentTransaction.module.css';

type Tab = keyof RecentTransactionsResponse;

// The tab values are the response's keys: each tab shows its own list as sent (#19, #40).
const tabs = [
  { value: 'all', label: 'All' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'expenses', label: 'Expenses' },
] as const satisfies readonly { value: Tab; label: string }[];

/** #6's own example, for every tab. */
const emptyMessage = 'No transactions yet';

const noTransactions = (data: RecentTransactionsResponse) =>
  data.all.length === 0 && data.revenue.length === 0 && data.expenses.length === 0;

type RecentTransactionProps = {
  /** The recent transactions query: every tab's list in one response. */
  query: DataStateQuery<RecentTransactionsResponse>;
};

/**
 * The content of the Overview Recent Transaction card (104, Figma section `Recent Transaction` 66:4747): the tabs All,
 * Revenue and Expenses (`MenuTab`, All selected on every visit, the selected one in the Active style, #19), in every
 * state, and under them the tab panel with the selected tab's list of up to 5 rows as sent (#40). The panel is a Tab
 * stop with the #87 ring on keyboard focus, since the rows hold nothing focusable (#112). The three lists share one
 * grid cell, so the card takes the tallest tab's height and switching tabs never moves the page; the hidden ones are
 * invisible and out of the accessibility tree (#107, #112 a). `DataState` covers the panel: the skeleton, the error
 * state, and "No transactions yet" when every list is empty; a tab whose own list is empty shows it in its place (#6).
 */
export function RecentTransaction({ query }: RecentTransactionProps) {
  const panelId = useId();
  const [selected, setSelected] = useState<Tab>('all');

  return (
    <div className={styles.content}>
      <MenuTab label="Recent Transaction" tabs={tabs} value={selected} onChange={setSelected} panelId={panelId} />
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={menuTabId(panelId, selected)}
        // A Tab stop, per the WAI-ARIA tabs pattern: the rows hold no focusable element (#112).
        tabIndex={0}
        className={styles.panel}
      >
        <DataState
          query={query}
          skeleton={<RecentTransactionSkeleton />}
          empty={{ isEmpty: noTransactions, message: emptyMessage }}
        >
          {(data) => (
            <div className={styles.lists}>
              {tabs.map((tab) => {
                const rows = data[tab.value];
                const shown = tab.value === selected;
                return (
                  <div
                    key={tab.value}
                    className={shown ? styles.tabList : `${styles.tabList} ${styles.hidden}`}
                    aria-hidden={shown ? undefined : true}
                  >
                    {rows.length === 0 ? (
                      <div className={styles.message}>
                        <p className={styles.emptyText}>{emptyMessage}</p>
                      </div>
                    ) : (
                      <ul className={styles.list}>
                        {rows.map((transaction, index) => (
                          // No ID in the contract (no route takes a transaction): the row's position is its key.
                          <RecentTransactionItem
                            key={index}
                            transaction={transaction}
                            divided={index !== rows.length - 1}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DataState>
      </div>
    </div>
  );
}
