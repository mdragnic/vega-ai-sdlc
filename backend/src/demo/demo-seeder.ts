import { Inject, Injectable } from '@nestjs/common';
import type { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';

import { Account } from '../bank-data/account.entity.js';
import { Transaction } from '../bank-data/transaction.entity.js';
import { Bill } from '../bills/bill.entity.js';
import { CategoryLimit } from '../goals/category-limit.entity.js';
import { SavingsGoal } from '../goals/savings-goal.entity.js';
import { DEMO_DATASET, type DemoDataset } from './demo-dataset.js';

/**
 * Rows per INSERT statement, for every table. A transaction row has 9 columns and binds at most 9
 * values (TypeORM writes numbers into the SQL), so 1,000 rows stay well under SQLite's limit of
 * 32,766 bound values per statement.
 */
export const INSERT_BATCH_SIZE = 1_000;

/**
 * Copies the demo dataset into a new user's rows (#1, #53, #78), through the sign-up transaction's
 * EntityManager. The dataset is already in memory: every await here is a better-sqlite3 call that
 * settles in microtasks, so no other request's query runs inside the transaction (task 007 note).
 */
@Injectable()
export class DemoSeeder {
  constructor(@Inject(DEMO_DATASET) private readonly dataset: DemoDataset) {}

  async seed(manager: EntityManager, userId: number): Promise<void> {
    // One by one and in order, so the IDs follow the card order (#24).
    const accountIds: number[] = [];
    for (const account of this.dataset.accounts) {
      const { identifiers } = await manager.insert(Account, { ...account, userId });
      const id: unknown = identifiers[0]?.id;
      if (typeof id !== 'number') throw new Error('The account insert returned no ID');
      accountIds.push(id);
    }

    await insertInBatches(
      manager,
      Transaction,
      this.dataset.transactions.map(({ accountIndex, ...transaction }) => ({
        ...transaction,
        accountId: accountIds[accountIndex]!,
      })),
    );
    await insertInBatches(
      manager,
      Bill,
      this.dataset.bills.map((bill) => ({ ...bill, userId })),
    );
    await insertInBatches(
      manager,
      SavingsGoal,
      this.dataset.savingsGoals.map((goal) => ({ ...goal, userId })),
    );
    await insertInBatches(
      manager,
      CategoryLimit,
      this.dataset.categoryLimits.map((limit) => ({ ...limit, userId })),
    );
  }
}

/** Multi-row INSERTs of INSERT_BATCH_SIZE rows, without reading the rows back. */
async function insertInBatches<T extends ObjectLiteral>(
  manager: EntityManager,
  entity: EntityTarget<T>,
  rows: Partial<T>[],
): Promise<void> {
  for (let start = 0; start < rows.length; start += INSERT_BATCH_SIZE) {
    await manager
      .createQueryBuilder()
      .insert()
      .into(entity)
      .values(rows.slice(start, start + INSERT_BATCH_SIZE))
      .updateEntity(false)
      .execute();
  }
}
