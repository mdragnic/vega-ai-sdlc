import { Controller, Get, type INestApplication } from '@nestjs/common';
import { errorResponseSchema } from '@finebank/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TimeZone } from '../src/common/time-zone/time-zone.decorator.js';
import { createTestApp } from './helpers/test-app.js';

@Controller('probe')
class ZoneController {
  @Get('zone')
  zone(@TimeZone() timeZone: string): { timeZone: string } {
    return { timeZone };
  }
}

// T6: endpoints that need the browser zone read a valid IANA name from X-Time-Zone (#54, AC11).
describe('TimeZone decorator', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp({ controllers: [ZoneController] });
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (zone?: string) => {
    const req = request(app.getHttpServer()).get('/api/probe/zone');
    return zone === undefined ? req : req.set('X-Time-Zone', zone);
  };

  it('passes a valid IANA zone to the handler', async () => {
    const response = await get('Europe/Belgrade');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ timeZone: 'Europe/Belgrade' });
  });

  it('accepts UTC and Etc zones', async () => {
    expect((await get('UTC')).body).toEqual({ timeZone: 'UTC' });
    expect((await get('Etc/GMT+1')).status).toBe(200);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['unknown', 'Mars/Base'],
    ['an offset, not a zone name', '+01:00'],
    ['garbage', '<script>'],
  ])('rejects a %s header with 400 and the shared error shape', async (_, zone) => {
    const response = await get(zone);

    expect(response.status).toBe(400);
    expect(errorResponseSchema.strict().parse(response.body).message).toMatch(/X-Time-Zone/);
  });
});
