import type { ReactNode } from 'react';

import styles from './TextDivider.module.css';

/** Centered gray text with a line on each side: "or sign in with" (101), "or sign up with" (102). */
export function TextDivider({ children }: { children: ReactNode }) {
  return (
    <div className={styles.divider}>
      <span className={styles.line} aria-hidden="true" />
      <span className={styles.text}>{children}</span>
      <span className={styles.line} aria-hidden="true" />
    </div>
  );
}
