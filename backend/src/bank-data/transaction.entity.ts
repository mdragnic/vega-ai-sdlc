import {
  type ExpenseCategory,
  expenseCategorySchema,
  type TransactionDirection,
  transactionDirectionSchema,
  type TransactionStatus,
  transactionStatusSchema,
} from '@finebank/shared';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';

import { Account } from './account.entity.js';

/**
 * One income or expense of an account (#19, #56, #57). It reaches its user only through the
 * account, so it can never point at another user's account. Newest first is `occurred_at`
 * descending, then `id` descending.
 */
@Entity({ name: 'transactions' })
@Index(['accountId', 'occurredAt'])
@Check('CHK_transactions_amount', '"amount_cents" >= 0')
// Income has no category and an expense has one (#56). Kept under 50 characters: the migration
// formatter wraps longer checks, and TypeORM reads back only a check written on one line.
@Check('CHK_transactions_category', `("direction" = 'income') = ("category" IS NULL)`)
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id', type: 'integer' })
  accountId: number;

  @ManyToOne(() => Account, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'account_id' })
  account: Relation<Account>;

  /** UTC (#11). */
  @Column({ name: 'occurred_at', type: 'datetime' })
  occurredAt: Date;

  @Column({ type: 'simple-enum', enum: transactionDirectionSchema.options })
  direction: TransactionDirection;

  @Column({ type: 'simple-enum', enum: transactionStatusSchema.options })
  status: TransactionStatus;

  /** One of the 6 for an expense, NULL for income (#56). */
  @Column({ type: 'simple-enum', enum: expenseCategorySchema.options, nullable: true })
  category: ExpenseCategory | null;

  @Column({ type: 'text' })
  item: string;

  @Column({ name: 'shop_name', type: 'text' })
  shopName: string;

  /** A receipt ID, plain text (#27). */
  @Column({ type: 'text' })
  receipt: string;

  /** Integer cents, never negative: the direction gives the sign (#11, #19). */
  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents: number;
}
