import { describe, expect, it } from 'vitest';

import {
  accountTypeSchema,
  billLogoSchema,
  cardNetworkSchema,
  transactionDirectionSchema,
  transactionStatusSchema,
} from '../src/index.js';

// T1: the enums of accounts, transactions and bills exist once in the contract (#74), in kebab case.
describe.each([
  // The Account Type values of #26, in that order (the task 005 gallery's keys).
  ['accountTypeSchema', accountTypeSchema, ['credit-card', 'checking', 'savings', 'investment', 'loan'], 'credit'],
  // The card networks of #24; "none" is no value, stored as NULL.
  ['cardNetworkSchema', cardNetworkSchema, ['mastercard', 'visa'], 'none'],
  // Income or expense (#19); Credit and Debit only show the direction (#27).
  ['transactionDirectionSchema', transactionDirectionSchema, ['income', 'expense'], 'transfer'],
  ['transactionStatusSchema', transactionStatusSchema, ['complete', 'pending', 'failed'], 'Complete'],
  // The brand logo keys the frontend maps to its SVGs (#28).
  ['billLogoSchema', billLogoSchema, ['figma', 'adobe'], 'netflix'],
] as const)('%s', (_name, schema, values, unknown) => {
  it('lists its values in order', () => {
    expect(schema.options).toEqual(values);
  });

  it.each(values)('accepts %j', (value) => {
    expect(schema.parse(value)).toBe(value);
  });

  it.each([unknown, '', null])('rejects %j', (value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });
});
