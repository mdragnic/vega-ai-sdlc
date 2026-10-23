import type { z } from 'zod';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * One API endpoint (#74). `path` is relative to `/api`, so backend routes and the
 * frontend client both read it from here. `request` is the body schema, absent when
 * the endpoint takes no body.
 */
export interface ContractEntry<
  TRequest extends z.ZodType | undefined = z.ZodType | undefined,
  TResponse extends z.ZodType = z.ZodType,
> {
  readonly method: HttpMethod;
  readonly path: `/${string}`;
  readonly request: TRequest;
  readonly response: TResponse;
}
