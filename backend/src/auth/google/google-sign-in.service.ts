import { timingSafeEqual } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { emailSchema, googleSignIn, inAppReturnTarget, paths, RETURN_TO_PARAM, returnTarget } from '@finebank/shared';
import { DataSource, type EntityManager } from 'typeorm';

import { DemoSeeder } from '../../demo/demo-seeder.js';
import { User } from '../../users/user.entity.js';
import { UsersService } from '../../users/users.service.js';
import { AuthService } from '../auth.service.js';
import { SessionsService } from '../sessions.service.js';
import { GOOGLE_CLIENT, type GoogleClient, type GoogleProfile } from './google-client.js';
import { newUserName } from './new-user-name.js';
import { pkceChallenge, randomToken } from './pkce.js';
import { decodeSignIn, encodeSignIn, type StartedSignIn } from './sign-in-cookie.js';

/** Where the browser goes next, and the sign-in cookie or the session token to set on the way. */
export interface Redirect {
  location: string;
  signInCookie?: string;
  sessionToken?: string;
}

/** A failed sign-in. Its reason is ours, for the log: never a value of the request, the profile or Google's errors. */
class SignInFailed extends Error {}

/**
 * Google sign-in, authorization code flow with PKCE (#2, #75, #81). The start keeps the state, the verifier and
 * the page asked for in the sign-in cookie. The callback checks them, gets the profile from Google, and signs in the
 * user with the verified email, or creates one with the demo dataset (#78), in one transaction that opens only
 * after Google answered. Cancel returns to Login with no message, any failure with the #81 message.
 */
@Injectable()
export class GoogleSignInService {
  private readonly logger = new Logger(GoogleSignInService.name);

  constructor(
    @Inject(GOOGLE_CLIENT) private readonly google: GoogleClient | null,
    private readonly dataSource: DataSource,
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
    private readonly users: UsersService,
    private readonly demo: DemoSeeder,
  ) {}

  /**
   * Google's authorization URL and the sign-in cookie; with no client (#102), Login with the message. `returnTo`
   * is kept only when it is one string that is an in-app path (#3): a repeated parameter gives an array.
   */
  start(returnTo: unknown): Redirect {
    const kept = typeof returnTo === 'string' ? (inAppReturnTarget(returnTo) ?? undefined) : undefined;
    if (!this.google) return this.failed('no Google client is configured', kept);

    const state = randomToken();
    const verifier = randomToken();
    return {
      location: this.google.authorizationUrl({ state, codeChallenge: pkceChallenge(verifier) }),
      signInCookie: encodeSignIn(kept === undefined ? { state, verifier } : { state, verifier, returnTo: kept }),
    };
  }

  /** Google's answer: `query` from the callback URL, `signInCookie` and the session the browser presented. */
  async finish(
    query: Record<string, unknown>,
    signInCookie: string | undefined,
    presentedToken: string | undefined,
  ): Promise<Redirect> {
    const started = decodeSignIn(signInCookie);
    // Checked again: the cookie can be edited by hand.
    const returnTo = inAppReturnTarget(started?.returnTo ?? null) ?? undefined;
    // A cancel signs no one in, whatever the state (#81).
    if (query.error === 'access_denied') return { location: loginPath(returnTo, false) };

    try {
      const sessionToken = await this.completeSignIn(query, started, presentedToken);
      return { location: returnTarget(returnTo ?? null), sessionToken };
    } catch (error) {
      if (error instanceof SignInFailed) return this.failed(error.message, returnTo);
      throw error;
    }
  }

  /** Checks Google's answer against the started sign-in, then signs the user in: the new session's token. */
  private async completeSignIn(
    query: Record<string, unknown>,
    started: StartedSignIn | undefined,
    presentedToken: string | undefined,
  ): Promise<string> {
    if (query.error !== undefined) throw new SignInFailed('Google returned an error');
    if (!this.google) throw new SignInFailed('no Google client is configured');
    if (!started) throw new SignInFailed('the sign-in cookie is missing or unreadable');
    if (typeof query.state !== 'string' || !sameText(query.state, started.state)) {
      throw new SignInFailed('the state is missing or does not match');
    }
    if (typeof query.code !== 'string' || query.code === '') throw new SignInFailed('the code is missing');

    // Every Google call ends here, before the transaction opens (#78).
    const profile = await this.google.profile({ code: query.code, codeVerifier: started.verifier }).catch(() => {
      throw new SignInFailed('the code exchange or the ID token verification failed');
    });
    if (!profile.emailVerified) throw new SignInFailed('the email is not verified');
    const email = emailSchema.safeParse(profile.email);
    if (!email.success) throw new SignInFailed('the email is missing or invalid');

    try {
      return await this.dataSource.transaction((manager) =>
        this.startUserSession(manager, email.data, profile, presentedToken),
      );
    } catch (error) {
      // A race that inserted the same email first lands here too; the next try finds the user. Only the kind of
      // error is logged: a failed query's message and parameters can hold the email.
      throw new SignInFailed(`the user or the session could not be saved (${errorKind(error)})`);
    }
  }

  /**
   * The user with the email (#2), whose name and username stay (#103), or a new one with the demo dataset (#78); then
   * a session. A user with a password becomes Google-only and loses every other session (#104): the password may
   * have been set by someone who signed up first with this email, which sign up never verifies (#15).
   */
  private async startUserSession(
    manager: EntityManager,
    email: string,
    profile: GoogleProfile,
    presentedToken: string | undefined,
  ): Promise<string> {
    let user = await manager.findOneBy(User, { email });
    if (!user) {
      user = await this.users.create(manager, {
        fullName: newUserName({ name: profile.name, email: profile.email ?? email }),
        email,
        passwordHash: null,
      });
      await this.demo.seed(manager, user.id);
    } else if (user.passwordHash !== null) {
      await this.sessions.deleteAllOf(manager, user.id);
      await this.users.removePassword(manager, user.id);
    }
    return (await this.auth.startSession(manager, user, presentedToken)).token;
  }

  /** Login with the #81 message and the page asked for, and one log line that names the reason. */
  private failed(reason: string, returnTo: string | undefined): Redirect {
    this.logger.warn(`Google sign-in failed: ${reason}`);
    return { location: loginPath(returnTo, true) };
  }
}

/** Login, with the page asked for (#3) and the failure marker (#81) when given. */
function loginPath(returnTo: string | undefined, failed: boolean): string {
  const query = new URLSearchParams();
  if (returnTo !== undefined) query.set(RETURN_TO_PARAM, returnTo);
  if (failed) query.set(googleSignIn.failureParam, googleSignIn.failureValue);
  const search = query.toString();
  return search === '' ? paths.login : `${paths.login}?${search}`;
}

/** The class of a thrown error, such as `QueryFailedError`: never its message. */
const errorKind = (error: unknown): string => (error instanceof Error ? error.constructor.name : typeof error);

/** Compares two texts in constant time for equal lengths. */
function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
