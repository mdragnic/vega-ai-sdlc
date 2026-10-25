import { Injectable } from '@nestjs/common';
import type { CurrentUser } from '@finebank/shared';
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

  findByEmail(email: string): Promise<User | null> {
    return this.dataSource.getRepository(User).findOneBy({ email });
  }

  async currentUser(id: number): Promise<CurrentUser> {
    return toCurrentUser(await this.dataSource.getRepository(User).findOneByOrFail({ id }));
  }
}

/** The users column whose unique constraint an insert broke, if that is what failed. */
function uniqueColumn(error: unknown): string | undefined {
  if (!(error instanceof QueryFailedError)) return undefined;
  return /UNIQUE constraint failed: users\.(\w+)$/.exec(error.message)?.[1];
}
