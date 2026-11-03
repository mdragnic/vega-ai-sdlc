import {
  categoryLabel,
  type ExpensesBreakdownCategory,
  formatMoney,
  formatPercent,
  hyphenatedCategoryLabel,
} from '@finebank/shared';
import { VisuallyHidden } from 'radix-ui';
import { useId } from 'react';

import { DownArrow16, UpArrow } from '../../assets/icons';
import { Card } from '../Card/Card';
import { CategoryIcon } from '../CategoryIcon/CategoryIcon';
import { expenseChangeText } from '../ExpensesItem/expenseChangeText';
import { ExpensesLineItem } from '../ExpensesLineItem/ExpensesLineItem';
import styles from './ExpensesBreakdown.module.css';

type ExpensesBreakdownProps = {
  /** One category as the backend sent it: this month's total so far, the change and its most recent items (#21, #61). */
  item: ExpensesBreakdownCategory;
};

/**
 * Figma component `Expenses Breakdown` (50:3852), one category card of the Expenses page (109): the Gray/05 header
 * with the category icon on its tile, the name over the total, and at the right the percentage with its arrow (red up,
 * green down, none at 0%; the line empty without a change, #21, #61) over "Compare to last month"; under it the white
 * body with the category's most recent items in the order sent, or "No expenses this month" (#61). Where the right
 * block does not fit beside the left, it moves under it, right-aligned, and the header grows (#106, #111 a, #115 b).
 * Not clickable (#29). Assistive technology reads the clean name, the total, the change in words, then the items.
 * Formats as sent; calculates nothing (#11).
 */
export function ExpensesBreakdown({ item }: ExpensesBreakdownProps) {
  const { category, total, change, recent } = item;
  const nameId = useId();

  return (
    <li className={styles.cell} aria-labelledby={nameId}>
      <Card padding="none" className={styles.card}>
        <div className={styles.header}>
          <CategoryIcon category={category} variant="header" decorative />
          <div className={styles.text}>
            <div className={styles.left}>
              <p className={styles.name} aria-hidden="true">
                {hyphenatedCategoryLabel(category)}
              </p>
              <VisuallyHidden.Root asChild>
                <h3 id={nameId}>{categoryLabel(category)}</h3>
              </VisuallyHidden.Root>
              <p className={styles.total}>{formatMoney(total)}</p>
            </div>
            <div className={styles.right} aria-hidden="true">
              <p className={styles.change}>
                {change !== null && (
                  <>
                    {formatPercent(change.percent)}
                    {change.direction === 'up' && <UpArrow className={styles.up} />}
                    {change.direction === 'down' && <DownArrow16 className={styles.down} />}
                  </>
                )}
              </p>
              <p className={styles.compare}>Compare to last month</p>
            </div>
            {change !== null && <VisuallyHidden.Root>{expenseChangeText(change)}</VisuallyHidden.Root>}
          </div>
        </div>
        <div className={styles.body}>
          {recent.length === 0 ? (
            <p className={styles.empty}>No expenses this month</p>
          ) : (
            <ul className={styles.items}>
              {recent.map((line, index) => (
                // No ID in the contract (no route takes a transaction): the item's position is its key.
                <ExpensesLineItem key={index} item={line} />
              ))}
            </ul>
          )}
        </div>
      </Card>
    </li>
  );
}
