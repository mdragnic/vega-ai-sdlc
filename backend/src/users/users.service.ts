import { Inject, Injectable, Logger } from '@nestjs/common';
import type { CurrentUser, Photo, PhotoMimeType, Profile, ProfileUpdateRequest } from '@finebank/shared';
import { DataSource, type EntityManager, IsNull, QueryFailedError } from 'typeorm';

import { CLOCK, type Clock } from '../common/clock/clock.js';
import { newPhotoName, PhotoStore } from './photo-store.js';
import { User } from './user.entity.js';
import { usernameBase, usernameCandidate } from './username.js';

/** The email of a new user belongs to another user (#15). */
export class EmailTakenError extends Error {
  constructor() {
    super('The email is already registered');
    this.name = 'EmailTakenError';
  }
}

/** The username of a profile save belongs to another user (#62): the unique index refused it. */
export class UsernameTakenError extends Error {
  constructor() {
    super('The username is already taken');
    this.name = 'UsernameTakenError';
  }
}

export interface NewUser {
  fullName: string;
  /** Trimmed and lowercase (#15). */
  email: string;
  passwordHash: string | null;
}

/** The photo's update time as the API sends it (#74, #76): present only when a photo is stored. */
const photoTimeOf = (photoUpdatedAt: Date | null | undefined) =>
  photoUpdatedAt ? { photoUpdatedAt: photoUpdatedAt.toISOString() } : {};

/** The signed-in user as the API returns it, with `photoUpdatedAt` only when a photo is stored (task 029). */
export function toCurrentUser({ fullName, email, username, photoUpdatedAt }: User): CurrentUser {
  return { fullName, email, username, ...photoTimeOf(photoUpdatedAt) };
}

/**
 * How many times a photo save reads the stored name and tries its update when other saves of the same user keep
 * changing the row in between; past it, a 500 with nothing stored (task 029 review: the loop is bounded).
 */
const MAX_PHOTO_TRIES = 5;

/** An error of the file system with this code. */
const hasCode = (error: unknown, code: string) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === code;

/** A stored photo: its file's bytes and its stored type (#76). */
export interface StoredPhoto {
  bytes: Buffer;
  mimeType: PhotoMimeType;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly photos: PhotoStore,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Inserts a user with a generated username (#62, #67) through the caller's transaction.
   * Throws EmailTakenError when the email is registered, also when another insert wins a race
   * for it; a race for the username takes the next number.
   */
  async create(manager: EntityManager, fields: NewUser): Promise<User> {
    if (await manager.existsBy(User, { email: fields.email })) {
      throw new EmailTakenError();
    }
    const base = usernameBase(fields.email);
    for (let n = 1; ; n += 1) {
      const username = usernameCandidate(base, n);
      if (await manager.existsBy(User, { username })) continue;
      try {
        return await manager.save(manager.create(User, { ...fields, username }));
      } catch (error) {
        const column = uniqueColumn(error);
        if (column === 'email') throw new EmailTakenError();
        if (column !== 'username') throw error;
      }
    }
  }

  /** Makes the user Google-only (#2, #104), through the caller's transaction. */
  async removePassword(manager: EntityManager, id: number): Promise<void> {
    await manager.update(User, { id }, { passwordHash: null });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.dataSource.getRepository(User).findOneBy({ email });
  }

  /** The user's stored email, trimmed and lowercase (#15), or undefined when the user is gone. Reads only the email. */
  async emailOf(id: number): Promise<string | undefined> {
    const user = await this.dataSource.getRepository(User).findOne({ select: { email: true }, where: { id } });
    return user?.email;
  }

  async currentUser(id: number): Promise<CurrentUser> {
    return toCurrentUser(await this.dataSource.getRepository(User).findOneByOrFail({ id }));
  }

  /**
   * The user's profile, the Account tab's five fields as stored (#33) and `photoUpdatedAt` with a stored photo (#76),
   * read by the session user's ID only (#39).
   */
  async profile(id: number): Promise<Profile> {
    const { fullName, email, username, phoneCountryCode, phoneNumber, photoUpdatedAt } = await this.dataSource
      .getRepository(User)
      .findOneByOrFail({ id });
    return { fullName, email, username, phoneCountryCode, phoneNumber, ...photoTimeOf(photoUpdatedAt) };
  }

  /**
   * Update Profile (#33, #76): one `UPDATE users` keyed on the session user's ID only, so no other row, the email (the
   * write guard's identity, #119), the password or the sessions can change. Without a photo it writes exactly the four
   * editable columns (task 028). The username's uniqueness is the unique index's, never a read before the write (#62):
   * its violation throws UsernameTakenError and stores nothing, so two users saving one username at once get one success.
   *
   * With a photo (task 029) the file and the row stay consistent: (1) the request was checked whole before this runs;
   * (2) the file is written under a new random name (a disk error: the partial file removed, the row unchanged, the error
   * thrown, a 500); (3) the update also sets the photo's three columns, its `WHERE` the user's ID and the photo name read
   * just before it, so this request knows which file it replaces; when another save changed the row in between, it
   * touched nothing, and the name is read again and the update repeated (two saves at once: the last one wins, no file
   * left behind), at most `MAX_PHOTO_TRIES` times, then a 500; when the update fails (the username taken, a database
   * error, the tries used up), the new file is removed and the old file and row stay; (4) only after the row is stored,
   * the replaced file is removed: a failure there keeps the answer (the new photo is stored) and is logged. Then the row
   * is read back for the answer.
   */
  async updateProfile(
    userId: number,
    { fullName, username, phoneCountryCode, phoneNumber, photo }: ProfileUpdateRequest,
  ): Promise<Profile> {
    const text = { fullName, username, phoneCountryCode, phoneNumber };
    const stored = photo && (await this.storePhoto(photo));
    let replaced: string | null = null;
    try {
      for (let tries = 1; ; tries += 1) {
        if (stored) replaced = await this.photoNameOf(userId);
        const { affected } = await this.dataSource.manager.update(
          User,
          stored ? { id: userId, photoPath: replaced ?? IsNull() } : { id: userId },
          stored ? { ...text, ...stored } : text,
        );
        if (!stored || affected !== 0) break;
        if (tries === MAX_PHOTO_TRIES) throw new Error('The photo was not stored: the row kept changing');
      }
    } catch (error) {
      if (stored) await this.removePhoto(stored.photoPath);
      if (uniqueColumn(error) === 'username') throw new UsernameTakenError();
      throw error;
    }
    if (replaced !== null) await this.removePhoto(replaced);
    return this.profile(userId);
  }

  /**
   * The session user's stored photo (#76): the bytes of the file the row names and the row's type; none when the user
   * has no photo or its file is missing from the folder. Read by the session user's ID only (#39, #46).
   */
  async photo(userId: number): Promise<StoredPhoto | undefined> {
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ select: { id: true, photoPath: true, photoMimeType: true }, where: { id: userId } });
    if (!user?.photoPath || !user.photoMimeType) return undefined;
    try {
      return { bytes: await this.photos.read(user.photoPath), mimeType: user.photoMimeType };
    } catch (error) {
      if (hasCode(error, 'ENOENT')) return undefined;
      throw error;
    }
  }

  /**
   * Writes a checked photo as uploaded (#128 b3) under a new name, `randomUUID()` and the extension of the type its first
   * bytes gave (#76), and gives the photo's three columns: that name, that type and the Clock's time (#80). A failed
   * write removes what it left, unless the name was already taken (never overwritten, `wx`): that file is not this
   * request's.
   */
  private async storePhoto({ file, mimeType }: Photo) {
    const name = newPhotoName(mimeType);
    const bytes = new Uint8Array(await file.arrayBuffer());
    try {
      await this.photos.write(name, bytes);
    } catch (error) {
      if (!hasCode(error, 'EEXIST')) await this.removePhoto(name);
      throw error;
    }
    return { photoPath: name, photoMimeType: mimeType, photoUpdatedAt: this.clock.now() };
  }

  /** The user's stored photo name, or null without one. Throws when the user is gone, so a save never loops. */
  private async photoNameOf(userId: number): Promise<string | null> {
    const user = await this.dataSource
      .getRepository(User)
      .findOneOrFail({ select: { id: true, photoPath: true }, where: { id: userId } });
    return user.photoPath;
  }

  /** Removes a photo file; a failure is logged (message and stack only) and leaves an unused file (accepted). */
  private async removePhoto(name: string): Promise<void> {
    try {
      await this.photos.remove(name);
    } catch (error) {
      if (error instanceof Error) this.logger.error(error.message, error.stack);
      else this.logger.error('A value that is not an Error was thrown');
    }
  }
}

/** The users column whose unique constraint an insert or an update broke, if that is what failed. */
function uniqueColumn(error: unknown): string | undefined {
  if (!(error instanceof QueryFailedError)) return undefined;
  return /UNIQUE constraint failed: users\.(\w+)$/.exec(error.message)?.[1];
}
