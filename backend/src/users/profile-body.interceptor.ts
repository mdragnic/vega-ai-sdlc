import {
  BadRequestException,
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { NoFilesInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import type { Observable } from 'rxjs';

/**
 * multer's limits for Update Profile's body (#76): no file until task 029, at most 10 parts and 10 fields (the four
 * are needed), 1 KB per field value (a 100-code-point name is at most 400 bytes) and 100 bytes per field name. A body
 * past any of them is refused while it is read, before it is buffered.
 */
const limits = { files: 0, parts: 10, fields: 10, fieldSize: 1024, fieldNameSize: 100 } as const;

/** The answers of this stage, in the shared error shape (#74). Neither echoes anything of the request. */
const messages = {
  notMultipart: 'Send the profile as multipart/form-data',
  unreadable: 'The profile could not be read',
} as const;

/**
 * Update Profile's multipart stage (#76): an interceptor, so it runs after CSRF (the middleware), the session guard and
 * the write guard (#75, #119), and before the validation pipe. Nothing of the body is read before the guards. A request
 * that is not `multipart/form-data` (JSON, a form, text, none) answers 415; otherwise multer reads the text parts into
 * the body through `NoFilesInterceptor` with the limits above, and any failure of that read (a file part, a limit, a
 * malformed body) answers 400. The shared schema then checks the parts (#74).
 */
@Injectable()
export class ProfileBodyInterceptor implements NestInterceptor {
  private readonly noFiles = new (NoFilesInterceptor({ limits }))();

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.is('multipart/form-data') !== 'multipart/form-data') {
      throw new UnsupportedMediaTypeException(messages.notMultipart);
    }
    try {
      return await this.noFiles.intercept(context, next);
    } catch {
      // multer's and busboy's own texts name the request's parts: one fixed text instead.
      throw new BadRequestException(messages.unreadable);
    }
  }
}
