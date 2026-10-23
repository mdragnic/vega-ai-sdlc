import { type ContractEntry, type ErrorResponse } from '@finebank/shared';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ApiError, apiRequest } from '../../src/api/client';

const echo = {
  method: 'PUT',
  path: '/probe/echo',
  request: z.object({ name: z.string() }),
  response: z.object({ name: z.string(), timeZone: z.string() }),
} satisfies ContractEntry;

const missing = {
  method: 'GET',
  path: '/probe/missing',
  request: undefined,
  response: z.object({}),
} satisfies ContractEntry;

const server = setupServer(
  http.put('*/api/probe/echo', async ({ request }) => {
    const body = (await request.json()) as { name: string };
    return HttpResponse.json({ name: body.name, timeZone: request.headers.get('X-Time-Zone') ?? '' });
  }),
  http.get('*/api/probe/missing', () =>
    HttpResponse.json({ message: 'Validation failed', fieldErrors: { name: 'Required' } } satisfies ErrorResponse, {
      status: 400,
    }),
  ),
);

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

function mockBrowserTimeZone(timeZone: string): void {
  const real = new Intl.DateTimeFormat().resolvedOptions();
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ ...real, timeZone });
}

// T5: every request carries the browser's IANA zone (#54) and errors come back in the shared shape (#74).
describe('apiRequest', () => {
  it('sends X-Time-Zone with the browser zone', async () => {
    mockBrowserTimeZone('America/New_York');

    const result = await apiRequest(echo, { name: 'Marko' });

    expect(result).toEqual({ name: 'Marko', timeZone: 'America/New_York' });
  });

  it('rejects a 400 with the parsed error shape', async () => {
    const error: unknown = await apiRequest(missing).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).body).toEqual({ message: 'Validation failed', fieldErrors: { name: 'Required' } });
  });

  it('falls back to a generic message when an error body is not the shared shape', async () => {
    server.use(http.get('*/api/probe/missing', () => new HttpResponse('Bad Gateway', { status: 502 })));

    const error: unknown = await apiRequest(missing).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(502);
    expect((error as ApiError).body).toEqual({ message: 'Request failed with status 502' });
  });
});
