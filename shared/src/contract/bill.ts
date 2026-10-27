import { z } from 'zod';

import type { ContractEntry } from './entry.js';
import { moneySchema } from './money.js';

/** The biller logo key the backend sends; the frontend maps it to its brand SVG (#28). */
export const billLogoSchema = z.enum(['figma', 'adobe']);

export type BillLogo = z.infer<typeof billLogoSchema>;

/**
 * One upcoming bill of the Overview card (#28): plain dates `YYYY-MM-DD` and the amount in integer cents (#11, #96).
 * No row ID or user ID, since no route takes a bill (#28: no actions), and no description, which is the Bills
 * page's (task 023). Unknown keys are dropped.
 */
export const upcomingBillSchema = z.object({
  title: z.string(),
  logo: billLogoSchema,
  dueDate: z.iso.date(),
  lastChargeDate: z.iso.date(),
  amount: moneySchema,
});

/** Every bill due today or later in the user's zone, soonest first; the same day in the order stored (#28, #41). */
export const upcomingBillsResponseSchema = z.object({
  bills: z.array(upcomingBillSchema),
});

export type UpcomingBillsResponse = z.infer<typeof upcomingBillsResponseSchema>;

/**
 * The signed-in user's upcoming bills, today in the zone sent as `X-Time-Zone` (#39, #54, #80). Task 023 extends
 * this for the Bills page.
 */
export const billsContract = {
  upcoming: { method: 'GET', path: '/bills/upcoming', request: undefined, response: upcomingBillsResponseSchema },
} as const satisfies Record<string, ContractEntry>;
