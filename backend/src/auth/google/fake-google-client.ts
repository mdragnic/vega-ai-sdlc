import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { GOOGLE_REDIRECT_URI } from '../../config/config.js';
import { type GoogleClient, GoogleClientError, type GoogleProfile, GOOGLE_SCOPES } from './google-client.js';
import { pkceChallenge } from './pkce.js';

/** The client ID the fake's authorization URL names, and the only one its page accepts. */
export const FAKE_GOOGLE_CLIENT_ID = 'finebank-fake-google-client';

/** The fake Google page, relative to `/api` (`FakeGoogleController`). */
export const FAKE_GOOGLE_AUTHORIZE_PATH = '/test/google/authorize';

interface IssuedCode {
  profile: GoogleProfile;
  codeChallenge: string;
}

/**
 * Google for tests (#75, #102), used whenever NODE_ENV=test. Its authorization URL is the fake Google page, which
 * issues a one-time code for the profile entered there. A code gives its profile once, and only with the verifier
 * whose S256 hash is the challenge it was issued for, so the tests prove the PKCE wiring end to end.
 */
@Injectable()
export class FakeGoogleClient implements GoogleClient {
  private readonly codes = new Map<string, IssuedCode>();

  authorizationUrl({ state, codeChallenge }: { state: string; codeChallenge: string }): string {
    const query = new URLSearchParams({
      client_id: FAKE_GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: GOOGLE_SCOPES.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `/api${FAKE_GOOGLE_AUTHORIZE_PATH}?${query.toString()}`;
  }

  /** What Google does when the user continues: a one-time code for the profile and the challenge. */
  issueCode(profile: GoogleProfile, codeChallenge: string): string {
    const code = randomBytes(16).toString('base64url');
    this.codes.set(code, { profile, codeChallenge });
    return code;
  }

  profile({ code, codeVerifier }: { code: string; codeVerifier: string }): Promise<GoogleProfile> {
    const issued = this.codes.get(code);
    this.codes.delete(code);
    if (!issued) return Promise.reject(new GoogleClientError('Unknown or used code'));
    if (pkceChallenge(codeVerifier) !== issued.codeChallenge) {
      return Promise.reject(new GoogleClientError('The verifier does not match the challenge'));
    }
    return Promise.resolve(issued.profile);
  }
}
