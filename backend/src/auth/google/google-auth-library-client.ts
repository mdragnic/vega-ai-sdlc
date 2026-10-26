import { CodeChallengeMethod, OAuth2Client, type TokenPayload } from 'google-auth-library';

import type { GoogleConfig } from '../../config/config.js';
import { type GoogleClient, GoogleClientError, type GoogleProfile, GOOGLE_SCOPES } from './google-client.js';

/**
 * The real Google client, through `google-auth-library`. Its errors are replaced by ours without a cause: a library
 * error can carry the token request, the client secret, the code and the verifier included.
 */
export class GoogleAuthLibraryClient implements GoogleClient {
  private readonly oauth: OAuth2Client;

  constructor(
    private readonly config: GoogleConfig,
    oauth?: OAuth2Client,
  ) {
    this.oauth =
      oauth ??
      new OAuth2Client({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
      });
  }

  authorizationUrl({ state, codeChallenge }: { state: string; codeChallenge: string }): string {
    return this.oauth.generateAuthUrl({
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: [...GOOGLE_SCOPES],
      state,
      code_challenge: codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
    });
  }

  async profile({ code, codeVerifier }: { code: string; codeVerifier: string }): Promise<GoogleProfile> {
    const idToken = await this.exchange(code, codeVerifier);
    const claims = await this.verify(idToken);
    return { email: claims.email, emailVerified: claims.email_verified === true, name: claims.name };
  }

  private async exchange(code: string, codeVerifier: string): Promise<string> {
    let idToken: string | null | undefined;
    try {
      ({
        tokens: { id_token: idToken },
      } = await this.oauth.getToken({ code, codeVerifier, redirect_uri: this.config.redirectUri }));
    } catch {
      throw new GoogleClientError('The code exchange failed');
    }
    if (!idToken) throw new GoogleClientError('Google returned no ID token');
    return idToken;
  }

  private async verify(idToken: string): Promise<TokenPayload> {
    let claims: TokenPayload | undefined;
    try {
      claims = (await this.oauth.verifyIdToken({ idToken, audience: this.config.clientId })).getPayload();
    } catch {
      throw new GoogleClientError('The ID token failed verification');
    }
    if (!claims) throw new GoogleClientError('The ID token has no claims');
    return claims;
  }
}
