import { type ArgumentsHost, Catch, HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';

import { ApiExceptionFilter } from '../common/errors/api-exception.filter.js';
import { profileBodyLimits } from './profile-body.interceptor.js';

/**
 * The most a browser's Update Profile sends: the photo at its limit and the text parts multer allows (each part's value,
 * name, headers and boundary within 512 bytes beyond its limits). A body past it is not read to its end.
 */
export const PROFILE_DISCARD_LIMIT =
  profileBodyLimits.fileSize +
  profileBodyLimits.parts * (profileBodyLimits.fieldSize + profileBodyLimits.fieldNameSize + 512);

/** The guards' answers that come before the body is read: 401 signed out, 409 another user (#119). */
const guardAnswers = new Set<number>([HttpStatus.UNAUTHORIZED, HttpStatus.CONFLICT]);

/**
 * Reads the rest of `request`'s body and drops it, up to `limit` bytes: nothing is parsed, kept or stored. Resolves at
 * the body's end, when the client goes, or once more than `limit` bytes came; past that the answer does not wait, and
 * the rest goes as before the wait (a connection that closes after the answer cuts it off).
 */
export function discardBody(request: Request, limit: number): Promise<void> {
  if (request.readableEnded) return Promise.resolve();
  return new Promise((resolve) => {
    let read = 0;
    const done = () => {
      request.off('data', onData);
      request.off('end', done);
      request.off('close', done);
      request.off('error', done);
      resolve();
    };
    function onData(chunk: Buffer) {
      read += chunk.length;
      if (read > limit) done();
    }
    request.on('data', onData);
    request.on('end', done);
    request.on('close', done);
    request.on('error', done);
  });
}

/**
 * Update Profile's answers in the shared error shape, as `ApiExceptionFilter` gives them, with one addition (#131): when
 * a guard refuses the save before the multipart stage has read the body (401, or the write guard's 409), the rest of the
 * body is read and dropped first, up to `PROFILE_DISCARD_LIMIT`. The Vite dev server's proxy asks the backend to close
 * the connection after each answer; closed with the photo unread, the connection is reset and the browser can get the
 * proxy's 502 instead of this answer. Nothing of the body is parsed, kept or stored, and the guards still decide before
 * anything is read; a larger body is cut off as before.
 */
@Catch()
export class ProfileGuardAnswerFilter extends ApiExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<Request>();
    if (exception instanceof HttpException && guardAnswers.has(exception.getStatus()) && !request.readableEnded) {
      void discardBody(request, PROFILE_DISCARD_LIMIT).then(() => super.catch(exception, host));
      return;
    }
    super.catch(exception, host);
  }
}
