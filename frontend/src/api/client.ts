import { type ContractEntry, type ErrorResponse, errorResponseSchema } from '@finebank/shared';
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

type BodyArgs<Req> = Req extends z.ZodType ? [body: z.input<Req>] : [];

/** Calls one contract entry through the same origin (`/api`, proxied to the backend in dev, #73). */
export async function apiRequest<Req extends z.ZodType | undefined, Res extends z.ZodType>(
  entry: ContractEntry<Req, Res>,
  ...[body]: BodyArgs<Req>
): Promise<z.output<Res>> {
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Time-Zone': browserTimeZone() };
  const init: RequestInit = { method: entry.method, headers, credentials: 'same-origin' };
  if (entry.request) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const response = await fetch(new URL(`/api${entry.path}`, window.location.origin), init);
  const json = await readJson(response);

  if (!response.ok) {
    const error = errorResponseSchema.safeParse(json);
    throw error.success
      ? new ApiError(response.status, error.data, true)
      : new ApiError(response.status, { message: `Request failed with status ${response.status}` }, false);
  }
  return entry.response.parse(json);
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
