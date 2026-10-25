import { type ContractEntry, type ErrorResponse } from '@finebank/shared';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ApiError, apiRequest, formErrorFor, formErrorMessage, serverFieldErrors } from '../../src/api/client';

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

  // Task 009: whether the message was written by the server or made up here (#97 a).
  it('marks an error body in the shared shape as from the server', async () => {
    const error: unknown = await apiRequest(missing).catch((caught: unknown) => caught);

    expect((error as ApiError).fromServer).toBe(true);
  });

  it('marks a made-up error body as not from the server', async () => {
    server.use(http.get('*/api/probe/missing', () => new HttpResponse('Bad Gateway', { status: 502 })));

    const error: unknown = await apiRequest(missing).catch((caught: unknown) => caught);

    expect((error as ApiError).fromServer).toBe(false);
  });
});

const shared = (status: number, message: string) => new ApiError(status, { message }, true);
const madeUp = (status: number) => new ApiError(status, { message: `Request failed with status ${status}` }, false);

// Task 009 T8: the text above a form's submit button (#6, #74, #97 a).
describe('formErrorMessage', () => {
  it.each([
    ['a 400 in the shared shape', shared(400, 'Validation failed'), 'Validation failed'],
    ['a 403 in the shared shape', shared(403, 'Invalid CSRF request'), 'Invalid CSRF request'],
    ['a 404 in the shared shape', shared(404, 'Not found'), 'Not found'],
    ['a 499 in the shared shape', shared(499, 'Client closed'), 'Client closed'],
    ['a 500 in the shared shape', shared(500, 'Internal server error'), 'Something went wrong.'],
    ['a 503 in the shared shape', shared(503, 'Service unavailable'), 'Something went wrong.'],
    ['a 404 without the shared shape', madeUp(404), 'Something went wrong.'],
    ['a 502 without the shared shape', madeUp(502), 'Something went wrong.'],
    ['a network failure', new TypeError('Failed to fetch'), 'Something went wrong.'],
    ['a response that fails its schema', new Error('Invalid input'), 'Something went wrong.'],
  ])('gives %s', (_name, error, text) => {
    expect(formErrorMessage(error)).toBe(text);
  });
});

const withFields = (status: number, fieldErrors: Record<string, string>) =>
  new ApiError(status, { message: 'Validation failed', fieldErrors }, true);

// Task 010 T13: the field errors of a failed request for the fields on a screen (#15, #74), moved from Login.
describe('serverFieldErrors', () => {
  const fields = ['fullName', 'email', 'password'] as const;

  it.each([
    ['a 400', withFields(400, { fullName: 'Name is required', password: 'Password is required' })],
    ['a 409', withFields(409, { fullName: 'Name is required', password: 'Password is required' })],
  ])('gives the field errors of %s for the fields on the screen, in field order', (_name, error) => {
    expect(serverFieldErrors(error, fields)).toEqual([
      ['fullName', 'Name is required'],
      ['password', 'Password is required'],
    ]);
  });

  it('gives the email taken message of a 409 for Email', () => {
    const taken = withFields(409, { email: 'An account with this email already exists' });

    expect(serverFieldErrors(taken, fields)).toEqual([['email', 'An account with this email already exists']]);
  });

  it.each([
    ['a 409 with a field not on the screen', withFields(409, { keepSignedIn: 'Invalid input' })],
    ['a 401 without field errors', shared(401, 'Email or password is incorrect')],
    ['a 500 with field errors', withFields(500, { email: 'Enter a valid email address' })],
    ['a made-up error body', madeUp(400)],
    ['a network failure', new TypeError('Failed to fetch')],
  ])('gives none for %s', (_name, error) => {
    expect(serverFieldErrors(error, fields)).toEqual([]);
  });
});

// Task 010 T13: the text above the submit button only when no field error shows under a field (#97 a).
describe('formErrorFor', () => {
  const fields = ['email', 'password'] as const;

  it.each([
    ['a 400 with field errors for the screen', withFields(400, { email: 'Enter a valid email address' }), undefined],
    ['a 409 with field errors for the screen', withFields(409, { email: 'Taken' }), undefined],
    ['a 409 with a field not on the screen', withFields(409, { fullName: 'Name is required' }), 'Validation failed'],
    ['a 401', shared(401, 'Email or password is incorrect'), 'Email or password is incorrect'],
    ['a 500', shared(500, 'Internal server error'), 'Something went wrong.'],
    ['a network failure', new TypeError('Failed to fetch'), 'Something went wrong.'],
  ])('gives %s', (_name, error, text) => {
    expect(formErrorFor(error, fields)).toBe(text);
  });
});
