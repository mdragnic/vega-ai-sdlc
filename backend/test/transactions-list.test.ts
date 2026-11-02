import type { INestApplication } from '@nestjs/common';
import { errorResponseSchema, transactionsContract } from '@finebank/shared';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { cookieFor, signUp } from './helpers/auth.js';
import { userIdOf } from './helpers/finance.js';
import { createTestApp } from './helpers/test-app.js';

// The path comes from the contract, so a route declared anywhere else would not answer it.
const listPath = `/api${transactionsContract.list.path}`;

const FIXED_NOW = '2026-10-22T10:00:00.000Z';
const BELGRADE = 'Europe/Belgrade';

type Body = { transactions: Record<string, unknown>[]; nextCursor: string | null };

/** The items of a raw body's rows, in the order sent. */
const items = (body: unknown) => (body as Body).transactions.map((row) => row.item);

const allPage1Items = [
  'Jeans',
  'Movie ticket',
  'Pizza',
  'Taxi fare',
  'Restaurant bill',
  'GTR 5',
  'Freelance payment',
  'Pizza',
  'Biriyani',
  'Shirt',
];
const allPage2Items = [
  'Dividend',
  'Parking',
  'Taxi fare',
  'iTunes',
  'Donation',
  'Loan installment',
  'Freelance payment',
  'Keyboard',
  'Pizza',
  'Metro Card bill',
];

const rowKeys = ['amount', 'category', 'direction', 'item', 'occurredAt', 'paymentMethod', 'shopName'];

describe('the transactions list API', () => {
  let app: INestApplication;
  let clock: FixedClock;
  let db: DataSource;

  beforeAll(async () => {
    app = await createTestApp({ config: { nodeEnv: 'test', testNow: FIXED_NOW } });
    clock = app.get(FixedClock);
    db = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    clock.set(new Date(FIXED_NOW));
  });

  /** A new user signed up through the API at the backend's clock, with the demo transactions. */
  async function newUser() {
    const { user, token } = await signUp(app);
    return { token, id: (await userIdOf(db, user.email))! };
  }

  /** `GET /api/transactions` with a raw query string. */
  const get = (options: { token?: string; zone?: string; query?: string }) => {
    let req = request(app.getHttpServer()).get(options.query === undefined ? listPath : `${listPath}?${options.query}`);
    if (options.token !== undefined) req = req.set('Cookie', cookieFor(options.token));
    if (options.zone !== undefined) req = req.set('X-Time-Zone', options.zone);
    return req;
  };
  const page = (token: string, tab: string, cursor?: string) =>
    get({
      token,
      zone: BELGRADE,
      query: cursor === undefined ? `tab=${tab}` : `tab=${tab}&cursor=${encodeURIComponent(cursor)}`,
    });

  // T7: AC2 to AC5 and AC11 (#11, #19, #27, #54, #74, #75, #96).
  describe('GET /api/transactions', () => {
    it('answers 200 with All’s first 10, only the contract’s keys, UTC timestamps, plain cents with USD and a cursor', async () => {
      const { token } = await newUser();

      const response = await page(token, 'all');

      expect(response.status).toBe(200);
      const body = response.body as Body;
      expect(Object.keys(body)).toEqual(['transactions', 'nextCursor']);
      expect(items(body)).toEqual(allPage1Items);
      expect(body.transactions[0]).toEqual({
        item: 'Jeans',
        shopName: 'Denim House',
        category: 'shopping',
        direction: 'expense',
        occurredAt: '2026-10-22T12:00:00.000Z',
        amount: { cents: 26_600, currency: 'USD' },
        paymentMethod: 'checking',
      });
      for (const row of body.transactions) {
        expect(Object.keys(row).toSorted()).toEqual(rowKeys);
        expect(Object.keys(row.amount as object).toSorted()).toEqual(['cents', 'currency']);
        expect((row.amount as { cents: number }).cents).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger((row.amount as { cents: number }).cents)).toBe(true);
        expect(row.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(row.category === null).toBe(row.direction === 'income');
      }
      expect(body.nextCursor).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    });

    it('answers page 2 for page 1’s cursor: Dividend first, Shirt not again', async () => {
      const { token } = await newUser();
      const first = (await page(token, 'all')).body as Body;

      const response = await page(token, 'all', first.nextCursor!);

      expect(response.status).toBe(200);
      expect(items(response.body)).toEqual(allPage2Items);
    });

    it('answers each tab its own kind: Revenue income only, Expenses expenses only', async () => {
      const { token } = await newUser();

      const revenue = (await page(token, 'revenue')).body as Body;
      const expenses = (await page(token, 'expenses')).body as Body;

      expect(revenue.transactions.map((row) => row.direction)).toEqual(Array.from({ length: 10 }, () => 'income'));
      expect(items(revenue)).toEqual([
        'Freelance payment',
        'Dividend',
        'Freelance payment',
        'Freelance payment',
        'Design project',
        'Interest',
        'Card repayment',
        'Freelance payment',
        'Freelance payment',
        'Dividend',
      ]);
      expect(expenses.transactions.map((row) => row.direction)).toEqual(Array.from({ length: 10 }, () => 'expense'));
      expect(items(expenses)).toEqual([...allPage1Items.filter((item) => item !== 'Freelance payment'), 'Parking']);
    });

    it('answers no rows and a null cursor before the dataset begins', async () => {
      clock.set(new Date('2021-12-31T10:00:00Z'));
      const { token } = await newUser();

      const response = await page(token, 'all');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ transactions: [], nextCursor: null });
    });

    it('answers exactly 10 rows and a null cursor at 2022-01-08, the end of the list', async () => {
      clock.set(new Date('2022-01-08T10:00:00Z'));
      const { token } = await newUser();

      const body = (await page(token, 'all')).body as Body;

      expect(body.transactions).toHaveLength(10);
      expect(body.nextCursor).toBeNull();
    });

    it('answers 401 without a session', async () => {
      const response = await get({ zone: BELGRADE, query: 'tab=all' });

      expect(response.status).toBe(401);
      expect(errorResponseSchema.strict().parse(response.body).message).toBe('Authentication required');
    });

    it.each([
      ['missing', undefined],
      ['an offset, not a zone', '+01:00'],
    ])('answers 400 in the shared error shape when X-Time-Zone is %s', async (_case, zone) => {
      const { token } = await newUser();

      const response = await get({ token, zone, query: 'tab=all' });

      expect(response.status).toBe(400);
      expect(errorResponseSchema.strict().parse(response.body).message).toMatch(/X-Time-Zone/);
    });

    it.each([
      ['no tab', ''],
      ['no tab but a cursor', 'cursor=abc'],
      ['an unknown tab', 'tab=other'],
      ['a repeated tab', 'tab=all&tab=revenue'],
      ['a cursor the backend did not make', `tab=all&cursor=${encodeURIComponent('not a cursor')}`],
      [
        'a base64url cursor the backend did not make',
        `tab=all&cursor=${Buffer.from('2026-10-15_1').toString('base64url')}`,
      ],
      ['an empty cursor', 'tab=all&cursor='],
      ['a cursor of 65 characters', `tab=all&cursor=${'a'.repeat(65)}`],
      ['a repeated cursor', 'tab=all&cursor=a&cursor=b'],
    ])('answers 400 in the shared error shape for %s, with no internals', async (_case, query) => {
      const { token } = await newUser();

      const response = await get({ token, zone: BELGRADE, query });

      expect(response.status).toBe(400);
      const body = errorResponseSchema.parse(response.body);
      expect(Object.keys(response.body as object).every((key) => key === 'message' || key === 'fieldErrors')).toBe(
        true,
      );
      expect(JSON.stringify(body)).not.toMatch(/SELECT|sqlite|stack|\bat \w|Error:|InvalidCursor/i);
    });
  });

  // T8: AC12, each user reads only their own rows; nothing in a request names a user or an account (#39, #46).
  describe('user scoping', () => {
    it('answers each user from their own rows: the other user’s change leaves the first’s answer as before', async () => {
      const other = await newUser();
      const first = await newUser();
      const before = (await page(first.token, 'all')).body as Body;

      await db.query('DELETE FROM transactions WHERE account_id IN (SELECT id FROM accounts WHERE user_id = ?)', [
        other.id,
      ]);

      expect(items(before)).toEqual(allPage1Items);
      expect((await page(first.token, 'all')).body).toEqual(before);
      expect((await page(other.token, 'all')).body).toEqual({ transactions: [], nextCursor: null });
    });

    it('ignores a userId or an accountId in the query: the session decides', async () => {
      const other = await newUser();
      const first = await newUser();
      await db.query('DELETE FROM transactions WHERE account_id IN (SELECT id FROM accounts WHERE user_id = ?)', [
        first.id,
      ]);
      const [{ id: otherAccount }] = await db.query<[{ id: number }]>(
        'SELECT id FROM accounts WHERE user_id = ? ORDER BY id LIMIT 1',
        [other.id],
      );

      for (const query of [`tab=all&userId=${other.id}`, `tab=all&accountId=${otherAccount}`]) {
        const response = await get({ token: first.token, zone: BELGRADE, query });

        expect({ query, status: response.status, body: response.body as unknown }).toEqual({
          query,
          status: 200,
          body: { transactions: [], nextCursor: null },
        });
      }
    });

    it('answers a cursor made from another user’s list with the requester’s own rows from that position', async () => {
      const other = await newUser();
      const first = await newUser();
      const firstCursor = ((await page(first.token, 'all')).body as Body).nextCursor!;
      // The first user's rows renamed, so any of them in the other's answer would show.
      await db.query(
        `UPDATE transactions SET item = 'First user' WHERE account_id IN (SELECT id FROM accounts WHERE user_id = ?)`,
        [first.id],
      );

      const response = await page(other.token, 'all', firstCursor);

      // The other user signed up first, so their Shirt (at the cursor's instant) has a lower ID and comes after it.
      expect(response.status).toBe(200);
      expect(items(response.body)).toEqual(['Shirt', ...allPage2Items.slice(0, 9)]);
    });
  });
});
