import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  accountTypeSchema,
  billLogoSchema,
  cardNetworkSchema,
  expenseCategorySchema,
  transactionDirectionSchema,
  transactionStatusSchema,
} from '@finebank/shared';
import { z } from 'zod';

const cents = z.int().nonnegative();
const positiveCents = z.int().positive();

const accountSchema = z.strictObject({
  accountType: accountTypeSchema,
  bankName: z.string().min(1),
  branchName: z.string().min(1),
  cardNetwork: cardNetworkSchema.nullable(),
  /** The full 16 digits, without spaces (#25). */
  accountNumber: z.string().regex(/^\d{16}$/),
  openingBalanceCents: z.int(),
});

const transactionSchema = z.strictObject({
  /** The account's position in `accounts`, 0 first. */
  accountIndex: z.int().nonnegative(),
  /** 12:00 UTC on its date, so the date reads the same from UTC-12 to UTC+11 (demo-data.md). */
  occurredAt: z.iso
    .datetime()
    .refine((value) => value.endsWith('T12:00:00.000Z'), 'Must be at 12:00 UTC, like 2022-01-01T12:00:00.000Z')
    .transform((value) => new Date(value)),
  direction: transactionDirectionSchema,
  status: transactionStatusSchema,
  category: expenseCategorySchema.nullable(),
  item: z.string().min(1),
  shopName: z.string().min(1),
  receipt: z.string().regex(/^[A-Za-z0-9]{11}$/),
  amountCents: cents,
});

const billSchema = z.strictObject({
  title: z.string().min(1),
  description: z.string().min(1),
  logo: billLogoSchema,
  dueDate: z.iso.date(),
  lastChargeDate: z.iso.date(),
  amountCents: cents,
});

const savingsGoalSchema = z.strictObject({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Must be a month like 2026-10'),
  targetCents: positiveCents,
  presentCents: cents,
});

const categoryLimitSchema = z.strictObject({
  category: expenseCategorySchema,
  limitCents: positiveCents,
});

/**
 * `backend/src/demo/demo-dataset.json`, written by `scripts/generate-demo-data.ts` from
 * `docs/spec/demo-data.md` (#53, #78). Money in integer cents (#11), enums from the contract (#74).
 */
export const demoDatasetSchema = z
  .strictObject({
    accounts: z.array(accountSchema).min(1),
    transactions: z.array(transactionSchema),
    bills: z.array(billSchema),
    savingsGoals: z.array(savingsGoalSchema),
    categoryLimits: z.array(categoryLimitSchema),
  })
  .superRefine(({ accounts, transactions }, context) => {
    transactions.forEach((transaction, i) => {
      if (transaction.accountIndex >= accounts.length) {
        context.addIssue({
          code: 'custom',
          path: ['transactions', i, 'accountIndex'],
          message: `Must be an index of accounts, below ${accounts.length}`,
        });
      }
      // An expense has a category and income has none (#56), as the database requires.
      if ((transaction.direction === 'expense') !== (transaction.category !== null)) {
        context.addIssue({
          code: 'custom',
          path: ['transactions', i, 'category'],
          message: 'An expense needs a category and income has none',
        });
      }
    });
  });

/** The JSON file's shape, as the generator writes it. */
export type DemoDatasetJson = z.input<typeof demoDatasetSchema>;

/** The parsed dataset, with instants as dates. */
export type DemoDataset = z.output<typeof demoDatasetSchema>;

/** The dataset, read and validated once when the app starts (DemoModule). */
export const DEMO_DATASET = Symbol('DemoDataset');

// Next to this file in src/ (tests) and in dist/ (nest-cli.json copies it as an asset).
const datasetFile = fileURLToPath(new URL('./demo-dataset.json', import.meta.url));

/** Reads and validates the dataset; a broken file stops the app with the file and the fields at fault. */
export function loadDemoDataset(file: string = datasetFile): DemoDataset {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read the demo dataset ${file}: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
  const parsed = demoDatasetSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`The demo dataset ${file} is invalid:\n${issues.join('\n')}`);
  }
  return parsed.data;
}
