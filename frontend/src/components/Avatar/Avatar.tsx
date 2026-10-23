import { initials } from '@finebank/shared';

import styles from './Avatar.module.css';

/**
 * The user's photo, or without one a circle with their initials (#38, #62). Both are named by the full
 * name. The initials circle is not designed: tokens only, chosen in task 003.
 */
export function Avatar({ fullName, photoUrl }: { fullName: string; photoUrl?: string }) {
  if (photoUrl) {
    return <img className={styles.avatar} src={photoUrl} alt={fullName} />;
  }

  return (
    <span className={`${styles.avatar} ${styles.initials}`} role="img" aria-label={fullName}>
      <span aria-hidden="true">{initials(fullName)}</span>
    </span>
  );
}
