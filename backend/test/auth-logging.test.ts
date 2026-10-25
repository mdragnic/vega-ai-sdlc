import { inspect } from 'node:util';

import type { INestApplication, LoggerService } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { cookieFor, login, me, sessionCookie } from './helpers/auth.js';
import { createTestApp } from './helpers/test-app.js';

/** Collects everything the app logs, objects included, as a logger would print them. */
class CapturingLogger implements LoggerService {
  readonly lines: string[] = [];
  private capture = (...args: unknown[]) => {
    this.lines.push(args.map((arg) => (typeof arg === 'string' ? arg : inspect(arg, { depth: 10 }))).join(' '));
  };
  log = this.capture;
  error = this.capture;
  warn = this.capture;
  debug = this.capture;
  verbose = this.capture;
  fatal = this.capture;
}

const fields = { fullName: 'Secret Person Name', email: 'secret.person@example.com', password: 'Plaintext-Secret-42' };

// AC5: no response body or log line contains a password or a hash; a database error never logs the row (#75).
describe('auth responses and logs', () => {
  let app: INestApplication;
  let logger: CapturingLogger;

  beforeEach(async () => {
    logger = new CapturingLogger();
    app = await createTestApp({ logger });
  });

  afterEach(async () => {
    await app.close();
  });

  it('never put the password, its hash or the session token in a body or a log line', async () => {
    const server = app.getHttpServer();
    const signup = await request(server).post('/api/auth/signup').send(fields);
    const token = sessionCookie(signup).value;
    const [{ password_hash: hash }] = await app
      .get(DataSource)
      .query<[{ password_hash: string }]>('SELECT password_hash FROM users');
    const bodies = [
      signup.text,
      (await login(app, { email: fields.email, password: 'wrong-password-1' })).text,
      (await login(app, { email: fields.email, password: fields.password })).text,
      (await request(server).post('/api/auth/signup').send(fields)).text,
      (await me(app, token)).text,
      (await request(server).post('/api/auth/logout').set('Cookie', cookieFor(token))).text,
    ];

    const output = [...bodies, ...logger.lines].join('\n');
    expect(output).not.toContain(fields.password);
    expect(output).not.toContain(hash);
    expect(output).not.toContain(hash.split('$').at(-1));
    expect(logger.lines.join('\n')).not.toContain(token);
  });

  it('logs a database error during sign up without the row’s values', async () => {
    await app
      .get(DataSource)
      .query("CREATE TRIGGER fail_signup BEFORE INSERT ON users BEGIN SELECT RAISE(ABORT, 'disk on fire'); END");

    const response = await request(app.getHttpServer()).post('/api/auth/signup').send(fields);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Internal server error' });
    const output = logger.lines.join('\n');
    expect(output).toContain('disk on fire');
    for (const value of [fields.password, fields.email, fields.fullName, 'secret.person', 'scrypt$']) {
      expect(output).not.toContain(value);
    }
  });
});
