/** Injects the `GoogleClient`, or null when none is configured outside tests (#75, #102). */
export const GOOGLE_CLIENT = Symbol('GOOGLE_CLIENT');

/** Google's scopes for sign-in only (#75): no offline access, so no refresh token is asked for. */
export const GOOGLE_SCOPES = ['openid', 'email', 'profile'] as const;

/** The claims a verified Google ID token gives. `email` and `name` can be missing. */
export interface GoogleProfile {
  email: string | undefined;
  /** True only when the token says `email_verified: true` (#75). */
  emailVerified: boolean;
  name: string | undefined;
}

/**
 * Google's authorization code flow with PKCE (#75): the real client, or the fake with NODE_ENV=test. Google's
 * tokens are used once and never stored.
 */
export interface GoogleClient {
  /** Where the browser signs in: the client ID, the redirect URI, the scopes, the state and the S256 challenge. */
  authorizationUrl(request: { state: string; codeChallenge: string }): string;
  /**
   * Exchanges the code with the PKCE verifier and verifies the ID token (signature, audience, issuer, expiry).
   * Throws on any failure, with an error that holds none of the request's values.
   */
  profile(request: { code: string; codeVerifier: string }): Promise<GoogleProfile>;
}

/** A Google call that failed. Its message is ours: never the library's error, which can hold the token request. */
export class GoogleClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleClientError';
  }
}
