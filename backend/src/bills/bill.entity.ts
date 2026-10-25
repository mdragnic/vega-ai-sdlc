import { type BillLogo, billLogoSchema } from '@finebank/shared';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';

import { User } from '../users/user.entity.js';

/**
 * A bill with one due date (#28, #41, #53). No category: no screen shows one, and its charge
 * transaction carries Others (#56).
 */
@Entity({ name: 'bills' })
@Index(['userId', 'dueDate'])
@Check('CHK_bills_amount', '"amount_cents" >= 0')
export class Bill {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'simple-enum', enum: billLogoSchema.options })
  logo: BillLogo;

  /** A plain date, `YYYY-MM-DD` (#11). */
  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  /** A plain date, `YYYY-MM-DD` (#11). */
  @Column({ name: 'last_charge_date', type: 'date' })
  lastChargeDate: string;

  /** Integer cents, USD (#11, #96). */
  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents: number;
}
