import { z } from 'zod';

import { fullNameSchema } from './auth.js';
import { countryCallingCodes } from './country-calling-codes.js';
import type { ContractEntry } from './entry.js';
import { photoSchema } from './profile-photo.js';
import { currentUserSchema, profileMessages, usernameSchema } from './user.js';

/** The most digits of a Phone Number: E.164's maximum for a whole number (#126 c). */
const MAX_PHONE_DIGITS = 15;

/** One of the listed codes (#43, #126 d), anything else "Choose a country code" (only a direct request can send one). */
export const phoneCountryCodeSchema = z.enum(countryCallingCodes, { error: profileMessages.countryCodeInvalid });

/**
 * The Phone Number without its country code (#33, #126 c as answered): trimmed at both ends with `trim()`, then every
 * space (U+0020) and hyphen (U+002D) removed. What is left is the value: empty is no number (it is optional; the country
 * code stays as chosen); otherwise only `0` to `9`, "Phone Number can only contain digits", and at most 15 digits, "Phone
 * Number must be at most 15 digits". The output is digits only, stored and shown with no grouping (`51547 58868` gives
 * `5154758868`).
 */
export const phoneNumberSchema = z
  .string()
  .trim()
  .transform((text) => text.replaceAll(/[ -]/g, ''))
  .refine((digits) => /^[0-9]*$/.test(digits), { error: profileMessages.phoneDigits, abort: true })
  .refine((digits) => digits.length <= MAX_PHONE_DIGITS, { error: profileMessages.phoneMax });

/**
 * `PATCH /profile`, Update Profile (#33): exactly the four editable fields, all required (the form always sends all four;
 * no number is the empty string), each by its one shared rule (#74, #126), the output trimmed and the number digits only,
 * and an optional `photo`, the shared photo rule (#76, task 029): with one, async (`parseAsync`). Unknown keys are
 * dropped, so an email, a password, an ID, a user or a photo URL never reaches the backend's logic: the email is
 * read-only (#33) and stays the write guard's identity (#119). The form uses it as is.
 */
export const profileUpdateRequestSchema = z.object({
  fullName: fullNameSchema,
  username: usernameSchema,
  phoneCountryCode: phoneCountryCodeSchema,
  phoneNumber: phoneNumberSchema,
  photo: photoSchema.optional(),
});

export type ProfileUpdateRequest = z.infer<typeof profileUpdateRequestSchema>;

/**
 * The signed-in user's profile, the Account tab's fields: the session user's keys (`photoUpdatedAt` only with a stored
 * photo, task 029) and the phone's two, as stored. Its `fullName` is any stored string (#126 a's condition). And
 * `hasPassword` (task 030): false for a Google-only user, whose Security tab shows the phone alone (#2, #34, #104).
 * Unknown keys are dropped.
 */
export const profileSchema = currentUserSchema.extend({
  phoneCountryCode: z.string(),
  phoneNumber: z.string(),
  hasPassword: z.boolean(),
});

export type Profile = z.infer<typeof profileSchema>;

/**
 * The signed-in user's profile (US-18, #33): `get` its fields for the Account tab; `update` its four editable ones and
 * an optional photo, one `multipart/form-data` request with the photo as its one file part `photo` (#76), answering
 * the stored profile; `photo`, the stored photo's bytes with their stored type (#76), a file, not JSON: the frontend
 * puts its address, `?v=` and `photoUpdatedAt`, in an `<img>`. The user comes from the session only (#39, #46).
 */
export const profileContract = {
  get: { method: 'GET', path: '/profile', request: undefined, response: profileSchema },
  update: {
    method: 'PATCH',
    path: '/profile',
    request: profileUpdateRequestSchema,
    response: profileSchema,
    encoding: 'multipart',
    filePart: 'photo',
  },
  photo: {
    method: 'GET',
    path: '/profile/photo',
    request: undefined,
    // The bytes of a file with their own type, never read as JSON (`responseEncoding`).
    response: z.unknown(),
    responseEncoding: 'file',
  },
} as const satisfies Record<string, ContractEntry>;
