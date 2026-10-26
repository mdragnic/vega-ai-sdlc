import { authContract, type CurrentUser, type LoginRequest, type SignUpRequest } from '@finebank/shared';
import {
  matchMutation,
  MutationCache,
  type Query,
  QueryCache,
  QueryClient,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { ApiError, apiRequest } from './client';

const sessionQueryKey = ['session'] as const;
const loginMutationKey = ['session', 'login'] as const;
const signUpMutationKey = ['session', 'signUp'] as const;
const logoutMutationKey = ['session', 'logout'] as const;

/** Who is signed in, from `GET /api/auth/me` (#3). */
export type Session = { status: 'checking' } | { status: 'signedIn'; user: CurrentUser } | { status: 'signedOut' };

const isUnauthorized = (error: unknown) => error instanceof ApiError && error.status === 401;

const isSessionQuery = (query: Query) => query.queryKey[0] === sessionQueryKey[0];

/** Sets who is signed in (`null`: nobody) and removes every other cached query, so no data of an earlier user stays (#39). */
function setSessionUser(queryClient: QueryClient, user: CurrentUser | null): void {
  queryClient.setQueryData<CurrentUser | null>(sessionQueryKey, user);
  queryClient.removeQueries({ predicate: (query) => !isSessionQuery(query) });
}

/**
 * The signed-in user. The check runs once when the app opens and again when the window gets focus back, so a
 * session that ended in the background is found (#3). A 401 means signed out. Any other failure, with no retry,
 * counts as signed out only on the first check (#97 b); after that the known state stays, so only a 401 ends
 * a session (#98).
 */
export function useSession(): Session {
  const query = useQuery({
    queryKey: sessionQueryKey,
    queryFn: () => apiRequest(authContract.me),
    retry: false,
    retryOnMount: false,
    // Each guard mounts its own observer; the check is not repeated on every navigation.
    refetchOnMount: false,
  });
  // A failed check keeps the data of the last one that succeeded (or of the login).
  if (query.data === null) return { status: 'signedOut' };
  if (query.data !== undefined) return { status: 'signedIn', user: query.data };
  return query.isError ? { status: 'signedOut' } : { status: 'checking' };
}

/**
 * A request that starts a session: login or sign up. On success the user goes into the session, and earlier
 * cached data is removed (#39).
 */
function useSessionStart<Request>(
  mutationKey: readonly string[],
  mutationFn: (request: Request) => Promise<CurrentUser>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey,
    mutationFn,
    // The variables hold the password: drop them as soon as the screen is gone.
    gcTime: 0,
    // A session check still running was sent without the new cookie: its 401 must not end the new session.
    onMutate: () => queryClient.cancelQueries({ queryKey: sessionQueryKey }),
    onSuccess: (user) => setSessionUser(queryClient, user),
  });
}

/** `POST /api/auth/login` (#14). */
export function useLogin() {
  return useSessionStart(loginMutationKey, (request: LoginRequest) => apiRequest(authContract.login, request));
}

/** `POST /api/auth/signup`: the new account is signed in for 30 days, with the demo dataset (#15, #63, #78). */
export function useSignUp() {
  return useSessionStart(signUpMutationKey, (request: SignUpRequest) => apiRequest(authContract.signUp, request));
}

/** The logout of the shell: its state, and `logOut`, which sends nothing while a request runs. */
export type LogoutState = { logOut: () => void; pending: boolean; failed: boolean };

/**
 * `POST /api/auth/logout` (#3, #100 c). One request at a time. On the 204 the session is signed out and every
 * other cached query is removed (#39); the app page's guard then opens Login, without a return target
 * (`useLogoutInProgress`). On a failure the session and the cached data stay: only the backend can end the
 * session (the cookie is httpOnly), so the user is still signed in, and `failed` says so until the next try.
 */
export function useLogout(): LogoutState {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: logoutMutationKey,
    mutationFn: () => apiRequest(authContract.logout),
    // Sent also while the browser counts as offline, so it fails and says so instead of waiting silently.
    networkMode: 'always',
    // Gone once the shell is: a later session's guard must not take it for this logout.
    gcTime: 0,
    onSuccess: async () => {
      // A session check sent before the logout could answer with the user after it.
      await queryClient.cancelQueries({ queryKey: sessionQueryKey });
      setSessionUser(queryClient, null);
    },
  });
  return {
    // The cache knows at once that a request runs; the component only after its next render.
    logOut: () => {
      if (queryClient.isMutating({ mutationKey: logoutMutationKey, exact: true }) === 0) mutation.mutate();
    },
    pending: mutation.isPending,
    failed: mutation.isError,
  };
}

/** True while a logout runs or once it succeeded: the session then ends without a return target (#3). */
export function useLogoutInProgress(): boolean {
  const statuses = useMutationState({
    filters: { mutationKey: logoutMutationKey, exact: true },
    select: (mutation) => mutation.state.status,
  });
  return statuses.some((status) => status === 'pending' || status === 'success');
}

const sessionStartMutationKeys = [loginMutationKey, signUpMutationKey];

/**
 * True once a login or a sign up on its screen started or succeeded. The screen then opens its target itself
 * (the return target, or Overview), so the guard does not race it there.
 */
export function useSessionStartInProgress(): boolean {
  const statuses = useMutationState({
    filters: {
      predicate: (mutation) =>
        sessionStartMutationKeys.some((mutationKey) => matchMutation({ mutationKey, exact: true }, mutation)),
    },
    select: (mutation) => mutation.state.status,
  });
  return statuses.some((status) => status === 'pending' || status === 'success');
}

/**
 * The app's query client. A 401 from any query or mutation means the session ended (expired, or deleted by a
 * logout elsewhere): the session becomes signed out, which opens Login, and every cached query is removed, so
 * the next user in this tab never sees this user's data (#3, #39, #75). A failed login's 401 is wrong
 * credentials, not a session end. A 401 is not retried.
 */
export function createQueryClient(): QueryClient {
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (isUnauthorized(error)) setSessionUser(queryClient, null);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (isUnauthorized(error) && !matchMutation({ mutationKey: loginMutationKey, exact: true }, mutation))
          setSessionUser(queryClient, null);
      },
    }),
    defaultOptions: {
      queries: { retry: (failureCount, error) => !isUnauthorized(error) && failureCount < 3 },
    },
  });
  return queryClient;
}
