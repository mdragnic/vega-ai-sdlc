import type { PhotoMimeType } from '@finebank/shared';
import { Check, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** `n` lowercase hexadecimal digits, as a GLOB pattern. */
const hex = (n: number) => '[0-9a-f]'.repeat(n);

/** A lowercase UUID v4, `randomUUID()`'s shape, as a GLOB pattern (GLOB is case-sensitive and matches the whole name). */
const uuid = `${hex(8)}-${hex(4)}-4${hex(3)}-[89ab]${hex(3)}-${hex(12)}`;

/** A user (#46): one type, own data only. */
@Entity({ name: 'users' })
// The shared rules' shapes as a second line (#126 c, d): a `+` and 1 to 3 digits with no leading zero; empty, or 1 to
// 15 digits `0` to `9`.
@Check(
  'CHK_users_phone_country_code',
  `"phone_country_code" GLOB '+[1-9]' OR "phone_country_code" GLOB '+[1-9][0-9]' OR "phone_country_code" GLOB '+[1-9][0-9][0-9]'`,
)
@Check('CHK_users_phone_number', `length("phone_number") <= 15 AND "phone_number" NOT GLOB '*[^0-9]*'`)
// The photo (#76, task 029): its three columns all set or all null; the name a lowercase UUID v4 and the extension of its
// type, nothing else (no folder, no path), so a row can never name a file outside the uploads folder.
@Check(
  'CHK_users_photo_all_or_none',
  `("photo_path" IS NULL AND "photo_mime_type" IS NULL AND "photo_updated_at" IS NULL) OR ("photo_path" IS NOT NULL AND "photo_mime_type" IS NOT NULL AND "photo_updated_at" IS NOT NULL)`,
)
@Check(
  'CHK_users_photo_name',
  `"photo_path" IS NULL OR ("photo_mime_type" = 'image/jpeg' AND "photo_path" GLOB '${uuid}.jpg') OR ("photo_mime_type" = 'image/png' AND "photo_path" GLOB '${uuid}.png')`,
)
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

  /** The stored photo's file name in the uploads folder, `<uuid>.jpg` or `.png`; null without a photo (#76). */
  @Column({ name: 'photo_path', type: 'text', nullable: true })
  photoPath: string | null;

  /** The stored photo's type by its first bytes, `image/jpeg` or `image/png` (#76). */
  @Column({ name: 'photo_mime_type', type: 'text', nullable: true })
  photoMimeType: PhotoMimeType | null;

  /** When the photo was stored, by the Clock (#76, #80): the `?v=` of its address. */
  @Column({ name: 'photo_updated_at', type: 'datetime', nullable: true })
  photoUpdatedAt: Date | null;
}
