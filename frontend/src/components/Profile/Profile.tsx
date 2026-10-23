import { Link } from 'react-router';

import { EllipsisVertical } from '../../assets/icons';
import { paths } from '../../routes/paths';
import { Avatar } from '../Avatar/Avatar';
import styles from './Profile.module.css';

/**
 * Figma `Profile` (403:5389), 224x104 with the divider at its top: avatar, full name and "View profile",
 * a link to the Settings Account tab (#9). The three-dot icon is visual only (#9).
 */
export function Profile({ fullName, photoUrl }: { fullName: string; photoUrl?: string }) {
  return (
    <div className={styles.profile}>
      <hr className={styles.divider} />
      <Avatar fullName={fullName} photoUrl={photoUrl} />
      <div className={styles.text}>
        <span className={styles.name}>{fullName}</span>
        <Link className={styles.link} to={paths.settingsAccount}>
          View profile
        </Link>
      </div>
      {/* The glyph's column of Lucide's 24px box, so the dots end at the block's right edge as in 104. */}
      <EllipsisVertical className={styles.dots} viewBox="10 0 4 24" aria-hidden="true" />
    </div>
  );
}
