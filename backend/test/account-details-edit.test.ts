import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import {
  accountMessages,
  accountsContract,
  accountsResponseSchema,
  bankNameSchema,
  branchNameSchema,
  errorResponseSchema,
  writeGuardMessages,
} from '@finebank/shared';
import request, { type Response } from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Account } from '../src/bank-data/account.entity.js';
import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { cookieFor, signUp } from './helpers/auth.js';
import { financeRows, userIdOf } from './helpers/finance.js';
import { createTestApp } from './helpers/test-app.js';

// The paths come from the contract, so a route declared anywhere else would not answer them.
const detailsPath = (raw: string) => `/api${accountsContract.details.path.replace(':accountId', raw)}`;
const updatePath = (raw: string) => `/api${accountsContract.updateDetails.path.replace(':accountId', raw)}`;
const listPath = `/api${accountsContract.list.path}`;

const FIXED_NOW = '2026-10-22T10:00:00.000Z';
const BELGRADE = 'Europe/Belgrade';

const usd = (cents: number) => ({ cents, currency: 'USD' });

/** A letter beyond the BMP: one code point, two UTF-16 code units. */
const doubleStruck = '\u{1D538}';
/** A family emoji: 5 code points. */
const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';

/** Checking's details at the fixed clock (demo-data.md; task 021 References). */
const checkingDetails = {
  accountType: 'checking',
  bankName: 'AB Bank Ltd',
  branchName: 'Park Street Branch',
  maskedNumber: '**** **** **** 7310',
  balance: usd(3_336_248),
};

/** A valid body: the demo's values. */
const validBody = { bankName: 'AB Bank Ltd', branchName: 'Park Street Branch', accountType: 'checking' };

/** A body the API refuses. */
const invalidBody = { ...validBody, bankName: '   ' };

/** Every ID outside task 021's strict rule, as a path segment: URL-encoded where it must be. */
const nonIds = ['abc', '0', '01', '1e3', '-1', '1.0', '12abc', '9007199254740992', '%2B1', '%207'];

/** Browser headers of a request from another site (task 014's four sets). */
const crossSite: [string, Record<string, string>][] = [
  ['Sec-Fetch-Site: cross-site', { 'Sec-Fetch-Site': 'cross-site' }],
  ['Sec-Fetch-Site: same-site', { 'Sec-Fetch-Site': 'same-site' }],
  ['a foreign Origin without Sec-Fetch-Site', { Origin: 'http://evil.example' }],
  [
    'Sec-Fetch-Site: cross-site and an Origin that matches Host',
    { 'Sec-Fetch-Site': 'cross-site', Host: 'localhost:5173', Origin: 'http://localhost:5173' },
  ],
];

/** The #120 b4 text of a field's rule. */
const messageOf = (field: 'bankName' | 'branchName', rule: 'required' | 'control' | 'max') =>
  accountMessages[`${field}${rule[0]!.toUpperCase()}${rule.slice(1)}` as keyof typeof accountMessages];

/** Status, the headers that could tell the cases apart, and the raw body. */
const shape = (response: Response) => ({
  status: response.status,
  contentType: response.headers['content-type'],
  cacheControl: response.headers['cache-control'],
  body: response.text,
});

/** The bound SQL of a statement: each `?` replaced by its parameter, so a test reads the values in the text. */
function bind(sql: string, parameters: unknown): string {
  const values: unknown[] = Array.isArray(parameters) ? parameters : [];
  let index = 0;
  return sql.replace(/\?/g, () => JSON.stringify(values[index++]));
}

/** The WHERE clause of a statement. */
const whereOf = (sql: string) => /\bWHERE\b(.*?)(\bORDER BY\b|\bLIMIT\b|\bRETURNING\b|$)/is.exec(sql)?.[1] ?? '';

describe('PATCH /api/accounts/:accountId', () => {
  let app: INestApplication;
  let db: DataSource;
  let clock: FixedClock;
  /** The requester, signed up second, so its IDs are not positions. */
  let token: string;
  let email: string;
  let userId: number;
  let accountIds: number[];
  /** The other user, signed up first, whose names and types differ from the requester's. */
  let otherToken: string;
  let otherEmail: string;
  let otherAccountIds: number[];
  /** Every account row as it stood before each test. */
  let accountsBefore: Record<string, unknown>[];

  const allAccounts = () => db.query<Record<string, unknown>[]>('SELECT * FROM accounts ORDER BY id');
  const allTransactions = () => db.query<Record<string, unknown>[]>('SELECT * FROM transactions ORDER BY id');

  /** Every account ID that is not the requester's, and every ID outside the strict rule. */
  const notFoundCases = (): [string, string][] => [
    ...otherAccountIds.map((id, index): [string, string] => [`the other user’s account ${index + 1}`, String(id)]),
    ['an ID no account has', String(Math.max(...accountIds, ...otherAccountIds) + 100_000)],
    ...nonIds.map((raw): [string, string] => [`the ID outside the rule ${JSON.stringify(raw)}`, raw]),
  ];

  beforeAll(async () => {
    app = await createTestApp({ config: { nodeEnv: 'test', testNow: FIXED_NOW } });
    db = app.get(DataSource);
    clock = app.get(FixedClock);
    const other = await signUp(app);
    otherToken = other.token;
    otherEmail = other.user.email;
    const otherId = (await userIdOf(db, otherEmail))!;
    const signedUp = await signUp(app);
    token = signedUp.token;
    email = signedUp.user.email;
    userId = (await userIdOf(db, email))!;
    accountIds = (await financeRows(db, userId)).accounts.map((account) => Number(account.id));
    otherAccountIds = (await financeRows(db, otherId)).accounts.map((account) => Number(account.id));

    // The other user's data differs from the requester's: its names and types.
    const types = ['loan', 'investment', 'savings', 'checking', 'credit-card'] as const;
    for (const [index, id] of otherAccountIds.entries()) {
      await db
        .getRepository(Account)
        .update(
          { id },
          { bankName: `Other Bank ${index}`, branchName: `Other Branch ${index}`, accountType: types[index]! },
        );
    }
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    clock.set(new Date(FIXED_NOW));
    accountsBefore = await allAccounts();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    // Each test starts from the same rows.
    for (const row of accountsBefore) {
      await db.query('UPDATE accounts SET bank_name = ?, branch_name = ?, account_type = ? WHERE id = ?', [
        row.bank_name,
        row.branch_name,
        row.account_type,
        row.id,
      ]);
    }
  });

  const checkingId = () => String(accountIds[1]);

  /**
   * A PATCH with the requester's session, the Belgrade zone and the requester's email in X-Expected-User unless told
   * otherwise (`null` leaves one out).
   */
  const patch = (
    path: string,
    body: unknown,
    options: {
      token?: string | null;
      zone?: string | null;
      expectedUser?: string | null;
      headers?: Record<string, string>;
    } = {},
  ) => {
    let req = request(app.getHttpServer()).patch(path);
    const session = options.token === undefined ? token : options.token;
    const zone = options.zone === undefined ? BELGRADE : options.zone;
    const expectedUser = options.expectedUser === undefined ? email : options.expectedUser;
    if (session !== null) req = req.set('Cookie', cookieFor(session));
    if (zone !== null) req = req.set('X-Time-Zone', zone);
    if (expectedUser !== null) req = req.set('X-Expected-User', expectedUser);
    if (options.headers) req = req.set(options.headers);
    return req.send(body as object);
  };

  const get = (path: string, session = token) =>
    request(app.getHttpServer()).get(path).set('Cookie', cookieFor(session)).set('X-Time-Zone', BELGRADE);

  /** The SQL the data source runs while `run` runs, each statement bound with its parameters. */
  async function recordSql(run: () => Promise<unknown>) {
    const statements: string[] = [];
    const logQuery = vi.spyOn(db.logger, 'logQuery').mockImplementation((sql, parameters) => {
      statements.push(bind(sql, parameters));
    });
    try {
      await run();
    } finally {
      logQuery.mockRestore();
    }
    return statements;
  }

  // T3: AC7, the write and its answer; only the three columns of the one row change (#25, #26, #57, #74, #75).
  describe('an own account', () => {
    it('answers 200 with exactly the five keys, the names trimmed, and stores only Checking’s three columns', async () => {
      const transactionsBefore = await allTransactions();

      const response = await patch(updatePath(checkingId()), {
        bankName: '  Nordic Bank  ',
        branchName: 'Harbour Branch ',
        accountType: 'savings',
        id: accountIds[0],
        userId: userId + 1,
        accountNumber: '1111222233334444',
        cardNetwork: 'mastercard',
        openingBalanceCents: 1,
        balance: usd(1),
      });

      expect(response.status).toBe(200);
      // The body as sent, not as a schema parses it.
      expect(JSON.parse(response.text)).toEqual({
        accountType: 'savings',
        bankName: 'Nordic Bank',
        branchName: 'Harbour Branch',
        maskedNumber: '**** **** **** 7310',
        balance: usd(3_336_248),
      });
      expect(Object.keys(JSON.parse(response.text) as object)).toHaveLength(5);
      const after = await allAccounts();
      expect(after).toEqual(
        accountsBefore.map((row) =>
          row.id === accountIds[1]
            ? { ...row, bank_name: 'Nordic Bank', branch_name: 'Harbour Branch', account_type: 'savings' }
            : row,
        ),
      );
      expect(await allTransactions()).toEqual(transactionsBefore);
    });

    it('answers the new values on GET /api/accounts/:accountId and GET /api/accounts', async () => {
      await patch(updatePath(checkingId()), { bankName: 'Nordic Bank', branchName: 'Harbour', accountType: 'loan' });

      expect((await get(detailsPath(checkingId()))).body).toEqual({
        ...checkingDetails,
        bankName: 'Nordic Bank',
        branchName: 'Harbour',
        accountType: 'loan',
      });
      const list = accountsResponseSchema.parse((await get(listPath)).body);
      expect(list.accounts[1]).toMatchObject({ id: accountIds[1], bankName: 'Nordic Bank', accountType: 'loan' });
      expect(list.accounts.map((account) => account.bankName)).toEqual([
        'Master Card',
        'Nordic Bank',
        'Brac Bank Ltd.',
        'AB Bank Ltd',
        'City Bank Ltd.',
      ]);
    });

    it('answers 200 with the details as they were for a save that changes nothing', async () => {
      const response = await patch(updatePath(checkingId()), validBody);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(checkingDetails);
      expect(await allAccounts()).toEqual(accountsBefore);
    });

    it('keeps the card network when the Credit Card becomes a Loan (#120 a)', async () => {
      const creditCard = String(accountIds[0]);

      expect(
        (await patch(updatePath(creditCard), { bankName: 'Master Card', branchName: 'Main', accountType: 'loan' }))
          .status,
      ).toBe(200);

      const list = accountsResponseSchema.parse((await get(listPath)).body);
      expect(list.accounts[0]).toMatchObject({ accountType: 'loan', cardNetwork: 'mastercard' });
    });
  });

  // T4: AC3 and AC8, the shared rule over HTTP; nothing stored (#26, #74, #120 b).
  describe('the rules', () => {
    const invalidNames: [string, string, 'required' | 'control' | 'max'][] = [
      ['empty', '', 'required'],
      ['three spaces', '   ', 'required'],
      ['a no-break and an ideographic space', '\u00A0\u3000', 'required'],
      ['a zero-width space', '\u200B', 'required'],
      ['two soft hyphens', '\u00AD\u00AD', 'required'],
      ['a tab inside', 'AB\tBank', 'control'],
      ['a line break inside', 'AB\nBank', 'control'],
      ['101 letters', 'B'.repeat(101), 'max'],
      ['101 letters beyond the BMP', doubleStruck.repeat(101), 'max'],
      ['96 letters and a family emoji', 'B'.repeat(96) + family, 'max'],
    ];

    it.each(invalidNames)(
      'answers 400 for a Bank Name %s, with its field error, storing nothing',
      async (_c, name, rule) => {
        const response = await patch(updatePath(checkingId()), { ...validBody, bankName: name });

        expect(response.status).toBe(400);
        expect(errorResponseSchema.strict().parse(response.body).fieldErrors).toEqual({
          bankName: messageOf('bankName', rule),
        });
        expect(await allAccounts()).toEqual(accountsBefore);
      },
    );

    it.each(invalidNames)(
      'answers 400 for a Branch Name %s, with its field error, storing nothing',
      async (_c, name, rule) => {
        const response = await patch(updatePath(checkingId()), { ...validBody, branchName: name });

        expect(response.status).toBe(400);
        expect(errorResponseSchema.strict().parse(response.body).fieldErrors).toEqual({
          branchName: messageOf('branchName', rule),
        });
        expect(await allAccounts()).toEqual(accountsBefore);
      },
    );

    it('answers both messages when both names fail', async () => {
      const response = await patch(updatePath(checkingId()), {
        ...validBody,
        bankName: '\u200B',
        branchName: 'B'.repeat(101),
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'Validation failed',
        fieldErrors: { bankName: 'Bank Name is required', branchName: 'Branch Name must be at most 100 characters' },
      });
    });

    it.each<[string, unknown]>([
      ['a label, not a value', 'Credit Card'],
      ['an unknown value', 'card'],
      ['nothing', undefined],
    ])('answers 400 for %s as the type, on accountType', async (_case, accountType) => {
      const response = await patch(updatePath(checkingId()), { ...validBody, accountType });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'Validation failed',
        fieldErrors: { accountType: 'Choose an Account Type' },
      });
      expect(await allAccounts()).toEqual(accountsBefore);
    });

    it.each(['bankName', 'branchName'] as const)('answers 400 without %s', async (key) => {
      const body = Object.fromEntries(Object.entries(validBody).filter(([name]) => name !== key));

      const response = await patch(updatePath(checkingId()), body);

      expect(response.status).toBe(400);
      expect(Object.keys(errorResponseSchema.parse(response.body).fieldErrors!)).toEqual([key]);
    });

    it('stores 100 letters beyond the BMP, whose length in SQLite is 100', async () => {
      const name = doubleStruck.repeat(100);

      const response = await patch(updatePath(checkingId()), { ...validBody, bankName: name, branchName: ` ${name} ` });

      expect(response.status).toBe(200);
      const [row] = await db.query<{ bank: number; branch: number; value: string }[]>(
        'SELECT length(bank_name) AS bank, length(branch_name) AS branch, branch_name AS value FROM accounts WHERE id = ?',
        [accountIds[1]],
      );
      expect(row).toEqual({ bank: 100, branch: 100, value: name });
    });
  });

  // T5: AC9, one 404 for every account that is not the requester's; the check and the write one UPDATE (#39, #77).
  describe('the not-found rule', () => {
    it('answers 404 with the GET’s status, headers and body for every case, changing nothing', async () => {
      for (const [name, raw] of notFoundCases()) {
        const response = await patch(updatePath(raw), validBody);
        const read = await get(detailsPath(raw));

        expect({ name, ...shape(response) }).toEqual({ name, ...shape(read) });
        expect({ name, ...shape(response) }).toEqual({
          name,
          status: 404,
          contentType: 'application/json; charset=utf-8',
          cacheControl: 'no-store',
          body: '{"message":"Account not found"}',
        });
      }
      expect(await allAccounts()).toEqual(accountsBefore);
    });

    it('answers the empty segment /api/accounts// with the same 404', async () => {
      const response = await patch('/api/accounts//', validBody);

      expect(shape(response)).toEqual(shape(await get('/api/accounts//')));
      expect(response.status).toBe(404);
      expect(await allAccounts()).toEqual(accountsBefore);
    });

    it('answers the other user its own account, so the 404 is the requester’s', async () => {
      const response = await patch(updatePath(String(otherAccountIds[1])), validBody, {
        token: otherToken,
        expectedUser: otherEmail,
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ bankName: 'AB Bank Ltd', accountType: 'checking' });
    });

    it('runs one UPDATE on accounts whose WHERE holds the account and the user, with no read of accounts before it', async () => {
      const statements = await recordSql(() => patch(updatePath(checkingId()), { ...validBody, branchName: 'X' }));

      const onAccounts = statements.filter((sql) => /\baccounts\b/i.test(sql));
      const updates = onAccounts.filter((sql) => /^UPDATE\b/i.test(sql));
      expect(updates).toHaveLength(1);
      const where = whereOf(updates[0]!);
      expect(where).toMatch(new RegExp(`"id"\\s*=\\s*${accountIds[1]}\\b`));
      expect(where).toMatch(new RegExp(`"user_id"\\s*=\\s*${userId}\\b`));
      const updateAt = statements.indexOf(updates[0]!);
      expect(statements.slice(0, updateAt).filter((sql) => /\bFROM\s+"?accounts"?/i.test(sql))).toEqual([]);
    });

    it('runs the same one UPDATE for another user’s account, which matches no row', async () => {
      const statements = await recordSql(() => patch(updatePath(String(otherAccountIds[1])), validBody));

      const updates = statements.filter((sql) => /^UPDATE\b.*\baccounts\b/is.test(sql));
      expect(updates).toHaveLength(1);
      expect(whereOf(updates[0]!)).toMatch(new RegExp(`"user_id"\\s*=\\s*${userId}\\b`));
      expect(statements.filter((sql) => /\bFROM\s+"?accounts"?/i.test(sql))).toEqual([]);
    });
  });

  // T6: AC10, the order of the checks and the protections on the PATCH (#75, #119).
  describe('the order and the protections', () => {
    it('answers 401 without a session', async () => {
      const response = await patch(updatePath(checkingId()), validBody, { token: null });

      expect(response.status).toBe(401);
      expect(errorResponseSchema.strict().parse(response.body).message).toBe('Authentication required');
    });

    it.each(crossSite)('answers 403 with %s and changes nothing', async (_case, headers) => {
      const response = await patch(updatePath(checkingId()), { ...validBody, bankName: 'Evil Bank' }, { headers });

      expect(response.status).toBe(403);
      expect(await allAccounts()).toEqual(accountsBefore);
    });

    it.each<[string, string | null]>([
      ['no X-Expected-User', null],
      ['one that is not an email', 'not-an-email'],
      ['an empty one', ''],
    ])('answers 400 with %s, changing nothing', async (_case, expectedUser) => {
      const response = await patch(updatePath(checkingId()), { ...validBody, bankName: 'Changed' }, { expectedUser });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: writeGuardMessages.expectedUserInvalid });
      expect(await allAccounts()).toEqual(accountsBefore);
    });

    it('answers 409 with the shared message for another user’s email, with no query on accounts', async () => {
      let response!: Response;
      const statements = await recordSql(async () => {
        response = await patch(
          updatePath(checkingId()),
          { ...validBody, bankName: 'Changed' },
          { expectedUser: otherEmail },
        );
      });

      expect(response.status).toBe(409);
      expect(response.text).toBe(JSON.stringify({ message: 'Another user is signed in. Nothing was saved.' }));
      expect(statements.filter((sql) => /\baccounts\b|\btransactions\b/i.test(sql))).toEqual([]);
      expect(statements.every((sql) => /^SELECT\b/i.test(sql))).toBe(true);
      expect(await allAccounts()).toEqual(accountsBefore);
    });

    it('answers 200 for the user’s own email in another case: compared in the stored form, never raw', async () => {
      const mixedCase = email.replace(/^user/, 'User').toUpperCase().replace('@EXAMPLE.COM', '@Example.COM');
      expect(mixedCase).not.toBe(email);
      expect(mixedCase.toLowerCase()).toBe(email);

      const response = await patch(
        updatePath(checkingId()),
        { ...validBody, bankName: 'Case Bank' },
        { expectedUser: ` ${mixedCase} ` },
      );

      expect(response.status).toBe(200);
      const [row] = await db.query<{ bank_name: string }[]>('SELECT bank_name FROM accounts WHERE id = ?', [
        accountIds[1],
      ]);
      expect(row!.bank_name).toBe('Case Bank');
    });

    it.each<[string, string | null]>([
      ['missing', null],
      ['an offset, not a zone', '+01:00'],
    ])('answers 400 when X-Time-Zone is %s', async (_case, zone) => {
      const response = await patch(updatePath(checkingId()), validBody, { zone });

      expect(response.status).toBe(400);
      expect(errorResponseSchema.strict().parse(response.body).message).toMatch(/X-Time-Zone/);
    });

    it('answers 400 with field errors for an invalid body', async () => {
      const response = await patch(updatePath(checkingId()), invalidBody);

      expect(response.status).toBe(400);
      expect(errorResponseSchema.parse(response.body).fieldErrors).toEqual({ bankName: 'Bank Name is required' });
    });

    it.each<[string, () => Promise<Response>, number, (body: { message: string; fieldErrors?: object }) => void]>([
      [
        'no session and no header: 401',
        () => patch(updatePath(checkingId()), validBody, { token: null, expectedUser: null }),
        401,
        (body) => expect(body.message).toBe('Authentication required'),
      ],
      [
        'another email and an invalid body: 409',
        () => patch(updatePath(checkingId()), invalidBody, { expectedUser: otherEmail }),
        409,
        (body) => expect(body.message).toBe(writeGuardMessages.otherUser),
      ],
      [
        'an invalid zone and an invalid body: the zone’s 400',
        () => patch(updatePath(checkingId()), invalidBody, { zone: '+01:00' }),
        400,
        (body) => expect(body.message).toMatch(/X-Time-Zone/),
      ],
      [
        'an ID outside the strict rule and an invalid body: the body’s 400',
        () => patch(updatePath('abc'), invalidBody),
        400,
        (body) => expect(body.fieldErrors).toEqual({ bankName: 'Bank Name is required' }),
      ],
      [
        'another user’s account and an invalid body: the body’s 400',
        () => patch(updatePath(String(otherAccountIds[1])), invalidBody),
        400,
        (body) => expect(body.fieldErrors).toEqual({ bankName: 'Bank Name is required' }),
      ],
    ])('answers a request failing two checks with the earlier one: %s', async (_case, send, status, check) => {
      const response = await send();

      expect(response.status).toBe(status);
      check(response.body as { message: string; fieldErrors?: object });
      expect(await allAccounts()).toEqual(accountsBefore);
    });
  });
});

// The demo dataset's names pass the new rule unchanged, so no seeded name can break a response (task 022 Scope).
describe('the demo dataset’s names', () => {
  it('pass bankNameSchema and branchNameSchema unchanged', () => {
    const dataset = JSON.parse(readFileSync(resolve(import.meta.dirname, '../src/demo/demo-dataset.json'), 'utf8')) as {
      accounts: { bankName: string; branchName: string }[];
    };

    expect(dataset.accounts).toHaveLength(5);
    for (const { bankName, branchName } of dataset.accounts) {
      expect(bankNameSchema.parse(bankName)).toBe(bankName);
      expect(branchNameSchema.parse(branchName)).toBe(branchName);
    }
  });
});
