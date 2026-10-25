import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';

import type { INestApplication } from '@nestjs/common';
import { DataSource, type Logger as TypeOrmLogger } from 'typeorm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { DemoSeeder, INSERT_BATCH_SIZE } from '../src/demo/demo-seeder.js';
import { User } from '../src/users/user.entity.js';
import { signUp } from './helpers/auth.js';
import { tableCounts } from './helpers/finance.js';
import { createTestApp } from './helpers/test-app.js';

// Every file read of the app goes through these spies (they call the real functions).
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const spies = {
    readFileSync: vi.fn<typeof actual.readFileSync>(actual.readFileSync),
    readFile: vi.fn<typeof actual.readFile>(actual.readFile),
    promises: { ...actual.promises, readFile: vi.fn<typeof actual.promises.readFile>(actual.promises.readFile) },
  };
  return { ...actual, ...spies, default: { ...actual, ...spies } };
});
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  const readFile = vi.fn<typeof actual.readFile>(actual.readFile);
  return { ...actual, readFile, default: { ...actual, readFile } };
});

/** A read's path; a URL, buffer, descriptor or handle as Node would print it. */
const pathOf = (file: unknown): string =>
  typeof file === 'string' ? file : file instanceof URL ? file.pathname : inspect(file);

const fileReads = () => [
  ...vi.mocked(fs.readFileSync).mock.calls.map(([file]) => pathOf(file)),
  ...vi.mocked(fs.readFile).mock.calls.map(([file]) => pathOf(file)),
  ...vi.mocked(fs.promises.readFile).mock.calls.map(([file]) => pathOf(file)),
  ...vi.mocked(fsPromises.readFile).mock.calls.map(([file]) => pathOf(file)),
];

const SQLITE_MAX_VARIABLES = 32_766;

// T9: AC6, the dataset is read once at start; seeding reads no file and never yields to the event loop.
describe('seeding and I/O', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // Vitest clears the spies before each test (clearMocks), so this test starts its own app.
  it('reads and validates the dataset once, when the app starts', async () => {
    const started = await createTestApp();
    try {
      const atStart = fileReads().filter((file) => file.endsWith('demo-dataset.json'));
      await signUp(started);
      await signUp(started);

      expect(atStart).toHaveLength(1);
      expect(fileReads().filter((file) => file.endsWith('demo-dataset.json'))).toHaveLength(1);
    } finally {
      await started.close();
    }
  });

  it('reads no file during a sign up', async () => {
    await signUp(app);

    expect(fileReads()).toEqual([]);
    expect((await tableCounts(app.get(DataSource))).transactions).toBeGreaterThanOrEqual(3411);
  });

  it('does not yield to the event loop while seeding inside a transaction', async () => {
    const db = app.get(DataSource);
    const seeder = app.get(DemoSeeder);
    let immediateRan: boolean | undefined;

    await db.transaction(async (manager) => {
      const user = await manager.save(
        manager.create(User, { email: 'io@example.com', fullName: 'Io', username: 'io_1', passwordHash: null }),
      );
      let ran = false;
      setImmediate(() => {
        ran = true;
      });
      await seeder.seed(manager, user.id);
      immediateRan = ran;
    });

    expect(immediateRan).toBe(false);
    const [{ count }] = await db.query<[{ count: number }]>(
      'SELECT COUNT(*) AS count FROM transactions t JOIN accounts a ON a.id = t.account_id JOIN users u ON u.id = a.user_id WHERE u.email = ?',
      ['io@example.com'],
    );
    expect(count).toBe(3411);
  });
});

/** Counts the INSERT statements and their bound values, as TypeORM runs them. */
class InsertCounter implements TypeOrmLogger {
  readonly inserts: { table: string; parameters: number }[] = [];
  logQuery(query: string, parameters?: unknown[]): void {
    const table = /^INSERT INTO "(\w+)"/.exec(query)?.[1];
    if (table) this.inserts.push({ table, parameters: parameters?.length ?? 0 });
  }
  logQueryError(): void {}
  logQuerySlow(): void {}
  logSchemaBuild(): void {}
  logMigration(): void {}
  log(): void {}
}

// T11: AC7, batched inserts and the seeding time on a file database.
describe('seeding speed', () => {
  let app: INestApplication;
  let root: string;

  beforeAll(async () => {
    root = fs.mkdtempSync(join(tmpdir(), 'finebank-seed-'));
    app = await createTestApp({ config: { databaseFile: join(root, 'finebank.test.sqlite') } });
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('inserts the transactions in batches, under SQLite’s bound variable limit', async () => {
    const counter = new InsertCounter();
    app.get(DataSource).setOptions({ logger: counter });

    await signUp(app);

    const transactionInserts = counter.inserts.filter((insert) => insert.table === 'transactions');
    expect(transactionInserts).toHaveLength(Math.ceil(3411 / INSERT_BATCH_SIZE));
    expect(transactionInserts.length).toBeLessThan(10);
    expect(Math.max(...counter.inserts.map((insert) => insert.parameters))).toBeLessThanOrEqual(SQLITE_MAX_VARIABLES);
    // One statement per account (to get its ID), one each for bills, goals and limits, then the session.
    expect(counter.inserts.map((insert) => insert.table).filter((table) => table !== 'transactions')).toEqual([
      'users',
      'accounts',
      'accounts',
      'accounts',
      'accounts',
      'accounts',
      'bills',
      'savings_goals',
      'category_limits',
      'sessions',
    ]);
  });

  it('seeds in under 3,000 ms', async () => {
    const seeder = app.get(DemoSeeder);
    const seed = seeder.seed.bind(seeder);
    let elapsed = Number.NaN;
    vi.spyOn(seeder, 'seed').mockImplementation(async (manager, userId) => {
      const start = performance.now();
      await seed(manager, userId);
      elapsed = performance.now() - start;
    });

    await signUp(app);

    // Written past Vitest's console capture, so a plain `npm test` shows it too (AC7).
    process.stdout.write(
      `Seeding 3,411 transactions and the other rows took ${elapsed.toFixed(0)} ms (file database)\n`,
    );
    expect(elapsed).toBeLessThan(3000);
  });
});
