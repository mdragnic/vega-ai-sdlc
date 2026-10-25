import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { readConfig } from '../src/config/config.js';
import { DEMO_DATASET, demoDatasetSchema, loadDemoDataset } from '../src/demo/demo-dataset.js';

const committedFile = resolve(import.meta.dirname, '../src/demo/demo-dataset.json');

/** A fresh copy of the committed JSON, to break one field at a time. */
const copy = (): { transactions: Record<string, unknown>[] } & Record<string, unknown> =>
  JSON.parse(readFileSync(committedFile, 'utf8')) as { transactions: Record<string, unknown>[] };

/** The paths of the issues a broken copy gives. */
function issuePaths(data: unknown): string[] {
  const result = demoDatasetSchema.safeParse(data);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

// T6: the dataset schema and the loader (#11, #74, #78, AC3, AC6).
describe('demo dataset schema', () => {
  it('accepts the committed file and gives instants as dates', () => {
    const parsed = demoDatasetSchema.parse(copy());

    expect(parsed.transactions[0]!.occurredAt).toEqual(new Date('2022-01-01T12:00:00.000Z'));
  });

  it.each<[string, (data: ReturnType<typeof copy>) => void, string]>([
    ['a float amount', (d) => (d.transactions[5]!.amountCents = 12.5), 'transactions.5.amountCents'],
    ['a negative amount', (d) => (d.transactions[5]!.amountCents = -1), 'transactions.5.amountCents'],
    [
      'a time other than 12:00 UTC',
      (d) => (d.transactions[7]!.occurredAt = '2022-01-03T11:00:00.000Z'),
      'transactions.7.occurredAt',
    ],
    ['an unknown category', (d) => (d.transactions[1]!.category = 'bills'), 'transactions.1.category'],
    ['a missing field', (d) => delete d.transactions[2]!.receipt, 'transactions.2.receipt'],
    ['an unknown field', (d) => (d.transactions[2]!.userId = 7), 'transactions.2'],
    ['a short receipt', (d) => (d.transactions[3]!.receipt = 'AB12'), 'transactions.3.receipt'],
    ['an account index out of range', (d) => (d.transactions[4]!.accountIndex = 5), 'transactions.4.accountIndex'],
    ['an expense without a category', (d) => (d.transactions[1]!.category = null), 'transactions.1.category'],
    ['income with a category', (d) => (d.transactions[0]!.category = 'food'), 'transactions.0.category'],
    [
      'an account number with spaces',
      (d) => ((d.accounts as Record<string, unknown>[])[0]!.accountNumber = '3388 4556 8860 2598'),
      'accounts.0.accountNumber',
    ],
    [
      'a due date with a time',
      (d) => ((d.bills as Record<string, unknown>[])[0]!.dueDate = '2022-05-15T00:00:00Z'),
      'bills.0.dueDate',
    ],
    [
      'a month 13',
      (d) => ((d.savingsGoals as Record<string, unknown>[])[0]!.month = '2022-13'),
      'savingsGoals.0.month',
    ],
    [
      'a target of 0',
      (d) => ((d.savingsGoals as Record<string, unknown>[])[0]!.targetCents = 0),
      'savingsGoals.0.targetCents',
    ],
  ])('rejects %s with the field’s path', (_case, breakIt, path) => {
    const data = copy();
    breakIt(data);

    expect(issuePaths(data)).toEqual([path]);
  });
});

describe('loadDemoDataset', () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'finebank-demo-'));
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  function brokenFile(): string {
    const data = copy();
    data.transactions[5]!.amountCents = 12.5;
    const file = join(root, 'broken.json');
    writeFileSync(file, JSON.stringify(data));
    return file;
  }

  it('reads the committed file by default', () => {
    expect(loadDemoDataset().transactions).toHaveLength(3411);
  });

  it('stops with an error that names the file and the field', () => {
    const file = brokenFile();

    expect(() => loadDemoDataset(file)).toThrow(/demo dataset.*broken\.json[\s\S]*transactions\.5\.amountCents/);
  });

  it('stops with an error on a file that is not JSON', () => {
    const file = join(root, 'not-json.json');
    writeFileSync(file, '{"accounts": [');

    expect(() => loadDemoDataset(file)).toThrow(/demo dataset.*not-json\.json/);
  });

  it('keeps the app from starting with a broken file', async () => {
    const file = brokenFile();
    const config = { ...readConfig({ NODE_ENV: 'test' }), databaseFile: ':memory:' };

    const compiling = Test.createTestingModule({ imports: [AppModule.forRoot(config)] })
      .overrideProvider(DEMO_DATASET)
      .useFactory({ factory: () => loadDemoDataset(file) })
      .compile();

    await expect(compiling).rejects.toThrow(/transactions\.5\.amountCents/);
  });
});
