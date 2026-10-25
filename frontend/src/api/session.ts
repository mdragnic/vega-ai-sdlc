import { authContract, type CurrentUser, type LoginRequest } from '@finebank/shared';
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

/** `POST /api/auth/login`. On success the user goes into the session, and earlier cached data is removed (#39). */
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: loginMutationKey,
    mutationFn: (request: LoginRequest) => apiRequest(authContract.login, request),
    // The variables hold the password: drop them as soon as the Login screen is gone.
    gcTime: 0,
    // A session check still running was sent without the new cookie: its 401 must not end the new session.
    onMutate: () => queryClient.cancelQueries({ queryKey: sessionQueryKey }),
    onSuccess: (user) => setSessionUser(queryClient, user),
  });
}

/**
 * True once a login on this screen started or succeeded. The screen then opens the return target itself, so
 * the guard does not race it to Overview.
 */
export function useLoginInProgress(): boolean {
  const statuses = useMutationState({
    filters: { mutationKey: loginMutationKey },
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
