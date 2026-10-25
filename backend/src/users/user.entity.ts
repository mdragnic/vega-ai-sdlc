import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** A user (#46): one type, own data only. */
@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  /** Trimmed and lowercase (#15), the login identity. */
  @Column({ type: 'text', unique: true })
  email: string;

  @Column({ name: 'full_name', type: 'text' })
  fullName: string;

  /** Generated at sign up (#62, #67). */
  @Column({ type: 'text', unique: true })
  username: string;

  /** scrypt with its parameters; null for a Google-only user (#2, #75). */
  @Column({ name: 'password_hash', type: 'text', nullable: true })
  passwordHash: string | null;
}
