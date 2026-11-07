import { Body, Controller, Cookies, Get, Headers, HttpCode, HttpStatus, Post, Put, Res } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import {
  authContract,
  type CurrentUser as CurrentUserResponse,
  type LoginRequest,
  type PasswordChangeRequest,
  type SignUpRequest,
} from '@finebank/shared';
import type { Response } from 'express';

import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { Public } from './public.decorator.js';
import { clearSessionCookieOptions, readSessionToken, SESSION_COOKIE, sessionCookieOptions } from './session-cookie.js';

/** `/api/auth`: sign up, login, logout, the signed-in user and the password change (#3, #14, #15, #34, #75). */
@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly adapterHost: HttpAdapterHost,
  ) {}

  /** 201 with the new user and a 30-day session (#15, #63). */
  @Public()
  @Post(authContract.signUp.path)
  async signUp(
    @Body({ schema: authContract.signUp.request }) body: SignUpRequest,
    @Cookies(SESSION_COOKIE) presentedToken: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CurrentUserResponse> {
    const { user, token } = await this.auth.signUp(body, presentedToken);
    this.adapterHost.httpAdapter.setCookie(response, SESSION_COOKIE, token, sessionCookieOptions(true));
    return user;
  }

  /** 200 with the user and a session for 30 days or the browser session (#14). */
  @Public()
  @Post(authContract.login.path)
  @HttpCode(HttpStatus.OK)
  async login(
    @Body({ schema: authContract.login.request }) body: LoginRequest,
    @Cookies(SESSION_COOKIE) presentedToken: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CurrentUserResponse> {
    const { user, token } = await this.auth.login(body, presentedToken);
    this.adapterHost.httpAdapter.setCookie(response, SESSION_COOKIE, token, sessionCookieOptions(body.keepSignedIn));
    return user;
  }

  /** 204, also without a valid session, so the cookie is always cleared (#3). */
  @Public()
  @Post(authContract.logout.path)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Cookies(SESSION_COOKIE) presentedToken: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(presentedToken);
    this.adapterHost.httpAdapter.clearCookie(response, SESSION_COOKIE, clearSessionCookieOptions);
  }

  /** The signed-in user only (#39, #46). */
  @Get(authContract.me.path)
  me(@CurrentUser() userId: number): Promise<CurrentUserResponse> {
    return this.users.currentUser(userId);
  }

  /**
   * The password change (task 030, #34): behind the session guard and its write guard (#119), so CSRF 403, 401 and the
   * guard's 400 or 409 come before the body is read; then the schema's 400 and the verification's 400, or 204 with no
   * body. The user comes from the session only (#39). The session kept is the one the guard accepted: its token read from
   * the same Cookie header with the guard's reader. No cookie is set or cleared, so the current session, its "Keep me
   * signed in" choice and its expiry stay as they were (#75).
   */
  @Put(authContract.changePassword.path)
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Body({ schema: authContract.changePassword.request }) body: PasswordChangeRequest,
    @CurrentUser() userId: number,
    @Headers('cookie') cookie: string | undefined,
  ): Promise<void> {
    const presentedToken = readSessionToken(cookie);
    if (presentedToken === undefined) throw new Error('The session guard accepted a request without a session token');
    await this.auth.changePassword(userId, presentedToken, body);
  }
}
