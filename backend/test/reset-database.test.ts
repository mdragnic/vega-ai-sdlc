import { mkdtempSync, rmSync } from 'node:fs';
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
    const config = { ...readConfig({ NODE_ENV: 'test' }), databaseFile: join(root, 'finebank.test.sqlite') };
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

  it('refuses to run outside NODE_ENV=test', async () => {
    const config = { ...readConfig({ NODE_ENV: 'development' }), databaseFile: join(root, 'finebank.sqlite') };

    await expect(resetDatabase(config)).rejects.toThrow(/NODE_ENV=test/);
  });
});
