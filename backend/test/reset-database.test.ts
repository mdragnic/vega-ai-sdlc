import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readConfig } from '../src/config/config.js';
import { resetDatabase } from '../src/database/reset-database.js';

function tableNames(file: string): string[] {
  const db = new Database(file, { readonly: true });
  // sqlite_* tables are SQLite internals (sqlite_sequence backs AUTOINCREMENT).
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as { name: string }[];
  db.close();
  return rows.map((row) => row.name);
}

// E2E runs start from an empty test database with all migrations applied (task 000 step 6).
describe('resetDatabase', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'finebank-'));
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('drops existing data and applies the migrations', async () => {
    const config = {
      ...readConfig({ NODE_ENV: 'test' }),
      databaseFile: join(root, 'finebank.test.sqlite'),
      uploadsDir: join(root, 'uploads-test'),
    };
    const db = new Database(config.databaseFile);
    db.exec('CREATE TABLE leftover (id INTEGER)');
    db.close();

    await resetDatabase(config);

    expect(tableNames(config.databaseFile)).toEqual([
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

  // Task 029: the e2e run's photos go with its database: the folder is emptied, and kept.
  it('empties the uploads folder', async () => {
    const uploadsDir = join(root, 'uploads-test');
    mkdirSync(join(uploadsDir, 'nested'), { recursive: true });
    writeFileSync(join(uploadsDir, '0e6f6b5c-3c1d-4d8a-9f00-0123456789ab.png'), 'x');
    writeFileSync(join(uploadsDir, 'nested', 'y.jpg'), 'y');
    const config = {
      ...readConfig({ NODE_ENV: 'test' }),
      databaseFile: join(root, 'finebank.test.sqlite'),
      uploadsDir,
    };

    await resetDatabase(config);

    expect(existsSync(uploadsDir)).toBe(true);
    expect(readdirSync(uploadsDir)).toEqual([]);
  });

  it('refuses to run outside NODE_ENV=test, touching neither the database nor the uploads', async () => {
    const uploadsDir = join(root, 'uploads');
    mkdirSync(uploadsDir);
    writeFileSync(join(uploadsDir, 'kept.png'), 'x');
    const config = {
      ...readConfig({ NODE_ENV: 'development' }),
      databaseFile: join(root, 'finebank.sqlite'),
      uploadsDir,
    };

    await expect(resetDatabase(config)).rejects.toThrow(/NODE_ENV=test/);
    expect(readdirSync(uploadsDir)).toEqual(['kept.png']);
  });
});
