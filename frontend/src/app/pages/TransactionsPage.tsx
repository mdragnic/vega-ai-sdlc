import type { TransactionsTab } from '@finebank/shared';
import { useId, useState } from 'react';

import { useTransactions } from '../../api/transactions';
import { Card, DataState, MenuTab, Section, TransactionTable, TransactionTableSkeleton } from '../../components';
import { menuTabId } from '../../components/MenuTab/MenuTab';
import styles from './TransactionsPage.module.css';

// The tab values are the query's: each tab asks the backend for its own pages (#19, #74).
const tabs = [
  { value: 'all', label: 'All' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'expenses', label: 'Expenses' },
] as const satisfies readonly { value: TransactionsTab; label: string }[];

/**
 * Transactions (107): the section "Recent Transaction" (US-13), the tabs All, Revenue and Expenses (`MenuTab`, All
 * selected on every visit, the selected one in the Active style, #19) in every state, and under them the tab panel, a
 * Tab stop with the #87 ring (#112), holding the white card with the selected tab's table. `DataState` covers the
 * card: the skeleton while the tab's first page loads, the error state, "No transactions yet" when the first page is
 * empty (#6). Each tab takes its own height (#117 c).
 */
export function TransactionsPage() {
  const panelId = useId();
  const [selected, setSelected] = useState<TransactionsTab>('all');
  const transactions = useTransactions(selected);

  return (
    <Section title="Recent Transaction" gap="lg">
      <div className={styles.content}>
        <MenuTab label="Recent Transaction" tabs={tabs} value={selected} onChange={setSelected} panelId={panelId} />
        <div
          id={panelId}
          role="tabpanel"
          aria-labelledby={menuTabId(panelId, selected)}
          // A Tab stop, per the WAI-ARIA tabs pattern: the table holds no focusable element (#112).
          tabIndex={0}
          className={styles.panel}
        >
          <Card padding="none" className={styles.card}>
            <DataState
              // A tab's own states: a Retry or the focus of a "Load More" never carries to another tab.
              key={selected}
              query={transactions}
              skeleton={<TransactionTableSkeleton />}
              empty={{ isEmpty: (data) => data.pages[0]?.transactions.length === 0, message: 'No transactions yet' }}
            >
              {(data) => (
                <TransactionTable
                  pages={data.pages}
                  labelledBy={menuTabId(panelId, selected)}
                  loadingMore={transactions.isFetchingNextPage}
                  // Changes with each failure, so a repeated failure is announced again (#117 b).
                  loadMoreFailure={transactions.isFetchNextPageError ? transactions.errorUpdateCount : null}
                  onLoadMore={() => void transactions.fetchNextPage()}
                />
              )}
            </DataState>
          </Card>
        </div>
      </div>
    </Section>
  );
}
