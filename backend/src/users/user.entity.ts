import { Check, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** A user (#46): one type, own data only. */
@Entity({ name: 'users' })
// The shared rules' shapes as a second line (#126 c, d): a `+` and 1 to 3 digits with no leading zero; empty, or 1 to
// 15 digits `0` to `9`.
@Check(
  'CHK_users_phone_country_code',
  `"phone_country_code" GLOB '+[1-9]' OR "phone_country_code" GLOB '+[1-9][0-9]' OR "phone_country_code" GLOB '+[1-9][0-9][0-9]'`,
)
@Check('CHK_users_phone_number', `length("phone_number") <= 15 AND "phone_number" NOT GLOB '*[^0-9]*'`)
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  /** Trimmed and lowercase (#15), the login identity. Read-only in Settings (#33), so the write guard's identity (#119). */
  @Column({ type: 'text', unique: true })
  email: string;

  @Column({ name: 'full_name', type: 'text' })
  fullName: string;

  /** Generated at sign up (#62, #67); changed in Settings, unique by this column's index (#62, #126 b). */
  @Column({ type: 'text', unique: true })
  username: string;

  /** scrypt with its parameters; null for a Google-only user (#2, #75). */
  @Column({ name: 'password_hash', type: 'text', nullable: true })
  passwordHash: string | null;

  /** The phone's country code with its `+`, one of `countryCallingCodes`; `+1` for a new user (#43, #126 d). */
  @Column({ name: 'phone_country_code', type: 'text', default: '+1' })
  phoneCountryCode: string;

  /** The phone number, digits only, or empty for none (#33, #126 c). */
  @Column({ name: 'phone_number', type: 'text', default: '' })
  phoneNumber: string;
}
