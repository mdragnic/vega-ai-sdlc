import { Navigate, Outlet } from 'react-router';

import { useSession, useSessionStartInProgress } from '../api/session';
import { paths } from './paths';

/**
 * Layout route around Login, Sign up and Forgot Password: a signed-in user goes to Overview, whatever `returnTo`
 * says (#3, #99 a). After a login or a sign up on its screen, the screen itself opens its target: the return
 * target after login, Overview after sign up. While the session check runs, only the page background shows
 * (#97 c), so a form never flashes before Overview.
 */
export function GuestOnly() {
  const session = useSession();
  const sessionStartInProgress = useSessionStartInProgress();

  if (session.status === 'checking') return null;
  if (session.status === 'signedIn' && !sessionStartInProgress) return <Navigate replace to={paths.overview} />;
  return <Outlet />;
}
