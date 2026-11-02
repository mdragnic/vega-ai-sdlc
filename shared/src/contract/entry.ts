import type { z } from 'zod';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** The schema of a URL query: its values are strings, or absent, as a URL carries them. */
export type QuerySchema = z.ZodType<Record<string, string | undefined>>;

/**
 * The schema of a path's parameters: read from the URL as strings, each parsed to the string or number it names
 * (task 021).
 */
export type ParamsSchema = z.ZodType<Record<string, string | number>, Record<string, string>>;

/**
 * One API endpoint (#74). `path` is relative to `/api`, so backend routes and the frontend client both read it from
 * here. `request` is the body schema, absent when the endpoint takes no body. `query` is the object schema of the URL
 * query, absent when the endpoint takes none (task 020). `params` is the object schema of the path's parameters, each
 * named `:name` in `path` (the syntax of Nest and React Router), absent when the path has none (task 021).
 */
export interface ContractEntry<
  TRequest extends z.ZodType | undefined = z.ZodType | undefined,
  TResponse extends z.ZodType = z.ZodType,
  TQuery extends QuerySchema | undefined = QuerySchema | undefined,
  TParams extends ParamsSchema | undefined = ParamsSchema | undefined,
> {
  readonly method: HttpMethod;
  readonly path: `/${string}`;
  readonly request: TRequest;
  readonly response: TResponse;
  readonly query?: TQuery;
  readonly params?: TParams;
}
