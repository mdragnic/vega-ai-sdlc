import type { ReactNode } from 'react';

import { Logo } from '../../assets';
import styles from './AuthLayout.module.css';

/**
 * The frame of Login, Sign up and Forgot Password: a light gray page with a centered 400px column and
 * the logo in primary teal at its top (#66, #70). Each screen sets its own top offset through `className`.
 */
export function AuthLayout({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={styles.page}>
      <main className={className ? `${styles.column} ${className}` : styles.column}>
        <Logo className={styles.logo} role="img" aria-label="FINEbank.IO" />
        {children}
      </main>
    </div>
  );
}
