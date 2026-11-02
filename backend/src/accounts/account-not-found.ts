import { NotFoundException } from '@nestjs/common';
import { accountIdSchema } from '@finebank/shared';

/**
 * The one answer of every account route for an account that is not the signed-in user's (#39): another user's, an
 * unknown ID, an ID outside the strict rule and an empty segment alike, `404 {"message":"Account not found"}`, so
 * account IDs cannot be probed.
 */
export function accountNotFound(): NotFoundException {
  return new NotFoundException('Account not found');
}

/**
 * The account ID of a path, parsed with the shared strict rule (`accountIdSchema`, the frontend route's too); the one
 * 404 when it is missing, empty or does not parse. Not the validation pipe, which would answer 400.
 */
export function accountIdFrom(raw: string | undefined): number {
  const parsed = accountIdSchema.safeParse(raw);
  if (!parsed.success) throw accountNotFound();
  return parsed.data;
}

/**
 * A contract path whose account segment may also be empty (the parameter in path-to-regexp's optional group,
 * `{:accountId}`), registered beside the contract path so an empty segment (`/api/accounts//`,
 * `/api/accounts//transactions`) reaches `accountIdFrom` and gets the one 404, not the default one, which names the
 * path: Express matches a parameter only to a non-empty segment, and strips a route's trailing slashes, so a route
 * ending in two slashes cannot be written out. `/api/accounts/` stays the accounts list, whose route comes first.
 */
export function emptyAccountIdPath(path: `/${string}`): string {
  return path.replace(':accountId', '{:accountId}');
}
