import { z } from 'zod';

/**
 * The one error body every endpoint returns (#74).
 * Field errors show inline under the field, the message above the submit button (#6).
 */
export const errorResponseSchema = z.object({
  message: z.string(),
  fieldErrors: z.record(z.string(), z.string()).optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
