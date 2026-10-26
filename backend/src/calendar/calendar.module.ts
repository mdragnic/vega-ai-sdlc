import { Module } from '@nestjs/common';

import { CalendarController } from './calendar.controller.js';

/** Today in the user's zone (#54, #100). */
@Module({ controllers: [CalendarController] })
export class CalendarModule {}
