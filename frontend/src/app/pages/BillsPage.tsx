import { useUpcomingBills } from '../../api/bills';
import { BillTable, BillTableSkeleton, Card, DataState, Section } from '../../components';
import styles from './BillsPage.module.css';

/** The section title, which also names the table (US-14 criterion 1). */
const title = 'Upcoming Bills';

/**
 * Bills (108): the section "Upcoming Bills" (US-14) and under it the white card across the content width (#94) with
 * every upcoming bill in Figma's table, soonest first, not paginated (#28, #41). It reads Overview's query (task 015,
 * `['bills', 'upcoming']`), so both pages show one answer. `DataState` covers the card: the skeleton while the bills
 * load, the error state, "No upcoming bills" when there are none (#6, #111 b); a failed refetch keeps the rows (#89).
 */
export function BillsPage() {
  const bills = useUpcomingBills();

  return (
    <Section title={title} gap="lg">
      <Card padding="none" className={styles.card}>
        <DataState
          query={bills}
          skeleton={<BillTableSkeleton />}
          empty={{ isEmpty: (data) => data.bills.length === 0, message: 'No upcoming bills' }}
        >
          {(data) => <BillTable bills={data.bills} label={title} />}
        </DataState>
      </Card>
    </Section>
  );
}
