import {
  BadRequestException,
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_PHOTO_BYTES, photoMessages, profileContract } from '@finebank/shared';
import type { Request } from 'express';
import type { Observable } from 'rxjs';

import { validationException } from '../common/errors/validation-exception.js';

/** The one file part of Update Profile (#76): its name from the contract. */
const PHOTO_PART = profileContract.update.filePart;

/**
 * multer's limits for Update Profile's body (#76): one file, the photo, of at most 2 MB (the shared rule's size, so
 * multer stops reading past it), at most 10 parts and 10 fields (the four are needed), 1 KB per field value (a
 * 100-code-point name is at most 400 bytes) and 100 bytes per field name. A body past any of them is refused while it
 * is read. The photo is held in memory (multer's default storage): nothing reaches the disk before every check.
 */
const limits = { files: 1, fileSize: MAX_PHOTO_BYTES, parts: 10, fields: 10, fieldSize: 1024, fieldNameSize: 100 };

/** The answers of this stage, in the shared error shape (#74). Neither echoes anything of the request. */
const messages = {
  notMultipart: 'Send the profile as multipart/form-data',
  unreadable: 'The profile could not be read',
} as const;

/** The one field of multer's file this stage reads: never its name, its declared type or its encoding (#76). */
type UploadedPhoto = { buffer: Buffer };

/**
 * The photo's bytes into the body as a `Blob` under the photo part's name, so the one request schema checks it with the
 * text parts (#74). A text part of the same name stays a string, and with a file becomes two values: both fail the rule.
 */
function putPhotoInBody(request: Request & { file?: UploadedPhoto }): void {
  const file = request.file;
  if (file === undefined) return;
  const body: unknown = request.body;
  // multer always gives the parts an object; without one the file is refused, never dropped.
  if (typeof body !== 'object' || body === null) throw new BadRequestException(messages.unreadable);
  delete request.file;
  const photo = new Blob([file.buffer]);
  const text: unknown = Reflect.get(body, PHOTO_PART);
  Reflect.set(body, PHOTO_PART, text === undefined ? photo : [text, photo].flat());
}

/**
 * Update Profile's multipart stage (#76): an interceptor, so it runs after CSRF (the middleware), the session guard and
 * the write guard (#75, #119), and before the validation pipe. Nothing of the body is read before the guards. A request
 * that is not `multipart/form-data` (JSON, a form, text, none) answers 415; otherwise multer reads the text parts and the
 * one file part `photo` (task 029) through `FileInterceptor` with the limits above. A photo past 2 MB answers the shared
 * rule's 400 under `photo`; any other failure of that read (a file under another name, a second file, a limit, a
 * malformed body) answers 400 with one fixed text. The shared schema then checks the parts and the photo (#74).
 */
@Injectable()
export class ProfileBodyInterceptor implements NestInterceptor {
  private readonly photo = new (FileInterceptor(PHOTO_PART, { limits }))();

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request & { file?: UploadedPhoto }>();
    if (request.is('multipart/form-data') !== 'multipart/form-data') {
      throw new UnsupportedMediaTypeException(messages.notMultipart);
    }
    const withPhoto: CallHandler = {
      handle: () => {
        putPhotoInBody(request);
        return next.handle();
      },
    };
    try {
      return await this.photo.intercept(context, withPhoto);
    } catch (error) {
      // Nest answers multer's file size limit with a 413: the shared rule's 400 under `photo` instead.
      if (error instanceof PayloadTooLargeException) {
        throw validationException([{ message: photoMessages.tooLarge, path: [PHOTO_PART] }]);
      }
      // multer's and busboy's own texts name the request's parts: one fixed text instead.
      throw new BadRequestException(messages.unreadable);
    }
  }
}
