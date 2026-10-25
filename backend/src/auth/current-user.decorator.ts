import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

const signedInUsers = new WeakMap<Request, number>();

/** Records the user whose session the guard accepted for this request. */
export function setSignedInUser(request: Request, userId: number): void {
  signedInUsers.set(request, userId);
}

/**
 * The signed-in user's ID, on routes that are not `@Public()`. Every query for user data is
 * scoped with it, so no one ever reads another user's data (#39, #46, #75).
 */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): number => {
  const userId = signedInUsers.get(context.switchToHttp().getRequest<Request>());
  if (userId === undefined) {
    throw new Error('@CurrentUser() needs a route that is not @Public()');
  }
  return userId;
});
