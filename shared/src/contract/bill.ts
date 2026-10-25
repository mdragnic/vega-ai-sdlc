import { z } from 'zod';

/** The biller logo key the backend sends; the frontend maps it to its brand SVG (#28). */
export const billLogoSchema = z.enum(['figma', 'adobe']);

export type BillLogo = z.infer<typeof billLogoSchema>;
