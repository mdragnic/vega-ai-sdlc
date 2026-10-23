import { LogoutIcon } from '../../assets/icons';
import styles from './Logout.module.css';

/** Figma `Logout` (13:612): the sidebar button above the profile block. What logging out does is task 011. */
export function Logout({ onLogout }: { onLogout: () => void }) {
  return (
    <button type="button" className={styles.button} onClick={onLogout}>
      <LogoutIcon className={styles.icon} aria-hidden="true" />
      <span>Logout</span>
    </button>
  );
}
