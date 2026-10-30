import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { ChevronRight } from '../../assets/icons';
import styles from './Button.module.css';

type ButtonProps = {
  /** The in-app path it opens, without a full page load. */
  to: string;
  /** The visible label, which names the link. */
  children: ReactNode;
  /** The id(s) of the text that tells this link apart from the others with the same label. */
  'aria-describedby'?: string;
};

/**
 * Figma `Button` (43:1161), "Details >" on a Balances card (105): the teal button with its label and the white
 * chevron. It navigates, so it is a link, with the teal ring on keyboard focus (#87); no hover style (not designed).
 */
export function Button({ to, children, 'aria-describedby': describedBy }: ButtonProps) {
  return (
    <Link to={to} className={styles.button} aria-describedby={describedBy}>
      {children}
      <ChevronRight className={styles.chevron} aria-hidden="true" />
    </Link>
  );
}
