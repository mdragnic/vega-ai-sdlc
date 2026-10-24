import { createContext, useState, type ReactNode } from 'react';

import styles from './AppLayout.module.css';

/**
 * The content area of the screen (the `main` element, right of the sidebar and below the header), or null
 * outside `AppLayout`. `Popup` dims from its top edge.
 */
export const ContentAreaContext = createContext<HTMLElement | null>(null);

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
  const [contentArea, setContentArea] = useState<HTMLElement | null>(null);

  return (
    <ContentAreaContext value={contentArea}>
      <div className={styles.layout}>
        <div className={styles.sidebar}>{navBar}</div>
        <div className={styles.column}>
          {header}
          <main ref={setContentArea} className={styles.content}>
            {children}
          </main>
        </div>
      </div>
    </ContentAreaContext>
  );
}
