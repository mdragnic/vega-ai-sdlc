import { type DynamicModule, Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountsModule } from './accounts/accounts.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BankDataModule } from './bank-data/bank-data.module.js';
import { BillsModule } from './bills/bills.module.js';
import { CalendarModule } from './calendar/calendar.module.js';
import { ClockModule } from './common/clock/clock.module.js';
import { ApiExceptionFilter } from './common/errors/api-exception.filter.js';
import { validationException } from './common/errors/validation-exception.js';
import type { AppConfig } from './config/config.js';
import { databaseOptions } from './database/database-options.js';
import { GoalsModule } from './goals/goals.module.js';
import { StatisticsModule } from './statistics/statistics.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        TypeOrmModule.forRoot(databaseOptions(config)),
        ClockModule.forRoot(config),
        AuthModule.forRoot(config),
        BankDataModule,
        AccountsModule,
        CalendarModule,
        GoalsModule,
        BillsModule,
        TransactionsModule,
        StatisticsModule,
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
