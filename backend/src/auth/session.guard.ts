import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { setSignedInUser } from './current-user.decorator.js';
import { IS_PUBLIC } from './public.decorator.js';
import { readSessionToken } from './session-cookie.js';
import { SessionsService } from './sessions.service.js';

/**
 * Registered for every route (#75): a route needs a valid session cookie unless it is
 * `@Public()`, and its handler gets the user through `@CurrentUser()`.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
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
    setSignedInUser(request, userId);
    return true;
  }
}
