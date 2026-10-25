import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// T13: formatting, amount input and chart rules never turn cents into a float (#11, AC12; task 006 T5).

const srcDir = join(import.meta.dirname, '..', 'src');
const checkedDirs = ['format', 'amount-input', 'chart'];

const floatMoney = [
  /\bparseFloat\b/, // parseFloat(...), Number.parseFloat(...)
  /\btoFixed\b/, // amount.toFixed(2)
  /\/\s*100\b/, // cents / 100
];

function floatMoneyUses(source: string): string[] {
  return source
    .split('\n')
    .filter((line) => floatMoney.some((pattern) => pattern.test(line)))
    .map((line) => line.trim());
}

function sourceFiles(dir: string): string[] {
  return readdirSync(join(srcDir, dir), { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.ts'))
    .map((file) => join(dir, file));
}

describe('integer-only money source', () => {
  const files = checkedDirs.flatMap(sourceFiles);

  it('finds the source files', () => {
    expect(files.length).toBeGreaterThanOrEqual(checkedDirs.length);
  });

  it.each(files)('%s never divides cents into a float', (file) => {
    expect(floatMoneyUses(readFileSync(join(srcDir, file), 'utf8'))).toEqual([]);
  });

  it.each([
    'const dollars = cents / 100;',
    'const dollars = cents/100;',
    'const dollars = cents / 100.0;',
    'return amount.toFixed(2);',
    'const amount = parseFloat(text);',
    'const amount = Number.parseFloat(text);',
  ])('flags %j', (line) => {
    expect(floatMoneyUses(line)).toEqual([line]);
  });

  it('passes integer digit work', () => {
    expect(floatMoneyUses("const digits = String(cents).padStart(3, '0');")).toEqual([]);
  });
});
