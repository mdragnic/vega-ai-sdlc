import {
  BadRequestException,
  type CanActivate,
  ConflictException,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { emailSchema, EXPECTED_USER_HEADER, writeGuardMessages } from '@finebank/shared';
import type { Request } from 'express';

import { UsersService } from '../users/users.service.js';
import { setSignedInUser } from './current-user.decorator.js';
import { IS_PUBLIC } from './public.decorator.js';
import { readSessionToken } from './session-cookie.js';
import { SessionsService } from './sessions.service.js';

/** The methods that only read: no write guard (#119 b). */
const readMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Registered for every route (#75): a route needs a valid session cookie unless it is `@Public()`, and its handler gets
 * the user through `@CurrentUser()`. A write (any other method) also passes the write guard (#119).
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [context.getHandler(), context.getClass()])) {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    const token = readSessionToken(request.headers.cookie);
    const userId = token === undefined ? undefined : await this.sessions.userIdFor(token);
    if (userId === undefined) {
      throw new UnauthorizedException('Authentication required');
    }
    if (!readMethods.has(request.method)) {
      await this.checkExpectedUser(request, userId);
    }
    setSignedInUser(request, userId);
    return true;
  }

  /**
   * The write guard (#119), after the session (401 first) and before the route reads or writes anything: the
   * `X-Expected-User` header names the user the tab shows. It is parsed with the shared email rule, trimmed and
   * lowercased as sign up and login store an email (#15), and that output, never the raw header, is compared with the
   * session user's stored email: missing or not an email, 400; another user's, 409, so a stale tab never writes into
   * the signed-in user's data (#110). The header's value is never logged or echoed.
   */
  private async checkExpectedUser(request: Request, userId: number): Promise<void> {
    const expected = emailSchema.safeParse(request.header(EXPECTED_USER_HEADER));
    if (!expected.success) {
      throw new BadRequestException(writeGuardMessages.expectedUserInvalid);
    }
    if (expected.data !== (await this.users.emailOf(userId))) {
      throw new ConflictException(writeGuardMessages.otherUser);
    }
  }
}
