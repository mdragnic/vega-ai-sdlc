import { z } from 'zod';

/**
 * The texts of the Account tab's rules (#126 b, c, d; #62's taken username), one message per field, its first failing
 * rule (#95 a). Full name's texts are `fullNameSchema`'s (#126 a).
 */
export const profileMessages = {
  usernameRequired: 'Username is required',
  usernameMin: 'Username must be at least 3 characters',
  usernameMax: 'Username must be at most 30 characters',
  usernameCharacters: 'Username can only contain lowercase letters, numbers, dots and underscores',
  usernameTaken: 'This username is already taken',
  phoneDigits: 'Phone Number can only contain digits',
  phoneMax: 'Phone Number must be at most 15 digits',
  countryCodeInvalid: 'Choose a country code',
} as const;

/** The length of a text in code points, the unit of every length rule (#120 b1, #126 b). */
// oxlint-disable-next-line typescript/no-misused-spread
const codePoints = (text: string) => [...text].length;

/**
 * The username rule (#62, #126 b): trimmed at both ends, then 3 to 30 characters (code points) of `a` to `z`, `0` to `9`,
 * `.` and `_` (#95 d), one message, its first failing rule (#95 a). Uppercase is refused, not lowercased: nothing typed
 * is changed but the trim. Generated usernames pass it (#67); its uniqueness is the database's (`users.username`).
 */
export const usernameSchema = z
  .string({ error: (issue) => (issue.input === undefined ? profileMessages.usernameRequired : undefined) })
  .trim()
  .min(1, { error: profileMessages.usernameRequired, abort: true })
  .refine((text) => codePoints(text) >= 3, { error: profileMessages.usernameMin, abort: true })
  .refine((text) => codePoints(text) <= 30, { error: profileMessages.usernameMax, abort: true })
  .regex(/^[a-z0-9._]+$/, { error: profileMessages.usernameCharacters });

/**
 * The signed-in user. `fullName` is any stored string (#126 a's condition): the name rule applies to requests, so a
 * name stored before it never breaks the session.
 */
export const currentUserSchema = z.object({
  fullName: z.string(),
  email: z.email(),
  username: usernameSchema,
});

export type CurrentUser = z.infer<typeof currentUserSchema>;
