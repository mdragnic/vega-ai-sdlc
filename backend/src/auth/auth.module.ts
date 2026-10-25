import { type DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import type { AppConfig } from '../config/config.js';
import { DemoModule } from '../demo/demo.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordHasher } from './password.js';
import { SessionGuard } from './session.guard.js';
import { SessionsService } from './sessions.service.js';

/** The auth routes, sessions, and the guard every route passes through (#75). */
@Module({})
export class AuthModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AuthModule,
      imports: [UsersModule, DemoModule],
      controllers: [AuthController],
      providers: [
        AuthService,
        SessionsService,
        { provide: PasswordHasher, useFactory: () => PasswordHasher.create(config.scryptCost) },
        { provide: APP_GUARD, useClass: SessionGuard },
      ],
    };
  }
}
