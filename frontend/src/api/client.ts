import { type ContractEntry, type ErrorResponse, errorResponseSchema } from '@finebank/shared';
import type { z } from 'zod';

/** A non-2xx response. `body` is always the shared error shape (#74). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ErrorResponse,
  ) {
    super(body.message);
    this.name = 'ApiError';
  }
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
    throw new ApiError(
      response.status,
      error.success ? error.data : { message: `Request failed with status ${response.status}` },
    );
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
