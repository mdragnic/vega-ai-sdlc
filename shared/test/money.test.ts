import { describe, expect, it } from 'vitest';

import { moneySchema } from '../src/index.js';

// T1: money in JSON is integer cents with a currency, USD only (#11, #74).
describe('moneySchema', () => {
  it('accepts integer cents in USD', () => {
    expect(moneySchema.parse({ cents: 2505600, currency: 'USD' })).toEqual({ cents: 2505600, currency: 'USD' });
  });

  it('accepts negative cents', () => {
    expect(moneySchema.parse({ cents: -50000, currency: 'USD' })).toEqual({ cents: -50000, currency: 'USD' });
  });

  it.each([
    ['fractional cents', { cents: 12.5, currency: 'USD' }],
    ['cents beyond the safe integer range', { cents: 2 ** 53, currency: 'USD' }],
    ['cents as a string', { cents: '2505600', currency: 'USD' }],
    ['no currency', { cents: 2505600 }],
    ['another currency', { cents: 2505600, currency: 'EUR' }],
    ['no cents', { currency: 'USD' }],
  ])('rejects %s', (_case, value) => {
    expect(moneySchema.safeParse(value).success).toBe(false);
  });
});
