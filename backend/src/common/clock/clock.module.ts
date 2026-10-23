import { type DynamicModule, Global, Module } from '@nestjs/common';

import type { AppConfig } from '../../config/config.js';
import { CLOCK } from './clock.js';
import { FixedClock } from './fixed-clock.js';
import { SystemClock } from './system-clock.js';
import { TestClockController } from './test-clock.controller.js';

/**
 * Provides CLOCK everywhere: the system time, or with NODE_ENV=test a FixedClock starting at
 * TEST_NOW plus the test-only GET and PUT /api/test/clock routes.
 */
@Global()
@Module({})
export class ClockModule {
  static forRoot(config: AppConfig): DynamicModule {
    if (config.nodeEnv !== 'test') {
      return { module: ClockModule, providers: [{ provide: CLOCK, useClass: SystemClock }], exports: [CLOCK] };
    }

    return {
      module: ClockModule,
      controllers: [TestClockController],
      providers: [
        { provide: FixedClock, useValue: new FixedClock(new Date(config.testNow)) },
        { provide: CLOCK, useExisting: FixedClock },
      ],
      exports: [CLOCK],
    };
  }
}
