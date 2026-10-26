import { LogoutIcon } from '../../assets/icons';
import styles from './Logout.module.css';

type LogoutProps = {
  onLogout: () => void;
  /**
   * While the logout request runs (#100 c): `aria-disabled`, and clicks (also Enter) are cancelled. Not the
   * native `disabled`, so the button keeps keyboard focus, as `ButtonPrimary` does. It looks the same: no
   * pending state is designed.
   */
  pending?: boolean;
};

/** Figma `Logout` (13:612): the sidebar button above the profile block. */
export function Logout({ onLogout, pending = false }: LogoutProps) {
  return (
    <button
      type="button"
      className={styles.button}
      aria-disabled={pending || undefined}
      onClick={() => {
        if (!pending) onLogout();
      }}
    >
      <LogoutIcon className={styles.icon} aria-hidden="true" />
      <span>Logout</span>
    </button>
  );
}
