import { Body, Controller, type INestApplication, Post } from '@nestjs/common';
import { errorResponseSchema } from '@finebank/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createTestApp } from './helpers/test-app.js';

const greetingSchema = z.object({ name: z.string().min(1) });

@Controller('probe')
class ProbeController {
  @Post('greeting')
  greet(@Body({ schema: greetingSchema }) body: z.infer<typeof greetingSchema>): { greeting: string } {
    return { greeting: `Hello ${body.name}` };
  }

  @Post('crash')
  crash(): never {
    throw new Error('database password is hunter2');
  }
}

describe('app', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp({ controllers: [ProbeController] });
  });

  afterAll(async () => {
    await app.close();
  });

  // T10: unknown routes return the shared error shape (AC12).
  it('returns 404 with the shared error shape for an unknown /api route', async () => {
    const response = await request(app.getHttpServer()).get('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect(errorResponseSchema.strict().parse(response.body).message).toBeTruthy();
  });

  it('validates a body against its schema with the global pipe', async () => {
    const response = await request(app.getHttpServer()).post('/api/probe/greeting').send({ name: 'Marko' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ greeting: 'Hello Marko' });
  });

  it('returns 400 with field errors when the body is invalid', async () => {
    const response = await request(app.getHttpServer()).post('/api/probe/greeting').send({ name: '' });

    expect(response.status).toBe(400);
    const body = errorResponseSchema.strict().parse(response.body);
    expect(body.message).toBeTruthy();
    expect(Object.keys(body.fieldErrors ?? {})).toEqual(['name']);
  });

  it('returns 400 with the shared error shape for malformed JSON', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/probe/greeting')
      .set('Content-Type', 'application/json')
      .send('{"name":');

    expect(response.status).toBe(400);
    expect(errorResponseSchema.strict().parse(response.body).message).toBeTruthy();
  });

  it('returns 413 with the shared error shape for a body over the size limit', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/probe/greeting')
      .send({ name: 'x'.repeat(200_000) });

    expect(response.status).toBe(413);
    expect(errorResponseSchema.strict().parse(response.body).message).toBeTruthy();
  });

  it('returns 500 with a generic message for an unexpected error', async () => {
    const response = await request(app.getHttpServer()).post('/api/probe/crash');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Internal server error' });
  });
});
