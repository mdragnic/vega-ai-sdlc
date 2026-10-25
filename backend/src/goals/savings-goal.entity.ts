import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation, Unique } from 'typeorm';

import { User } from '../users/user.entity.js';

/** The savings goal of one month: at most one per month; a month without a goal has no row (#58, #85). */
@Entity({ name: 'savings_goals' })
@Unique(['userId', 'month'])
@Check('CHK_savings_goals_target', '"target_cents" > 0')
@Check('CHK_savings_goals_present', '"present_cents" >= 0')
export class SavingsGoal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  /** `YYYY-MM`. */
  @Column({ type: 'text' })
  month: string;

  /** Integer cents, above 0 (#31). */
  @Column({ name: 'target_cents', type: 'integer' })
  targetCents: number;

  /** Integer cents, 0 or more (#31). */
  @Column({ name: 'present_cents', type: 'integer' })
  presentCents: number;
}
