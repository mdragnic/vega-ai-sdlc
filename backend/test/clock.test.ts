import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { errorResponseSchema, testClockContract } from '@finebank/shared';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { CLOCK, type Clock } from '../src/common/clock/clock.js';
import { readConfig } from '../src/config/config.js';
import { createTestApp } from './helpers/test-app.js';

const clockPath = `/api${testClockContract.get.path}`;

describe('Clock', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  // T7: NODE_ENV=test fixes "now" at TEST_NOW (AC10).
  it('is fixed at TEST_NOW with NODE_ENV=test', async () => {
    app = await createTestApp({ config: { nodeEnv: 'test', testNow: '2026-01-02T03:04:05.000Z' } });

    const clock = app.get<Clock>(CLOCK);

    expect(clock.now().toISOString()).toBe('2026-01-02T03:04:05.000Z');
    expect(clock.now().toISOString()).toBe('2026-01-02T03:04:05.000Z');
  });

  // T7: outside tests "now" is the system time (AC10).
  it('follows the system time with NODE_ENV=development', async () => {
    app = await createTestApp({ config: { nodeEnv: 'development' } });
    const before = Date.now();

    const now = app.get<Clock>(CLOCK).now().getTime();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });

  it('reads TEST_NOW and defaults it to the e2e fixed instant', () => {
    const e2eConstants = readFileSync(resolve(import.meta.dirname, '../../e2e/constants.ts'), 'utf8');
    const fixedNow = /export const FIXED_NOW = '([^']+)'/.exec(e2eConstants)?.[1];

    expect(readConfig({ NODE_ENV: 'test', TEST_NOW: '2027-05-06T07:08:09Z' }).testNow).toBe('2027-05-06T07:08:09Z');
    expect(readConfig({ NODE_ENV: 'test' }).testNow).toBe(fixedNow);
  });

  it('rejects a TEST_NOW that is not an ISO instant', () => {
    expect(() => readConfig({ NODE_ENV: 'test', TEST_NOW: 'tomorrow' })).toThrow(/TEST_NOW/);
  });

  it('rejects a TEST_NOW without a zone, which would be read in local time', () => {
    expect(() => readConfig({ NODE_ENV: 'test', TEST_NOW: '2026-10-22T10:00:00' })).toThrow(/TEST_NOW/);
  });
});

describe('test clock route', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  // T7: GET and PUT /api/test/clock read and move the clock with NODE_ENV=test (AC10).
  it('reads and moves the clock with NODE_ENV=test', async () => {
    app = await createTestApp({ config: { nodeEnv: 'test', testNow: '2026-10-22T10:00:00.000Z' } });
    const server = app.getHttpServer();

    const read = await request(server).get(clockPath);
    expect(read.status).toBe(200);
    expect(read.body).toEqual({ now: '2026-10-22T10:00:00.000Z' });

    const moved = await request(server).put(clockPath).send({ now: '2026-11-01T00:00:00.000Z' });
    expect(moved.status).toBe(200);
    expect(moved.body).toEqual({ now: '2026-11-01T00:00:00.000Z' });

    expect((await request(server).get(clockPath)).body).toEqual({ now: '2026-11-01T00:00:00.000Z' });
    expect(app.get<Clock>(CLOCK).now().toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  it('rejects an invalid instant with field errors', async () => {
    app = await createTestApp({ config: { nodeEnv: 'test' } });

    const response = await request(app.getHttpServer()).put(clockPath).send({ now: 'soon' });

    expect(response.status).toBe(400);
    expect(Object.keys(errorResponseSchema.parse(response.body).fieldErrors ?? {})).toEqual(['now']);
  });

  // T7: the route does not exist without NODE_ENV=test (AC10).
  it.each(['development', 'production'] as const)('does not exist with NODE_ENV=%s', async (nodeEnv) => {
    app = await createTestApp({ config: { nodeEnv } });
    const server = app.getHttpServer();

    for (const response of [await request(server).get(clockPath), await request(server).put(clockPath).send({})]) {
      expect(response.status).toBe(404);
      expect(errorResponseSchema.strict().parse(response.body).message).toBeTruthy();
    }
  });
});
