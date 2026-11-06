import { initials } from '@finebank/shared';
import { useState } from 'react';

import styles from './Avatar.module.css';

/**
 * The user's photo, or without one a circle with their initials (#38, #62). Both are named by the full
 * name. The initials circle is not designed: tokens only, chosen in task 003. A photo that fails to load (its
 * file gone) shows the initials too, until the address changes (task 029).
 */
export function Avatar({ fullName, photoUrl }: { fullName: string; photoUrl?: string }) {
  const [failedUrl, setFailedUrl] = useState<string>();

  if (photoUrl && photoUrl !== failedUrl) {
    return <img className={styles.avatar} src={photoUrl} alt={fullName} onError={() => setFailedUrl(photoUrl)} />;
  }

  return (
    <span className={`${styles.avatar} ${styles.initials}`} role="img" aria-label={fullName}>
      <span aria-hidden="true">{initials(fullName)}</span>
    </span>
  );
}
