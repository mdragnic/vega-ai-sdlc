import {
  categoryLabel,
  type ExpenseChange,
  type ExpensesBreakdownCategory,
  formatMoney,
  formatPercent,
  hyphenatedCategoryLabel,
} from '@finebank/shared';
import { VisuallyHidden } from 'radix-ui';
import { Link } from 'react-router';

import { ArrowRight24, DownArrow16, UpArrow } from '../../assets/icons';
import { paths } from '../../routes/paths';
import { CategoryIcon } from '../CategoryIcon/CategoryIcon';
import styles from './ExpensesItem.module.css';

/** What a screen reader says for the change: "up 7% compared to last month", or "0% compared to last month". */
const changeText = ({ percent, direction }: ExpenseChange) =>
  `${direction === null ? '' : `${direction} `}${formatPercent(percent)} compared to last month`;

type ExpensesItemProps = {
  /** One category as the backend sent it: this month's total so far and the change against last month (#21). */
  item: ExpensesBreakdownCategory;
};

/**
 * Figma component `Expences Item` (42:777), one category of the Overview Expenses Breakdown (104): the category icon on
 * its gray tile; the name, the total and the change (the whole percent with its asterisk, then the red up or the green
 * down arrow, no arrow at 0%, an empty line without a change, #21, #61); and the right arrow, a link to Expenses that
 * turns teal on hover (#21). Where the text and the right arrow do not fit side by side, the arrow moves under
 * the text, right-aligned, and the name breaks at its soft hyphens (#115 b). The name, the percentage and the arrows
 * are hidden from assistive technology, which reads the clean name and the change in words. Formats as sent;
 * calculates nothing (#11).
 */
export function ExpensesItem({ item }: ExpensesItemProps) {
  const { category, total, change } = item;
  const label = categoryLabel(category);

  return (
    <li className={styles.item}>
      <CategoryIcon category={category} variant="breakdown" decorative />
      <div className={styles.body}>
        <div className={styles.text}>
          <p className={styles.name} aria-hidden="true">
            {hyphenatedCategoryLabel(category)}
          </p>
          <VisuallyHidden.Root>{label}</VisuallyHidden.Root>
          <p className={styles.amount}>{formatMoney(total)}</p>
          <p className={styles.change} aria-hidden="true">
            {change !== null && (
              <>
                {formatPercent(change.percent)}*{change.direction === 'up' && <UpArrow className={styles.up} />}
                {change.direction === 'down' && <DownArrow16 className={styles.down} />}
              </>
            )}
          </p>
          {change !== null && <VisuallyHidden.Root>{changeText(change)}</VisuallyHidden.Root>}
        </div>
        <Link to={paths.expenses} className={styles.arrow} aria-label={`${label} expenses`}>
          <ArrowRight24 className={styles.arrowIcon} aria-hidden="true" />
        </Link>
      </div>
    </li>
  );
}
