import { describe, expect, it } from 'vitest';

import {
  accountDetailsSchema,
  accountIdSchema,
  accountParamsSchema,
  accountsContract,
  accountsResponseSchema,
  branchNameSchema,
} from '../src/index.js';

const usd = (cents: number) => ({ cents, currency: 'USD' });

/** Checking as `GET /api/accounts/:accountId` answers it at the fixed clock (demo-data.md, task 021 References). */
const checking = {
  accountType: 'checking',
  bankName: 'AB Bank Ltd',
  branchName: 'Park Street Branch',
  maskedNumber: '**** **** **** 7310',
  balance: usd(3_336_248),
};

const without = (key: keyof typeof checking) =>
  Object.fromEntries(Object.entries(checking).filter(([name]) => name !== key));

// Task 021 T1, AC12 (Marko's addition 2): the account ID of a path, strict: only `^[1-9][0-9]*$` whose number is a
// safe integer, parsed to that number. The backend and the frontend route both parse with it.
describe('accountIdSchema', () => {
  it.each([
    ['1', 1],
    ['42', 42],
    ['9007199254740991', 9_007_199_254_740_991],
  ])('parses %j to %d', (raw, id) => {
    expect(accountIdSchema.parse(raw)).toBe(id);
  });

  it.each([
    ['letters', 'abc'],
    ['zero', '0'],
    ['a leading zero', '01'],
    ['two leading zeros', '007'],
    ['an exponent', '1e3'],
    ['a minus', '-1'],
    ['a plus', '+1'],
    ['a decimal point with a zero', '1.0'],
    ['a fraction', '1.5'],
    ['digits then letters', '12abc'],
    ['a leading space', ' 7'],
    ['a trailing space', '7 '],
    ['a trailing line break', '7\n'],
    ['hexadecimal', '0x10'],
    ['one past the safe range', '9007199254740992'],
    ['two past the safe range, which Number rounds to one past it', '9007199254740993'],
    ['30 digits', '1'.repeat(30)],
    ['full-width digits', '１２'],
    ['the empty string', ''],
  ])('rejects %s (%j)', (_case, raw) => {
    expect(accountIdSchema.safeParse(raw).success).toBe(false);
  });

  it.each<[string, unknown]>([
    ['a number', 7],
    ['null', null],
    ['nothing', undefined],
    ['a list', ['7']],
  ])('rejects %s: a path parameter is a string', (_case, raw) => {
    expect(accountIdSchema.safeParse(raw).success).toBe(false);
  });

  it('parses the params of a path: { accountId }, unknown keys dropped', () => {
    expect(accountParamsSchema.parse({ accountId: '2', userId: '7' })).toEqual({ accountId: 2 });
    expect(accountParamsSchema.safeParse({ accountId: '01' }).success).toBe(false);
    expect(accountParamsSchema.safeParse({}).success).toBe(false);
  });
});

// T1, AC10: the Branch Name, required and at most 100 characters (#26), as the Bank Name.
describe('branchNameSchema', () => {
  it.each([
    ['a demo name', 'Park Street Branch'],
    ['1 character', 'P'],
    ['100 characters', 'P'.repeat(100)],
  ])('accepts %s', (_case, name) => {
    expect(branchNameSchema.parse(name)).toBe(name);
  });

  it.each<[string, unknown]>([
    ['an empty name', ''],
    ['101 characters', 'P'.repeat(101)],
    ['a number', 42],
    ['null', null],
    ['nothing', undefined],
  ])('rejects %s', (_case, name) => {
    expect(branchNameSchema.safeParse(name).success).toBe(false);
  });
});

// T1, AC10: exactly the five fields of US-12 criterion 2, the number masked (#25), the balance in integer cents (#11).
describe('accountDetailsSchema', () => {
  it.each<[string, unknown]>([
    ['Checking', checking],
    [
      'the Credit Card',
      {
        accountType: 'credit-card',
        bankName: 'Master Card',
        branchName: 'Main Branch',
        maskedNumber: '**** **** **** 2598',
        balance: usd(2_101_918),
      },
    ],
    ['100-character names', { ...checking, bankName: 'B'.repeat(100), branchName: 'P'.repeat(100) }],
    ['a negative balance', { ...checking, balance: usd(-9_007_199_254_740_991) }],
  ])('accepts %s', (_case, details) => {
    expect(accountDetailsSchema.parse(details)).toEqual(details);
  });

  it.each<[string, unknown]>([
    ['the full number', { ...checking, maskedNumber: '6934566990127310' }],
    ['the full number with spaces', { ...checking, maskedNumber: '6934 5669 9012 7310' }],
    ['a 101-character Branch Name', { ...checking, branchName: 'P'.repeat(101) }],
    ['an empty Branch Name', { ...checking, branchName: '' }],
    ['a 101-character Bank Name', { ...checking, bankName: 'B'.repeat(101) }],
    ['a float balance', { ...checking, balance: { cents: 3_336_248.5, currency: 'USD' } }],
    ['another currency', { ...checking, balance: { cents: 100, currency: 'EUR' } }],
    ['a balance as text', { ...checking, balance: '$33,362.48' }],
    ['an unknown account type', { ...checking, accountType: 'Checking' }],
    ...(Object.keys(checking) as (keyof typeof checking)[]).map((key): [string, unknown] => [
      `no ${key}`,
      without(key),
    ]),
  ])('rejects %s', (_case, details) => {
    expect(accountDetailsSchema.safeParse(details).success).toBe(false);
  });

  it('drops keys outside the contract: no ID, full number, opening balance, card network or user ID', () => {
    const parsed = accountDetailsSchema.parse({
      ...checking,
      id: 2,
      accountNumber: '6934566990127310',
      openingBalanceCents: 100,
      cardNetwork: 'visa',
      userId: 7,
    });

    expect(Object.keys(parsed).toSorted()).toEqual([
      'accountType',
      'balance',
      'bankName',
      'branchName',
      'maskedNumber',
    ]);
  });
});

// T1, AC10 to AC12: the details entry, the first with path parameters (`ContractEntry.params`).
describe('accountsContract.details', () => {
  it('answers one account with GET /accounts/:accountId, its ID in the path, no query or body', () => {
    expect(accountsContract.details).toMatchObject({
      method: 'GET',
      path: '/accounts/:accountId',
      request: undefined,
    });
    expect(accountsContract.details.params).toBe(accountParamsSchema);
    expect(accountsContract.details.response).toBe(accountDetailsSchema);
    expect('query' in accountsContract.details).toBe(false);
  });

  it('leaves the list entry unchanged: no params', () => {
    expect('params' in accountsContract.list).toBe(false);
    expect(accountsContract.list.response).toBe(accountsResponseSchema);
  });
});
