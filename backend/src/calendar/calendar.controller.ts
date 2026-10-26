import { Controller, Get, Inject } from '@nestjs/common';
import { calendarContract, type TodayResponse } from '@finebank/shared';

import { CLOCK, type Clock } from '../common/clock/clock.js';
import { todayIn } from '../common/time-zone/today-in.js';
import { TimeZone } from '../common/time-zone/time-zone.decorator.js';

/** `/api/calendar`: today in the user's zone, for the header date (#54, #80, #100). Needs a session; reads no user data. */
@Controller()
export class CalendarController {
  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  @Get(calendarContract.today.path)
  today(@TimeZone() timeZone: string): TodayResponse {
    return { today: todayIn(this.clock.now(), timeZone) };
  }
}
