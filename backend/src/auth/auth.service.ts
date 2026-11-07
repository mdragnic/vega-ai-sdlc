import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  authMessages,
  type CurrentUser,
  type LoginRequest,
  type PasswordChangeRequest,
  passwordMessages,
  type SignUpRequest,
} from '@finebank/shared';
import { DataSource, type EntityManager } from 'typeorm';

import { DemoSeeder } from '../demo/demo-seeder.js';
import { User } from '../users/user.entity.js';
import { EmailTakenError, toCurrentUser, UsersService } from '../users/users.service.js';
import { PasswordHasher } from './password.js';
import { SessionsService } from './sessions.service.js';

export interface SignedIn {
  user: CurrentUser;
  /** The new session's token, for the cookie. */
  token: string;
}

/**
 * Sign up, login and logout. A sign up or login replaces the session the browser presented, as Google sign-in does.
 * Password hashing runs on the thread pool, so it stays outside the transactions: SQLite has one
 * connection, and a transaction must not stay open while other requests use it.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly passwords: PasswordHasher,
    private readonly demo: DemoSeeder,
  ) {}

  /**
   * Creates the user, their copy of the demo dataset and a session in one transaction (#78): if any
   * insert fails, nothing is kept.
   */
  async signUp(fields: SignUpRequest, presentedToken: string | undefined): Promise<SignedIn> {
    const passwordHash = await this.passwords.hash(fields.password);
    try {
      return await this.dataSource.transaction(async (manager) => {
        const user = await this.users.create(manager, { fullName: fields.fullName, email: fields.email, passwordHash });
        await this.demo.seed(manager, user.id);
        return this.startSession(manager, user, presentedToken);
      });
    } catch (error) {
      if (error instanceof EmailTakenError) {
        throw new ConflictException({
          message: authMessages.emailTaken,
          fieldErrors: { email: authMessages.emailTaken },
        });
      }
      throw error;
    }
  }

  /**
   * An unknown email, a user without a password (#2) and a wrong password fail alike (#14), each
   * after one scrypt verification, so the time taken does not tell which emails exist. A Google
   * sign-in can remove the password while scrypt runs (#104): the session starts only if the user
   * still has exactly the hash just verified, checked in the transaction that inserts it.
   */
  async login({ email, password }: LoginRequest, presentedToken: string | undefined): Promise<SignedIn> {
    const user = await this.users.findByEmail(email);
    const valid = await this.passwords.verify(password, user?.passwordHash ?? null);
    if (!user || !valid) {
      throw new UnauthorizedException(authMessages.invalidCredentials);
    }
    return this.dataSource.transaction(async (manager) => {
      const current = await manager.findOneBy(User, { id: user.id });
      if (current?.passwordHash !== user.passwordHash) {
        throw new UnauthorizedException(authMessages.invalidCredentials);
      }
      return this.startSession(manager, user, presentedToken);
    });
  }

  /**
   * The session user's password change (task 030, #34). The user is the session's only (#39); the passwords reach only
   * scrypt and nothing here logs (#75). The stored hash is read by the user's ID and the current password verified
   * against it outside any transaction, as login: a user without a password (#2) is checked against the dummy hash and
   * refused alike. Only after a match is the new password hashed, also outside any transaction (as sign up), so a wrong
   * one costs one scrypt run. Then one transaction: the `UPDATE` keyed on the user's ID and the hash just verified, a
   * compare and set, so when the hash changed meanwhile (another change, a Google takeover, #104) nothing is stored and
   * the answer is the wrong-password 400, as what was typed is no longer the current password; and every other session
   * of the user deleted, the presented one kept (#129 a).
   */
  async changePassword(
    userId: number,
    presentedToken: string,
    { currentPassword, newPassword }: PasswordChangeRequest,
  ): Promise<void> {
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ select: { id: true, passwordHash: true }, where: { id: userId } });
    const verifiedHash = user?.passwordHash ?? null;
    const valid = await this.passwords.verify(currentPassword, verifiedHash);
    if (!valid || verifiedHash === null) throw wrongCurrentPassword();
    const passwordHash = await this.passwords.hash(newPassword);
    await this.dataSource.transaction(async (manager) => {
      const { affected } = await manager.update(User, { id: userId, passwordHash: verifiedHash }, { passwordHash });
      if (affected !== 1) throw wrongCurrentPassword();
      await this.sessions.deleteOthersOf(manager, userId, presentedToken);
    });
  }

  /** Ends the presented session, if any (#3). */
  async logout(presentedToken: string | undefined): Promise<void> {
    if (presentedToken !== undefined) {
      await this.sessions.delete(this.dataSource.manager, presentedToken);
    }
  }

  /** Deletes the presented session, if any, and starts one for the user, through the caller's transaction. */
  async startSession(manager: EntityManager, user: User, presentedToken: string | undefined): Promise<SignedIn> {
    if (presentedToken !== undefined) {
      await this.sessions.delete(manager, presentedToken);
    }
    const token = await this.sessions.create(manager, user.id);
    return { user: toCurrentUser(user), token };
  }
}

/** A current password that does not match (#34): the message under Old Password, in the shared error shape (#74). */
const wrongCurrentPassword = () =>
  new BadRequestException({
    message: passwordMessages.currentIncorrect,
    fieldErrors: { currentPassword: passwordMessages.currentIncorrect },
  });
