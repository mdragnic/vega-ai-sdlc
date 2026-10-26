import { createHash, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

import { CLOCK, type Clock } from '../common/clock/clock.js';
import { SESSION_LIFETIME_SECONDS } from './session-cookie.js';
import { Session } from './session.entity.js';

/** Sessions by token (#75): 256 random bits in the cookie, only their SHA-256 in the database. */
@Injectable()
export class SessionsService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Starts a session through the caller's transaction and returns its token for the cookie. */
  async create(manager: EntityManager, userId: number): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(this.clock.now().getTime() + SESSION_LIFETIME_SECONDS * 1000);
    await manager.insert(Session, { tokenHash: hashToken(token), userId, expiresAt });
    return token;
  }

  /** The user of the token's session while it is valid. An expired session's row is deleted. */
  async userIdFor(token: string): Promise<number | undefined> {
    const sessions = this.dataSource.getRepository(Session);
    const session = await sessions.findOneBy({ tokenHash: hashToken(token) });
    if (!session) return undefined;
    if (session.expiresAt.getTime() <= this.clock.now().getTime()) {
      await sessions.delete({ id: session.id });
      return undefined;
    }
    return session.userId;
  }

  /** Ends the token's session, if it has one. */
  async delete(manager: EntityManager, token: string): Promise<void> {
    await manager.delete(Session, { tokenHash: hashToken(token) });
  }

  /** Ends every session of the user, through the caller's transaction. */
  async deleteAllOf(manager: EntityManager, userId: number): Promise<void> {
    await manager.delete(Session, { userId });
  }
}

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
