import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';

import { useLogoutInProgress, useSession } from '../api/session';
import { paths } from './paths';
import { loginPathFor } from './return-to';

/**
 * Layout route around every app page: signed out, Login opens with this page as the return target (#3). It
 * also does so when the session ends while the page is open (a 401, `createQueryClient`). After Logout, Login
 * opens with no return target, so the next login opens Overview (#3). While the session check runs, only the
 * page background shows (#97 c).
 */
export function RequireAuth() {
  const session = useSession();
  const loggedOut = useLogoutInProgress();
  const location = useLocation();
  // Chosen once, when the session is found ended, and kept until Login opens: the logout is forgotten as soon as
  // the shell is gone, which can be before Login has opened, and a new target would restart the navigation.
  const [loginPath, setLoginPath] = useState<string | null>(null);
  const signedOut = session.status === 'signedOut';
  if (signedOut && loginPath === null) setLoginPath(loggedOut ? paths.login : loginPathFor(location));
  if (!signedOut && loginPath !== null) setLoginPath(null);

  if (session.status === 'checking') return null;
  if (signedOut) return loginPath === null ? null : <Navigate replace to={loginPath} />;
  return <Outlet />;
}
