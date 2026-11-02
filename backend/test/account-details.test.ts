import type { INestApplication } from '@nestjs/common';
import {
  accountDetailsSchema,
  accountsContract,
  accountsResponseSchema,
  errorResponseSchema,
  transactionsContract,
} from '@finebank/shared';
import request, { type Response } from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountsService } from '../src/accounts/accounts.service.js';
import { Account } from '../src/bank-data/account.entity.js';
import { Transaction } from '../src/bank-data/transaction.entity.js';
import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { cookieFor, signUp } from './helpers/auth.js';
import { financeRows, userIdOf } from './helpers/finance.js';
import { createTestApp } from './helpers/test-app.js';

// The paths come from the contract, so a route declared anywhere else would not answer them.
const detailsPath = (accountId: string) => `/api${accountsContract.details.path.replace(':accountId', accountId)}`;
const historyPath = (accountId: string) => `/api${transactionsContract.history.path.replace(':accountId', accountId)}`;
const listPath = `/api${accountsContract.list.path}`;

const FIXED_NOW = '2026-10-22T10:00:00.000Z';
const BELGRADE = 'Europe/Belgrade';
const NEW_YORK = 'America/New_York';

const usd = (cents: number) => ({ cents, currency: 'USD' });

/** The five demo accounts' details at the fixed clock, oldest first (demo-data.md; task 021 References). */
const demoDetails = [
  {
    accountType: 'credit-card',
    bankName: 'Master Card',
    branchName: 'Main Branch',
    maskedNumber: '**** **** **** 2598',
    balance: usd(2_101_918),
  },
  {
    accountType: 'checking',
    bankName: 'AB Bank Ltd',
    branchName: 'Park Street Branch',
    maskedNumber: '**** **** **** 7310',
    balance: usd(3_336_248),
  },
  {
    accountType: 'savings',
    bankName: 'Brac Bank Ltd.',
    branchName: 'Gulshan Branch',
    maskedNumber: '**** **** **** 4421',
    balance: usd(2_735_680),
  },
  {
    accountType: 'investment',
    bankName: 'AB Bank Ltd',
    branchName: 'Park Street Branch',
    maskedNumber: '**** **** **** 6652',
    balance: usd(2_950_300),
  },
  {
    accountType: 'loan',
    bankName: 'City Bank Ltd.',
    branchName: 'Motijheel Branch',
    maskedNumber: '**** **** **** 9083',
    balance: usd(1_901_321),
  },
];

/** The full numbers stored for every user (demo-data.md, Accounts), never returned (#25). */
const fullNumbers = [
  '3388455688602598',
  '6934566990127310',
  '1334568868014421',
  '6984568662016652',
  '3634568966019083',
];

const withSpaces = (digits: string) => digits.replace(/(\d{4})(?=\d)/g, '$1 ');

/** Every ID outside the strict rule (Marko's addition 2), as a path segment: URL-encoded where it must be. */
const nonIds = [
  'abc',
  '0',
  '01',
  '007',
  '1e3',
  '-1',
  '%2B1',
  '1.0',
  '1.5',
  '12abc',
  '%207',
  '7%20',
  '0x10',
  '9007199254740992',
  '9007199254740993',
  '1'.repeat(30),
];

const NOT_FOUND = '{"message":"Account not found"}';

/** Status, the headers that could tell the cases apart, and the raw body. */
const shape = (response: Response) => ({
  status: response.status,
  contentType: response.headers['content-type'],
  cacheControl: response.headers['cache-control'],
  body: response.text,
});

const expected = {
  status: 404,
  contentType: 'application/json; charset=utf-8',
  cacheControl: 'no-store',
  body: NOT_FOUND,
};

/** Everything of the other user that must never appear. */
function expectNothingOfTheOtherUser(text: string) {
  for (const word of ['Other Bank', 'Other Branch', 'OtherRcpt99', 'Headphones', '12345', 'Gadget Shop']) {
    expect(text).not.toContain(word);
  }
}

describe('Account Details API', () => {
  let app: INestApplication;
  let clock: FixedClock;
  let db: DataSource;
  /** The requester, signed up second, so its IDs are not positions. */
  let token: string;
  let userId: number;
  let accountIds: number[];
  /** The other user, signed up first, whose names and transactions differ from the requester's. */
  let otherToken: string;
  let otherAccountIds: number[];

  beforeAll(async () => {
    app = await createTestApp({ config: { nodeEnv: 'test', testNow: FIXED_NOW } });
    clock = app.get(FixedClock);
    db = app.get(DataSource);
    const other = await signUp(app);
    otherToken = other.token;
    const otherId = (await userIdOf(db, other.user.email))!;
    const signedUp = await signUp(app);
    token = signedUp.token;
    userId = (await userIdOf(db, signedUp.user.email))!;
    accountIds = (await financeRows(db, userId)).accounts.map((account) => Number(account.id));
    otherAccountIds = (await financeRows(db, otherId)).accounts.map((account) => Number(account.id));

    // The other user's data differs from the requester's: names, and a transaction on its Checking.
    for (const [index, id] of otherAccountIds.entries()) {
      await db
        .getRepository(Account)
        .update({ id }, { bankName: `Other Bank ${index}`, branchName: `Other Branch ${index}` });
    }
    await db.getRepository(Transaction).insert({
      accountId: otherAccountIds[1]!,
      occurredAt: new Date('2026-10-22T08:00:00Z'),
      direction: 'expense',
      status: 'complete',
      category: 'shopping',
      item: 'Headphones',
      shopName: 'Gadget Shop',
      receipt: 'OtherRcpt99',
      amountCents: 12_345,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    clock.set(new Date(FIXED_NOW));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** A GET with the requester's session and the Belgrade zone unless told otherwise. */
  const get = (path: string, options: { token?: string | null; zone?: string | null } = {}) => {
    let req = request(app.getHttpServer()).get(path);
    const session = options.token === undefined ? token : options.token;
    const zone = options.zone === undefined ? BELGRADE : options.zone;
    if (session !== null) req = req.set('Cookie', cookieFor(session));
    if (zone !== null) req = req.set('X-Time-Zone', zone);
    return req;
  };

  /** The accounts list, with each account's details checked to give the same balance (one calculation, #57). */
  async function expectSameBalances(zone: string) {
    const list = accountsResponseSchema.parse((await get(listPath, { zone })).body);
    for (const account of list.accounts) {
      const details = accountDetailsSchema.parse((await get(detailsPath(String(account.id)), { zone })).body);
      expect(details.balance).toEqual(account.balance);
    }
    return list;
  }

  /** Every account ID that is not one of the requester's, and every ID outside the strict rule. */
  const cases = (): [string, string][] => [
    ...otherAccountIds.map((id, index): [string, string] => [`the other user’s account ${index + 1}`, String(id)]),
    ['an ID no account has', String(Math.max(...accountIds, ...otherAccountIds) + 100_000)],
    ...nonIds.map((raw): [string, string] => [`the ID outside the rule ${JSON.stringify(raw)}`, raw]),
  ];

  // T3: AC2 and AC10, each of the five accounts as sent (#11, #25, #26, #96).
  describe('GET /api/accounts/:accountId', () => {
    it('answers 200 with exactly the five fields of each account, in integer cents with USD', async () => {
      for (const [index, id] of accountIds.entries()) {
        const response = await get(detailsPath(String(id)));

        expect(response.status).toBe(200);
        // The body as sent, not as the schema parses it (which drops an unknown key).
        expect(response.body).toEqual(demoDetails[index]);
        expect(Object.keys(response.body as object).toSorted()).toEqual([
          'accountType',
          'balance',
          'bankName',
          'branchName',
          'maskedNumber',
        ]);
        expect(accountDetailsSchema.strict().parse(response.body)).toEqual(response.body);
      }
    });

    it('answers 401 without a session', async () => {
      const response = await get(detailsPath(String(accountIds[1])), { token: null });

      expect(response.status).toBe(401);
      expect(errorResponseSchema.strict().parse(response.body).message).toBe('Authentication required');
    });

    it.each([
      ['missing', null],
      ['an offset, not a zone', '+01:00'],
    ])('answers 400 in the shared error shape when X-Time-Zone is %s', async (_case, zone) => {
      const response = await get(detailsPath(String(accountIds[1])), { zone });

      expect(response.status).toBe(400);
      expect(errorResponseSchema.strict().parse(response.body).message).toMatch(/X-Time-Zone/);
    });

    // T4: AC10, nothing but the five fields; no number with more than its last 4 digits (#25).
    it('never sends a full number, a 12-digit prefix, an opening balance, a card network, an ID or a receipt', async () => {
      const { transactions } = await financeRows(db, userId);
      const receipts = transactions.slice(0, 50).map((row) => String(row.receipt));

      for (const id of accountIds) {
        const text = (await get(detailsPath(String(id)))).text;

        for (const number of fullNumbers) {
          expect(text).not.toContain(number);
          expect(text).not.toContain(number.slice(0, 12));
          expect(text).not.toContain(withSpaces(number));
          expect(text).not.toContain(withSpaces(number).slice(0, 14));
        }
        expect(text.replace(/\*{4} \*{4} \*{4} \d{4}/g, '')).not.toMatch(/\d{13}|\d{4} \d{4}/);
        for (const word of [
          'openingBalance',
          'opening_balance',
          'cardNetwork',
          'mastercard',
          'visa',
          '"id"',
          'userId',
          'accountId',
          'receipt',
          'item',
          ...receipts,
        ]) {
          expect(text).not.toContain(word);
        }
        expect(text).not.toContain(`:${id},`);
        expect(text).not.toContain(`:${userId},`);
      }
    });
  });

  // T5: AC8 and AC9, one balance calculation: the details' balance is the accounts list's, in any zone and clock (#57).
  describe('the balance', () => {
    it.each([
      [FIXED_NOW, BELGRADE],
      ['2026-10-23T22:30:00Z', BELGRADE],
      ['2026-10-23T22:30:00Z', NEW_YORK],
      ['2022-01-17T10:00:00Z', BELGRADE],
    ])('at %s in %s equals the accounts list’s for every account', async (now, zone) => {
      clock.set(new Date(now));

      const list = await expectSameBalances(zone);

      expect(list.accounts).toHaveLength(5);
    });

    it('moves with a Complete expense on the Credit Card in both, never with a Pending or a Failed one', async () => {
      const creditCardId = accountIds[0]!;
      const before = await expectSameBalances(BELGRADE);
      const add = (status: 'complete' | 'pending' | 'failed', amountCents: number) =>
        db.getRepository(Transaction).insert({
          accountId: creditCardId,
          occurredAt: new Date('2026-10-22T08:00:00Z'),
          direction: 'expense',
          status,
          category: 'food',
          item: `Test ${status}`,
          shopName: 'Pizza Hit',
          receipt: `T${status}`,
          amountCents,
        });

      await add('pending', 7_000);
      await add('failed', 9_000);
      const unchanged = await expectSameBalances(BELGRADE);
      await add('complete', 1_111);
      const after = await expectSameBalances(BELGRADE);

      expect(unchanged.accounts[0]!.balance).toEqual(before.accounts[0]!.balance);
      expect(after.accounts[0]!.balance.cents).toBe(before.accounts[0]!.balance.cents - 1_111);
      expect(after.accounts.slice(1)).toEqual(before.accounts.slice(1));
      await db
        .getRepository(Transaction)
        .delete({ accountId: creditCardId, shopName: 'Pizza Hit', item: 'Test complete' });
      await db.getRepository(Transaction).delete({ accountId: creditCardId, item: 'Test pending' });
      await db.getRepository(Transaction).delete({ accountId: creditCardId, item: 'Test failed' });
    });
  });

  // T6: AC12 and AC14, one 404 for every account that is not the requester's, on both routes (#39, #46).
  describe('the not-found rule', () => {
    let ownCursor: string;

    beforeAll(async () => {
      const page = (await get(historyPath(String(accountIds[1])))).body as { nextCursor: string };
      ownCursor = page.nextCursor;
    });

    it('answers the details route 404 with one status, headers and body for every case', async () => {
      for (const [name, raw] of cases()) {
        const response = await get(detailsPath(raw));
        expect({ name, ...shape(response) }).toEqual({ name, ...expected });
        expectNothingOfTheOtherUser(response.text);
      }
    });

    it('answers the history route 404 with the same, with and without a cursor', async () => {
      for (const [name, raw] of cases()) {
        for (const path of [historyPath(raw), `${historyPath(raw)}?cursor=${encodeURIComponent(ownCursor)}`]) {
          const response = await get(path);
          expect({ name, path, ...shape(response) }).toEqual({ name, path, ...expected });
          expectNothingOfTheOtherUser(response.text);
        }
      }
    });

    it.each([
      ['/api/accounts//', 'the details path'],
      ['/api/accounts//transactions', 'the history path'],
      ['/api/accounts//transactions?cursor=abc', 'the history path with a cursor'],
    ])('answers the empty segment %s (%s) with the same 404, never the default one with the path', async (path) => {
      const response = await get(path);

      expect(shape(response)).toEqual(expected);
    });

    it('keeps /api/accounts/ the accounts list', async () => {
      const response = await get('/api/accounts/');

      expect(response.status).toBe(200);
      expect(accountsResponseSchema.parse(response.body).accounts.map((account) => account.id)).toEqual(accountIds);
    });

    it('parses the largest safe integer as an ID: no account has it, so 404', async () => {
      const details = await get(detailsPath('9007199254740991'));
      const history = await get(historyPath('9007199254740991'));

      expect(shape(details)).toEqual(expected);
      expect(shape(history)).toEqual(expected);
    });

    it('answers the other user its own accounts, so the 404 is the requester’s', async () => {
      const response = await get(detailsPath(String(otherAccountIds[1])), { token: otherToken });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ bankName: 'Other Bank 1', branchName: 'Other Branch 1' });
    });

    it('answers 401 before anything else without a session, for an own and a non-numeric ID alike', async () => {
      for (const raw of [String(accountIds[1]), 'abc', String(otherAccountIds[1])]) {
        expect((await get(detailsPath(raw), { token: null })).status).toBe(401);
        expect((await get(historyPath(raw), { token: null })).status).toBe(401);
      }
    });

    // (Marko's addition 1) With the ownership check out of the way, the history's transaction read still filters by
    // the session user and the account in one query: the other user's account gives no rows.
    it('answers the other user’s account no rows even when hasAccount always says yes', async () => {
      // The double, so the account check lets the request through (the 200 below shows it did).
      vi.spyOn(app.get(AccountsService), 'hasAccount').mockResolvedValue(true);

      const response = await get(historyPath(String(otherAccountIds[1])));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ transactions: [], nextCursor: null });
      expectNothingOfTheOtherUser(response.text);
    });
  });
});
