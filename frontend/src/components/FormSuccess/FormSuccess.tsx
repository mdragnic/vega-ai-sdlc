import type { ReactNode } from 'react';

import styles from './FormSuccess.module.css';

/**
 * The success text above a form's submit button, "Profile updated" (#52; task 030's "Password updated", #34), in
 * `FormError`'s place and type (#6). Its `role="status"` region is always on the page and empty without a message, so the
 * message is announced when it comes; the empty region takes no room.
 */
export function FormSuccess({ children }: { children?: ReactNode }) {
  return <div role="status">{children ? <p className={styles.success}>{children}</p> : null}</div>;
}
