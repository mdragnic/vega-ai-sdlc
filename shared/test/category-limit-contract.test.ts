import { describe, expect, it } from 'vitest';

import {
  categoryLimitFormSchema,
  categoryLimitMessages,
  categoryLimitRequestSchema,
  categoryLimitResponseSchema,
  categoryLimitSchema,
  categoryLimitsContract,
  categoryLimitsResponseSchema,
  goalMessages,
  savingsGoalFormSchema,
} from '../src/index.js';

const usd = (cents: number) => ({ cents, currency: 'USD' });

/** $1,000,000,000.00, the largest limit (#31). */
const MAX_CENTS = 100_000_000_000;

/** The six categories in the designed order (#56, #61), written out. */
const SIX = ['housing', 'food', 'transportation', 'entertainment', 'shopping', 'others'];

/** A first login's limits: $250.00 each (demo-data.md, Categories). */
const demoLimits = SIX.map((category) => ({ category, limit: usd(25_000) }));

/** The issues of a failed parse as `field: message`. */
function fieldErrors(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  expect(result.success).toBe(false);
  return result.error!.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

// T1, AC9: one category's limit, `null` without a row (#85, #125 a).
describe('categoryLimitSchema', () => {
  it.each([
    ['a limit', { category: 'food', limit: usd(25_000) }],
    ['no limit', { category: 'others', limit: null }],
  ])('accepts %s', (_case, body) => {
    expect(categoryLimitSchema.parse(body)).toEqual(body);
  });

  it('drops unknown keys', () => {
    expect(categoryLimitSchema.parse({ category: 'food', limit: usd(1), id: 4, userId: 9 })).toEqual({
      category: 'food',
      limit: usd(1),
    });
  });

  it.each([
    ['no limit key', { category: 'food' }],
    ['a category outside the six', { category: 'bills', limit: usd(1) }],
    ['cents that are not whole', { category: 'food', limit: usd(1.5) }],
    ['another currency', { category: 'food', limit: { cents: 1, currency: 'EUR' } }],
  ])('rejects %s', (_case, body) => {
    expect(categoryLimitSchema.safeParse(body).success).toBe(false);
  });
});

// T1, AC1 and AC9: the six once each, in the designed order (#56, #61).
describe('categoryLimitsResponseSchema', () => {
  it('accepts the six in order, a category without a limit among them', () => {
    const body = { limits: demoLimits.map((entry, index) => (index === 1 ? { ...entry, limit: null } : entry)) };

    expect(categoryLimitsResponseSchema.parse(body)).toEqual(body);
  });

  it('drops unknown keys', () => {
    expect(categoryLimitsResponseSchema.parse({ limits: demoLimits, userId: 3 })).toEqual({ limits: demoLimits });
  });

  it.each([
    ['five', demoLimits.slice(0, 5)],
    ['seven, one repeated', [...demoLimits, demoLimits[0]]],
    ['a repeat in place of one', demoLimits.map((entry, index) => (index === 5 ? demoLimits[4] : entry))],
    ['the wrong order', [demoLimits[1], demoLimits[0], ...demoLimits.slice(2)]],
    ['none', []],
  ])('rejects %s', (_case, limits) => {
    expect(categoryLimitsResponseSchema.safeParse({ limits }).success).toBe(false);
  });
});

// T1, AC10: the save's body, the amount rules of #31 through the goal Target rule (#108 a).
describe('categoryLimitRequestSchema', () => {
  const body = { category: 'food', limit: usd(30_050) };

  it.each([
    ['$300.50 for Food', body],
    ['1 cent', { category: 'others', limit: usd(1) }],
    ['the maximum', { category: 'housing', limit: usd(MAX_CENTS) }],
  ])('accepts %s', (_case, valid) => {
    expect(categoryLimitRequestSchema.parse(valid)).toEqual(valid);
  });

  it('drops unknown keys, so a userId or id in the body has no effect', () => {
    expect(categoryLimitRequestSchema.parse({ ...body, userId: 2, id: 9, month: '2026-10' })).toEqual(body);
    expect(categoryLimitRequestSchema.parse({ ...body, limit: { ...usd(30_050), userId: 2 } })).toEqual(body);
  });

  it.each([
    ['0', usd(0), goalMessages.targetPositive],
    ['-1', usd(-1), goalMessages.invalidAmount],
    ['1.5 cents', usd(1.5), goalMessages.invalidAmount],
    ['EUR', { cents: 30_050, currency: 'EUR' }, goalMessages.invalidAmount],
    ['one cent above the maximum', usd(MAX_CENTS + 1), goalMessages.targetMax],
    ['cents as text', { cents: '30050', currency: 'USD' }, goalMessages.invalidAmount],
    ['no limit', undefined, goalMessages.invalidAmount],
    ['null', null, goalMessages.invalidAmount],
  ])('rejects a limit of %s with its text on `limit`', (_case, limit, message) => {
    expect(fieldErrors(categoryLimitRequestSchema.safeParse({ category: 'food', limit }))).toEqual([
      `limit: ${message}`,
    ]);
  });

  it.each([
    ['bills', 'bills'],
    ['a capital letter', 'Food'],
    ['an empty text', ''],
    ['a number', 7],
    ['null', null],
    ['no category', undefined],
  ])('rejects %s as the category with "Enter a valid category"', (_case, category) => {
    expect(fieldErrors(categoryLimitRequestSchema.safeParse({ category, limit: usd(30_050) }))).toEqual([
      `category: ${categoryLimitMessages.invalidCategory}`,
    ]);
  });

  it('reports both fields at once', () => {
    expect(fieldErrors(categoryLimitRequestSchema.safeParse({ category: 'bills', limit: usd(0) }))).toEqual([
      `category: ${categoryLimitMessages.invalidCategory}`,
      `limit: ${goalMessages.targetPositive}`,
    ]);
  });

  it('says "Enter a valid category"', () => {
    expect(categoryLimitMessages.invalidCategory).toBe('Enter a valid category');
  });
});

// T1, AC5 and AC10: the saved limit, never `null`.
describe('categoryLimitResponseSchema', () => {
  it('accepts the saved category and limit, dropping unknown keys', () => {
    expect(categoryLimitResponseSchema.parse({ category: 'food', limit: usd(30_050), id: 3 })).toEqual({
      category: 'food',
      limit: usd(30_050),
    });
  });

  it.each([
    ['a null limit', { category: 'food', limit: null }],
    ['no category', { limit: usd(1) }],
    ['a category outside the six', { category: 'bills', limit: usd(1) }],
  ])('rejects %s', (_case, body) => {
    expect(categoryLimitResponseSchema.safeParse(body).success).toBe(false);
  });
});

/** The popup's text through the form schema. */
const parse = (limit: string) => categoryLimitFormSchema.safeParse({ limit });

/** A form parse as its one field's money, or its messages. */
type FormParse = { success: boolean; data?: Record<string, unknown>; error?: { issues: { message: string }[] } };
const outcome = (result: FormParse, field: string) =>
  result.success ? result.data![field] : result.error!.issues.map((issue) => issue.message);

// T2, AC8 and AC13: the popup's text to the request amount, through the same rules as the API (#64, #74, #84, #108 a).
describe('categoryLimitFormSchema', () => {
  it.each([
    ['300.5', usd(30_050)],
    ['250', usd(25_000)],
    ['0.01', usd(1)],
    ['1000000000', usd(MAX_CENTS)],
  ])('reads %j as integer cents in USD', (text, money) => {
    expect(parse(text)).toEqual({ success: true, data: { limit: money } });
  });

  it.each([
    ['', goalMessages.targetRequired],
    ['.', goalMessages.targetRequired],
    ['0', goalMessages.targetPositive],
    ['1000000000.01', goalMessages.targetMax],
    ['99999999999999999999', goalMessages.targetMax],
    ['12a', goalMessages.invalidAmount],
    ['1,5', goalMessages.invalidAmount],
    ['-5', goalMessages.invalidAmount],
  ])('rejects %j with its text', (text, message) => {
    expect(fieldErrors(parse(text))).toEqual([`limit: ${message}`]);
  });

  it.each(['', '.', '0', '300.5', '1000000000', '1000000000.01', '12a'])(
    'reads %j as the goal form reads its Target, from one shared rule',
    (text) => {
      expect(outcome(parse(text), 'limit')).toEqual(
        outcome(savingsGoalFormSchema.safeParse({ target: text, present: '' }), 'target'),
      );
    },
  );
});

// T1, AC9 and AC10: the two endpoints (#32: no month; #39: the user from the session).
describe('categoryLimitsContract', () => {
  it('lists the limits with GET /category-limits, no body and no query', () => {
    expect(categoryLimitsContract.list).toMatchObject({ method: 'GET', path: '/category-limits', request: undefined });
    expect('query' in categoryLimitsContract.list).toBe(false);
    expect(categoryLimitsContract.list.response).toBe(categoryLimitsResponseSchema);
  });

  it('saves one limit with PUT /category-limits, the request and response schemas, no query', () => {
    expect(categoryLimitsContract.save).toMatchObject({ method: 'PUT', path: '/category-limits' });
    expect('query' in categoryLimitsContract.save).toBe(false);
    expect(categoryLimitsContract.save.request).toBe(categoryLimitRequestSchema);
    expect(categoryLimitsContract.save.response).toBe(categoryLimitResponseSchema);
  });
});
