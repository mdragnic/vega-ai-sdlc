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
};

/**
 * Figma `Nav bar` (411:6442): the dark sidebar, 280px wide and as tall as the viewport. From the top: the
 * white logo (#66, #70), the seven sections, then Logout and the profile block at the bottom.
 */
export function NavBar({ activeSection, fullName, photoUrl, onLogout }: NavBarProps) {
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
        <Logout onLogout={onLogout} />
        <Profile fullName={fullName} photoUrl={photoUrl} />
      </div>
    </div>
  );
}
