import type { MigrationInterface } from 'typeorm';

import { CreateUsersAndSessions1792921656294 } from './1792921656294-CreateUsersAndSessions.js';
import { CreateFinanceTables1792930295195 } from './1792930295195-CreateFinanceTables.js';

/** Every migration, oldest first. `npm run migration:generate` adds a file; list its class here. */
export const migrations: (new () => MigrationInterface)[] = [
  CreateUsersAndSessions1792921656294,
  CreateFinanceTables1792930295195,
];
