import { z } from 'zod';

/**
 * The username rule (#62): 3 to 30 characters of `a` to `z`, `0` to `9`, `.` and `_` (#95 d).
 * Generated usernames pass it (#67), and the Settings username field checks against it.
 */
export const usernameSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9._]+$/);

/** The signed-in user. */
export const currentUserSchema = z.object({
  fullName: z.string(),
  email: z.email(),
  username: usernameSchema,
});

export type CurrentUser = z.infer<typeof currentUserSchema>;
