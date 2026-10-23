import { z } from 'zod';

import type { ContractEntry } from './entry.js';

/** The backend clock's current instant, an ISO timestamp in UTC. */
export const testClockStateSchema = z.object({ now: z.iso.datetime() });

export type TestClockState = z.infer<typeof testClockStateSchema>;

/** Test-only routes that read and move the backend clock; they exist only with NODE_ENV=test (#80). */
export const testClockContract = {
  get: { method: 'GET', path: '/test/clock', request: undefined, response: testClockStateSchema },
  set: { method: 'PUT', path: '/test/clock', request: testClockStateSchema, response: testClockStateSchema },
} as const satisfies Record<string, ContractEntry>;
