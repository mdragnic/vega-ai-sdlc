import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { accountsContract, accountsResponseSchema, errorResponseSchema } from '@finebank/shared';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { Transaction } from '../src/bank-data/transaction.entity.js';
import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { cookieFor, signUp } from './helpers/auth.js';
import { financeRows, userIdOf } from './helpers/finance.js';
import { createTestApp } from './helpers/test-app.js';

// The path comes from the contract, so a route declared anywhere else would not answer it.
const accountsPath = `/api${accountsContract.list.path}`;

const FIXED_NOW = '2026-10-22T10:00:00.000Z';
const BELGRADE = 'Europe/Belgrade';
const NEW_YORK = 'America/New_York';

const usd = (cents: number) => ({ cents, currency: 'USD' });

/** The demo accounts on 22 Oct 2026 (demo-data.md "What a first login shows"), oldest first (#24, #25). */
const firstLoginAccounts = [
  {
    accountType: 'credit-card',
    cardNetwork: 'mastercard',
    maskedNumber: '**** **** **** 2598',
    balance: usd(2_101_918),
  },
  { accountType: 'checking', cardNetwork: 'visa', maskedNumber: '**** **** **** 7310', balance: usd(3_336_248) },
  { accountType: 'savings', cardNetwork: null, maskedNumber: '**** **** **** 4421', balance: usd(2_735_680) },
  { accountType: 'investment', cardNetwork: null, maskedNumber: '**** **** **** 6652', balance: usd(2_950_300) },
  { accountType: 'loan', cardNetwork: null, maskedNumber: '**** **** **** 9083', balance: usd(1_901_321) },
];

/** The full numbers stored for every user (demo-data.md, Accounts), never returned (#25). */
const fullNumbers = [
  '3388455688602598',
  '6934566990127310',
  '1334568868014421',
  '6984568662016652',
  '3634568966019083',
];
const bankNames = ['Master Card', 'AB Bank Ltd', 'Brac Bank Ltd.', 'City Bank Ltd.'];

const withSpaces = (digits: string) => digits.replace(/(\d{4})(?=\d)/g, '$1 ');

describe('GET /api/accounts', () => {
  let app: INestApplication;
  let clock: FixedClock;
  let db: DataSource;
  let token: string;
  let userId: number;

  beforeAll(async () => {
    app = await createTestApp({ config: { nodeEnv: 'test', testNow: FIXED_NOW } });
    clock = app.get(FixedClock);
    db = app.get(DataSource);
    const signedUp = await signUp(app);
    token = signedUp.token;
    userId = (await userIdOf(db, signedUp.user.email))!;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    clock.set(new Date(FIXED_NOW));
  });

  const get = (options: { token?: string; zone?: string }) => {
    let req = request(app.getHttpServer()).get(accountsPath);
    if (options.token !== undefined) req = req.set('Cookie', cookieFor(options.token));
    if (options.zone !== undefined) req = req.set('X-Time-Zone', options.zone);
    return req;
  };

  // T3: AC1, AC2 and AC7, the first login's Total Balance and carousel (#11, #17, #24, #25, #57, #96).
  it('answers 200 with the total and the 5 accounts oldest first, in integer cents with USD', async () => {
    const response = await get({ token, zone: BELGRADE });

    expect(response.status).toBe(200);
    const body = accountsResponseSchema.parse(response.body);
    const ids = (await financeRows(db, userId)).accounts.map((account) => account.id);
    expect(body).toEqual({
      totalBalance: usd(13_025_467),
      accounts: firstLoginAccounts.map((account, index) => ({ id: ids[index], ...account })),
    });
  });

  it('answers 401 without a session', async () => {
    const response = await get({ zone: BELGRADE });

    expect(response.status).toBe(401);
    expect(errorResponseSchema.strict().parse(response.body).message).toBe('Authentication required');
  });

  it.each([
    ['missing', undefined],
    ['an offset, not a zone', '+01:00'],
    ['an unknown zone', 'Mars/Base'],
  ])('answers 400 in the shared error shape when X-Time-Zone is %s', async (_case, zone) => {
    const response = await get({ token, zone });

    expect(response.status).toBe(400);
    expect(errorResponseSchema.strict().parse(response.body).message).toMatch(/X-Time-Zone/);
  });

  // T4: AC8, nothing but the contract's fields; no number with more than its last 4 digits (#25).
  it('never sends a full number, a 12-digit prefix, an opening balance, a Bank Name or a transaction', async () => {
    const response = await get({ token, zone: BELGRADE });
    const text = response.text;
    const { transactions } = await financeRows(db, userId);
    const receipt = String(transactions[0]!.receipt);

    for (const number of fullNumbers) {
      expect(text).not.toContain(number);
      expect(text).not.toContain(number.slice(0, 12));
      expect(text).not.toContain(withSpaces(number));
      expect(text).not.toContain(withSpaces(number).slice(0, 14));
    }
    // Outside the masks, nothing shaped like an account number: no 13 digits in a row, no two 4-digit groups.
    expect(text.replace(/\*{4} \*{4} \*{4} \d{4}/g, '')).not.toMatch(/\d{13}|\d{4} \d{4}/);
    for (const name of [...bankNames, 'openingBalance', 'opening_balance', 'bankName', 'branchName', receipt]) {
      expect(text).not.toContain(name);
    }
    expect(Object.keys(response.body as object).toSorted()).toEqual(['accounts', 'totalBalance']);
    for (const account of (response.body as { accounts: object[] }).accounts) {
      expect(Object.keys(account).toSorted()).toEqual(['accountType', 'balance', 'cardNetwork', 'id', 'maskedNumber']);
    }
  });

  // T5: AC9, Complete transactions dated up to today in the user's zone (#53, #54, #57, #80).
  it.each([
    ['2026-10-22T21:59:00Z', BELGRADE, 13_025_467, 2_101_918],
    // 23 Oct in Belgrade: the Biriyani of 23 Oct, $14.78 on Credit Card, counts.
    ['2026-10-22T22:01:00Z', BELGRADE, 13_023_989, 2_100_440],
    // Still 22 Oct in New York.
    ['2026-10-22T22:01:00Z', NEW_YORK, 13_025_467, 2_101_918],
  ])('at %s in %s gives a total of %i cents, Credit Card %i', async (now, zone, total, creditCard) => {
    clock.set(new Date(now));

    const body = accountsResponseSchema.parse((await get({ token, zone })).body);

    expect(body.totalBalance).toEqual(usd(total));
    expect(body.accounts[0]!.balance).toEqual(usd(creditCard));
  });

  // T6: AC10, each user sees only their own accounts; no parameter selects another user (#39, #46).
  it('keeps another user’s change out of this user’s accounts', async () => {
    const other = await signUp(app);
    const otherId = (await userIdOf(db, other.user.email))!;
    const ownIds = (await financeRows(db, userId)).accounts.map((account) => account.id);
    const otherAccounts = (await financeRows(db, otherId)).accounts;
    const before = (await get({ token, zone: BELGRADE })).body as object;
    const otherBefore = accountsResponseSchema.parse((await get({ token: other.token, zone: BELGRADE })).body);

    await db.getRepository(Transaction).insert({
      accountId: Number(otherAccounts[0]!.id),
      occurredAt: new Date('2026-10-22T08:00:00Z'),
      direction: 'expense',
      status: 'complete',
      category: 'shopping',
      item: 'Headphones',
      shopName: 'Gadget Shop',
      receipt: 'Zz9yX8wV7uT',
      amountCents: 12_345,
    });

    const after = accountsResponseSchema.parse((await get({ token, zone: BELGRADE })).body);
    const otherAfter = accountsResponseSchema.parse((await get({ token: other.token, zone: BELGRADE })).body);
    expect(after).toEqual(before);
    expect(after.accounts.map((account) => account.id)).toEqual(ownIds);
    expect(otherAfter.totalBalance.cents).toBe(otherBefore.totalBalance.cents - 12_345);
    expect(otherAfter.accounts[0]!.balance.cents).toBe(otherBefore.accounts[0]!.balance.cents - 12_345);
    expect(otherAfter.accounts.map((account) => account.id)).toEqual(otherAccounts.map((account) => account.id));
  });

  it('ignores a userId in the query: the session decides', async () => {
    const other = await signUp(app);
    const otherId = (await userIdOf(db, other.user.email))!;
    const ownIds = (await financeRows(db, userId)).accounts.map((account) => account.id);

    const response = await request(app.getHttpServer())
      .get(`${accountsPath}?userId=${otherId}`)
      .set('Cookie', cookieFor(token))
      .set('X-Time-Zone', BELGRADE);

    expect(response.status).toBe(200);
    expect(accountsResponseSchema.parse(response.body).accounts.map((account) => account.id)).toEqual(ownIds);
  });

  it('has no route that takes a user', async () => {
    const other = await signUp(app);
    const otherId = (await userIdOf(db, other.user.email))!;

    const response = await request(app.getHttpServer())
      .get(`${accountsPath}/${otherId}`)
      .set('Cookie', cookieFor(token))
      .set('X-Time-Zone', BELGRADE);

    expect(response.status).toBe(404);
  });
});

const srcDir = resolve(import.meta.dirname, '../src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

// T7, AC7: the path exists once, in the contract (#74).
describe('accounts sources', () => {
  // A path string, or a route decorator with the path; the `accounts` table name is neither.
  const declaresPath = /['"`]\/accounts\b|@(Controller|Get|Post|Put|Patch|Delete)\(\s*['"`]\/?accounts\b/;

  it('never declares the accounts path outside the contract', () => {
    const files = sourceFiles(srcDir).map((file) => relative(srcDir, file).replaceAll('\\', '/'));
    const offenders = files.filter((file) => declaresPath.test(readFileSync(join(srcDir, file), 'utf8')));

    expect(files).toContain('accounts/accounts.controller.ts');
    expect(offenders).toEqual([]);
  });

  it.each(["@Get('/accounts')", "@Controller('accounts')", 'const path = `/accounts`;'])('flags %s', (code) => {
    expect(declaresPath.test(code)).toBe(true);
  });

  it.each(["@Entity({ name: 'accounts' })", "'SELECT * FROM accounts'", '@Get(accountsContract.list.path)'])(
    'allows %s',
    (code) => {
      expect(declaresPath.test(code)).toBe(false);
    },
  );
});
