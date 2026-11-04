import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import {
  categoryLimitMessages,
  categoryLimitsContract,
  categoryLimitsResponseSchema,
  errorResponseSchema,
  goalMessages,
} from '@finebank/shared';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { cookieFor, signUp } from './helpers/auth.js';
import { userIdOf } from './helpers/finance.js';
import { registeredRoutes } from './helpers/routes.js';
import { createTestApp } from './helpers/test-app.js';

// The paths come from the contract, so a route declared anywhere else would not answer them.
const listPath = `/api${categoryLimitsContract.list.path}`;
const savePath = `/api${categoryLimitsContract.save.path}`;

const usd = (cents: number) => ({ cents, currency: 'USD' });

/** A first login's limits, as sent: $250.00 for each of the six in the designed order (demo-data.md; #56, #61). */
const demoBody = {
  limits: [
    { category: 'housing', limit: usd(25_000) },
    { category: 'food', limit: usd(25_000) },
    { category: 'transportation', limit: usd(25_000) },
    { category: 'entertainment', limit: usd(25_000) },
    { category: 'shopping', limit: usd(25_000) },
    { category: 'others', limit: usd(25_000) },
  ],
};

/** Food's limit of $300.50, as the popup sends it for `300.5`. */
const foodBody = { category: 'food', limit: usd(30_050) };

/** Limits the form cannot send, with the text they answer on `limit` (#31, #108 a). */
const brokenLimits: [string, unknown, string][] = [
  ['0', usd(0), goalMessages.targetPositive],
  ['negative', usd(-100), goalMessages.invalidAmount],
  ['not whole cents', usd(1.5), goalMessages.invalidAmount],
  ['in another currency', { cents: 30_050, currency: 'EUR' }, goalMessages.invalidAmount],
  ['above $1,000,000,000.00', usd(100_000_000_001), goalMessages.targetMax],
  ['missing', undefined, goalMessages.invalidAmount],
];

type Row = { id: number; user_id: number; category: string; limit_cents: number };

describe('the category limits API', () => {
  let app: INestApplication;
  let db: DataSource;

  beforeAll(async () => {
    app = await createTestApp({ config: { nodeEnv: 'test' } });
    db = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Each signed-up session's email, which every write sends as `X-Expected-User` (task 022, #119). */
  const emails = new Map<string, string>();

  /** A new user signed up through the API, with the demo limits. */
  async function newUser() {
    const { user, token } = await signUp(app);
    emails.set(token, user.email);
    return { token, id: (await userIdOf(db, user.email))! };
  }

  /** A GET with a session and no `X-Time-Zone`: the limits have no month (#32). */
  const get = (options: { token?: string; path?: string }) => {
    const req = request(app.getHttpServer()).get(options.path ?? listPath);
    return options.token === undefined ? req : req.set('Cookie', cookieFor(options.token));
  };

  /** A PUT with the session's cookie and email, as the app sends it; no `X-Time-Zone`. */
  const put = (body: unknown, options: { token?: string; path?: string }) => {
    let req = request(app.getHttpServer()).put(options.path ?? savePath);
    if (options.token !== undefined) {
      req = req.set('Cookie', cookieFor(options.token)).set('X-Expected-User', emails.get(options.token)!);
    }
    return req.send(body as object);
  };

  /** A user's rows, read with plain SQL in id order. */
  const rowsOf = (userId: number) =>
    db.query<Row[]>('SELECT id, user_id, category, limit_cents FROM category_limits WHERE user_id = ? ORDER BY id', [
      userId,
    ]);
  const allRows = () => db.query<Row[]>('SELECT id, user_id, category, limit_cents FROM category_limits ORDER BY id');

  // T5: AC1 and AC9 (#11, #32, #39, #74, #75, #96).
  describe('GET /api/category-limits', () => {
    it('answers 200 with the six limits as sent, without X-Time-Zone, and only the contract’s keys', async () => {
      await newUser();
      const { token } = await newUser();

      const response = await get({ token });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(demoBody);
      const body = response.body as { limits: Record<string, unknown>[] };
      expect(Object.keys(body)).toEqual(['limits']);
      for (const entry of body.limits) {
        expect(Object.keys(entry).toSorted()).toEqual(['category', 'limit']);
        expect(Object.keys(entry.limit as object).toSorted()).toEqual(['cents', 'currency']);
      }
      expect(categoryLimitsResponseSchema.parse(response.body)).toEqual(demoBody);
    });

    // The other user signs up after the session user, so their rows come later: a read without the user condition
    // would answer them (task 027 code review: with the other user first, the session user's later rows hid the bug).
    it('answers the session user’s rows only, whatever userId the query names', async () => {
      const { token } = await newUser();
      const other = await newUser();
      await db.query("UPDATE category_limits SET limit_cents = 99 WHERE user_id = ? AND category = 'food'", [other.id]);

      expect((await get({ token, path: `${listPath}?userId=${other.id}` })).body).toEqual(demoBody);
    });

    it('answers `limit: null` for a category without a row (#125 a)', async () => {
      const { token, id } = await newUser();
      await db.query("DELETE FROM category_limits WHERE user_id = ? AND category = 'transportation'", [id]);

      const response = await get({ token });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        limits: demoBody.limits.map((entry) =>
          entry.category === 'transportation' ? { category: 'transportation', limit: null } : entry,
        ),
      });
    });

    it('answers 401 without a session', async () => {
      const response = await get({});

      expect(response.status).toBe(401);
      expect(errorResponseSchema.strict().parse(response.body).message).toBe('Authentication required');
    });
  });

  // T6: AC5, AC10 and AC13 (#11, #31, #39, #46, #108 a, #125 b).
  describe('PUT /api/category-limits', () => {
    it('updates Food and answers 200 with `{ category, limit }`; the other rows unchanged; GET answers it', async () => {
      const other = await newUser();
      const { token, id } = await newUser();
      const before = await rowsOf(id);
      const otherBefore = await rowsOf(other.id);

      const response = await put(foodBody, { token });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(foodBody);
      expect(Object.keys(response.body as object).toSorted()).toEqual(['category', 'limit']);
      expect(await rowsOf(id)).toEqual(
        before.map((row) => (row.category === 'food' ? { ...row, limit_cents: 30_050 } : row)),
      );
      expect(await rowsOf(other.id)).toEqual(otherBefore);
      expect((await get({ token })).body).toEqual({
        limits: demoBody.limits.map((entry) => (entry.category === 'food' ? foodBody : entry)),
      });
    });

    it('accepts the maximum, $1,000,000,000.00', async () => {
      const { token } = await newUser();

      const response = await put({ category: 'transportation', limit: usd(100_000_000_000) }, { token });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ category: 'transportation', limit: usd(100_000_000_000) });
    });

    it.each(brokenLimits)(
      'answers 400 for a limit that is %s, on `limit`, and stores nothing',
      async (_case, limit, message) => {
        const { token } = await newUser();
        const before = await allRows();

        const response = await put({ category: 'food', limit }, { token });

        expect(response.status).toBe(400);
        expect(errorResponseSchema.strict().parse(response.body)).toEqual({
          message: 'Validation failed',
          fieldErrors: { limit: message },
        });
        expect(await allRows()).toEqual(before);
      },
    );

    it('changes only the session user’s Food row when the body names the other user', async () => {
      const other = await newUser();
      const { token, id } = await newUser();
      const otherBefore = await rowsOf(other.id);

      const response = await put(
        { ...foodBody, userId: other.id, user_id: other.id, id: otherBefore[0]!.id },
        { token, path: `${savePath}?userId=${other.id}` },
      );

      expect(response.status).toBe(200);
      expect(await rowsOf(other.id)).toEqual(otherBefore);
      expect((await rowsOf(id)).find((row) => row.category === 'food')!.limit_cents).toBe(30_050);
    });

    it('creates the row of a category without one: one row for the user and Food (#125 b)', async () => {
      const { token, id } = await newUser();
      await db.query("DELETE FROM category_limits WHERE user_id = ? AND category = 'food'", [id]);

      const response = await put({ category: 'food', limit: usd(25_000) }, { token });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ category: 'food', limit: usd(25_000) });
      expect((await rowsOf(id)).filter((row) => row.category === 'food')).toEqual([
        { id: expect.any(Number) as unknown, user_id: id, category: 'food', limit_cents: 25_000 },
      ]);
      expect(await rowsOf(id)).toHaveLength(6);
      expect((await get({ token })).body).toEqual(demoBody);
    });

    it('answers 401 without a session and stores nothing', async () => {
      await newUser();
      const before = await allRows();

      const response = await put(foodBody, {});

      expect(response.status).toBe(401);
      expect(errorResponseSchema.strict().parse(response.body).message).toBe('Authentication required');
      expect(await allRows()).toEqual(before);
    });
  });

  // T7: AC10, a category outside the six (Marko, task file approval).
  describe('PUT /api/category-limits with a category outside the six', () => {
    it.each<[string, Record<string, unknown>]>([
      ['bills', { category: 'bills', limit: usd(30_050) }],
      ['Food', { category: 'Food', limit: usd(30_050) }],
      ['an empty text', { category: '', limit: usd(30_050) }],
      ['a number', { category: 7, limit: usd(30_050) }],
      ['no category key', { limit: usd(30_050) }],
    ])('answers 400 in the shared error shape for %s and stores nothing for any user', async (_case, body) => {
      await newUser();
      const { token, id } = await newUser();
      const before = await rowsOf(id);
      const everyRow = await allRows();

      const response = await put(body, { token });

      expect(response.status).toBe(400);
      // As sent, before any schema parse.
      expect(response.body).toEqual({
        message: 'Validation failed',
        fieldErrors: { category: categoryLimitMessages.invalidCategory },
      });
      expect(await rowsOf(id)).toEqual(before);
      expect(await allRows()).toEqual(everyRow);
    });
  });

  // T10: AC9 and AC10, the routes exist once, in the contract; nothing takes a user, a row or a category in the path.
  describe('routes', () => {
    it('registers exactly the contract’s two category limit routes', () => {
      expect(registeredRoutes(app).filter((route) => route.includes('/category-limits'))).toEqual([
        'GET /api/category-limits',
        'PUT /api/category-limits',
      ]);
    });

    it('has no route that takes a category, a user or a row ID', async () => {
      const other = await newUser();
      const { token } = await newUser();
      const otherBefore = await rowsOf(other.id);
      const [otherRow] = otherBefore;

      for (const path of [
        `${listPath}/food`,
        `${listPath}/${other.id}`,
        `${listPath}/${String(otherRow!.id)}`,
        `${listPath}/food/2026-10`,
      ]) {
        expect((await get({ token, path })).status, `GET ${path}`).toBe(404);
        expect((await put(foodBody, { token, path })).status, `PUT ${path}`).toBe(404);
      }
      expect(await rowsOf(other.id)).toEqual(otherBefore);
    });
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

const fileList = () => sourceFiles(srcDir).map((file) => relative(srcDir, file).replaceAll('\\', '/'));
const read = (file: string) => readFileSync(join(srcDir, file), 'utf8');

// T10: AC9, the paths exist once, in the contract (#74); the limits have no month, so no clock and no zone (#32).
describe('category limit sources', () => {
  const declaresPath = /['"`]\/category-limits\b|@(Controller|Get|Post|Put|Patch|Delete)\(\s*['"`]\/?category-limits\b/;

  it('never declares a category limit path outside the contract', () => {
    const files = fileList();
    const offenders = files.filter((file) => declaresPath.test(read(file)));

    expect(files).toContain('goals/category-limits.controller.ts');
    expect(offenders).toEqual([]);
  });

  it.each(["@Put('/category-limits')", "@Controller('category-limits')", "const path = '/category-limits';"])(
    'flags %s',
    (code) => {
      expect(declaresPath.test(code)).toBe(true);
    },
  );

  it.each(["@Entity({ name: 'category_limits' })", '@Put(categoryLimitsContract.save.path)'])('allows %s', (code) => {
    expect(declaresPath.test(code)).toBe(false);
  });

  it.each(['goals/category-limits.service.ts', 'goals/category-limits.controller.ts'])(
    '%s reads no clock and no time zone',
    (file) => {
      expect(read(file)).not.toMatch(/\bCLOCK\b|\bClock\b|TimeZone|X-Time-Zone|monthIn|todayIn/);
    },
  );
});

// T9: AC11, no migration for the limits: the table, its CHECK and its unique key are task 008's (finance-schema.test.ts).
describe('category limit migrations', () => {
  const migrationsDir = resolve(import.meta.dirname, '../src/database/migrations');

  it('touches category_limits only in task 008’s CreateFinanceTables', () => {
    const files = readdirSync(migrationsDir).filter((name) => name !== 'index.ts');
    const touching = files.filter((name) => /category_limits/.test(readFileSync(join(migrationsDir, name), 'utf8')));

    expect(files.length).toBeGreaterThan(1);
    expect(touching).toEqual(['1792930295195-CreateFinanceTables.ts']);
  });
});
