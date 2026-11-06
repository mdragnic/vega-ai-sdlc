import { Injectable } from '@nestjs/common';
import type { CurrentUser, Profile, ProfileUpdateRequest } from '@finebank/shared';
import { DataSource, type EntityManager, QueryFailedError } from 'typeorm';

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

/** The signed-in user as the API returns it. */
export function toCurrentUser({ fullName, email, username }: User): CurrentUser {
  return { fullName, email, username };
}

@Injectable()
export class UsersService {
  constructor(private readonly dataSource: DataSource) {}

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

  /** The user's profile, the Account tab's five fields as stored (#33), read by the session user's ID only (#39). */
  async profile(id: number): Promise<Profile> {
    const { fullName, email, username, phoneCountryCode, phoneNumber } = await this.dataSource
      .getRepository(User)
      .findOneByOrFail({ id });
    return { fullName, email, username, phoneCountryCode, phoneNumber };
  }

  /**
   * Update Profile (#33): one `UPDATE users` of exactly the four editable columns, keyed on the session user's ID only,
   * so no other row, the email (the write guard's identity, #119), the password or the sessions can change. The username's
   * uniqueness is the unique index's, never a read before the write (#62): its violation throws UsernameTakenError and
   * stores nothing, so two users saving one username at once get one success. Then the row is read back for the answer.
   */
  async updateProfile(
    userId: number,
    { fullName, username, phoneCountryCode, phoneNumber }: ProfileUpdateRequest,
  ): Promise<Profile> {
    try {
      await this.dataSource.manager.update(User, { id: userId }, { fullName, username, phoneCountryCode, phoneNumber });
    } catch (error) {
      if (uniqueColumn(error) === 'username') throw new UsernameTakenError();
      throw error;
    }
    return this.profile(userId);
  }
}

/** The users column whose unique constraint an insert or an update broke, if that is what failed. */
function uniqueColumn(error: unknown): string | undefined {
  if (!(error instanceof QueryFailedError)) return undefined;
  return /UNIQUE constraint failed: users\.(\w+)$/.exec(error.message)?.[1];
}
