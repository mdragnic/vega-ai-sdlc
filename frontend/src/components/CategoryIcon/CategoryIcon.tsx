import { categoryLabel, type ExpenseCategory } from '@finebank/shared';
import type { ComponentType, SVGProps } from 'react';

import { Food, Housing, Movie, Others, Shopping, Transport, Wallet } from '../../assets/icons';
import styles from './CategoryIcon.module.css';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

// Matched to 104, 107, 109 and 110 by rendering every icon and diffing it against the PNGs (task 004 Log).
const ICONS: Record<ExpenseCategory, Icon> = {
  housing: Housing,
  food: Food,
  transportation: Transport,
  entertainment: Movie,
  shopping: Shopping,
  others: Others,
};

type CategoryIconProps = {
  /** The expense category, or `null` for income, which has no category and uses the wallet (#56). */
  category: ExpenseCategory | null;
  /**
   * The measured context: a gray tile in 104 Recent Transaction (`recent`), 104 Expenses Breakdown
   * (`breakdown`), on the 109 card header (`header`) and in 110 Goals (`goal`); no tile in 107 rows (`plain`).
   */
  variant: 'recent' | 'breakdown' | 'header' | 'goal' | 'plain';
  /** When the category name shows next to the icon, so the icon would repeat it. */
  decorative?: boolean;
};

/** The icon of an expense category, or of income (#56). Named by the category label unless decorative. */
export function CategoryIcon({ category, variant, decorative = false }: CategoryIconProps) {
  const Icon = category === null ? Wallet : ICONS[category];
  const label = category === null ? 'Income' : categoryLabel(category);
  const a11y = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label };

  return (
    <span className={`${styles.icon} ${styles[variant]}`} {...a11y}>
      <Icon className={styles.glyph} aria-hidden="true" />
    </span>
  );
}
