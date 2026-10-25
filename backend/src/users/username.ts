const MAX_LENGTH = 30;
const BASE_LENGTH = 26;
const MIN_LENGTH = 3;

/**
 * The username made from an email (#62, #67, #95 b): the part before `@`, lowercased, without
 * the characters the username rule does not allow, cut to 26 characters, then padded with
 * digits counted up from 1 until it has 3 (`jo` gives `jo1`, `j` gives `j12`, nothing gives `123`).
 */
export function usernameBase(email: string): string {
  let base = email
    .slice(0, email.indexOf('@'))
    .toLowerCase()
    .replaceAll(/[^a-z0-9._]/g, '')
    .slice(0, BASE_LENGTH);
  for (let digit = 1; base.length < MIN_LENGTH; digit += 1) {
    base += String(digit);
  }
  return base;
}

/**
 * The n-th username to try for a base: the base itself, then the uniqueness number from 2
 * (`marko`, `marko2`, `marko3`). A 26-character base takes numbers up to 9999 within 30
 * characters; beyond that, the base is shortened so the result still fits.
 */
export function usernameCandidate(base: string, n: number): string {
  if (n === 1) return base;
  const suffix = String(n);
  return base.slice(0, MAX_LENGTH - suffix.length) + suffix;
}
