import { type ExpenseCategory, expenseCategorySchema } from '@finebank/shared';
import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation, Unique } from 'typeorm';

import { User } from '../users/user.entity.js';

/** A spending limit per category, not per month (#32). */
@Entity({ name: 'category_limits' })
@Unique(['userId', 'category'])
@Check('CHK_category_limits_limit', '"limit_cents" > 0')
export class CategoryLimit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ type: 'simple-enum', enum: expenseCategorySchema.options })
  category: ExpenseCategory;

  /** Integer cents, above 0 (#31). */
  @Column({ name: 'limit_cents', type: 'integer' })
  limitCents: number;
}
