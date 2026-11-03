import { Link } from 'react-router';

import styles from './ScrollFixture.module.css';

type ScrollFixtureProps = {
  /** The other fixture page, which the link opens. */
  otherPage: string;
};

/**
 * Test fixture only (task 023): a page inside the shell taller than the window, for task 011's scroll tests (e2e
 * `app-shell-slice.spec.ts` T26 and T27), so they never depend on a real page being empty. A link to the other
 * fixture page, then a block 3000 high; no data and no request. Its routes exist only in the e2e run (`routes.tsx`).
 */
export function ScrollFixture({ otherPage }: ScrollFixtureProps) {
  return (
    <div>
      <Link to={otherPage} className={styles.link}>
        Scroll fixture page: open the other
      </Link>
      <div className={styles.block} />
    </div>
  );
}
