import { type CurrentUser, profileContract, type ProfileUpdateRequest } from '@finebank/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from './client';
import { sessionEpoch, sessionQueryKey, useUserWrite } from './session';

const profileQueryKey = ['profile'] as const;

/**
 * The stored photo's address (#76, task 029): the contract's path through the same origin, and `?v=` its update time, so
 * a new photo gets a new address and a mounted `<img>` asks for it again (the backend ignores `v`). The one helper for
 * the box and the sidebar.
 */
export const photoUrl = (photoUpdatedAt: string): string =>
  `/api${profileContract.photo.path}?${new URLSearchParams({ v: photoUpdatedAt }).toString()}`;
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
 * late answer after a session end changes nothing, #39), with the chosen photo as its file part (task 029). On success
 * the stored profile from the answer goes into `['profile']` (a profile read still running is cancelled first), and the
 * session's user (the sidebar's name, initials and photo, Overview's greeting, US-04) takes its name, email, username and
 * photo time (set, or removed) from the same answer, with no request (US-18 criteria 10 and 15): a session check still
 * running is cancelled first, so an answer sent before the save cannot bring the old values back. The email is unchanged
 * (#33), so the same user stays signed in: nothing is cleared and the page does not remount. Nothing else is asked for
 * again.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useUserWrite({
    mutationKey: updateProfileMutationKey,
    entry: profileContract.update,
    // The checked photo's file goes as the file part; its detected type stays with the backend's own check (#76).
    args: ({ photo, ...fields }: ProfileUpdateRequest) => [{ ...fields, photo: photo?.file }],
    onSuccess: async (profile) => {
      const epoch = sessionEpoch(queryClient);
      // A profile read sent before the save (window focus) would bring the old values back: cancelled first.
      await queryClient.cancelQueries({ queryKey: profileQueryKey, exact: true });
      if (epoch !== sessionEpoch(queryClient)) return;
      queryClient.setQueryData(profileQueryKey, profile);
      await queryClient.cancelQueries({ queryKey: sessionQueryKey, exact: true });
      // A session that ended while the check was cancelled keeps its own state.
      if (epoch !== sessionEpoch(queryClient)) return;
      const { fullName, email, username, photoUpdatedAt } = profile;
      const user: CurrentUser = { fullName, email, username, ...(photoUpdatedAt ? { photoUpdatedAt } : {}) };
      queryClient.setQueryData<CurrentUser | null>(sessionQueryKey, user);
    },
  });
}
