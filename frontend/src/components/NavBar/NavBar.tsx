import { Logo } from '../../assets';
import { Logout } from '../Logout/Logout';
import { NavMenu, navSections, type NavSection } from '../NavMenu/NavMenu';
import { Profile } from '../Profile/Profile';
import styles from './NavBar.module.css';

type NavBarProps = {
  /** The section shown as Active. Which section a URL belongs to is task 011 (#47). */
  activeSection: NavSection;
  fullName: string;
  photoUrl?: string;
  onLogout: () => void;
  /** While the logout request runs: Logout cancels its clicks and keeps focus (#100 c). */
  logoutPending?: boolean;
  /** Why the last logout failed, shown right above Logout and announced (#100 c). */
  logoutError?: string;
};

/**
 * Figma `Nav bar` (411:6442): the dark sidebar, 280px wide and as tall as the viewport. From the top: the
 * white logo (#66, #70), the seven sections, then Logout and the profile block at the bottom. A failed logout's
 * message, not designed, shows right above Logout; Logout and the profile block stay in place.
 */
export function NavBar({ activeSection, fullName, photoUrl, onLogout, logoutPending, logoutError }: NavBarProps) {
  return (
    <div className={styles.navBar}>
      <div className={styles.brand}>
        <Logo className={styles.logo} role="img" aria-label="FINEbank.IO" />
      </div>
      <nav className={styles.nav} aria-label="Main">
        <ul className={styles.list}>
          {navSections.map((section) => (
            <li key={section}>
              <NavMenu section={section} active={section === activeSection} />
            </li>
          ))}
        </ul>
      </nav>
      <div className={styles.bottom}>
        <div className={styles.logout}>
          {logoutError && (
            <p role="alert" className={styles.logoutError}>
              {logoutError}
            </p>
          )}
          <Logout onLogout={onLogout} pending={logoutPending} />
        </div>
        <Profile fullName={fullName} photoUrl={photoUrl} />
      </div>
    </div>
  );
}
