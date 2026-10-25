import type { INestApplication } from '@nestjs/common';
import { currentUserSchema } from '@finebank/shared';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { type DemoDataset, loadDemoDataset } from '../src/demo/demo-dataset.js';
import { login, me, newUser, setCookies, signUp } from './helpers/auth.js';
import { CapturingLogger } from './helpers/capturing-logger.js';
import { financeRows, tableCounts, userIdOf } from './helpers/finance.js';
import { createTestApp } from './helpers/test-app.js';

/** A dataset instant as SQLite stores a UTC datetime: `2022-01-01 12:00:00.000`. */
const stored = (instant: Date): string => instant.toISOString().replace('T', ' ').replace('Z', '');

let dataset: DemoDataset;

beforeAll(() => {
  // The committed file, read by the test itself: the expected rows of every seeded user.
  dataset = loadDemoDataset();
});

/** A user's rows in the dataset's shape, with account IDs turned back into indexes. */
async function seededData(db: DataSource, userId: number) {
  const rows = await financeRows(db, userId);
  const accountIds = rows.accounts.map((account) => account.id as number);
  return {
    accountIds,
    accounts: rows.accounts.map((a) => ({
      accountType: a.account_type,
      bankName: a.bank_name,
      branchName: a.branch_name,
      cardNetwork: a.card_network,
      accountNumber: a.account_number,
      openingBalanceCents: a.opening_balance_cents,
    })),
    transactions: rows.transactions.map((t) => ({
      accountIndex: accountIds.indexOf(t.account_id as number),
      occurredAt: t.occurred_at,
      direction: t.direction,
      status: t.status,
      category: t.category,
      item: t.item,
      shopName: t.shop_name,
      receipt: t.receipt,
      amountCents: t.amount_cents,
    })),
    bills: rows.bills.map((b) => ({
      title: b.title,
      description: b.description,
      logo: b.logo,
      dueDate: b.due_date,
      lastChargeDate: b.last_charge_date,
      amountCents: b.amount_cents,
    })),
    savingsGoals: rows.savingsGoals.map((g) => ({
      month: g.month,
      targetCents: g.target_cents,
      presentCents: g.present_cents,
    })),
    categoryLimits: rows.categoryLimits.map((l) => ({ category: l.category, limitCents: l.limit_cents })),
  };
}

const expected = () => ({
  ...dataset,
  transactions: dataset.transactions.map((t) => ({ ...t, occurredAt: stored(t.occurredAt) })),
});

describe('sign up with the demo dataset', () => {
  let app: INestApplication;
  let db: DataSource;

  beforeEach(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
  });

  afterEach(async () => {
    await app.close();
  });

  // T7: AC4.
  it('still answers 201 with the user, who owns a copy of the whole dataset', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({ fullName: 'Tanzir Rahman', email: 'tanzir@example.com', password: 'abcdef12' });

    expect(response.status).toBe(201);
    expect(currentUserSchema.strict().parse(response.body)).toEqual({
      fullName: 'Tanzir Rahman',
      email: 'tanzir@example.com',
      username: 'tanzir',
    });
    const { accountIds, ...data } = await seededData(db, (await userIdOf(db, 'tanzir@example.com'))!);
    expect(accountIds).toEqual(accountIds.toSorted((a, b) => a - b));
    expect(data.accounts).toHaveLength(5);
    expect(data.transactions).toHaveLength(3411);
    expect(data).toEqual(expected());
  });

  it('gives a second user a separate copy with equal values', async () => {
    const first = await signUp(app);
    const second = await signUp(app);

    const a = await seededData(db, (await userIdOf(db, first.user.email))!);
    const b = await seededData(db, (await userIdOf(db, second.user.email))!);
    expect(a.accountIds.filter((id) => b.accountIds.includes(id))).toEqual([]);
    const { accountIds: _a, ...valuesA } = a;
    const { accountIds: _b, ...valuesB } = b;
    expect(valuesB).toEqual(valuesA);
    expect(valuesB).toEqual(expected());
    expect((await tableCounts(db)).transactions).toBe(2 * 3411);
  });

  // T17: AC14.
  it('deletes a user’s accounts, transactions, bills, goals and limits with the user', async () => {
    const gone = await signUp(app);
    const kept = await signUp(app);
    const goneId = (await userIdOf(db, gone.user.email))!;
    const keptId = (await userIdOf(db, kept.user.email))!;

    await db.query('DELETE FROM users WHERE id = ?', [goneId]);

    const left = await financeRows(db, goneId);
    expect(Object.values(left).map((rows) => rows.length)).toEqual([0, 0, 0, 0, 0]);
    expect(await tableCounts(db)).toEqual({
      users: 1,
      sessions: 1,
      accounts: 5,
      transactions: 3411,
      bills: 14,
      savings_goals: 84,
      category_limits: 6,
    });
    expect((await seededData(db, keptId)).transactions).toHaveLength(3411);
  });

  // T10: AC6, the task 007 note on the shared connection.
  it('seeds 3 concurrent sign ups next to a me request, each user with only their own rows', async () => {
    const existing = await signUp(app);
    const fields = [newUser(), newUser(), newUser()];
    const server = app.getHttpServer();

    const [meResponse, ...signups] = await Promise.all([
      me(app, existing.token),
      ...fields.map((body) => request(server).post('/api/auth/signup').send(body)),
    ]);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body).toMatchObject({ email: existing.user.email });
    expect(signups.map((response) => response.status)).toEqual([201, 201, 201]);
    for (const body of fields) {
      const { accountIds, ...data } = await seededData(db, (await userIdOf(db, body.email))!);
      expect(accountIds).toHaveLength(5);
      // Every row of the dataset once, on the user's own accounts in the dataset's order.
      expect(data).toEqual(expected());
    }
    expect((await tableCounts(db)).transactions).toBe(4 * 3411);
  });
});

// T8, T16: a failed seeding keeps nothing, and full account numbers never leave the backend (AC5, AC12).
describe('sign up when the seeding fails', () => {
  let app: INestApplication;
  let db: DataSource;
  let logger: CapturingLogger;
  const fields = { fullName: 'Failing Person', email: 'failing@example.com', password: 'abcdef12' };

  beforeEach(async () => {
    logger = new CapturingLogger();
    app = await createTestApp({ logger });
    db = app.get(DataSource);
  });

  afterEach(async () => {
    await app.close();
  });

  /** Values of seeded rows that must never reach a log line. */
  const rowValues = () => [
    ...dataset.accounts.map((account) => account.accountNumber),
    'Figma - Yearly Plan',
    'Park View Apartments',
    'Professional plan',
    dataset.transactions[0]!.receipt,
    '8C52d5DKDJ5',
    fields.email,
  ];

  it.each([
    [
      'the 14th bill',
      `CREATE TRIGGER fail_seed BEFORE INSERT ON bills
       WHEN (SELECT COUNT(*) FROM bills WHERE user_id = NEW.user_id) = 13
       BEGIN SELECT RAISE(ABORT, 'disk on fire'); END`,
    ],
    [
      'the first transaction batch',
      "CREATE TRIGGER fail_seed BEFORE INSERT ON transactions BEGIN SELECT RAISE(ABORT, 'disk on fire'); END",
    ],
  ])('keeps no user, session or row when %s is rejected', async (_case, trigger) => {
    await db.query(trigger);

    const response = await request(app.getHttpServer()).post('/api/auth/signup').send(fields);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Internal server error' });
    expect(setCookies(response)).toEqual([]);
    expect(await tableCounts(db)).toEqual({
      users: 0,
      sessions: 0,
      accounts: 0,
      transactions: 0,
      bills: 0,
      savings_goals: 0,
      category_limits: 0,
    });
    const output = logger.lines.join('\n');
    expect(output).toContain('disk on fire');
    for (const value of rowValues()) {
      expect(output).not.toContain(value);
    }
  });

  it('never returns a full account number from sign up, login or me, nor logs one', async () => {
    const server = app.getHttpServer();
    const signup = await request(server).post('/api/auth/signup').send(fields);
    const loggedIn = await login(app, { email: fields.email, password: fields.password });
    const token = setCookies(loggedIn)[0]!.value;
    const bodies = [signup.text, loggedIn.text, (await me(app, token)).text];

    expect(signup.status).toBe(201);
    expect((await tableCounts(db)).accounts).toBe(5);
    const output = [...bodies, ...logger.lines].join('\n');
    for (const { accountNumber } of dataset.accounts) {
      expect(output).not.toContain(accountNumber);
    }
  });
});
