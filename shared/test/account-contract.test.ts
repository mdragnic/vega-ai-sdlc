import { describe, expect, it } from 'vitest';

import { accountsContract, accountsResponseSchema, accountSummarySchema, accountTypeLabel } from '../src/index.js';

const usd = (cents: number) => ({ cents, currency: 'USD' });

/** The first demo account as `GET /api/accounts` lists it (demo-data.md, task 013 AC1). */
const creditCard = {
  id: 1,
  accountType: 'credit-card',
  cardNetwork: 'mastercard',
  maskedNumber: '**** **** **** 2598',
  balance: usd(2_101_918),
};

// T8, AC7 and AC8: one account of the Total Balance carousel, as the backend sends it (#11, #24, #25, #96).
describe('accountSummarySchema', () => {
  it.each([
    ['the Credit Card', creditCard],
    ['an account without a card network', { ...creditCard, id: 3, accountType: 'savings', cardNetwork: null }],
    ['a VISA account', { ...creditCard, id: 2, accountType: 'checking', cardNetwork: 'visa' }],
    ['a negative balance', { ...creditCard, balance: usd(-1_250) }],
    ['a zero balance', { ...creditCard, balance: usd(0) }],
  ])('accepts %s', (_case, account) => {
    expect(accountSummarySchema.parse(account)).toEqual(account);
  });

  it.each([
    ['a float balance', { ...creditCard, balance: { cents: 2_101_918.5, currency: 'USD' } }],
    ['a balance in dollars as text', { ...creditCard, balance: '$21,019.18' }],
    ['another currency', { ...creditCard, balance: { cents: 100, currency: 'EUR' } }],
    ['a negative id', { ...creditCard, id: -1 }],
    ['a zero id', { ...creditCard, id: 0 }],
    ['a fractional id', { ...creditCard, id: 1.5 }],
    ['an unknown account type', { ...creditCard, accountType: 'credit' }],
    ['the account type label', { ...creditCard, accountType: 'Credit Card' }],
    ['an unknown card network', { ...creditCard, cardNetwork: 'amex' }],
    ['no card network key', Object.fromEntries(Object.entries(creditCard).filter(([key]) => key !== 'cardNetwork'))],
    ['the full number', { ...creditCard, maskedNumber: '3388455688602598' }],
    ['the full number with spaces', { ...creditCard, maskedNumber: '3388 4556 8860 2598' }],
    ['more than the last 4 digits', { ...creditCard, maskedNumber: '**** **** **60 2598' }],
    ['a Balances-style mask', { ...creditCard, maskedNumber: '3388 4556 8860 8***' }],
    ['a mask without spaces', { ...creditCard, maskedNumber: '************2598' }],
    ['3 digits', { ...creditCard, maskedNumber: '**** **** **** 598' }],
    ['5 digits', { ...creditCard, maskedNumber: '**** **** **** 12598' }],
    ['letters for digits', { ...creditCard, maskedNumber: '**** **** **** abcd' }],
    ['a trailing line break', { ...creditCard, maskedNumber: '**** **** **** 2598\n' }],
  ])('rejects %s', (_case, account) => {
    expect(accountSummarySchema.safeParse(account).success).toBe(false);
  });
});

// T8, AC7: the Total Balance and the accounts, oldest first (#17, #24).
describe('accountsResponseSchema', () => {
  it('accepts the total and the accounts in the given order', () => {
    const body = {
      totalBalance: usd(5_438_166),
      accounts: [creditCard, { ...creditCard, id: 2, accountType: 'checking', cardNetwork: 'visa' }],
    };

    expect(accountsResponseSchema.parse(body)).toEqual(body);
  });

  it('accepts no accounts with a total of 0 cents', () => {
    expect(accountsResponseSchema.parse({ totalBalance: usd(0), accounts: [] })).toEqual({
      totalBalance: usd(0),
      accounts: [],
    });
  });

  it.each([
    ['a float total', { totalBalance: { cents: 0.1, currency: 'USD' }, accounts: [] }],
    ['no total', { accounts: [] }],
    ['no accounts', { totalBalance: usd(0) }],
    ['an invalid account', { totalBalance: usd(0), accounts: [{ ...creditCard, maskedNumber: '2598' }] }],
  ])('rejects %s', (_case, body) => {
    expect(accountsResponseSchema.safeParse(body).success).toBe(false);
  });
});

describe('accountsContract', () => {
  it('lists the accounts with GET /accounts and no body', () => {
    expect(accountsContract.list).toMatchObject({ method: 'GET', path: '/accounts', request: undefined });
    expect(accountsContract.list.response).toBe(accountsResponseSchema);
  });
});

// T8: the Account Type names of #26.
describe('accountTypeLabel', () => {
  it.each([
    ['credit-card', 'Credit Card'],
    ['checking', 'Checking'],
    ['savings', 'Savings'],
    ['investment', 'Investment'],
    ['loan', 'Loan'],
  ] as const)('shows %j as %j', (type, label) => {
    expect(accountTypeLabel(type)).toBe(label);
  });
});
