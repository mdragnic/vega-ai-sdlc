import { accountIdSchema } from '@finebank/shared';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';

import { isAccountNotFound, useAccount, useUpdateAccountDetails } from '../../api/accounts';
import { formErrorFor } from '../../api/client';
import { useAccountTransactions } from '../../api/transactions';
import {
  AccountDetailsCard,
  AccountDetailsCardSkeleton,
  AccountDetailsForm,
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

/** The fields a failed save's `fieldErrors` can point to: their messages show under them, not above Save (#97 a). */
const editableFields = ['bankName', 'branchName', 'accountType'] as const;

/**
 * The account's two sections, 32 apart: "Account Details" with the details card and "Transactions History" with the
 * history card (no back or breadcrumb control, US-12 criterion 16, #26). Each card is a white `Card` with its own
 * `DataState` (#6, #89, #114): the skeleton, the error state, the history's "No transactions yet". When either request
 * answers 404 (another user's account or an unknown ID), Balances opens, replacing the URL (#39); until both first
 * answers are in, both cards show only their skeletons, so nothing of an account that turns out not to be the user's
 * shows at any moment.
 *
 * "Edit Details" switches the details card to edit mode (#26), offered only while it shows data: a background refetch
 * keeps the typing and a failed one keeps the data (#89). Save stores the fields (`useUpdateAccountDetails`) and returns
 * to view mode with the stored values; a failed save keeps the typing, its 404 opens Balances (#39); Cancel and Escape
 * discard. After a save, Cancel or Escape, focus moves to "Edit Details" (Chrome shows the #87 ring there only when that
 * action came from the keyboard). Leaving or remounting the page drops edit mode with no prompt.
 */
function AccountDetails({ accountId }: { accountId: number }) {
  const account = useAccount(accountId);
  const history = useAccountTransactions(accountId);
  const update = useUpdateAccountDetails(accountId);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  // Set when edit mode ends by a save, Cancel or Escape: "Edit Details" takes focus once view mode shows.
  const refocusEdit = useRef(false);
  // Latched for the account's page: a query asked again with no data (a Retry, a refetch on window focus) starts again
  // as `pending` with no failures, which must not send the other card back to its skeleton or drop its focus.
  const [answered, setAnswered] = useState(false);
  if (!answered && firstAnswerIn(account) && firstAnswerIn(history)) setAnswered(true);

  useEffect(() => {
    if (editing || !refocusEdit.current) return;
    refocusEdit.current = false;
    editButton.current?.focus();
  }, [editing]);

  // The save's typed names leave the mutation cache with edit mode.
  const leaveEditMode = () => {
    refocusEdit.current = true;
    update.reset();
    setEditing(false);
  };

  if (isAccountNotFound(account.error) || isAccountNotFound(history.error)) {
    return <Navigate replace to={paths.balances} />;
  }

  return (
    <div className={styles.page}>
      <Section title="Account Details" gap="lg">
        <Card padding="none" className={styles.detailsCard}>
          <DataState query={answered ? account : waiting(account)} skeleton={<AccountDetailsCardSkeleton />}>
            {(data) =>
              editing ? (
                <AccountDetailsForm
                  autoFocus
                  account={data}
                  saving={update.isPending}
                  formError={update.isError ? formErrorFor(update.error, editableFields) : undefined}
                  onCancel={leaveEditMode}
                  onSave={(request, { onError, onSettled }) => {
                    // The last attempt's message stays until the next one starts.
                    update.reset();
                    update.mutate(request, {
                      onSuccess: leaveEditMode,
                      onError: (error) => {
                        if (isAccountNotFound(error)) void navigate(paths.balances, { replace: true });
                        else onError(error);
                      },
                      onSettled,
                    });
                  }}
                />
              ) : (
                <AccountDetailsCard account={data} onEdit={() => setEditing(true)} editRef={editButton} />
              )
            }
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
