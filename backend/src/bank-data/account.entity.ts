import { type AccountType, accountTypeSchema, type CardNetwork, cardNetworkSchema } from '@finebank/shared';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';

import { User } from '../users/user.entity.js';

/**
 * A user's bank account (#24, #26, #57). Raw data only: the balance is the opening balance plus the
 * account's Complete transactions, calculated in the backend, never stored. Card order is `id` ascending.
 */
@Entity({ name: 'accounts' })
export class Account {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ name: 'account_type', type: 'simple-enum', enum: accountTypeSchema.options })
  accountType: AccountType;

  @Column({ name: 'bank_name', type: 'text' })
  bankName: string;

  @Column({ name: 'branch_name', type: 'text' })
  branchName: string;

  /** NULL when the account has no card network (#24). */
  @Column({ name: 'card_network', type: 'simple-enum', enum: cardNetworkSchema.options, nullable: true })
  cardNetwork: CardNetwork | null;

  /** The full 16 digits without spaces. Never returned or logged; the API shows a mask (#25). */
  @Column({ name: 'account_number', type: 'text' })
  accountNumber: string;

  /** Integer cents, USD (#11, #85, #96). */
  @Column({ name: 'opening_balance_cents', type: 'integer' })
  openingBalanceCents: number;
}
