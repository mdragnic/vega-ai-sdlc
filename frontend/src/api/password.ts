import { authContract, type PasswordChangeRequest } from '@finebank/shared';

import { useUserWrite } from './session';

const changePasswordMutationKey = ['password', 'change'] as const;

/**
 * `PUT /api/auth/password`, "Update Password" (task 030, #34): through the shared write helper (#119), so it carries the
 * tab's user, a 409 asks for the session again and a 401 ends it (`createQueryClient`). The body is exactly the current
 * and the new password as typed; the form's retype is never sent. On success nothing in the cache changes: no query
 * shows a changed value, and the current session stays (the response sets no cookie), so the session query is left
 * alone. The passwords leave the mutation cache as soon as nothing shows the write (`useUserWrite`'s `gcTime: 0`).
 */
export function useChangePassword() {
  return useUserWrite({
    mutationKey: changePasswordMutationKey,
    entry: authContract.changePassword,
    args: ({ currentPassword, newPassword }: PasswordChangeRequest) => [{ currentPassword, newPassword }],
    onSuccess: () => undefined,
  });
}
