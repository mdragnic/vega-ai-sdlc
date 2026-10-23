import { BadRequestException, type StandardSchemaValidationPipeOptions } from '@nestjs/common';
import type { ErrorResponse } from '@finebank/shared';

type Issues = Parameters<NonNullable<StandardSchemaValidationPipeOptions['exceptionFactory']>>[0];

/** Maps schema issues to the shared error shape: one message per field, the first one wins. */
export function validationException(issues: Issues): BadRequestException {
  const fieldErrors: Record<string, string> = {};
  let message = 'Validation failed';

  for (const issue of issues) {
    const field = (issue.path ?? [])
      .map((segment) => String(typeof segment === 'object' ? segment.key : segment))
      .join('.');
    if (!field) {
      message = issue.message;
    } else if (!(field in fieldErrors)) {
      fieldErrors[field] = issue.message;
    }
  }

  const body: ErrorResponse = Object.keys(fieldErrors).length > 0 ? { message, fieldErrors } : { message };
  return new BadRequestException(body);
}
