import type { DataSourceOptions } from 'typeorm';

import { Session } from '../auth/session.entity.js';
import { Account } from '../bank-data/account.entity.js';
import { Transaction } from '../bank-data/transaction.entity.js';
import { Bill } from '../bills/bill.entity.js';
import type { AppConfig } from '../config/config.js';
import { CategoryLimit } from '../goals/category-limit.entity.js';
import { SavingsGoal } from '../goals/savings-goal.entity.js';
import { User } from '../users/user.entity.js';
import { migrations } from './migrations/index.js';

/**
 * SQLite through better-sqlite3. Schema changes only through migrations, with `synchronize`
 * off everywhere: unit tests apply the same migrations to their in-memory databases (#79).
 * Entities and migrations are listed as classes, so the built app, the TypeORM CLI and the
 * unit tests all load the same ones.
 */
export function databaseOptions(config: AppConfig): DataSourceOptions {
  return {
    type: 'better-sqlite3',
    database: config.databaseFile,
    entities: [User, Session, Account, Transaction, Bill, SavingsGoal, CategoryLimit],
    migrations,
    synchronize: false,
  };
}
