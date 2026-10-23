import { Body, Controller, Get, Put } from '@nestjs/common';
import { testClockContract, type TestClockState } from '@finebank/shared';

import { FixedClock } from './fixed-clock.js';

/** Reads and moves the test clock. Registered only with NODE_ENV=test (ClockModule). */
@Controller()
export class TestClockController {
  constructor(private readonly clock: FixedClock) {}

  @Get(testClockContract.get.path)
  read(): TestClockState {
    return { now: this.clock.now().toISOString() };
  }

  @Put(testClockContract.set.path)
  move(@Body({ schema: testClockContract.set.request }) body: TestClockState): TestClockState {
    this.clock.set(new Date(body.now));
    return this.read();
  }
}
