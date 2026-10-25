import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { type ErrorResponse, errorResponseSchema } from '@finebank/shared';
import type { Response } from 'express';

/** Turns every error into the shared error shape `{ message, fieldErrors? }` (#74). */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(toErrorResponse(exception));
      return;
    }
    if (isClientError(exception)) {
      const body: ErrorResponse = { message: exception.message };
      response.status(exception.status).json(body);
      return;
    }

    // Only the message and stack: an error's other fields can hold data, such as the values of a
    // failed query (TypeORM's QueryFailedError keeps them in `parameters`).
    if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    } else {
      this.logger.error('A value that is not an Error was thrown');
    }
    const body: ErrorResponse = { message: 'Internal server error' };
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }
}

/** Express middleware errors (http-errors, e.g. body too large): 4xx with a message meant for the client. */
function isClientError(exception: unknown): exception is { status: number; message: string } {
  return (
    typeof exception === 'object' &&
    exception !== null &&
    'expose' in exception &&
    exception.expose === true &&
    'message' in exception &&
    typeof exception.message === 'string' &&
    'status' in exception &&
    typeof exception.status === 'number' &&
    exception.status >= 400 &&
    exception.status < 500
  );
}

function toErrorResponse(exception: HttpException): ErrorResponse {
  const body = exception.getResponse();
  if (typeof body === 'string') {
    return { message: body };
  }
  // Keeps message and fieldErrors, drops Nest's statusCode and error fields.
  const parsed = errorResponseSchema.safeParse(body);
  return parsed.success ? parsed.data : { message: exception.message };
}
