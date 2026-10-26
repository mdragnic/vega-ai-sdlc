import { createHash, randomBytes } from 'node:crypto';

/** 32 random bytes in base64url, 43 characters: the OAuth state and the PKCE code verifier (#75, RFC 7636). */
export const randomToken = (): string => randomBytes(32).toString('base64url');

/** The S256 code challenge of a PKCE verifier: its SHA-256 in base64url, without padding. */
export const pkceChallenge = (verifier: string): string => createHash('sha256').update(verifier).digest('base64url');
