import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { calendarContract, errorResponseSchema, todayResponseSchema } from '@finebank/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { cookieFor, signUp } from './helpers/auth.js';
import { createTestApp } from './helpers/test-app.js';

// The path comes from the contract, so a route declared anywhere else would not answer it.
const todayPath = `/api${calendarContract.today.path}`;

// T2, AC5 and AC22: today in the zone sent as X-Time-Zone, from the Clock, for a signed-in user (#54, #80, #100).
describe('GET /api/calendar/today', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    // 00:30 on 23 Oct in Belgrade, 18:30 on 22 Oct in New York.
    app = await createTestApp({ config: { nodeEnv: 'test', testNow: '2026-10-22T22:30:00.000Z' } });
    ({ token } = await signUp(app));
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (options: { token?: string; zone?: string }) => {
    let req = request(app.getHttpServer()).get(todayPath);
    if (options.token !== undefined) req = req.set('Cookie', cookieFor(options.token));
    if (options.zone !== undefined) req = req.set('X-Time-Zone', options.zone);
    return req;
  };

  it.each([
    ['Europe/Belgrade', '2026-10-23'],
    ['America/New_York', '2026-10-22'],
  ])('answers 200 with today in %s', async (zone, today) => {
    const response = await get({ token, zone });

    expect(response.status).toBe(200);
    expect(todayResponseSchema.strict().parse(response.body)).toEqual({ today });
  });

  it('answers 401 without a session', async () => {
    const response = await get({ zone: 'Europe/Belgrade' });

    expect(response.status).toBe(401);
    expect(errorResponseSchema.strict().parse(response.body).message).toBe('Authentication required');
  });

  it.each([
    ['missing', undefined],
    ['an offset, not a zone', '+01:00'],
    ['an unknown zone', 'Mars/Base'],
  ])('answers 400 in the shared error shape when the header is %s', async (_case, zone) => {
    const response = await get({ token, zone });

    expect(response.status).toBe(400);
    expect(errorResponseSchema.strict().parse(response.body).message).toMatch(/X-Time-Zone/);
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

// T3, AC22: the path exists once, in the contract (#74).
describe('calendar sources', () => {
  it('never declares the today path outside the contract', () => {
    const files = sourceFiles(srcDir);
    const offenders = files
      .filter((file) => /['"`]\/?calendar\/today/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(srcDir, file));

    expect(files.map((file) => relative(srcDir, file).replaceAll('\\', '/'))).toContain(
      'calendar/calendar.controller.ts',
    );
    expect(offenders).toEqual([]);
  });
});
