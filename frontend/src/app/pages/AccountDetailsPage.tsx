import { accountIdSchema } from '@finebank/shared';
import { useState } from 'react';
import { Navigate, useParams } from 'react-router';

import { isAccountNotFound, useAccount } from '../../api/accounts';
import { useAccountTransactions } from '../../api/transactions';
import {
  AccountDetailsCard,
  AccountDetailsCardSkeleton,
  Card,
  DataState,
  type DataStateQuery,
  Section,
  TransactionsHistorySkeleton,
  TransactionsHistoryTable,
} from '../../components';
import { paths } from '../../routes/paths';
import styles from './AccountDetailsPage.module.css';

/**
 * Account Details (106) at `/balances/:accountId`. The ID from the URL is parsed with the shared strict rule, the
 * backend's (`accountIdSchema`, Marko's addition 2); an ID it rejects opens Balances at once, replacing the URL in the
 * history, with no request (US-12 criterion 17, #39). React Router gives `/balances/` and `/balances//` to Balances
 * itself.
 */
export function AccountDetailsPage() {
  const { accountId } = useParams();
  const parsed = accountIdSchema.safeParse(accountId);
  if (!parsed.success) return <Navigate replace to={paths.balances} />;
  // One account's page: another account's starts afresh (its states, its Load More focus).
  return <AccountDetails key={parsed.data} accountId={parsed.data} />;
}

/** Whether the query's first answer is in: a response, or a failed try, which is not the 404 (that one ends it). */
const firstAnswerIn = (query: { status: string; failureCount: number }) =>
  query.status !== 'pending' || query.failureCount > 0;

/** The skeleton's state, for a card that waits for the other card's first answer. */
const waiting = <TData,>(query: DataStateQuery<TData>): DataStateQuery<TData> => ({
  status: 'pending',
  data: undefined,
  fetchStatus: 'fetching',
  refetch: query.refetch,
});

/**
 * The account's two sections, 32 apart: "Account Details" with the details card and "Transactions History" with the
 * history card (no back or breadcrumb control, US-12 criterion 16, #26). Each card is a white `Card` with its own
 * `DataState` (#6, #89, #114): the skeleton, the error state, the history's "No transactions yet". When either request
 * answers 404 (another user's account or an unknown ID), Balances opens, replacing the URL (#39); until both first
 * answers are in, both cards show only their skeletons, so nothing of an account that turns out not to be the user's
 * shows at any moment.
 */
function AccountDetails({ accountId }: { accountId: number }) {
  const account = useAccount(accountId);
  const history = useAccountTransactions(accountId);
  // Latched for the account's page: a query asked again with no data (a Retry, a refetch on window focus) starts again
  // as `pending` with no failures, which must not send the other card back to its skeleton or drop its focus.
  const [answered, setAnswered] = useState(false);
  if (!answered && firstAnswerIn(account) && firstAnswerIn(history)) setAnswered(true);

  if (isAccountNotFound(account.error) || isAccountNotFound(history.error)) {
    return <Navigate replace to={paths.balances} />;
  }

  return (
    <div className={styles.page}>
      <Section title="Account Details" gap="lg">
        <Card padding="none" className={styles.detailsCard}>
          <DataState query={answered ? account : waiting(account)} skeleton={<AccountDetailsCardSkeleton />}>
            {(data) => <AccountDetailsCard account={data} />}
          </DataState>
        </Card>
      </Section>
      <Section title="Transactions History" gap="lg">
        <Card padding="none" className={styles.historyCard}>
          <DataState
            query={answered ? history : waiting(history)}
            skeleton={<TransactionsHistorySkeleton />}
            empty={{ isEmpty: (data) => data.pages[0]?.transactions.length === 0, message: 'No transactions yet' }}
          >
            {(data) => (
              <TransactionsHistoryTable
                pages={data.pages}
                label="Transactions History"
                loadingMore={history.isFetchingNextPage}
                // Changes with each failure, so a repeated failure is announced again (#117 b).
                loadMoreFailure={history.isFetchNextPageError ? history.errorUpdateCount : null}
                onLoadMore={() => void history.fetchNextPage()}
              />
            )}
          </DataState>
        </Card>
      </Section>
    </div>
  );
}
