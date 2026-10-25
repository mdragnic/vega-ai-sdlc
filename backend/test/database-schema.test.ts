import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { readConfig } from '../src/config/config.js';
import { databaseOptions } from '../src/database/database-options.js';
import { migrations } from '../src/database/migrations/index.js';
import { signUp } from './helpers/auth.js';
import { createTestApp } from './helpers/test-app.js';

interface IndexRow {
  name: string;
  unique: number;
}

// T16: the migrations create users and sessions with their constraints, and match the entities (#75, #79).
describe('migrations', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await new DataSource(
      databaseOptions({ ...readConfig({ NODE_ENV: 'test' }), databaseFile: ':memory:' }),
    ).initialize();
    await dataSource.runMigrations();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  const query = <T>(sql: string): Promise<T[]> => dataSource.query(sql);

  /** Column lists of every index on a table, with whether it is unique. */
  async function indexes(table: string): Promise<{ columns: string[]; unique: boolean }[]> {
    const list = await query<IndexRow>(`PRAGMA index_list(${table})`);
    return Promise.all(
      list.map(async (index) => ({
        columns: (await query<{ name: string }>(`PRAGMA index_info("${index.name}")`)).map((column) => column.name),
        unique: index.unique === 1,
      })),
    );
  }

  it('creates the users and sessions tables', async () => {
    const tables = await query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );

    expect(tables.map((table) => table.name)).toEqual(['migrations', 'sessions', 'users']);
  });

  it('gives users a unique email and username and a nullable password hash', async () => {
    const columns = await query<{ name: string; notnull: number; pk: number }>('PRAGMA table_info(users)');

    expect(columns.map(({ name, notnull, pk }) => ({ name, notnull, pk }))).toEqual([
      { name: 'id', notnull: 1, pk: 1 },
      { name: 'email', notnull: 1, pk: 0 },
      { name: 'full_name', notnull: 1, pk: 0 },
      { name: 'username', notnull: 1, pk: 0 },
      { name: 'password_hash', notnull: 0, pk: 0 },
    ]);
    expect(await indexes('users')).toEqual(
      expect.arrayContaining([
        { columns: ['email'], unique: true },
        { columns: ['username'], unique: true },
      ]),
    );
  });

  it('gives sessions only the token hash, the user and the expiry', async () => {
    const columns = await query<{ name: string; notnull: number }>('PRAGMA table_info(sessions)');

    expect(columns.map(({ name, notnull }) => ({ name, notnull }))).toEqual([
      { name: 'id', notnull: 1 },
      { name: 'token_hash', notnull: 1 },
      { name: 'user_id', notnull: 1 },
      { name: 'expires_at', notnull: 1 },
    ]);
    expect(await indexes('sessions')).toEqual(
      expect.arrayContaining([
        { columns: ['token_hash'], unique: true },
        { columns: ['user_id'], unique: false },
      ]),
    );
  });

  it('links sessions to users with ON DELETE CASCADE', async () => {
    const keys = await query<{ table: string; from: string; to: string; on_delete: string }>(
      'PRAGMA foreign_key_list(sessions)',
    );

    expect(keys.map(({ table, from, to, on_delete }) => ({ table, from, to, on_delete }))).toEqual([
      { table: 'users', from: 'user_id', to: 'id', on_delete: 'CASCADE' },
    ]);
  });

  it('deletes a user’s sessions with the user, with foreign keys enforced', async () => {
    await dataSource.query("INSERT INTO users (email, full_name, username) VALUES ('a@x.com', 'A', 'aaa')");
    const [user] = await query<{ id: number }>("SELECT id FROM users WHERE email = 'a@x.com'");
    await dataSource.query(
      `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ('h1', ${user!.id}, '2026-11-21 10:00:00.000')`,
    );

    await expect(
      dataSource.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ('h2', 999, '2026-11-21')"),
    ).rejects.toThrow(/FOREIGN KEY/);
    await dataSource.query(`DELETE FROM users WHERE id = ${user!.id}`);
    expect(await query('SELECT * FROM sessions')).toEqual([]);
  });

  it('leaves no schema change pending between the entities and the migrations', async () => {
    const pending = await dataSource.driver.createSchemaBuilder().log();

    expect(pending.upQueries.map((q) => q.query)).toEqual([]);
  });

  it('registers every migration file', () => {
    const files = readdirSync(join(import.meta.dirname, '../src/database/migrations'))
      .filter((file) => file.endsWith('.ts') && file !== 'index.ts')
      .map((file) => file.replace(/^(\d+)-(\w+)\.ts$/, '$2$1'));

    expect(migrations.map((migration) => migration.name).toSorted()).toEqual(files.toSorted());
  });
});

// T16: `synchronize` stays off outside tests (#79).
describe('database options', () => {
  it.each(['development', 'production', 'test'])('keep synchronize off with NODE_ENV=%s', (nodeEnv) => {
    expect(databaseOptions(readConfig({ NODE_ENV: nodeEnv })).synchronize).toBe(false);
  });
});

// T16: the database holds no raw session token and no password (#75).
describe('stored secrets', () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'finebank-'));
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('keeps neither the token nor the password in the database file', async () => {
    const databaseFile = join(root, 'finebank.test.sqlite');
    const app = await createTestApp({ config: { databaseFile } });
    let token: string;
    try {
      ({ token } = await signUp(app, { password: 'Plaintext-Secret-42' }));
    } finally {
      await app.close();
    }

    const bytes = readFileSync(databaseFile);
    expect(bytes.includes('Plaintext-Secret-42')).toBe(false);
    expect(bytes.includes(token)).toBe(false);
    expect(bytes.includes(Buffer.from(token, 'base64url'))).toBe(false);
  });
});
