import type { ReactNode } from 'react';

import styles from './Card.module.css';

type CardProps = {
  /** `none` for content that sets its own insets, such as tables and Settings. */
  padding?: 'default' | 'none';
  /** Layout from the screen: size and grid placement. */
  className?: string;
  children: ReactNode;
};

/** The white content card of the app screens (104 to 112): card radius, card shadow and 24px padding. */
export function Card({ padding = 'default', className, children }: CardProps) {
  const classes = [styles.card, padding === 'none' && styles.flush, className].filter(Boolean).join(' ');
  return <div className={classes}>{children}</div>;
}
