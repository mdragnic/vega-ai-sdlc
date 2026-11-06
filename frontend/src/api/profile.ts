import { type CurrentUser, profileContract, type ProfileUpdateRequest } from '@finebank/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from './client';
import { sessionEpoch, sessionQueryKey, useUserWrite } from './session';

const profileQueryKey = ['profile'] as const;
const updateProfileMutationKey = [...profileQueryKey, 'update'] as const;

/**
 * The signed-in user's profile, the Account tab's five fields (US-18, #33). The app's query defaults apply (asked for
 * again when the window gets focus back, 3 retries), but nothing is kept once Settings is left (`gcTime: 0`): the form
 * reads the profile once, as it mounts, so it must start from the stored profile, never from an answer older than a
 * change made since in another tab (a save from such a form would write the old values back). Removed with every
 * cached query when a session starts or ends (#39).
 */
export function useProfile() {
  return useQuery({ queryKey: profileQueryKey, queryFn: () => apiRequest(profileContract.get), gcTime: 0 });
}

/**
 * `PATCH /api/profile`, "Save changes" (#33, #76, #127): one multipart request through the shared write helper (#119; a
 * late answer after a session end changes nothing, #39). On success the stored profile from the answer goes into
 * `['profile']` (a profile read still running is cancelled first), and the session's user (the sidebar's name and
 * initials, Overview's greeting, US-04) takes its name, email and username from the same answer, with no request (US-18
 * criterion 15): a session check still running is cancelled first, so an answer sent before the save cannot bring the
 * old name back. The email is unchanged (#33), so the same user stays signed in: nothing is cleared and the page does
 * not remount. Nothing else is asked for again.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useUserWrite({
    mutationKey: updateProfileMutationKey,
    entry: profileContract.update,
    args: (request: ProfileUpdateRequest) => [request],
    onSuccess: async (profile) => {
      const epoch = sessionEpoch(queryClient);
      // A profile read sent before the save (window focus) would bring the old values back: cancelled first.
      await queryClient.cancelQueries({ queryKey: profileQueryKey, exact: true });
      if (epoch !== sessionEpoch(queryClient)) return;
      queryClient.setQueryData(profileQueryKey, profile);
      await queryClient.cancelQueries({ queryKey: sessionQueryKey, exact: true });
      // A session that ended while the check was cancelled keeps its own state.
      if (epoch !== sessionEpoch(queryClient)) return;
      const { fullName, email, username } = profile;
      const user: CurrentUser = { fullName, email, username };
      queryClient.setQueryData<CurrentUser | null>(sessionQueryKey, user);
    },
  });
}
