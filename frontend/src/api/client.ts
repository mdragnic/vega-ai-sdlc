import {
  type ContractEntry,
  type ErrorResponse,
  errorResponseSchema,
  EXPECTED_USER_HEADER,
  type ParamsSchema,
  type QuerySchema,
} from '@finebank/shared';
import type { z } from 'zod';

/**
 * A non-2xx response. `body` is always the shared error shape (#74): the server's, or one made up here when
 * the response had none (`fromServer` false), such as a proxy error page when the backend is down.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ErrorResponse,
    readonly fromServer: boolean,
  ) {
    super(body.message);
    this.name = 'ApiError';
  }
}

/** The same text as a widget's error state (#88). */
const genericErrorMessage = 'Something went wrong.';

/**
 * The text above a form's submit button for a failed request (#6, #97 a): the server's message for a 4xx in
 * the shared shape, which is written for users; "Something went wrong." for a 5xx, a network failure or a
 * response without the shared shape.
 */
export function formErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.fromServer && error.status >= 400 && error.status < 500) {
    return error.body.message;
  }
  return genericErrorMessage;
}

/**
 * A failed request's field errors for the fields on a screen, in the screen's order: the `fieldErrors` of a
 * 4xx in the shared shape, such as a 400 (#74) or the 409 of an email already registered (#15). Empty when
 * none of them is for one of these fields.
 */
export function serverFieldErrors<Name extends string>(error: unknown, fieldNames: readonly Name[]): [Name, string][] {
  if (!(error instanceof ApiError) || !error.fromServer || error.status < 400 || error.status >= 500) return [];
  const fieldErrors = error.body.fieldErrors ?? {};
  return fieldNames.flatMap((name) => (fieldErrors[name] ? [[name, fieldErrors[name]] as [Name, string]] : []));
}

/**
 * The text above a form's submit button for a failed request (#97 a), or none when the failure has field
 * errors for the screen's fields, which show under them instead.
 */
export function formErrorFor(error: unknown, fieldNames: readonly string[]): string | undefined {
  return serverFieldErrors(error, fieldNames).length === 0 ? formErrorMessage(error) : undefined;
}

/** The browser's IANA time zone, sent with every request (#54). */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

type ParamsArgs<Params> = Params extends z.ZodType ? [params: z.input<Params>] : [];
type BodyArgs<Req> = Req extends z.ZodType ? [body: z.input<Req>] : [];
type QueryArgs<Query> = Query extends z.ZodType ? [query: z.input<Query>] : [];

/** The arguments of a call to a contract entry: its path parameters, its body, then its query, for an entry that has them. */
export type RequestArgs<Req, Query, Params> = [...ParamsArgs<Params>, ...BodyArgs<Req>, ...QueryArgs<Query>];

/**
 * The entry's path with each `:name` replaced by its parameter, parsed with the entry's params schema first and
 * encoded (task 021), so a value stays inside its one segment: a slash, `?` or `#` is encoded, and `.` and `..`, which
 * encoding leaves as they are and a URL resolves, are refused whatever the schema allows. Throws the schema's error, or
 * that refusal, before anything is sent.
 */
function pathWith(entry: ContractEntry, params: unknown): string {
  if (!entry.params) return entry.path;
  let path: string = entry.path;
  for (const [name, value] of Object.entries(entry.params.parse(params))) {
    const segment = encodeURIComponent(String(value));
    if (segment === '.' || segment === '..') throw new TypeError(`The path parameter ${name} cannot be ${segment}`);
    path = path.replace(`:${name}`, segment);
  }
  return path;
}

/**
 * Calls one contract entry through the same origin (`/api`, proxied to the backend in dev, #73): its path parameters,
 * its body, then its query, for an entry that has them. The parameters and the query are parsed with the entry's
 * schemas before anything is sent, so the frontend never sends what the backend rejects (#74); absent query values are
 * left out.
 */
export function apiRequest<
  Req extends z.ZodType | undefined,
  Res extends z.ZodType,
  Query extends QuerySchema | undefined = undefined,
  Params extends ParamsSchema | undefined = undefined,
>(entry: ContractEntry<Req, Res, Query, Params>, ...args: RequestArgs<Req, Query, Params>): Promise<z.output<Res>> {
  return send(entry, args, {});
}

/**
 * `apiRequest` for a write behind the session guard (#119), with `expectedUser`, the email of the user the tab shows, in
 * `X-Expected-User`. Called only through the session's `sendWrite`, which knows that user.
 */
export function apiWrite<
  Req extends z.ZodType | undefined,
  Res extends z.ZodType,
  Query extends QuerySchema | undefined = undefined,
  Params extends ParamsSchema | undefined = undefined,
>(
  expectedUser: string,
  entry: ContractEntry<Req, Res, Query, Params>,
  ...args: RequestArgs<Req, Query, Params>
): Promise<z.output<Res>> {
  return send(entry, args, { [EXPECTED_USER_HEADER]: expectedUser });
}

async function send<Res extends z.ZodType>(
  entry: ContractEntry<z.ZodType | undefined, Res>,
  args: unknown[],
  extraHeaders: Record<string, string>,
): Promise<z.output<Res>> {
  const rest: unknown[] = [...args];
  const params = entry.params ? rest.shift() : undefined;
  const body = entry.request ? rest.shift() : undefined;
  const [query] = rest;
  const url = new URL(`/api${pathWith(entry, params)}`, window.location.origin);
  if (entry.query) {
    for (const [name, value] of Object.entries(entry.query.parse(query))) {
      if (value !== undefined) url.searchParams.set(name, value);
    }
  }
  const headers: Record<string, string> = {
    ...extraHeaders,
    Accept: 'application/json',
    'X-Time-Zone': browserTimeZone(),
  };
  const init: RequestInit = { method: entry.method, headers, credentials: 'same-origin' };
  if (entry.request && entry.encoding === 'multipart') {
    // No Content-Type of its own: the browser sets `multipart/form-data` with the body's boundary.
    init.body = multipartBody(body);
  } else if (entry.request) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);
  const json = await readJson(response);

  if (!response.ok) {
    const error = errorResponseSchema.safeParse(json);
    throw error.success
      ? new ApiError(response.status, error.data, true)
      : new ApiError(response.status, { message: `Request failed with status ${response.status}` }, false);
  }
  return entry.response.parse(json);
}

/**
 * A multipart entry's body (task 028, #76): each key of the body object one text part, in the object's order. Every
 * value of such a body is a string (the profile's four fields); anything else is refused before anything is sent.
 */
function multipartBody(body: unknown): FormData {
  if (typeof body !== 'object' || body === null)
    throw new TypeError('A multipart body must be an object of text parts');
  const form = new FormData();
  for (const [name, value] of Object.entries(body)) {
    if (typeof value !== 'string') throw new TypeError(`The multipart part ${name} must be text`);
    form.append(name, value);
  }
  return form;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
