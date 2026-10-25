import { inspect } from 'node:util';

import type { LoggerService } from '@nestjs/common';

/** Collects everything the app logs, objects included, as a logger would print them. */
export class CapturingLogger implements LoggerService {
  readonly lines: string[] = [];
  private capture = (...args: unknown[]) => {
    this.lines.push(args.map((arg) => (typeof arg === 'string' ? arg : inspect(arg, { depth: 10 }))).join(' '));
  };
  log = this.capture;
  error = this.capture;
  warn = this.capture;
  debug = this.capture;
  verbose = this.capture;
  fatal = this.capture;
}
