import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { Controller, type INestApplication, Post } from '@nestjs/common';
import * as shared from '@finebank/shared';
import request, { type Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FAKE_GOOGLE_AUTHORIZE_PATH } from '../src/auth/google/fake-google-client.js';
import { Public } from '../src/auth/public.decorator.js';
import { cookieFor, signUp } from './helpers/auth.js';
import { createTestApp } from './helpers/test-app.js';

// A route that fails, for the 500. Public, so it reaches the error filter behind the session guard.
const CRASH_PATH = '/probe/crash';

@Public()
@Controller()
class CrashController {
  @Post(CRASH_PATH)
  crash(): never {
    throw new Error('The database is down');
  }
}

/** Every contract entry of the shared API (#74): each exported `...Contract` object's entries. */
const contractEntries = Object.entries(shared)
  .filter(([name]) => name.endsWith('Contract'))
  .flatMap(([, contract]) => Object.values(contract as Record<string, shared.ContractEntry>));

/**
 * The routes the app should register, as `METHOD /api/path`: every contract entry, the Google sign-in start and
 * callback (task 012), the fake Google page (NODE_ENV=test) and this test's crash route.
 */
const expectedRoutes = [
  ...contractEntries.map((entry) => `${entry.method} /api${entry.path}`),
  `GET /api${shared.googleSignIn.start}`,
  `GET /api${shared.googleSignIn.callback}`,
  `GET /api${FAKE_GOOGLE_AUTHORIZE_PATH}`,
  `POST /api${FAKE_GOOGLE_AUTHORIZE_PATH}`,
  `POST /api${CRASH_PATH}`,
].toSorted();

type RouteLayer = { route?: { path: string; methods: Record<string, boolean> } };

/** The routes the app has registered on Express, as `METHOD /path`, read from its router. */
function registeredRoutes(app: INestApplication): string[] {
  const express = app.getHttpAdapter().getInstance() as { router: { stack: RouteLayer[] } };
  return express.router.stack
    .flatMap(({ route }) =>
      route === undefined
        ? []
        : Object.keys(route.methods)
            .filter((method) => method !== '_all')
            .map((method) => `${method.toUpperCase()} ${route.path}`),
    )
    .toSorted();
}

const noStore = (response: Response) => response.headers['cache-control'];

// T10: AC14, every response under /api carries Cache-Control: no-store, set once (task 016 gate, follow-up 1).
describe('Cache-Control on /api', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp({ config: { nodeEnv: 'test' }, controllers: [CrashController] });
    ({ token } = await signUp(app));
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists the same routes as the app registers, so a new route is requested below', () => {
    expect(contractEntries).toEqual(
      expect.arrayContaining([
        shared.authContract.logout,
        shared.testClockContract.set,
        shared.savingsGoalsContract.save,
        shared.statisticsContract.weeklyComparison,
        shared.expensesContract.breakdown,
      ]),
    );
    expect(registeredRoutes(app)).toEqual(expectedRoutes);
  });

  it('answers no-store on every registered route, signed in, logout last', async () => {
    // Its own session: the logout ends it.
    const { token: session } = await signUp(app);
    const routes = registeredRoutes(app).toSorted(
      (a, b) => Number(a.endsWith('/logout')) - Number(b.endsWith('/logout')),
    );
    const answers: Record<string, string> = {};
    const statuses = new Set<number>();
    for (const route of routes) {
      const [method, path] = route.split(' ') as [string, string];
      const server = request(app.getHttpServer());
      const response = await server[method.toLowerCase() as 'get' | 'post' | 'put'](path)
        .set('Cookie', cookieFor(session))
        .set('X-Time-Zone', 'Europe/Belgrade');
      answers[route] = `${noStore(response)}`;
      statuses.add(response.status);
    }

    expect(answers).toEqual(Object.fromEntries(routes.map((route) => [route, 'no-store'])));
    // Successes, redirects, the fake Google HTML page, validation errors and the crash are all among them.
    expect([...statuses].toSorted((a, b) => a - b)).toEqual(expect.arrayContaining([200, 204, 302, 400, 500]));
  });

  it.each([
    ['404, an unknown path', () => request(app.getHttpServer()).get('/api/does-not-exist'), 404],
    [
      '400, no X-Time-Zone',
      () => request(app.getHttpServer()).get('/api/statistics/weekly-comparison').set('Cookie', cookieFor(token)),
      400,
    ],
    [
      '400, malformed JSON',
      () => request(app.getHttpServer()).post('/api/auth/login').type('json').send('{"email":'),
      400,
    ],
    ['401, no session', () => request(app.getHttpServer()).get('/api/accounts'), 401],
    [
      '403, a write from another site',
      () =>
        request(app.getHttpServer())
          .post('/api/auth/login')
          .set('Sec-Fetch-Site', 'cross-site')
          .send({ email: 'a@b.c', password: 'abcdef12' }),
      403,
    ],
    ['500, a crash', () => request(app.getHttpServer()).post(`/api${CRASH_PATH}`), 500],
  ])('answers no-store on a %s', async (_case, send, status) => {
    const response = await send();

    expect(response.status).toBe(status);
    expect(noStore(response)).toBe('no-store');
  });
});

const srcDir = resolve(import.meta.dirname, '../src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

// AC14: the header is set in one place, configureApp; no controller, decorator or route sets it.
describe('Cache-Control in backend/src', () => {
  const cacheControl = /cache-control/i;

  it('is set only in app.setup.ts', () => {
    const files = sourceFiles(srcDir).map((file) => relative(srcDir, file).replaceAll('\\', '/'));
    const setters = files.filter((file) => cacheControl.test(readFileSync(join(srcDir, file), 'utf8')));

    expect(files.length).toBeGreaterThan(10);
    expect(setters).toEqual(['app.setup.ts']);
  });
});
