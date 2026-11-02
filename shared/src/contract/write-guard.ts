/**
 * The shared write guard (#119): every write behind the session guard carries the email of the user the tab shows in
 * this header. The backend answers 400 without it (or when it is not an email) and 409 when it is not the session
 * user's, before anything is read or written, so a stale tab never writes into another user's data (#110).
 */
export const EXPECTED_USER_HEADER = 'X-Expected-User';

/** The guard's answers (#119): the 409's text, shown above the form's submit button (#97 a), and the 400's. */
export const writeGuardMessages = {
  otherUser: 'Another user is signed in. Nothing was saved.',
  expectedUserInvalid: 'The X-Expected-User header must hold the email of the signed-in user',
} as const;
