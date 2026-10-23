import type { Clock } from './clock.js';

/** A clock that stands still until it is moved. Used with NODE_ENV=test. */
export class FixedClock implements Clock {
  private instant: number;

  constructor(start: Date) {
    this.instant = start.getTime();
  }

  now(): Date {
    return new Date(this.instant);
  }

  set(instant: Date): void {
    this.instant = instant.getTime();
  }
}
