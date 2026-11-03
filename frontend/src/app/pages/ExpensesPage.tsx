import { useExpensesBreakdown, useMonthlyComparison } from '../../api/expenses';
import { Card, ExpensesBreakdownList, ExpensesComparison, Section } from '../../components';
import styles from './ExpensesPage.module.css';

/**
 * Expenses (109, US-15): the section "Expenses Comparison" with the chart card across the content width (#94), this
 * year against last year per month (#29), and 32 under it the section "Expenses Breakdown" with the six category
 * cards. Two widgets, each with its own `DataState`: one failing never breaks the other (#6). The cards read
 * Overview's breakdown query (`['expenses', 'breakdown']`), so both pages show one answer (task 024).
 */
export function ExpensesPage() {
  const monthlyComparison = useMonthlyComparison();
  const expensesBreakdown = useExpensesBreakdown();

  return (
    <div className={styles.page}>
      <Section title="Expenses Comparison" gap="lg">
        <Card>
          <ExpensesComparison query={monthlyComparison} />
        </Card>
      </Section>
      <Section title="Expenses Breakdown" gap="lg">
        <ExpensesBreakdownList query={expensesBreakdown} />
      </Section>
    </div>
  );
}
