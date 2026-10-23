import type { Clock } from './clock.js';

/** The real time. The one place backend code may read the system clock. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
