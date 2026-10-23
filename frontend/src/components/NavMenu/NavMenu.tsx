import type { ComponentType, SVGProps } from 'react';
import { Link } from 'react-router';

import { Bill, Expenses, Goal, MenuOverview, MenuSettings, Transaction, Wallet } from '../../assets/icons';
import { paths } from '../../routes/paths';
import styles from './NavMenu.module.css';

/** The sidebar sections, in sidebar order. */
export const navSections = ['overview', 'balances', 'transactions', 'bills', 'expenses', 'goals', 'settings'] as const;

export type NavSection = (typeof navSections)[number];

// Icons matched to 104 and 105 by rendering every candidate against the PNG (task 003 Log).
const sectionItems: Record<NavSection, { label: string; Icon: ComponentType<SVGProps<SVGSVGElement>>; path: string }> =
  {
    overview: { label: 'Overview', Icon: MenuOverview, path: paths.overview },
    balances: { label: 'Balances', Icon: Wallet, path: paths.balances },
    transactions: { label: 'Transactions', Icon: Transaction, path: paths.transactions },
    bills: { label: 'Bills', Icon: Bill, path: paths.bills },
    expenses: { label: 'Expenses', Icon: Expenses, path: paths.expenses },
    goals: { label: 'Goals', Icon: Goal, path: paths.goals },
    // Settings opens on the Account tab (US-04).
    settings: { label: 'Settings', Icon: MenuSettings, path: paths.settingsAccount },
  };

/**
 * Figma `Menu` (2:112): one sidebar item, a link to its section. Status=Active (teal, white text) when
 * `active`; otherwise Inactive, with the Hover style under the pointer.
 */
export function NavMenu({ section, active = false }: { section: NavSection; active?: boolean }) {
  const { label, Icon, path } = sectionItems[section];

  return (
    <Link
      to={path}
      className={active ? `${styles.item} ${styles.active}` : styles.item}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className={styles.icon} aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}
