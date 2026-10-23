import type { ReactNode } from 'react';

import styles from './FormError.module.css';

/** The server error above a form's submit button, announced as an alert (#6). Renders nothing without a message. */
export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;

  return (
    <p role="alert" className={styles.error}>
      {children}
    </p>
  );
}
