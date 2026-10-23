import { BadRequestException, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

// IANA names are area/location words (Europe/Belgrade, Etc/GMT+1, UTC); offsets like +01:00 are not zones.
const ianaName = /^[A-Za-z][A-Za-z0-9_-]*(\/[A-Za-z0-9_+-]+)*$/;

/** The browser's IANA time zone from X-Time-Zone (#54); 400 when missing or not a valid zone. */
export function parseTimeZone(header: string | undefined): string {
  if (!header) {
    throw new BadRequestException('The X-Time-Zone header is required');
  }
  if (ianaName.test(header)) {
    try {
      return new Intl.DateTimeFormat('en-US', { timeZone: header }).resolvedOptions().timeZone;
    } catch {
      // Unknown zone, reported below.
    }
  }
  throw new BadRequestException('The X-Time-Zone header must be an IANA time zone name');
}

/** Parameter decorator for endpoints that need the user's time zone. */
export const TimeZone = createParamDecorator((_data: unknown, context: ExecutionContext): string =>
  parseTimeZone(context.switchToHttp().getRequest<Request>().header('x-time-zone')),
);
