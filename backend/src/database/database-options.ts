import { fileURLToPath } from 'node:url';

import type { DataSourceOptions } from 'typeorm';

import type { AppConfig } from '../config/config.js';

// TypeORM globs need forward slashes, also on Windows.
const toGlob = (url: URL): string => fileURLToPath(url).replaceAll('\\', '/');

/**
 * SQLite through better-sqlite3. Schema changes only through migrations: `synchronize`
 * stays off here, and only unit tests turn it on for their own in-memory databases (#79).
 * Entities and migrations are loaded from the compiled files in dist/.
 */
export function databaseOptions(config: AppConfig): DataSourceOptions {
  return {
    type: 'better-sqlite3',
    database: config.databaseFile,
    entities: [toGlob(new URL('../**/*.entity.js', import.meta.url))],
    migrations: [toGlob(new URL('./migrations/*.js', import.meta.url))],
    synchronize: false,
  };
}
