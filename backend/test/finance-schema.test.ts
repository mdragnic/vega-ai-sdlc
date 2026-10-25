import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { readConfig } from '../src/config/config.js';
import { databaseOptions } from '../src/database/database-options.js';

interface ColumnRow {
  name: string;
  type: string;
  notnull: number;
  pk: number;
}

const financeTables = ['accounts', 'transactions', 'bills', 'savings_goals', 'category_limits'];

// T2, T3: the finance tables, their keys, indexes and constraints (#11, #24, #56, #58, #79, #85).
describe('finance tables', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await new DataSource(
      databaseOptions({ ...readConfig({ NODE_ENV: 'test' }), databaseFile: ':memory:' }),
    ).initialize();
    await dataSource.runMigrations();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  const query = <T>(sql: string, parameters?: unknown[]): Promise<T[]> => dataSource.query(sql, parameters);

  const insert = (table: string, row: Record<string, unknown>) =>
    query(
      `INSERT INTO ${table} (${Object.keys(row).join(', ')}) VALUES (${Object.keys(row)
        .map(() => '?')
        .join(', ')})`,
      Object.values(row),
    );

  // SQLite reports some declared types in upper case (INTEGER, TEXT); compared in lower case.
  const columns = async (table: string) =>
    (await query<ColumnRow>(`PRAGMA table_info(${table})`)).map(({ name, type, notnull, pk }) => ({
      name,
      type: type.toLowerCase(),
      notnull,
      pk,
    }));

  async function indexes(table: string): Promise<{ columns: string[]; unique: boolean }[]> {
    const list = await query<{ name: string; unique: number; origin: string }>(`PRAGMA index_list(${table})`);
    return Promise.all(
      list
        .filter((index) => index.origin !== 'pk')
        .map(async (index) => ({
          columns: (await query<{ name: string }>(`PRAGMA index_info("${index.name}")`)).map((column) => column.name),
          unique: index.unique === 1,
        })),
    );
  }

  const foreignKeys = async (table: string) =>
    (
      await query<{ table: string; from: string; to: string; on_delete: string }>(`PRAGMA foreign_key_list(${table})`)
    ).map(({ table: target, from, to, on_delete }) => ({ table: target, from, to, on_delete }));

  describe('columns, keys and indexes', () => {
    it('gives accounts the raw account fields, the full number and the opening balance', async () => {
      expect(await columns('accounts')).toEqual([
        { name: 'id', type: 'integer', notnull: 1, pk: 1 },
        { name: 'user_id', type: 'integer', notnull: 1, pk: 0 },
        { name: 'account_type', type: 'varchar', notnull: 1, pk: 0 },
        { name: 'bank_name', type: 'text', notnull: 1, pk: 0 },
        { name: 'branch_name', type: 'text', notnull: 1, pk: 0 },
        { name: 'card_network', type: 'varchar', notnull: 0, pk: 0 },
        { name: 'account_number', type: 'text', notnull: 1, pk: 0 },
        { name: 'opening_balance_cents', type: 'integer', notnull: 1, pk: 0 },
      ]);
      expect(await indexes('accounts')).toEqual([{ columns: ['user_id'], unique: false }]);
      expect(await foreignKeys('accounts')).toEqual([
        { table: 'users', from: 'user_id', to: 'id', on_delete: 'CASCADE' },
      ]);
    });

    it('gives transactions an account, no user, and an index on account and time', async () => {
      expect(await columns('transactions')).toEqual([
        { name: 'id', type: 'integer', notnull: 1, pk: 1 },
        { name: 'account_id', type: 'integer', notnull: 1, pk: 0 },
        { name: 'occurred_at', type: 'datetime', notnull: 1, pk: 0 },
        { name: 'direction', type: 'varchar', notnull: 1, pk: 0 },
        { name: 'status', type: 'varchar', notnull: 1, pk: 0 },
        { name: 'category', type: 'varchar', notnull: 0, pk: 0 },
        { name: 'item', type: 'text', notnull: 1, pk: 0 },
        { name: 'shop_name', type: 'text', notnull: 1, pk: 0 },
        { name: 'receipt', type: 'text', notnull: 1, pk: 0 },
        { name: 'amount_cents', type: 'integer', notnull: 1, pk: 0 },
      ]);
      expect(await indexes('transactions')).toEqual([{ columns: ['account_id', 'occurred_at'], unique: false }]);
      expect(await foreignKeys('transactions')).toEqual([
        { table: 'accounts', from: 'account_id', to: 'id', on_delete: 'CASCADE' },
      ]);
    });

    it('gives bills plain dates, a logo key and no category', async () => {
      expect(await columns('bills')).toEqual([
        { name: 'id', type: 'integer', notnull: 1, pk: 1 },
        { name: 'user_id', type: 'integer', notnull: 1, pk: 0 },
        { name: 'title', type: 'text', notnull: 1, pk: 0 },
        { name: 'description', type: 'text', notnull: 1, pk: 0 },
        { name: 'logo', type: 'varchar', notnull: 1, pk: 0 },
        { name: 'due_date', type: 'date', notnull: 1, pk: 0 },
        { name: 'last_charge_date', type: 'date', notnull: 1, pk: 0 },
        { name: 'amount_cents', type: 'integer', notnull: 1, pk: 0 },
      ]);
      expect(await indexes('bills')).toEqual([{ columns: ['user_id', 'due_date'], unique: false }]);
      expect(await foreignKeys('bills')).toEqual([{ table: 'users', from: 'user_id', to: 'id', on_delete: 'CASCADE' }]);
    });

    it('gives savings goals a month, a target and a present amount, one per month', async () => {
      expect(await columns('savings_goals')).toEqual([
        { name: 'id', type: 'integer', notnull: 1, pk: 1 },
        { name: 'user_id', type: 'integer', notnull: 1, pk: 0 },
        { name: 'month', type: 'text', notnull: 1, pk: 0 },
        { name: 'target_cents', type: 'integer', notnull: 1, pk: 0 },
        { name: 'present_cents', type: 'integer', notnull: 1, pk: 0 },
      ]);
      expect(await indexes('savings_goals')).toEqual([{ columns: ['user_id', 'month'], unique: true }]);
      expect(await foreignKeys('savings_goals')).toEqual([
        { table: 'users', from: 'user_id', to: 'id', on_delete: 'CASCADE' },
      ]);
    });

    it('gives category limits one limit per category', async () => {
      expect(await columns('category_limits')).toEqual([
        { name: 'id', type: 'integer', notnull: 1, pk: 1 },
        { name: 'user_id', type: 'integer', notnull: 1, pk: 0 },
        { name: 'category', type: 'varchar', notnull: 1, pk: 0 },
        { name: 'limit_cents', type: 'integer', notnull: 1, pk: 0 },
      ]);
      expect(await indexes('category_limits')).toEqual([{ columns: ['user_id', 'category'], unique: true }]);
      expect(await foreignKeys('category_limits')).toEqual([
        { table: 'users', from: 'user_id', to: 'id', on_delete: 'CASCADE' },
      ]);
    });

    it('stores every money column as INTEGER NOT NULL', async () => {
      const money = [];
      for (const table of financeTables) {
        for (const column of await columns(table)) {
          if (column.name.endsWith('_cents')) money.push({ table, column: column.name, ...column });
        }
      }

      expect(money.map(({ table, column, type, notnull }) => `${table}.${column} ${type} ${notnull}`)).toEqual([
        'accounts.opening_balance_cents integer 1',
        'transactions.amount_cents integer 1',
        'bills.amount_cents integer 1',
        'savings_goals.target_cents integer 1',
        'savings_goals.present_cents integer 1',
        'category_limits.limit_cents integer 1',
      ]);
    });

    it('has no REAL, FLOAT, DOUBLE, DECIMAL or NUMERIC column in any table', async () => {
      const tables = await query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      );
      const types = [];
      for (const { name } of tables) {
        for (const column of await columns(name)) types.push(`${name}.${column.name} ${column.type}`);
      }

      expect(types.length).toBeGreaterThan(30);
      expect(types.filter((entry) => /real|floa|doub|dec|num/i.test(entry.split(' ')[1]!))).toEqual([]);
    });
  });

  describe('constraints', () => {
    let userId: number;
    let accountId: number;

    beforeEach(async () => {
      await query('DELETE FROM users');
      await query("INSERT INTO users (email, full_name, username) VALUES ('a@x.com', 'A', 'aaa')");
      [{ id: userId }] = (await query<{ id: number }>('SELECT id FROM users')) as [{ id: number }];
      await query(
        `INSERT INTO accounts (user_id, account_type, bank_name, branch_name, card_network, account_number, opening_balance_cents)
         VALUES (?, 'checking', 'AB Bank Ltd', 'Park Street Branch', 'visa', '6934566990127310', 2500000)`,
        [userId],
      );
      [{ id: accountId }] = (await query<{ id: number }>('SELECT id FROM accounts')) as [{ id: number }];
    });

    const validTransaction = (): Record<string, unknown> => ({
      account_id: accountId,
      occurred_at: '2026-10-22 12:00:00.000',
      direction: 'expense',
      status: 'complete',
      category: 'shopping',
      item: 'Jeans',
      shop_name: 'Denim House',
      receipt: 'Ab3dE5gH9jK',
      amount_cents: 26600,
    });
    const validAccount = (): Record<string, unknown> => ({
      user_id: userId,
      account_type: 'credit-card',
      bank_name: 'Master Card',
      branch_name: 'Main Branch',
      card_network: 'mastercard',
      account_number: '3388455688602598',
      opening_balance_cents: 2500000,
    });
    const validBill = (): Record<string, unknown> => ({
      user_id: userId,
      title: 'Figma - Yearly Plan',
      description: 'For advanced security',
      logo: 'figma',
      due_date: '2027-05-15',
      last_charge_date: '2026-05-14',
      amount_cents: 15000,
    });
    const validGoal = (): Record<string, unknown> => ({
      user_id: userId,
      month: '2026-10',
      target_cents: 2000000,
      present_cents: 1625000,
    });
    const validLimit = (): Record<string, unknown> => ({ user_id: userId, category: 'food', limit_cents: 25000 });

    const rows: Record<string, () => Record<string, unknown>> = {
      accounts: validAccount,
      transactions: validTransaction,
      bills: validBill,
      savings_goals: validGoal,
      category_limits: validLimit,
    };

    it.each(financeTables)('accepts a valid %s row', async (table) => {
      await expect(insert(table, rows[table]!())).resolves.toBeDefined();
    });

    it('accepts income without a category and an account without a card network', async () => {
      await insert('transactions', { ...validTransaction(), direction: 'income', category: null });
      await insert('accounts', { ...validAccount(), card_network: null });

      expect(await query('SELECT direction, category FROM transactions')).toEqual([
        { direction: 'income', category: null },
      ]);
    });

    it.each<[string, string, Record<string, unknown>]>([
      ['an expense without a category', 'transactions', { category: null }],
      ['income with a category', 'transactions', { direction: 'income' }],
      ['an unknown direction', 'transactions', { direction: 'transfer' }],
      ['an unknown status', 'transactions', { status: 'Complete' }],
      ['an unknown category', 'transactions', { category: 'bills' }],
      ['a negative amount', 'transactions', { amount_cents: -1 }],
      ['no amount', 'transactions', { amount_cents: null }],
      ['an unknown account', 'transactions', { account_id: 999_999 }],
      ['an unknown account type', 'accounts', { account_type: 'credit' }],
      ['an unknown card network', 'accounts', { card_network: 'amex' }],
      ['no opening balance', 'accounts', { opening_balance_cents: null }],
      ['an unknown user', 'accounts', { user_id: 999_999 }],
      ['an unknown logo', 'bills', { logo: 'netflix' }],
      ['a negative bill amount', 'bills', { amount_cents: -1 }],
      ['a target of 0', 'savings_goals', { target_cents: 0 }],
      ['a negative present amount', 'savings_goals', { present_cents: -1 }],
      ['a limit of 0', 'category_limits', { limit_cents: 0 }],
      ['an unknown limit category', 'category_limits', { category: 'bills' }],
    ])('rejects %s', async (_case, table, change) => {
      await expect(insert(table, { ...rows[table]!(), ...change })).rejects.toThrow(/constraint failed/i);
    });

    it('rejects a second goal for the same month', async () => {
      await insert('savings_goals', validGoal());

      await expect(insert('savings_goals', { ...validGoal(), target_cents: 100 })).rejects.toThrow(/UNIQUE/);
      await expect(insert('savings_goals', { ...validGoal(), month: '2026-11' })).resolves.toBeDefined();
    });

    it('rejects a second limit for the same category', async () => {
      await insert('category_limits', validLimit());

      await expect(insert('category_limits', { ...validLimit(), limit_cents: 100 })).rejects.toThrow(/UNIQUE/);
      await expect(insert('category_limits', { ...validLimit(), category: 'housing' })).resolves.toBeDefined();
    });
  });
});
