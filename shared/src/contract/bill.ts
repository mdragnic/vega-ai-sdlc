import { z } from 'zod';

import type { ContractEntry } from './entry.js';
import { moneySchema } from './money.js';

/** The biller logo key the backend sends; the frontend maps it to its brand SVG (#28). */
export const billLogoSchema = z.enum(['figma', 'adobe']);

export type BillLogo = z.infer<typeof billLogoSchema>;

/**
 * One upcoming bill of the Overview card and the Bills table (#28): the title and its description (the Bills table
 * shows it under the title; the Overview card leaves it off, US-07), plain dates `YYYY-MM-DD` and the amount in
 * integer cents (#11, #96). No row ID or user ID, since no route takes a bill (#28: no actions). Unknown keys are
 * dropped.
 */
export const upcomingBillSchema = z.object({
  title: z.string(),
  description: z.string(),
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
 * The signed-in user's upcoming bills, today in the zone sent as `X-Time-Zone` (#39, #54, #80). The one bills route:
 * Overview's Upcoming Bill and the Bills page read the same answer (task 023).
 */
export const billsContract = {
  upcoming: { method: 'GET', path: '/bills/upcoming', request: undefined, response: upcomingBillsResponseSchema },
} as const satisfies Record<string, ContractEntry>;
