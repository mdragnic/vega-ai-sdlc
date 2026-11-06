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

/** A photo's three columns, the time fixed (task 029). */
const photo = (path: string, type: string) => ({
  photo_path: path,
  photo_mime_type: type,
  photo_updated_at: '2026-10-22 10:00:00.000',
});

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

  it('creates the users and sessions tables, and the finance tables of task 008', async () => {
    const tables = await query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );

    expect(tables.map((table) => table.name)).toEqual([
      'accounts',
      'bills',
      'category_limits',
      'migrations',
      'savings_goals',
      'sessions',
      'transactions',
      'users',
    ]);
  });

  it('gives users a unique email and username and a nullable password hash', async () => {
    const columns = await query<{ name: string; notnull: number; pk: number }>('PRAGMA table_info(users)');

    expect(columns.map(({ name, notnull, pk }) => ({ name, notnull, pk }))).toEqual([
      { name: 'id', notnull: 1, pk: 1 },
      { name: 'email', notnull: 1, pk: 0 },
      { name: 'full_name', notnull: 1, pk: 0 },
      { name: 'username', notnull: 1, pk: 0 },
      { name: 'password_hash', notnull: 0, pk: 0 },
      // Task 028: the phone (#33, #43, #126 c, d).
      { name: 'phone_country_code', notnull: 1, pk: 0 },
      { name: 'phone_number', notnull: 1, pk: 0 },
      // Task 029: the photo (#76).
      { name: 'photo_path', notnull: 0, pk: 0 },
      { name: 'photo_mime_type', notnull: 0, pk: 0 },
      { name: 'photo_updated_at', notnull: 0, pk: 0 },
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

  // Task 028 T23: AddUserPhone gives every user +1 and no number (#43, demo-data.md), with checks on their shapes.
  describe('the phone columns', () => {
    let next = 0;
    const insert = (columns: Record<string, string>) => {
      next += 1;
      const values = { email: `phone${next}@x.com`, full_name: 'P', username: `phone${next}`, ...columns };
      const names = Object.keys(values).map((name) => `"${name}"`);
      return dataSource.query(
        `INSERT INTO users (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`,
        Object.values(values),
      );
    };

    it('defaults a new row to +1 and an empty number', async () => {
      await insert({});
      const [row] = await query<{ phone_country_code: string; phone_number: string }>(
        `SELECT phone_country_code, phone_number FROM users WHERE email = 'phone${next}@x.com'`,
      );

      expect(row).toEqual({ phone_country_code: '+1', phone_number: '' });
    });

    it.each(['+1', '+44', '+880', '+998'])('accepts the country code %s', async (code) => {
      await expect(insert({ phone_country_code: code })).resolves.not.toThrow();
    });

    it.each(['', '1', '+', '+0', '+01', '+1234', '+88a', ' +1', '+1 '])('refuses the country code %j', async (code) => {
      await expect(insert({ phone_country_code: code })).rejects.toThrow(/CHECK constraint failed/);
    });

    it.each(['', '0', '5154758868', '123456789012345'])('accepts the number %j', async (number) => {
      await expect(insert({ phone_number: number })).resolves.not.toThrow();
    });

    it.each(['1234567890123456', '515 4758868', '064-123', '+381', '12a', '١٢'])(
      'refuses the number %j',
      async (number) => {
        await expect(insert({ phone_number: number })).rejects.toThrow(/CHECK constraint failed/);
      },
    );
  });

  // Task 029 T22: AddUserPhoto gives users the photo's name, type and time (#76): null without a photo, all three or none,
  // the name a lowercase UUID v4 with the type's extension.
  describe('the photo columns', () => {
    let next = 0;
    const name = '0e6f6b5c-3c1d-4d8a-9f00-0123456789ab';
    const insert = (columns: Record<string, string>) => {
      next += 1;
      const values = { email: `photo${next}@x.com`, full_name: 'P', username: `photo${next}`, ...columns };
      const names = Object.keys(values).map((column) => `"${column}"`);
      return dataSource.query(
        `INSERT INTO users (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`,
        Object.values(values),
      );
    };

    it('are nullable text, text and datetime', async () => {
      const columns = await query<{ name: string; type: string; notnull: number; dflt_value: unknown }>(
        'PRAGMA table_info(users)',
      );

      expect(columns.filter((column) => column.name.startsWith('photo_'))).toEqual([
        expect.objectContaining({ name: 'photo_path', type: 'TEXT', notnull: 0, dflt_value: null }),
        expect.objectContaining({ name: 'photo_mime_type', type: 'TEXT', notnull: 0, dflt_value: null }),
        expect.objectContaining({ name: 'photo_updated_at', type: 'datetime', notnull: 0, dflt_value: null }),
      ]);
    });

    it('leave a new row without a photo', async () => {
      await insert({});
      const [row] = await query<Record<string, unknown>>(
        `SELECT photo_path, photo_mime_type, photo_updated_at FROM users WHERE email = 'photo${next}@x.com'`,
      );

      expect(row).toEqual({ photo_path: null, photo_mime_type: null, photo_updated_at: null });
    });

    it.each([
      ['a JPEG', photo(`${name}.jpg`, 'image/jpeg')],
      ['a PNG', photo(`${name}.png`, 'image/png')],
    ])('accept %s with all three set', async (_case, columns) => {
      await expect(insert(columns)).resolves.not.toThrow();
    });

    it.each([
      ['a name alone', { photo_path: `${name}.png` }],
      ['a type alone', { photo_mime_type: 'image/png' }],
      ['a time alone', { photo_updated_at: '2026-10-22 10:00:00.000' }],
      ['no time', { photo_path: `${name}.png`, photo_mime_type: 'image/png' }],
      ['a path', photo(`../${name}.png`, 'image/png')],
      ['a name in a folder', photo(`uploads/${name}.png`, 'image/png')],
      ['an uppercase UUID', photo(`${name.toUpperCase()}.png`, 'image/png')],
      ['a UUID of version 1', photo(`${name.replace('-4d8a-', '-1d8a-')}.png`, 'image/png')],
      ['a UUID of another variant', photo(`${name.replace('-9f00-', '-cf00-')}.png`, 'image/png')],
      ['a name with more after it', photo(`${name}.png.html`, 'image/png')],
      ['.jpeg', photo(`${name}.jpeg`, 'image/jpeg')],
      ['.png for a JPEG', photo(`${name}.png`, 'image/jpeg')],
      ['.jpg for a PNG', photo(`${name}.jpg`, 'image/png')],
      ['another type', photo(`${name}.png`, 'image/gif')],
    ])('refuse %s', async (_case, columns) => {
      await expect(insert(columns)).rejects.toThrow(/CHECK constraint failed/);
    });
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

/** The rows that reference a user: a rebuild of the users table must keep them. */
const referencingRows = async (db: DataSource) => ({
  sessions: await db.query('SELECT * FROM sessions'),
  accounts: await db.query('SELECT * FROM accounts'),
});

// Task 028: AddUserPhone rebuilds `users` (SQLite cannot add a CHECK to a table); an existing user keeps every row that
// references them (sessions and finance rows cascade on delete), and gets +1 and no number (#43).
describe('AddUserPhone on an existing database', () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'finebank-'));
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('keeps every user, session and finance row, and gives existing users +1 and no number', async () => {
    const databaseFile = join(root, 'existing.sqlite');
    const options = databaseOptions({ ...readConfig({ NODE_ENV: 'test' }), databaseFile });
    const before = await new DataSource({ ...options, migrations: migrations.slice(0, 2) }).initialize();
    await before.runMigrations();
    await before.query("INSERT INTO users (email, full_name, username) VALUES ('old@x.com', 'Old User', 'old.user')");
    await before.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ('h-old', 1, '2026-11-21')");
    await before.query(
      `INSERT INTO accounts (user_id, account_type, bank_name, branch_name, account_number, opening_balance_cents)
       VALUES (1, 'checking', 'AB Bank Ltd', 'Main Branch', '1234567890123456', 0)`,
    );
    const kept = await referencingRows(before);
    await before.destroy();

    const after = await new DataSource(options).initialize();
    try {
      expect(await after.runMigrations()).toHaveLength(migrations.length - 2);
      expect(
        await after.query('SELECT id, email, full_name, username, phone_country_code, phone_number FROM users'),
      ).toEqual([
        {
          id: 1,
          email: 'old@x.com',
          full_name: 'Old User',
          username: 'old.user',
          phone_country_code: '+1',
          phone_number: '',
        },
      ]);
      expect(await referencingRows(after)).toEqual(kept);
      expect(kept.sessions).toHaveLength(1);
      expect(kept.accounts).toHaveLength(1);
      expect(await after.query('PRAGMA foreign_key_check')).toEqual([]);
    } finally {
      await after.destroy();
    }
  });
});

// Task 029 T22: AddUserPhoto rebuilds `users` (SQLite cannot add a CHECK to a table); every row is kept, with no photo.
describe('AddUserPhoto on an existing database', () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'finebank-'));
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('keeps every user, session and finance row, and gives every user no photo', async () => {
    const databaseFile = join(root, 'existing.sqlite');
    const options = databaseOptions({ ...readConfig({ NODE_ENV: 'test' }), databaseFile });
    const addUserPhoto = migrations.findIndex((migration) => migration.name.startsWith('AddUserPhoto'));
    expect(addUserPhoto).toBeGreaterThan(0);
    const before = await new DataSource({ ...options, migrations: migrations.slice(0, addUserPhoto) }).initialize();
    await before.runMigrations();
    await before.query(
      `INSERT INTO users (email, full_name, username, phone_country_code, phone_number)
       VALUES ('old@x.com', 'Old User', 'old.user', '+44', '2071234567')`,
    );
    await before.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ('h-old', 1, '2026-11-21')");
    await before.query(
      `INSERT INTO accounts (user_id, account_type, bank_name, branch_name, account_number, opening_balance_cents)
       VALUES (1, 'checking', 'AB Bank Ltd', 'Main Branch', '1234567890123456', 0)`,
    );
    const users = await before.query('SELECT * FROM users');
    const kept = await referencingRows(before);
    await before.destroy();

    const after = await new DataSource(options).initialize();
    try {
      expect(await after.runMigrations()).toHaveLength(migrations.length - addUserPhoto);
      expect(await after.query('SELECT * FROM users')).toEqual(
        users.map((user: object) => ({ ...user, photo_path: null, photo_mime_type: null, photo_updated_at: null })),
      );
      expect(await referencingRows(after)).toEqual(kept);
      expect(kept.sessions).toHaveLength(1);
      expect(kept.accounts).toHaveLength(1);
      expect(await after.query('PRAGMA foreign_key_check')).toEqual([]);
    } finally {
      await after.destroy();
    }
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
