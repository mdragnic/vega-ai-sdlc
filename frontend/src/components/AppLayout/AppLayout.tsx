import type { ReactNode } from 'react';

import styles from './AppLayout.module.css';

type AppLayoutProps = {
  /** The `NavBar`. */
  navBar: ReactNode;
  /** The `Header`. */
  header: ReactNode;
  /** The screen content. */
  children: ReactNode;
};

/**
 * The frame of every app screen (104 to 112): the sidebar on the left stays in place while the page scrolls
 * (#5); the main column holds the header and then the content, and both scroll (#83).
 */
export function AppLayout({ navBar, header, children }: AppLayoutProps) {
  return (
    <div className={styles.layout}>
      <div className={styles.sidebar}>{navBar}</div>
      <div className={styles.column}>
        {header}
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
