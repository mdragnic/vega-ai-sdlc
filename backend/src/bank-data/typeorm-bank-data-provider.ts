import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { Account } from './account.entity.js';
import {
  type AccountDetails,
  type BankAccount,
  type BankDataProvider,
  type BankTransaction,
  InvalidCursorError,
  type TransactionFilter,
  type TransactionPage,
} from './bank-data-provider.js';
import { Transaction } from './transaction.entity.js';

/** The only BankDataProvider: the app's own tables through TypeORM (#77). */
@Injectable()
export class TypeOrmBankDataProvider implements BankDataProvider {
  constructor(private readonly dataSource: DataSource) {}

  private get accounts() {
    return this.dataSource.getRepository(Account);
  }

  async listAccounts(userId: number): Promise<BankAccount[]> {
    const rows = await this.accounts.find({ where: { userId }, order: { id: 'ASC' } });
    return rows.map(toBankAccount);
  }

  async getAccount(userId: number, accountId: number): Promise<BankAccount | null> {
    const row = await this.accounts.findOneBy({ id: accountId, userId });
    return row ? toBankAccount(row) : null;
  }

  async updateAccountDetails(
    userId: number,
    accountId: number,
    { bankName, branchName, accountType }: AccountDetails,
  ): Promise<BankAccount | null> {
    const { affected } = await this.accounts.update({ id: accountId, userId }, { bankName, branchName, accountType });
    return affected ? this.getAccount(userId, accountId) : null;
  }

  async listTransactions(userId: number, filter: TransactionFilter): Promise<TransactionPage> {
    const { accountId, direction, occurredFrom, occurredBefore, cursor, limit } = filter;
    if (limit !== undefined && !(Number.isSafeInteger(limit) && limit > 0)) {
      throw new RangeError(`The limit must be a positive integer, got ${limit}`);
    }
    // An invalid date would bind as 'NaN-NaN-NaN', matching nothing or dropping the bound without a sound.
    for (const [name, date] of Object.entries({ occurredFrom, occurredBefore })) {
      if (date !== undefined && Number.isNaN(date.getTime())) {
        throw new RangeError(`${name} must be a valid date`);
      }
    }

    // A transaction reaches its user only through its account.
    const query = this.dataSource
      .getRepository(Transaction)
      .createQueryBuilder('t')
      .innerJoin('t.account', 'a')
      .where('a.userId = :userId', { userId })
      .orderBy('t.occurredAt', 'DESC')
      .addOrderBy('t.id', 'DESC');
    if (accountId !== undefined) query.andWhere('t.accountId = :accountId', { accountId });
    if (direction !== undefined) query.andWhere('t.direction = :direction', { direction });
    if (occurredFrom !== undefined) query.andWhere('t.occurredAt >= :occurredFrom', { occurredFrom });
    if (occurredBefore !== undefined) query.andWhere('t.occurredAt < :occurredBefore', { occurredBefore });
    if (cursor !== undefined) {
      const after = decodeCursor(cursor);
      query.andWhere('(t.occurredAt < :afterAt OR (t.occurredAt = :afterAt AND t.id < :afterId))', {
        afterAt: after.occurredAt,
        afterId: after.id,
      });
    }
    if (limit !== undefined) query.limit(limit + 1);

    const rows = await query.getMany();
    const page = limit !== undefined ? rows.slice(0, limit) : rows;
    const last = page.at(-1);
    return {
      transactions: page.map(toBankTransaction),
      nextCursor: limit !== undefined && rows.length > limit && last ? encodeCursor(last) : null,
    };
  }
}

function toBankAccount(row: Account): BankAccount {
  return {
    id: row.id,
    accountType: row.accountType,
    bankName: row.bankName,
    branchName: row.branchName,
    cardNetwork: row.cardNetwork,
    accountNumber: row.accountNumber,
    openingBalanceCents: row.openingBalanceCents,
  };
}

function toBankTransaction(row: Transaction): BankTransaction {
  return {
    id: row.id,
    accountId: row.accountId,
    occurredAt: row.occurredAt,
    direction: row.direction,
    status: row.status,
    category: row.category,
    item: row.item,
    shopName: row.shopName,
    receipt: row.receipt,
    amountCents: row.amountCents,
  };
}

// The cursor is the last row's instant and ID, base64url-encoded so callers treat it as opaque.
const cursorText = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)_([1-9]\d{0,15})$/;

function encodeCursor({ occurredAt, id }: { occurredAt: Date; id: number }): string {
  return Buffer.from(`${occurredAt.toISOString()}_${id}`, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { occurredAt: Date; id: number } {
  const match = cursorText.exec(Buffer.from(cursor, 'base64url').toString('utf8'));
  const occurredAt = new Date(match?.[1] ?? Number.NaN);
  const id = Number(match?.[2]);
  // Only a cursor this provider made decodes and encodes back to the same text.
  if (
    !match ||
    Number.isNaN(occurredAt.getTime()) ||
    !Number.isSafeInteger(id) ||
    encodeCursor({ occurredAt, id }) !== cursor
  ) {
    throw new InvalidCursorError();
  }
  return { occurredAt, id };
}
