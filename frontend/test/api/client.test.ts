import {
  accountsContract,
  authContract,
  type ContractEntry,
  type ErrorResponse,
  profileContract,
  savingsGoalsContract,
  transactionsContract,
} from '@finebank/shared';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ApiError, apiRequest, formErrorFor, formErrorMessage, serverFieldErrors } from '../../src/api/client';
import { createQueryClient, sendWrite, sessionQueryKey } from '../../src/api/session';
import { readMultipart, sendFilesThroughNodeFetch } from '../support/multipart';

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

// Task 020 T17, AC3, AC4, AC11: an entry with a query sends it as URL search parameters, parsed with the entry's query
// schema first, so the frontend never sends what the backend rejects (#74).
describe('apiRequest with a query', () => {
  /** Every URL the probe receives, as path and search. */
  const received: string[] = [];
  const answerPage = () =>
    http.get('*/api/transactions', ({ request }) => {
      const url = new URL(request.url);
      received.push(`${url.pathname}${url.search}`);
      return HttpResponse.json({ transactions: [], nextCursor: null });
    });

  afterEach(() => {
    received.length = 0;
  });

  it('sends the tab and the cursor', async () => {
    server.use(answerPage());

    const page = await apiRequest(transactionsContract.list, {
      tab: 'all',
      cursor: 'MjAyNi0xMC0xNVQxMjowMDowMC4wMDBaXzEw',
    });

    expect(page).toEqual({ transactions: [], nextCursor: null });
    expect(received).toEqual(['/api/transactions?tab=all&cursor=MjAyNi0xMC0xNVQxMjowMDowMC4wMDBaXzEw']);
  });

  it('leaves out a query value that is absent', async () => {
    server.use(answerPage());

    await apiRequest(transactionsContract.list, { tab: 'revenue' });
    await apiRequest(transactionsContract.list, { tab: 'expenses', cursor: undefined });

    expect(received).toEqual(['/api/transactions?tab=revenue', '/api/transactions?tab=expenses']);
  });

  it('encodes a value as a search parameter', async () => {
    server.use(answerPage());

    await apiRequest(transactionsContract.list, { tab: 'all', cursor: 'a+b/c=d&e' });

    expect(received).toEqual(['/api/transactions?tab=all&cursor=a%2Bb%2Fc%3Dd%26e']);
  });

  it('drops keys outside the query schema', async () => {
    server.use(answerPage());

    await apiRequest(transactionsContract.list, { tab: 'all', userId: 7 } as { tab: 'all' });

    expect(received).toEqual(['/api/transactions?tab=all']);
  });

  it.each<[string, unknown]>([
    ['an unknown tab', { tab: 'other' }],
    ['no tab', {}],
    ['an empty cursor', { tab: 'all', cursor: '' }],
  ])('rejects %s before any request', async (_case, query) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(apiRequest(transactionsContract.list, query as { tab: 'all' })).rejects.toBeInstanceOf(z.ZodError);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('calls an entry without a query as before: no search, the body sent', async () => {
    const urls: string[] = [];
    server.events.on('request:start', ({ request }) => urls.push(request.url));

    await apiRequest(echo, { name: 'Marko' });

    expect(urls).toHaveLength(1);
    expect(new URL(urls[0]!).search).toBe('');
    server.events.removeAllListeners();
  });
});

// Task 021 T14, AC12 and AC13: an entry with path parameters parses them with the entry's params schema before
// anything is sent, and puts each into the path encoded, so a crafted ID cannot reach another API path (#74).
describe('apiRequest with path parameters', () => {
  /** Every URL a probe receives, as path and search, and the zone it carries. */
  const received: string[] = [];
  const zones: (string | null)[] = [];
  const record = (request: Request) => {
    const url = new URL(request.url);
    received.push(`${url.pathname}${url.search}`);
    zones.push(request.headers.get('X-Time-Zone'));
  };
  const answerDetails = () =>
    http.get('*/api/accounts/:accountId', ({ request }) => {
      record(request);
      return HttpResponse.json({
        accountType: 'checking',
        bankName: 'AB Bank Ltd',
        branchName: 'Park Street Branch',
        maskedNumber: '**** **** **** 7310',
        balance: { cents: 3_336_248, currency: 'USD' },
      });
    });
  const answerHistory = () =>
    http.get('*/api/accounts/:accountId/transactions', ({ request }) => {
      record(request);
      return HttpResponse.json({ transactions: [], nextCursor: null });
    });

  afterEach(() => {
    received.length = 0;
    zones.length = 0;
  });

  it('puts the account ID into the details path', async () => {
    mockBrowserTimeZone('Europe/Belgrade');
    server.use(answerDetails());

    const details = await apiRequest(accountsContract.details, { accountId: '42' });

    expect(details.bankName).toBe('AB Bank Ltd');
    expect(received).toEqual(['/api/accounts/42']);
    expect(zones).toEqual(['Europe/Belgrade']);
  });

  it('puts the account ID into the history path, then the cursor into the query', async () => {
    server.use(answerHistory());

    await apiRequest(transactionsContract.history, { accountId: '42' }, {});
    await apiRequest(
      transactionsContract.history,
      { accountId: '42' },
      { cursor: 'MjAyNi0xMC0wNFQxMjowMDowMC4wMDBaXzEyOTA' },
    );

    expect(received).toEqual([
      '/api/accounts/42/transactions',
      '/api/accounts/42/transactions?cursor=MjAyNi0xMC0wNFQxMjowMDowMC4wMDBaXzEyOTA',
    ]);
  });

  it.each([
    '../transactions',
    '1/2',
    '2?tab=all',
    '2#x',
    'abc',
    '01',
    '1e3',
    '-1',
    '1.0',
    '12abc',
    ' 7',
    '',
    '9007199254740992',
  ])('rejects the account ID %j before any request', async (accountId) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(apiRequest(accountsContract.details, { accountId })).rejects.toBeInstanceOf(z.ZodError);
    await expect(apiRequest(transactionsContract.history, { accountId }, {})).rejects.toBeInstanceOf(z.ZodError);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects missing params before any request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(apiRequest(accountsContract.details, {} as { accountId: string })).rejects.toBeInstanceOf(z.ZodError);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('encodes each parameter into its segment', async () => {
    const urls: string[] = [];
    server.events.on('request:start', ({ request }) => urls.push(new URL(request.url).pathname));
    server.use(http.get('*/api/probe/:name/items', () => HttpResponse.json({})));
    const probe = {
      method: 'GET',
      path: '/probe/:name/items',
      params: z.object({ name: z.string() }),
      request: undefined,
      response: z.object({}),
    } satisfies ContractEntry;

    await apiRequest(probe, { name: '../a b/c?d' });

    expect(urls).toEqual(['/api/probe/..%2Fa%20b%2Fc%3Fd/items']);
    server.events.removeAllListeners();
  });

  // Code review: encodeURIComponent leaves `.` and `..` as they are, and a URL resolves them, so a schema that allowed
  // them would let a value move up the path; they are refused whatever the schema allows.
  it.each(['.', '..'])(
    'rejects a parameter that is %j before any request, whatever its schema allows',
    async (name) => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const probe = {
        method: 'GET',
        path: '/probe/:name/items',
        params: z.object({ name: z.string() }),
        request: undefined,
        response: z.object({}),
      } satisfies ContractEntry;

      await expect(apiRequest(probe, { name })).rejects.toThrow(/path parameter/);

      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it('calls entries without params as before', async () => {
    const urls: string[] = [];
    server.events.on('request:start', ({ request }) => urls.push(new URL(request.url).pathname));

    await apiRequest(echo, { name: 'Marko' });

    expect(urls).toEqual(['/api/probe/echo']);
    server.events.removeAllListeners();
  });
});

/** A session user as the session query holds it. */
const sessionUser = { fullName: 'A User', email: 'a@x.com', username: 'auser' };

/** A valid profile request: the four editable fields, as the form sends them (task 028). */
const profileBody = {
  fullName: 'Ana Marija Petrović',
  username: 'ana.petrovic',
  phoneCountryCode: '+381',
  phoneNumber: '',
} as const;

/** A query client whose session query holds `user` (`undefined`: still checking; `null`: signed out). */
function clientWithSession(user: typeof sessionUser | null | undefined) {
  const queryClient = createQueryClient();
  if (user !== undefined) queryClient.setQueryData(sessionQueryKey, user);
  return queryClient;
}

// Task 022 T10, AC4, AC11 and AC20: every write behind the session guard carries the email of the user the tab shows
// (#119), through one helper; reads and the session's own requests do not.
describe('sendWrite', () => {
  /** Every request a probe receives: its method, path, body and the two headers. */
  const received: { method: string; path: string; body: string; expectedUser: string | null; zone: string | null }[] =
    [];
  const record = async (request: Request) => {
    received.push({
      method: request.method,
      path: new URL(request.url).pathname,
      body: await request.clone().text(),
      expectedUser: request.headers.get('X-Expected-User'),
      zone: request.headers.get('X-Time-Zone'),
    });
  };
  const checking = {
    accountType: 'savings',
    bankName: 'Nordic Bank',
    branchName: 'Harbour Branch',
    maskedNumber: '**** **** **** 7310',
    balance: { cents: 3_336_248, currency: 'USD' },
  };

  afterEach(() => {
    received.length = 0;
  });

  it('sends the PATCH to the account’s path with the JSON body, X-Expected-User and X-Time-Zone', async () => {
    mockBrowserTimeZone('Europe/Belgrade');
    server.use(
      http.patch('*/api/accounts/:accountId', async ({ request }) => {
        await record(request);
        return HttpResponse.json(checking);
      }),
    );
    const request = { bankName: 'Nordic Bank', branchName: 'Harbour Branch', accountType: 'savings' } as const;

    const details = await sendWrite(
      clientWithSession(sessionUser),
      accountsContract.updateDetails,
      { accountId: '42' },
      request,
    );

    expect(details).toEqual(checking);
    expect(received).toEqual([
      {
        method: 'PATCH',
        path: '/api/accounts/42',
        body: JSON.stringify(request),
        expectedUser: 'a@x.com',
        zone: 'Europe/Belgrade',
      },
    ]);
  });

  // Task 028 T13: AC7, an entry with `encoding: 'multipart'` (#76) sends each body key as a text part, with the header.
  it('sends the profile PATCH as multipart/form-data with exactly the four text parts and the header', async () => {
    const parts: [string, FormDataEntryValue][] = [];
    let contentType: string | null = null;
    server.use(
      http.patch('*/api/profile', async ({ request }) => {
        contentType = request.headers.get('Content-Type');
        await record(request);
        for (const entry of await request.formData()) parts.push(entry);
        return HttpResponse.json({ ...profileBody, email: 'a@x.com' });
      }),
    );
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const profile = await sendWrite(clientWithSession(sessionUser), profileContract.update, profileBody);

    expect(profile).toEqual({ ...profileBody, email: 'a@x.com' });
    expect(parts).toEqual([
      ['fullName', 'Ana Marija Petrović'],
      ['username', 'ana.petrovic'],
      ['phoneCountryCode', '+381'],
      ['phoneNumber', ''],
    ]);
    expect(contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(received.map(({ method, path, expectedUser }) => [method, path, expectedUser])).toEqual([
      ['PATCH', '/api/profile', 'a@x.com'],
    ]);
    // The browser sets the type with its boundary: the client sets none of its own.
    const init = fetchSpy.mock.calls[0]![1]!;
    expect(new Headers(init.headers).has('Content-Type')).toBe(false);
    expect(init.body).toBeInstanceOf(FormData);
  });

  // Task 029 T13: AC4, AC5, the entry's file part (`filePart: 'photo'`) sent as a file under the fixed name `photo`.
  describe('with a photo', () => {
    /** Every part as the backend reads it: a text, or a file's name, type and bytes. */
    const parts: [string, string | { name: string; type: string; bytes: number[] }][] = [];
    let contentType: string | null = null;

    const receive = () =>
      server.use(
        http.patch('*/api/profile', async ({ request }) => {
          contentType = request.headers.get('Content-Type');
          for (const part of await readMultipart(request)) {
            parts.push([part.name, 'value' in part ? part.value : part.file]);
          }
          return HttpResponse.json({ ...profileBody, email: 'a@x.com', photoUpdatedAt: '2026-10-22T10:00:00.000Z' });
        }),
      );

    let restoreFetch: () => void;
    // After the server listens: the wrapper goes around MSW's fetch.
    beforeAll(() => {
      restoreFetch = sendFilesThroughNodeFetch();
    });
    afterAll(() => restoreFetch());

    afterEach(() => {
      parts.length = 0;
      contentType = null;
    });

    it('sends the four text parts and one file part photo, named photo, with the chosen bytes', async () => {
      receive();
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const photo = new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])], 'my holiday.png', {
        type: 'image/png',
      });

      const profile = await sendWrite(clientWithSession(sessionUser), profileContract.update, {
        ...profileBody,
        photo,
      });

      expect(profile.photoUpdatedAt).toBe('2026-10-22T10:00:00.000Z');
      expect(parts).toEqual([
        ['fullName', 'Ana Marija Petrović'],
        ['username', 'ana.petrovic'],
        ['phoneCountryCode', '+381'],
        ['phoneNumber', ''],
        ['photo', { name: 'photo', type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 1, 2, 3] }],
      ]);
      expect(contentType).toMatch(/^multipart\/form-data; boundary=/);
      expect(new Headers(fetchSpy.mock.calls[0]![1]!.headers).has('Content-Type')).toBe(false);
    });

    it('sends exactly the four text parts when the photo is absent', async () => {
      receive();

      await sendWrite(clientWithSession(sessionUser), profileContract.update, { ...profileBody, photo: undefined });

      expect(parts.map(([name]) => name)).toEqual(['fullName', 'username', 'phoneCountryCode', 'phoneNumber']);
    });

    it.each<[string, unknown]>([
      ['a number', 42],
      ['an object', { name: 'x.png' }],
      ['null', null],
    ])('refuses %s as the photo before anything is sent', async (_case, photo) => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      await expect(
        sendWrite(clientWithSession(sessionUser), profileContract.update, {
          ...profileBody,
          photo: photo as File,
        }),
      ).rejects.toThrow(/photo/);

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('refuses a file in a part that is not the entry’s file part', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      await expect(
        sendWrite(clientWithSession(sessionUser), profileContract.update, {
          ...profileBody,
          fullName: new File(['x'], 'x.png') as unknown as string,
        }),
      ).rejects.toThrow(/fullName/);

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  it('never reads a file response through apiRequest: the photo’s address is for an <img>', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(apiRequest(profileContract.photo)).rejects.toThrow(/file/);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends the goal PUT with the header', async () => {
    server.use(
      http.put('*/api/savings-goals', async ({ request }) => {
        await record(request);
        return HttpResponse.json({ month: '2026-10', goal: null });
      }),
    );

    await sendWrite(clientWithSession(sessionUser), savingsGoalsContract.save, {
      month: '2026-10',
      target: { cents: 100, currency: 'USD' },
      present: { cents: 0, currency: 'USD' },
    });

    expect(received.map(({ method, path, expectedUser }) => [method, path, expectedUser])).toEqual([
      ['PUT', '/api/savings-goals', 'a@x.com'],
    ]);
  });

  it.each([
    ['still checking', undefined],
    ['signed out', null],
  ])('throws before anything is sent while the session is %s', async (_case, user) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(
      sendWrite(
        clientWithSession(user),
        accountsContract.updateDetails,
        { accountId: '42' },
        {
          bankName: 'A',
          branchName: 'B',
          accountType: 'loan',
        },
      ),
    ).rejects.toThrow(/signed-in user/);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(['abc', '01', '../42', ''])('rejects the account ID %j before any request', async (accountId) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(
      sendWrite(
        clientWithSession(sessionUser),
        accountsContract.updateDetails,
        { accountId },
        {
          bankName: 'A',
          branchName: 'B',
          accountType: 'loan',
        },
      ),
    ).rejects.toBeInstanceOf(z.ZodError);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('leaves the header out of reads and of the session’s own requests', async () => {
    const headers: (string | null)[] = [];
    server.events.on('request:start', ({ request }) => headers.push(request.headers.get('X-Expected-User')));
    server.use(
      http.get('*/api/auth/me', () => HttpResponse.json(sessionUser)),
      http.post('*/api/auth/login', () => HttpResponse.json(sessionUser)),
      http.post('*/api/auth/signup', () => HttpResponse.json(sessionUser)),
      http.post('*/api/auth/logout', () => new HttpResponse(null, { status: 204 })),
    );

    await apiRequest(authContract.me);
    await apiRequest(authContract.login, { email: 'a@x.com', password: 'abcdef12', keepSignedIn: true });
    await apiRequest(authContract.signUp, { fullName: 'A', email: 'a@x.com', password: 'abcdef12' });
    await apiRequest(authContract.logout);

    expect(headers).toEqual([null, null, null, null]);
    server.events.removeAllListeners();
  });
});
