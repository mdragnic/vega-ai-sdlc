import { useAccounts } from '../../api/accounts';
import { Card, DataState, Section, TotalBalance, TotalBalanceSkeleton } from '../../components';
import { paths } from '../../routes/paths';
import styles from './OverviewPage.module.css';

/**
 * Overview (104): the six sections on a grid that fills the content area (#94). Only Total Balance has content;
 * the other cards stay empty, at their 104 heights, until their tasks fill them (#105 a).
 */
export function OverviewPage() {
  const accounts = useAccounts();

  return (
    <div className={styles.grid}>
      <Section title="Total Balance" gap="sm" className={`${styles.section} ${styles.totalBalance}`}>
        <Card padding="none" className={`${styles.card} ${styles.topCard}`}>
          <div className={styles.topCardBody}>
            <DataState
              query={accounts}
              skeleton={<TotalBalanceSkeleton />}
              empty={{ isEmpty: (data) => data.accounts.length === 0, message: 'No accounts yet' }}
            >
              {(data) => <TotalBalance data={data} />}
            </DataState>
          </div>
        </Card>
      </Section>
      <Section title="Goals" gap="sm" className={`${styles.section} ${styles.goals}`}>
        <Card className={`${styles.card} ${styles.topCard}`}>{null}</Card>
      </Section>
      <Section title="Upcoming Bill" gap="sm" viewAllTo={paths.bills} className={`${styles.section} ${styles.bills}`}>
        <Card className={`${styles.card} ${styles.topCard}`}>{null}</Card>
      </Section>
      <Section
        title="Recent Transaction"
        gap="sm"
        viewAllTo={paths.transactions}
        className={`${styles.section} ${styles.recentTransaction}`}
      >
        <Card className={styles.card}>{null}</Card>
      </Section>
      <Section title="Statistics" gap="sm" className={`${styles.section} ${styles.statistics}`}>
        <Card className={`${styles.card} ${styles.statisticsCard}`}>{null}</Card>
      </Section>
      <Section
        title="Expenses Breakdown"
        gap="sm"
        note="*Compare to last month"
        className={`${styles.section} ${styles.expensesBreakdown}`}
      >
        <Card className={`${styles.card} ${styles.expensesBreakdownCard}`}>{null}</Card>
      </Section>
    </div>
  );
}
