import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { ConflictException, type INestApplication } from '@nestjs/common';
import { goalMessages } from '@finebank/shared';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { GoalMonths } from '../src/goals/goal-months.js';
import { signUp } from './helpers/auth.js';
import { userIdOf } from './helpers/finance.js';
import { createTestApp } from './helpers/test-app.js';

const FIXED_NOW = '2026-10-22T10:00:00.000Z';
const BELGRADE = 'Europe/Belgrade';
const NEW_YORK = 'America/New_York';

// Task 026 T5, AC3 and AC11: the Goals months moved out of `SavingsGoalsService` into one provider both Goals reads use,
// behavior unchanged (#60, #123 a, b). Another user signs up first, so IDs never equal positions.
describe('GoalMonths', () => {
  let app: INestApplication;
  let clock: FixedClock;
  let months: GoalMonths;
  let userId: number;

  beforeAll(async () => {
    app = await createTestApp({ config: { nodeEnv: 'test', testNow: FIXED_NOW } });
    clock = app.get(FixedClock);
    months = app.get(GoalMonths);
    await signUp(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    clock.set(new Date(FIXED_NOW));
    userId = (await userIdOf(app.get(DataSource), (await signUp(app)).user.email))!;
  });

  it('gives the range from the current month in the zone back to the earliest (#123 a)', async () => {
    expect(await months.range(userId, BELGRADE)).toEqual({ current: '2026-10', earliest: '2022-01' });
  });

  it.each([
    [BELGRADE, '2026-11'],
    [NEW_YORK, '2026-10'],
  ])('at 2026-10-31T23:30:00Z in %s, the current month is %s', async (zone, current) => {
    clock.set(new Date('2026-10-31T23:30:00Z'));

    expect(await months.range(userId, zone)).toEqual({ current, earliest: '2022-01' });
  });

  it('gives the current month alone with no data up to today', async () => {
    clock.set(new Date('2021-12-31T10:00:00Z'));

    expect(await months.range(userId, BELGRADE)).toEqual({ current: '2021-12', earliest: '2021-12' });
  });

  it.each(['2026-10', '2022-01', '2024-02'])('lets %s through', async (month) => {
    await expect(months.check(userId, BELGRADE, month)).resolves.toBeUndefined();
  });

  it.each(['2026-11', '2021-12', '2027-05'])('answers 409 monthUnavailable for %s (#123 b)', async (month) => {
    const check = months.check(userId, BELGRADE, month);

    await expect(check).rejects.toThrow(ConflictException);
    await expect(check).rejects.toThrow(goalMessages.monthUnavailable);
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

// T5: one month range for both reads, never a copy (#60: one list).
describe('the Goals months’ sources', () => {
  const files = sourceFiles(srcDir).map((file) => relative(srcDir, file).replaceAll('\\', '/'));
  const read = (file: string) => readFileSync(join(srcDir, file), 'utf8');

  it('reads the earliest transaction for the range only in goals/goal-months.ts', () => {
    expect(files.filter((file) => file.startsWith('goals/') && read(file).includes('earliestOccurredAt'))).toEqual([
      'goals/goal-months.ts',
    ]);
  });

  it.each(['goals/savings-goals.service.ts', 'goals/saving-summary.service.ts'])(
    '%s takes the range and the check from GoalMonths',
    (file) => {
      expect(read(file)).toMatch(/private readonly \w+: GoalMonths/);
      expect(read(file)).toMatch(/\.check\(userId, timeZone, month\)/);
    },
  );
});
