import { z } from 'zod';

import { fullNameSchema } from './auth.js';
import { countryCallingCodes } from './country-calling-codes.js';
import type { ContractEntry } from './entry.js';
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
 * no number is the empty string), each by its one shared rule (#74, #126), the output trimmed and the number digits only.
 * Unknown keys are dropped, so an email, a password, an ID, a user or a photo URL never reaches the backend's logic: the
 * email is read-only (#33) and stays the write guard's identity (#119). The form uses it as is.
 */
export const profileUpdateRequestSchema = z.object({
  fullName: fullNameSchema,
  username: usernameSchema,
  phoneCountryCode: phoneCountryCodeSchema,
  phoneNumber: phoneNumberSchema,
});

export type ProfileUpdateRequest = z.infer<typeof profileUpdateRequestSchema>;

/**
 * The signed-in user's profile, the Account tab's fields: the session user's three keys and the phone's two, as stored.
 * Its `fullName` is any stored string (#126 a's condition). Unknown keys are dropped.
 */
export const profileSchema = currentUserSchema.extend({
  phoneCountryCode: z.string(),
  phoneNumber: z.string(),
});

export type Profile = z.infer<typeof profileSchema>;

/**
 * The signed-in user's profile (US-18, #33): `get` its five fields for the Account tab, and `update` its four editable
 * ones, one `multipart/form-data` request (#76: the photo part follows in task 029), answering the stored profile. The
 * user comes from the session only (#39, #46).
 */
export const profileContract = {
  get: { method: 'GET', path: '/profile', request: undefined, response: profileSchema },
  update: {
    method: 'PATCH',
    path: '/profile',
    request: profileUpdateRequestSchema,
    response: profileSchema,
    encoding: 'multipart',
  },
} as const satisfies Record<string, ContractEntry>;
