import { inspect } from 'node:util';

import { LoginTicket, OAuth2Client, type TokenPayload } from 'google-auth-library';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GoogleAuthLibraryClient } from '../src/auth/google/google-auth-library-client.js';
import { GoogleClientError } from '../src/auth/google/google-client.js';

const config = {
  clientId: 'client-id.apps.googleusercontent.com',
  clientSecret: 'GOCSPX-known-client-secret',
  redirectUri: 'http://localhost:5173/api/auth/google/callback',
};
const state = 'S'.repeat(43);
const codeChallenge = 'C'.repeat(43);
const code = '4/0known-authorization-code';
const codeVerifier = 'V'.repeat(43);
const idToken = 'eyJknown.id.token';
const accessToken = 'ya29.known-access-token';

/** The claims of a verified Google ID token (complete, as Google sends them). */
const payload: TokenPayload = {
  iss: 'https://accounts.google.com',
  azp: config.clientId,
  aud: config.clientId,
  sub: '110169484474386276334',
  email: 'Tanzir.Rahman@gmail.com',
  email_verified: true,
  at_hash: 'HK6E_P6Dh8Y93mRNtsDB1Q',
  name: 'Tanzir Rahman',
  picture: 'https://lh3.googleusercontent.com/a/photo',
  given_name: 'Tanzir',
  family_name: 'Rahman',
  iat: 1_792_000_000,
  exp: 1_792_003_600,
};

/** A library error as gaxios throws it: the token request, client secret, code and verifier included. */
function tokenRequestError(): Error {
  const error = new Error(`invalid_grant: request to https://oauth2.googleapis.com/token failed`);
  Object.assign(error, {
    config: {
      url: 'https://oauth2.googleapis.com/token',
      data: `client_secret=${config.clientSecret}&code=${code}&code_verifier=${codeVerifier}`,
    },
    response: { data: { error: 'invalid_grant' } },
  });
  return error;
}

/** The client over a real OAuth2Client whose two network calls are stubbed: nothing is fetched. */
function stubbedClient(claims: TokenPayload = payload) {
  const oauth = new OAuth2Client({ ...config });
  const getToken = vi
    .spyOn(oauth, 'getToken')
    .mockResolvedValue({ tokens: { id_token: idToken, access_token: accessToken }, res: null } as never);
  const verifyIdToken = vi
    .spyOn(oauth, 'verifyIdToken')
    .mockResolvedValue(new LoginTicket('envelope', claims) as never);
  return { client: new GoogleAuthLibraryClient(config, oauth), getToken, verifyIdToken };
}

/** Everything a logger could print of an error. */
const printed = (error: unknown) => inspect(error, { depth: 10 });

afterEach(() => {
  vi.restoreAllMocks();
});

// Task 012 T1: Google's authorization URL, built without a request (AC1, #75).
describe('GoogleAuthLibraryClient.authorizationUrl', () => {
  it('has the client ID, the redirect URI, the code flow, the scopes, the state and the S256 challenge only', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const url = new URL(new GoogleAuthLibraryClient(config).authorizationUrl({ state, codeChallenge }));

    expect(`${url.origin}${url.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    expect(url.search).not.toContain(config.clientSecret);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// Task 012 T15: the code exchange with the verifier, the ID token check, and errors without the request (AC1, AC6, AC11).
describe('GoogleAuthLibraryClient.profile', () => {
  it('exchanges the code with the verifier and redirect URI, verifies the ID token for the client ID, and maps it', async () => {
    const { client, getToken, verifyIdToken } = stubbedClient();

    const profile = await client.profile({ code, codeVerifier });

    expect(getToken).toHaveBeenCalledExactlyOnceWith({ code, codeVerifier, redirect_uri: config.redirectUri });
    expect(verifyIdToken).toHaveBeenCalledExactlyOnceWith({ idToken, audience: config.clientId });
    expect(profile).toEqual({ email: 'Tanzir.Rahman@gmail.com', emailVerified: true, name: 'Tanzir Rahman' });
  });

  it.each([
    ['without email_verified', { email_verified: undefined }, { emailVerified: false }],
    ['with email_verified false', { email_verified: false }, { emailVerified: false }],
    ['without an email', { email: undefined }, { email: undefined }],
    ['without a name', { name: undefined }, { name: undefined }],
  ])('maps a token %s', async (_case, claims, expected) => {
    const { client } = stubbedClient({ ...payload, ...claims });

    expect(await client.profile({ code, codeVerifier })).toMatchObject(expected);
  });

  it('throws when the code exchange fails, without the request, secret, code or verifier', async () => {
    const { client, getToken, verifyIdToken } = stubbedClient();
    getToken.mockRejectedValue(tokenRequestError());

    const error: unknown = await client.profile({ code, codeVerifier }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GoogleClientError);
    for (const value of [config.clientSecret, code, codeVerifier, 'oauth2.googleapis.com', 'invalid_grant']) {
      expect(printed(error)).not.toContain(value);
    }
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('throws when the ID token fails verification, without the token', async () => {
    const { client, verifyIdToken } = stubbedClient();
    verifyIdToken.mockRejectedValue(new Error(`Wrong recipient, payload audience != requiredAudience: ${idToken}`));

    const error: unknown = await client.profile({ code, codeVerifier }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GoogleClientError);
    for (const value of [idToken, accessToken, config.clientSecret, code, codeVerifier]) {
      expect(printed(error)).not.toContain(value);
    }
  });

  it('throws when Google returns no ID token', async () => {
    const { client, getToken, verifyIdToken } = stubbedClient();
    getToken.mockResolvedValue({ tokens: { access_token: accessToken }, res: null } as never);

    await expect(client.profile({ code, codeVerifier })).rejects.toThrow(GoogleClientError);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('throws when the verified token has no payload', async () => {
    const { client, verifyIdToken } = stubbedClient();
    verifyIdToken.mockResolvedValue(new LoginTicket('envelope') as never);

    await expect(client.profile({ code, codeVerifier })).rejects.toThrow(GoogleClientError);
  });
});
