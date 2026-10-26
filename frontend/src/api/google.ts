import { googleSignIn, RETURN_TO_PARAM } from '@finebank/shared';

/** The backend route that starts Google sign-in (#75), with the page to open afterwards when given (#3). */
export function googleSignInUrl(returnTo?: string): string {
  const start = `/api${googleSignIn.start}`;
  if (returnTo === undefined) return start;
  return `${start}?${new URLSearchParams({ [RETURN_TO_PARAM]: returnTo }).toString()}`;
}

/**
 * Starts Google sign-in in this tab: a full page load, not a fetch. The backend sends the browser on to Google, and
 * Google back to the backend, which opens the page asked for, or Login when the sign-in did not happen (#75, #81).
 */
export function startGoogleSignIn(returnTo?: string): void {
  window.location.assign(googleSignInUrl(returnTo));
}
