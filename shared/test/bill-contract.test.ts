import { describe, expect, it } from 'vitest';

import { billsContract, upcomingBillSchema, upcomingBillsResponseSchema } from '../src/index.js';

const usd = (cents: number) => ({ cents, currency: 'USD' });

/** The first upcoming demo bill on 22 Oct 2026 (demo-data.md, "What a first login shows"). */
const figma = {
  title: 'Figma - Yearly Plan',
  logo: 'figma',
  dueDate: '2027-05-15',
  lastChargeDate: '2026-05-14',
  amount: usd(15_000),
};

const adobe = {
  title: 'Adobe Inc - Yearly Plan',
  logo: 'adobe',
  dueDate: '2027-06-16',
  lastChargeDate: '2026-06-17',
  amount: usd(55_900),
};

const without = (key: keyof typeof figma) => Object.fromEntries(Object.entries(figma).filter(([name]) => name !== key));

// T1, AC7: one upcoming bill as the backend sends it: plain dates, integer cents with USD, no ID (#11, #28, #96).
describe('upcomingBillSchema', () => {
  it.each([
    ['the Figma bill', figma],
    ['the Adobe bill', adobe],
    ['an amount of 0 cents', { ...figma, amount: usd(0) }],
  ])('accepts %s', (_case, bill) => {
    expect(upcomingBillSchema.parse(bill)).toEqual(bill);
  });

  it.each<[string, unknown]>([
    ['an unknown logo', { ...figma, logo: 'netflix' }],
    ['the logo as its name', { ...figma, logo: 'Figma' }],
    ['a due date without leading zeros', { ...figma, dueDate: '2027-5-15' }],
    ['a timestamp as the due date', { ...figma, dueDate: '2027-05-15T00:00:00.000Z' }],
    ['a due date that does not exist', { ...figma, dueDate: '2027-02-30' }],
    ['a formatted due date', { ...figma, dueDate: '15 May, 2027' }],
    ['a timestamp as the last charge date', { ...figma, lastChargeDate: '2026-05-14 00:00:00.000' }],
    ['a float amount', { ...figma, amount: { cents: 150.5, currency: 'USD' } }],
    ['an amount in dollars as text', { ...figma, amount: '$150.00' }],
    ['another currency', { ...figma, amount: { cents: 15_000, currency: 'EUR' } }],
    ['a number for the title', { ...figma, title: 150 }],
    ...(Object.keys(figma) as (keyof typeof figma)[]).map((key): [string, unknown] => [`no ${key}`, without(key)]),
  ])('rejects %s', (_case, bill) => {
    expect(upcomingBillSchema.safeParse(bill).success).toBe(false);
  });

  it('drops keys outside the contract: no row ID, user ID or description', () => {
    const parsed = upcomingBillSchema.parse({ ...figma, id: 11, userId: 7, description: 'For advanced security' });

    expect(parsed).toEqual(figma);
    expect(Object.keys(parsed).toSorted()).toEqual(['amount', 'dueDate', 'lastChargeDate', 'logo', 'title']);
  });
});

// T1, AC7: every upcoming bill, soonest first, in the order the backend sends them (#28, #41).
describe('upcomingBillsResponseSchema', () => {
  it('accepts the bills in the given order', () => {
    const body = { bills: [figma, adobe] };

    expect(upcomingBillsResponseSchema.parse(body)).toEqual(body);
  });

  it('accepts no upcoming bills', () => {
    expect(upcomingBillsResponseSchema.parse({ bills: [] })).toEqual({ bills: [] });
  });

  it.each([
    ['no bills key', {}],
    ['bills that are not a list', { bills: figma }],
    ['an invalid bill', { bills: [figma, { ...adobe, amount: usd(1.5) }] }],
  ])('rejects %s', (_case, body) => {
    expect(upcomingBillsResponseSchema.safeParse(body).success).toBe(false);
  });
});

describe('billsContract', () => {
  it('lists the upcoming bills with GET /bills/upcoming and no body', () => {
    expect(billsContract.upcoming).toMatchObject({ method: 'GET', path: '/bills/upcoming', request: undefined });
    expect(billsContract.upcoming.response).toBe(upcomingBillsResponseSchema);
  });
});
