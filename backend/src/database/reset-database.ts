import { rmSync } from 'node:fs';

import { DataSource } from 'typeorm';

import type { AppConfig } from '../config/config.js';
import { databaseOptions } from './database-options.js';

/** Deletes the test database file and applies every migration to a fresh one. */
export async function resetDatabase(config: AppConfig): Promise<void> {
  if (config.nodeEnv !== 'test') {
    throw new Error('resetDatabase runs only with NODE_ENV=test');
  }

  rmSync(config.databaseFile, { force: true });
  const dataSource = await new DataSource(databaseOptions(config)).initialize();
  try {
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }
}
