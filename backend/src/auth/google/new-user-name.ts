/** Full Name's maximum (#15), counted as `fullNameSchema` counts it: in UTF-16 code units. */
const MAX_LENGTH = 100;

/**
 * The name of a new Google user (#62, #103): the profile's name, trimmed; with no name or only spaces, the part of
 * the email before `@`, as Google gives it. A longer result is cut to its first 100 characters, never between the
 * two halves of a surrogate pair, and trimmed again, so it always passes `fullNameSchema`.
 */
export function newUserName({ name, email }: { name: string | undefined; email: string }): string {
  const base = name?.trim() || email.slice(0, email.indexOf('@')).trim();
  if (base.length <= MAX_LENGTH) return base;
  const end = isHighSurrogate(base.charCodeAt(MAX_LENGTH - 1)) ? MAX_LENGTH - 1 : MAX_LENGTH;
  return base.slice(0, end).trim();
}

const isHighSurrogate = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;
