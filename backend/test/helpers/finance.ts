import type { DataSource } from 'typeorm';

/** The finance rows of one user, read with plain SQL in id order, without the app's code. */
export async function financeRows(db: DataSource, userId: number) {
  const accounts = await db.query<Record<string, unknown>[]>('SELECT * FROM accounts WHERE user_id = ? ORDER BY id', [
    userId,
  ]);
  const transactions = await db.query<Record<string, unknown>[]>(
    `SELECT t.* FROM transactions t JOIN accounts a ON a.id = t.account_id WHERE a.user_id = ? ORDER BY t.id`,
    [userId],
  );
  const bills = await db.query<Record<string, unknown>[]>('SELECT * FROM bills WHERE user_id = ? ORDER BY id', [
    userId,
  ]);
  const savingsGoals = await db.query<Record<string, unknown>[]>(
    'SELECT * FROM savings_goals WHERE user_id = ? ORDER BY id',
    [userId],
  );
  const categoryLimits = await db.query<Record<string, unknown>[]>(
    'SELECT * FROM category_limits WHERE user_id = ? ORDER BY id',
    [userId],
  );
  return { accounts, transactions, bills, savingsGoals, categoryLimits };
}

/** The ID of the user with this email, or undefined. */
export async function userIdOf(db: DataSource, email: string): Promise<number | undefined> {
  const [row] = await db.query<{ id: number }[]>('SELECT id FROM users WHERE email = ?', [email]);
  return row?.id;
}

/** Row counts of every table that sign up writes. */
export async function tableCounts(db: DataSource): Promise<Record<string, number>> {
  const tables = ['users', 'sessions', 'accounts', 'transactions', 'bills', 'savings_goals', 'category_limits'];
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const [{ count }] = await db.query<[{ count: number }]>(`SELECT COUNT(*) AS count FROM ${table}`);
    counts[table] = count;
  }
  return counts;
}
