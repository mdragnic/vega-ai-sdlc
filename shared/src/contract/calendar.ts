import { z } from 'zod';

import type { ContractEntry } from './entry.js';

/** Today in the user's time zone, a plain date `YYYY-MM-DD` (#54, #74). */
export const todayResponseSchema = z.object({ today: z.iso.date() });

export type TodayResponse = z.infer<typeof todayResponseSchema>;

/** Today from the backend's clock in the zone sent as `X-Time-Zone` (#54, #80): the header date (#100). */
export const calendarContract = {
  today: { method: 'GET', path: '/calendar/today', request: undefined, response: todayResponseSchema },
} as const satisfies Record<string, ContractEntry>;
