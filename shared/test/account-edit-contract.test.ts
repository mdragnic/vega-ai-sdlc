import { describe, expect, it } from 'vitest';

import {
  accountDetailsRequestSchema,
  accountDetailsSchema,
  accountMessages,
  accountParamsSchema,
  accountsContract,
  accountsResponseSchema,
  bankNameSchema,
  branchNameSchema,
  EXPECTED_USER_HEADER,
  writeGuardMessages,
} from '../src/index.js';

const usd = (cents: number) => ({ cents, currency: 'USD' });

/** A letter beyond the BMP: one code point, two UTF-16 code units. */
const doubleStruck = '\u{1D538}';
/** A family emoji: 5 code points (3 people joined by 2 zero-width joiners), one grapheme. */
const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';

/** The demo dataset's names (demo-data.md, Accounts). */
const demoBankNames = ['Master Card', 'AB Bank Ltd', 'Brac Bank Ltd.', 'City Bank Ltd.'];
const demoBranchNames = ['Main Branch', 'Park Street Branch', 'Gulshan Branch', 'Motijheel Branch'];

/** The first issue's message of a failed parse, and how many issues there are. */
function failure(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  expect(result.success).toBe(false);
  return { message: result.error!.issues[0]!.message, count: result.error!.issues.length };
}

// T1, AC3 and AC8: the one name rule of #26 and #120 b, on both names, used by the form and the API (#74).
describe.each([
  ['Bank Name', bankNameSchema],
  ['Branch Name', branchNameSchema],
] as const)('the %s rule', (field, schema) => {
  const required = `${field} is required`;
  const control = `${field} cannot contain tabs or line breaks`;
  const max = `${field} must be at most 100 characters`;

  it.each([
    ['a demo name', 'AB Bank Ltd', 'AB Bank Ltd'],
    ['spaces around it, trimmed', '  AB Bank Ltd  ', 'AB Bank Ltd'],
    ['a no-break and an ideographic space around it, trimmed', '\u00A0AB Bank\u3000', 'AB Bank'],
    ['a letter with a caron', 'Šabac', 'Šabac'],
    ['CJK letters', '銀行', '銀行'],
    ['a soft hyphen inside a word', 'Hous\u00ADing', 'Hous\u00ADing'],
    ['inner spaces as typed', 'AB  Bank   Ltd', 'AB  Bank   Ltd'],
    ['1 character', 'A', 'A'],
    ['100 letters', 'B'.repeat(100), 'B'.repeat(100)],
    ['100 letters beyond the BMP (200 UTF-16 code units)', doubleStruck.repeat(100), doubleStruck.repeat(100)],
    ['100 letters and spaces around them', ` ${'B'.repeat(100)}  `, 'B'.repeat(100)],
    ['95 letters and a family emoji (100 code points)', 'B'.repeat(95) + family, 'B'.repeat(95) + family],
  ])('accepts %s, the output trimmed', (_case, input, output) => {
    expect(schema.parse(input)).toBe(output);
  });

  it.each([
    ['an empty name', '', required],
    ['three spaces', '   ', required],
    ['a no-break and an ideographic space', '\u00A0\u3000', required],
    ['a zero-width space', '\u200B', required],
    ['two soft hyphens', '\u00AD\u00AD', required],
    ['a tab alone, trimmed away', '\t', required],
    ['a control character alone', '\u0001', required],
    ['a zero-width space between spaces', ' \u200B ', required],
    ['a tab inside', 'AB\tBank', control],
    ['a line break inside', 'AB\nBank', control],
    ['a carriage return inside', 'AB\rBank', control],
    ['a NEL inside, which trim() keeps', 'AB\u0085Bank', control],
    ['101 letters', 'B'.repeat(101), max],
    ['101 letters beyond the BMP', doubleStruck.repeat(101), max],
    ['96 letters and a family emoji (101 code points)', 'B'.repeat(96) + family, max],
    ['a tab in 101 letters: the earlier rule', `${'B'.repeat(50)}\t${'B'.repeat(50)}`, control],
  ])('rejects %s with its one message', (_case, input, message) => {
    expect(failure(schema.safeParse(input))).toEqual({ message, count: 1 });
  });

  it.each<[string, unknown]>([
    ['a number', 42],
    ['null', null],
    ['nothing', undefined],
  ])('rejects %s as required', (_case, input) => {
    expect(failure(schema.safeParse(input))).toEqual({ message: required, count: 1 });
  });

  it('passes every demo name unchanged', () => {
    for (const name of field === 'Bank Name' ? demoBankNames : demoBranchNames) {
      expect(schema.parse(name)).toBe(name);
    }
  });
});

// T1: the texts of #120 b4, exported once for the form, the API and the tests.
describe('accountMessages', () => {
  it('holds the #120 b4 texts', () => {
    expect(accountMessages).toEqual({
      bankNameRequired: 'Bank Name is required',
      bankNameControl: 'Bank Name cannot contain tabs or line breaks',
      bankNameMax: 'Bank Name must be at most 100 characters',
      branchNameRequired: 'Branch Name is required',
      branchNameControl: 'Branch Name cannot contain tabs or line breaks',
      branchNameMax: 'Branch Name must be at most 100 characters',
      accountTypeInvalid: 'Choose an Account Type',
    });
  });
});

const validRequest = { bankName: 'AB Bank Ltd', branchName: 'Park Street Branch', accountType: 'checking' };

// T1, AC7 and AC8: the PATCH body, exactly the three editable fields of #26, all required.
describe('accountDetailsRequestSchema', () => {
  it('parses the demo values', () => {
    expect(accountDetailsRequestSchema.parse(validRequest)).toEqual(validRequest);
  });

  it('trims both names', () => {
    expect(
      accountDetailsRequestSchema.parse({
        ...validRequest,
        bankName: '  Nordic Bank  ',
        branchName: 'Harbour Branch ',
      }),
    ).toEqual({ ...validRequest, bankName: 'Nordic Bank', branchName: 'Harbour Branch' });
  });

  it.each(['credit-card', 'checking', 'savings', 'investment', 'loan'])('accepts the type %s', (accountType) => {
    expect(accountDetailsRequestSchema.parse({ ...validRequest, accountType }).accountType).toBe(accountType);
  });

  it.each<[string, unknown]>([
    ['a label, not a value', 'Credit Card'],
    ['an unknown value', 'card'],
    ['an empty value', ''],
    ['null', null],
    ['nothing', undefined],
  ])('rejects %s as the type with "Choose an Account Type"', (_case, accountType) => {
    const result = accountDetailsRequestSchema.safeParse({ ...validRequest, accountType });

    expect(result.success).toBe(false);
    expect(result.error!.issues.map(({ path, message }) => [path.join('.'), message])).toEqual([
      ['accountType', 'Choose an Account Type'],
    ]);
  });

  it.each([
    ['bankName', 'Bank Name is required'],
    ['branchName', 'Branch Name is required'],
    ['accountType', 'Choose an Account Type'],
  ])('rejects a body without %s, on that field', (key, message) => {
    const body = Object.fromEntries(Object.entries(validRequest).filter(([name]) => name !== key));
    const result = accountDetailsRequestSchema.safeParse(body);

    expect(result.error!.issues.map(({ path, message: text }) => [path.join('.'), text])).toEqual([[key, message]]);
  });

  it('gives one message per field, each field its own, when both names fail', () => {
    const result = accountDetailsRequestSchema.safeParse({
      ...validRequest,
      bankName: '   ',
      branchName: 'P'.repeat(101),
    });

    expect(result.error!.issues.map(({ path, message }) => [path.join('.'), message])).toEqual([
      ['bankName', 'Bank Name is required'],
      ['branchName', 'Branch Name must be at most 100 characters'],
    ]);
  });

  it('drops every other key: an ID, a user, the number, the card network, the opening balance, a balance', () => {
    const parsed = accountDetailsRequestSchema.parse({
      ...validRequest,
      id: 7,
      userId: 3,
      accountNumber: '1111222233334444',
      cardNetwork: 'visa',
      openingBalanceCents: 1,
      balance: usd(1),
    });

    expect(parsed).toEqual(validRequest);
    expect(Object.keys(parsed).toSorted()).toEqual(['accountType', 'bankName', 'branchName']);
  });
});

// T1, AC7: the contract entry of the account write.
describe('accountsContract.updateDetails', () => {
  it('is PATCH /accounts/:accountId with the account params, the request schema and the details response', () => {
    expect(accountsContract.updateDetails).toEqual({
      method: 'PATCH',
      path: '/accounts/:accountId',
      params: accountParamsSchema,
      request: accountDetailsRequestSchema,
      response: accountDetailsSchema,
    });
  });
});

// T1: the responses and the write share the one rule, so every stored name passes it.
describe('the response schemas with the name rule', () => {
  const checking = {
    accountType: 'checking',
    bankName: 'AB Bank Ltd',
    branchName: 'Park Street Branch',
    maskedNumber: '**** **** **** 7310',
    balance: usd(3_336_248),
  };

  it('accepts every demo name in the details and the accounts list', () => {
    for (const [index, bankName] of demoBankNames.entries()) {
      const branchName = demoBranchNames[index]!;
      expect(accountDetailsSchema.parse({ ...checking, bankName, branchName })).toEqual({
        ...checking,
        bankName,
        branchName,
      });
      const summary = {
        id: index + 1,
        accountType: 'checking',
        bankName,
        cardNetwork: null,
        maskedNumber: checking.maskedNumber,
        balance: checking.balance,
      };
      expect(accountsResponseSchema.parse({ totalBalance: usd(0), accounts: [summary] }).accounts).toEqual([summary]);
    }
  });

  it.each([
    ['a whitespace-only Bank Name', { bankName: '   ' }],
    ['an invisible-only Branch Name', { branchName: '\u200B' }],
    ['a tab in the Bank Name', { bankName: 'AB\tBank' }],
  ])('rejects %s in the details', (_case, change) => {
    expect(accountDetailsSchema.safeParse({ ...checking, ...change }).success).toBe(false);
  });

  it('accepts 100 letters beyond the BMP in the details', () => {
    const bankName = doubleStruck.repeat(100);

    expect(accountDetailsSchema.parse({ ...checking, bankName }).bankName).toBe(bankName);
  });
});

// T1, #119: the write guard's header and texts, one place for the backend and the frontend.
describe('the write guard', () => {
  it('names the header X-Expected-User', () => {
    expect(EXPECTED_USER_HEADER).toBe('X-Expected-User');
  });

  it('holds the 409 text of #119 and a 400 text naming the header', () => {
    expect(writeGuardMessages.otherUser).toBe('Another user is signed in. Nothing was saved.');
    expect(writeGuardMessages.expectedUserInvalid).toMatch(/X-Expected-User/);
  });
});
