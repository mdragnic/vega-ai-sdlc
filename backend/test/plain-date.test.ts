import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { addDays, addMonths, mondayOf, startOfMonth } from '../src/common/time-zone/plain-date.js';

// Task 024 T4, AC5, AC18: the backend's plain-date helpers in one module (task 017 review), used by the Statistics
// and the Expenses services. Plain dates and months have no zone, so their arithmetic is exact; only a month's first
// instant needs the zone (#54), DST-safe through `startOfDay`.
describe('addDays', () => {
  it.each([
    ['2026-10-22', 1, '2026-10-23'],
    ['2026-10-31', 1, '2026-11-01'],
    ['2026-11-01', -1, '2026-10-31'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2027-01-01', -1, '2026-12-31'],
    ['2026-10-19', -7, '2026-10-12'],
    ['2026-10-19', 7, '2026-10-26'],
    ['2024-02-28', 1, '2024-02-29'],
    ['2026-02-28', 1, '2026-03-01'],
    ['2026-10-25', 0, '2026-10-25'],
  ])('%s plus %i days is %s', (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected);
  });
});

describe('mondayOf', () => {
  it.each([
    ['2026-10-19', '2026-10-19'],
    ['2026-10-20', '2026-10-19'],
    ['2026-10-21', '2026-10-19'],
    ['2026-10-22', '2026-10-19'],
    ['2026-10-23', '2026-10-19'],
    ['2026-10-24', '2026-10-19'],
    ['2026-10-25', '2026-10-19'],
    ['2026-10-26', '2026-10-26'],
    // A week across the end of a year.
    ['2027-01-01', '2026-12-28'],
  ])('the Monday of %s is %s', (date, expected) => {
    expect(mondayOf(date)).toBe(expected);
  });
});

describe('addMonths', () => {
  it.each([
    ['2026-10', 1, '2026-11'],
    ['2026-10', -1, '2026-09'],
    ['2026-12', 1, '2027-01'],
    ['2026-01', -1, '2025-12'],
    ['2026-01', 12, '2027-01'],
    ['2026-01', -12, '2025-01'],
    ['2026-12', -12, '2025-12'],
    ['2026-03', 11, '2027-02'],
    ['2026-10', 0, '2026-10'],
  ])('%s plus %i months is %s', (month, months, expected) => {
    expect(addMonths(month, months)).toBe(expected);
  });
});

describe('startOfMonth', () => {
  it.each([
    // Belgrade is on summer time on 1 Oct (UTC+2) and leaves it on 25 Oct: 1 Nov starts at 00:00 CET (UTC+1).
    ['2026-10', 'Europe/Belgrade', '2026-09-30T22:00:00.000Z'],
    ['2026-11', 'Europe/Belgrade', '2026-10-31T23:00:00.000Z'],
    ['2027-01', 'Europe/Belgrade', '2026-12-31T23:00:00.000Z'],
    // New York leaves summer time on 1 Nov at 02:00: that day still starts at 00:00 EDT (UTC-4).
    ['2026-10', 'America/New_York', '2026-10-01T04:00:00.000Z'],
    ['2026-11', 'America/New_York', '2026-11-01T04:00:00.000Z'],
    ['2026-12', 'America/New_York', '2026-12-01T05:00:00.000Z'],
    ['2027-01', 'America/New_York', '2027-01-01T05:00:00.000Z'],
  ])('starts %s in %s at %s', (month, timeZone, expected) => {
    expect(startOfMonth(month, timeZone).toISOString()).toBe(expected);
  });

  it('gives Belgrade’s October, with its DST change, 745 hours', () => {
    const hours =
      (startOfMonth('2026-11', 'Europe/Belgrade').getTime() - startOfMonth('2026-10', 'Europe/Belgrade').getTime()) /
      3_600_000;

    expect(hours).toBe(745);
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

// T12, AC18: one module, no private copies left in the services.
describe('the plain-date helpers’ sources', () => {
  const declares = /\b(const|let|function)\s+(addDays|mondayOf|addMonths|startOfMonth)\b/;
  const files = sourceFiles(srcDir).map((file) => relative(srcDir, file).replaceAll('\\', '/'));

  it('declares addDays, mondayOf, addMonths and startOfMonth only in common/time-zone/plain-date.ts', () => {
    const declaring = files.filter((file) => declares.test(readFileSync(join(srcDir, file), 'utf8')));

    expect(declaring).toEqual(['common/time-zone/plain-date.ts']);
  });

  it.each(['statistics/statistics.service.ts', 'expenses/expenses.service.ts', 'goals/savings-goals.service.ts'])(
    '%s imports them',
    (file) => {
      expect(readFileSync(join(srcDir, file), 'utf8')).toMatch(/from '\.\.\/common\/time-zone\/plain-date\.js'/);
    },
  );

  // Task 025 T12, AC18: the month of an instant only through `monthIn` (task 014 review, task 024).
  const monthOfToday = /todayIn\([^;]*\)\s*\.slice\(\s*0\s*,\s*7\s*\)/;

  it('reads the month of an instant only through monthIn, declared in plain-date.ts alone', () => {
    const declaring = files.filter((file) =>
      /\b(const|let|function)\s+(monthIn|currentMonthIn)\b/.test(readFileSync(join(srcDir, file), 'utf8')),
    );
    const slicing = files.filter(
      (file) =>
        file !== 'common/time-zone/plain-date.ts' && monthOfToday.test(readFileSync(join(srcDir, file), 'utf8')),
    );

    expect(declaring).toEqual(['common/time-zone/plain-date.ts']);
    expect(slicing).toEqual([]);
  });

  it.each(['todayIn(this.clock.now(), timeZone).slice(0, 7)', 'todayIn(transaction.occurredAt, zone).slice(0,7)'])(
    'flags %s',
    (code) => {
      expect(monthOfToday.test(code)).toBe(true);
    },
  );
});
