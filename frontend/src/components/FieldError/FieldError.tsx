import type { ReactNode } from 'react';

import styles from './FieldError.module.css';

/** The inline message under a form field (#6). `Input` links it to the field through `id`. */
export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className={styles.error}>
      {children}
    </p>
  );
}
