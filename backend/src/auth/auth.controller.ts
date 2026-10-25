import { Body, Controller, Cookies, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import {
  authContract,
  type CurrentUser as CurrentUserResponse,
  type LoginRequest,
  type SignUpRequest,
} from '@finebank/shared';
import type { Response } from 'express';

import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { Public } from './public.decorator.js';
import { clearSessionCookieOptions, SESSION_COOKIE, sessionCookieOptions } from './session-cookie.js';

/** `/api/auth`: sign up, login, logout and the signed-in user (#3, #14, #15, #75). */
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
}
