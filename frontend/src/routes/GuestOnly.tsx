import { Navigate, Outlet } from 'react-router';

import { useLoginInProgress, useSession } from '../api/session';
import { paths } from './paths';

/**
 * Layout route around Login: a signed-in user goes to Overview, whatever `returnTo` says (#3). After a login on
 * this screen, the screen itself opens the return target. While the session check runs, only the page
 * background shows (#97 c), so the form never flashes before Overview.
 */
export function GuestOnly() {
  const session = useSession();
  const loginInProgress = useLoginInProgress();

  if (session.status === 'checking') return null;
  if (session.status === 'signedIn' && !loginInProgress) return <Navigate replace to={paths.overview} />;
  return <Outlet />;
}
