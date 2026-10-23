/** The only source of "now" in the backend (#54, #80). Inject it with `@Inject(CLOCK)`. */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('Clock');
