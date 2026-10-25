import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';

import { User } from '../users/user.entity.js';

/** A signed-in browser. Only the token's hash is stored, never the token (#75). */
@Entity({ name: 'sessions' })
export class Session {
  @PrimaryGeneratedColumn()
  id: number;

  /** SHA-256 of the cookie's token, in hex. */
  @Column({ name: 'token_hash', type: 'text', unique: true })
  tokenHash: string;

  @Index()
  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  /** Fixed at creation, 30 days after the Clock's now, never extended (#75). Stored in UTC. */
  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt: Date;
}
