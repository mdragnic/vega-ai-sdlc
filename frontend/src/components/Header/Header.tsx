import { formatDate } from '@finebank/shared';

import { ChevronsRight, NotificationIcon } from '../../assets/icons';
import { HeaderSearch } from '../HeaderSearch/HeaderSearch';
import styles from './Header.module.css';

type HeaderProps = {
  /** The signed-in user's first name, given on Overview only (#10). */
  greetingName?: string;
  /** Today as a plain date `YYYY-MM-DD`: the backend's today in the browser's time zone (#54). */
  today: string;
};

/**
 * Figma `Header` (411:6067): "Hello <name>" on Overview, the "»" icon and today's date (#10, #11), the bell
 * with its teal dot (#8) and the search field (#7). The "»" icon and the bell are visual only.
 */
export function Header({ greetingName, today }: HeaderProps) {
  return (
    <header className={styles.header}>
      {greetingName && <p className={styles.greeting}>Hello {greetingName}</p>}
      <ChevronsRight className={styles.chevron} aria-hidden="true" />
      <time className={styles.date} dateTime={today}>
        {formatDate(today)}
      </time>
      <NotificationIcon className={styles.bell} aria-hidden="true" />
      <HeaderSearch />
    </header>
  );
}
