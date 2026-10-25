import { Navigate, Outlet, useLocation } from 'react-router';

import { useSession } from '../api/session';
import { loginPathFor } from './return-to';

/**
 * Layout route around every app page: signed out, Login opens with this page as the return target (#3). It
 * also does so when the session ends while the page is open (a 401, `createQueryClient`). While the session
 * check runs, only the page background shows (#97 c).
 */
export function RequireAuth() {
  const session = useSession();
  const location = useLocation();

  if (session.status === 'checking') return null;
  if (session.status === 'signedOut') return <Navigate replace to={loginPathFor(location)} />;
  return <Outlet />;
}
