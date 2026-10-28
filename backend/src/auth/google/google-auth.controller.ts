import { Controller, Cookies, Get, HttpStatus, Query, Res } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { googleSignIn, RETURN_TO_PARAM } from '@finebank/shared';
import type { Response } from 'express';

import { Public } from '../public.decorator.js';
import { SESSION_COOKIE, sessionCookieOptions } from '../session-cookie.js';
import { type Redirect, GoogleSignInService } from './google-sign-in.service.js';
import { clearSignInCookieOptions, GOOGLE_SIGN_IN_COOKIE, signInCookieOptions } from './sign-in-cookie.js';

/**
 * `/api/auth/google` and its callback (#75): page navigations that answer `302` with no body (`no-store` comes from
 * `configureApp`, as on every `/api` response). Both
 * are GET, which Nest's CSRF protection lets pass; the state check protects the callback from login CSRF.
 */
@Public()
@Controller()
export class GoogleAuthController {
  constructor(
    private readonly signInService: GoogleSignInService,
    private readonly adapterHost: HttpAdapterHost,
  ) {}

  @Get(googleSignIn.start)
  start(@Query(RETURN_TO_PARAM) returnTo: unknown, @Res() response: Response): void {
    this.redirect(response, this.signInService.start(returnTo));
  }

  /** The sign-in cookie is cleared in every outcome; a sign-in sets a 30-day session (#63, #75). */
  @Get(googleSignIn.callback)
  async callback(
    @Query() query: Record<string, unknown>,
    @Cookies(GOOGLE_SIGN_IN_COOKIE) signInCookie: string | undefined,
    @Cookies(SESSION_COOKIE) presentedToken: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    this.adapterHost.httpAdapter.clearCookie(response, GOOGLE_SIGN_IN_COOKIE, clearSignInCookieOptions);
    this.redirect(response, await this.signInService.finish(query, signInCookie, presentedToken));
  }

  private redirect(response: Response, { location, signInCookie, sessionToken }: Redirect): void {
    const http = this.adapterHost.httpAdapter;
    if (signInCookie !== undefined) http.setCookie(response, GOOGLE_SIGN_IN_COOKIE, signInCookie, signInCookieOptions);
    if (sessionToken !== undefined) http.setCookie(response, SESSION_COOKIE, sessionToken, sessionCookieOptions(true));
    http.setHeader(response, 'Location', location);
    http.status(response, HttpStatus.FOUND);
    http.end(response);
  }
}
