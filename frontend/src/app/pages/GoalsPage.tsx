import { useState } from 'react';

import { useCategoryLimits } from '../../api/category-limits';
import { useSavingSummary } from '../../api/saving-summary';
import { useSavingsGoal, useSavingsGoalMonths } from '../../api/savings-goals';
import { Card, GoalItemList, SavingSummary, SavingsGoal, Section } from '../../components';
import styles from './GoalsPage.module.css';

/**
 * Goals (110, US-16): the section "Goals" with the Savings Goal card and the Saving Summary card in one row (368 : 712,
 * #94), and 32 under it the section "Expenses Goals by Category" with the six category cards on a 3x2 grid
 * (`GoalItemList`, task 027): one limit per category for every month, so no selector picks a month for them and a pick
 * in either card never changes them (#32). The Savings Goal card's month is the newest of the list until the user picks one, so a page left open past midnight moves to the new month when the
 * list is fetched again; a picked month stays while it is in the list. While the Adjust Goal popup is open its month is
 * held, so the card behind it stays on the month the save names (as Overview's popup keeps its month, task 014); if the
 * list moved on meanwhile, that month stays selected after the popup closes, as if picked, so the card shows what was
 * just saved and "Adjust Goal" keeps its focus. The Saving Summary card has its own selected month by the same rule, on
 * the same months query (one list, #60); a pick in either card never changes the other (#30), and a goal save never
 * asks for the summary again (#59). Every visit opens on the current month (#30); nothing is remembered.
 */
export function GoalsPage() {
  const months = useSavingsGoalMonths();
  const [picked, setPicked] = useState<string | null>(null);
  /** The month the Adjust Goal popup opened with, while it is open. */
  const [held, setHeld] = useState<string | null>(null);
  const list = months.data?.months;
  const selected =
    list === undefined ? undefined : (held ?? (picked !== null && list.includes(picked) ? picked : list[0]));
  const goal = useSavingsGoal(selected);
  const [summaryPicked, setSummaryPicked] = useState<string | null>(null);
  const summaryMonth =
    list === undefined ? undefined : summaryPicked !== null && list.includes(summaryPicked) ? summaryPicked : list[0];
  const summary = useSavingSummary(summaryMonth);
  const limits = useCategoryLimits();

  const onPopupOpenChange = (open: boolean) => {
    if (open) {
      setHeld(selected ?? null);
      return;
    }
    // The list moved on behind the popup: its month stays selected, so the card does not swap under the user.
    if (held !== null && held !== list?.[0]) setPicked(held);
    setHeld(null);
  };

  return (
    <div className={styles.page}>
      <Section title="Goals" gap="lg">
        <div className={styles.topRow}>
          <Card padding="none" className={styles.savingsGoalCard}>
            <div className={styles.savingsGoalBody}>
              <SavingsGoal
                months={months}
                selected={selected}
                onSelect={setPicked}
                onPopupOpenChange={onPopupOpenChange}
                goal={goal}
              />
            </div>
          </Card>
          <Card padding="none" className={styles.savingSummaryCard}>
            <div className={styles.savingSummaryBody}>
              <SavingSummary months={months} selected={summaryMonth} onSelect={setSummaryPicked} summary={summary} />
            </div>
          </Card>
        </div>
      </Section>
      <Section title="Expenses Goals by Category" gap="lg">
        <GoalItemList query={limits} />
      </Section>
    </div>
  );
}
