import { type DynamicModule, Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from './auth/auth.module.js';
import { ClockModule } from './common/clock/clock.module.js';
import { ApiExceptionFilter } from './common/errors/api-exception.filter.js';
import { validationException } from './common/errors/validation-exception.js';
import type { AppConfig } from './config/config.js';
import { databaseOptions } from './database/database-options.js';

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        TypeOrmModule.forRoot(databaseOptions(config)),
        ClockModule.forRoot(config),
        AuthModule.forRoot(config),
      ],
      providers: [
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
        {
          provide: APP_PIPE,
          useValue: new StandardSchemaValidationPipe({ exceptionFactory: validationException }),
        },
      ],
    };
  }
}
