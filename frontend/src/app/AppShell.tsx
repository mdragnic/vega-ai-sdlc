import { firstName } from '@finebank/shared';
import { Outlet, ScrollRestoration, useMatches } from 'react-router';

import { useToday } from '../api/calendar';
import { useLogout, useSession } from '../api/session';
import { AppLayout, Header, NavBar } from '../components';
import type { NavSection } from '../components/NavMenu/NavMenu';
import styles from './AppShell.module.css';

/** What an app page's route tells the shell: its sidebar section, and whether the header greets (#10, #47). */
export type ShellHandle = { section: NavSection; greeting?: boolean };

const isShellHandle = (handle: unknown): handle is ShellHandle =>
  typeof handle === 'object' && handle !== null && 'section' in handle;

/** The failed logout's message, next to Logout (#100 c). */
const logoutFailedMessage = "Couldn't log out. Please try again.";

/**
 * Layout route around every app page (104 to 112), inside `RequireAuth`: the sidebar and the header for the
 * signed-in user, with the page below. It stays mounted while the user moves between pages. Another page
 * opens at the top; Back and Forward restore the position (#100 d). The page remounts when the signed-in user
 * changes.
 */
export function AppShell() {
  const session = useSession();
  const handle = useMatches()
    .map((match) => match.handle)
    .findLast(isShellHandle);
  const today = useToday();
  const logout = useLogout();

  // RequireAuth renders the shell for a signed-in user only.
  if (session.status !== 'signedIn' || !handle) return null;
  const { fullName } = session.user;

  return (
    <div className={styles.shell}>
      <AppLayout
        navBar={
          <NavBar
            activeSection={handle.section}
            fullName={fullName}
            onLogout={logout.logOut}
            logoutPending={logout.pending}
            logoutError={logout.failed ? logoutFailedMessage : undefined}
          />
        }
        header={<Header greetingName={handle.greeting ? firstName(fullName) : undefined} today={today} />}
      >
        {/* Keyed on the user: when another tab signs in someone else, the page remounts, so an open popup closes
            and nothing typed for the earlier user stays (#39). */}
        <Outlet key={session.user.email} />
      </AppLayout>
      <ScrollRestoration />
    </div>
  );
}
