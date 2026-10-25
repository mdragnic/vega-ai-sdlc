import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { generate, serialize } from '../scripts/generate-demo-data.js';

const backendRoot = resolve(import.meta.dirname, '..');
const committedFile = join(backendRoot, 'src/demo/demo-dataset.json');

// T4: the committed dataset is exactly what the generator makes from demo-data.md (#78, AC2).
describe('generate-demo-data', () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'finebank-demo-'));
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('regenerates the committed file byte for byte', () => {
    expect(Buffer.from(serialize(generate()), 'utf8').equals(readFileSync(committedFile))).toBe(true);
  });

  it('makes the same output on every run', () => {
    expect(serialize(generate())).toBe(serialize(generate()));
  });

  it('writes one record per line', () => {
    const lines = serialize(generate()).split('\n');

    // 5 sections of records plus their brackets, the outer braces and the final newline.
    expect(lines).toHaveLength(5 + 3411 + 14 + 84 + 6 + 5 * 2 + 2 + 1);
    expect(lines[1]).toBe('  "accounts": [');
    expect(JSON.parse(lines[2]!.replace(/,$/, ''))).toMatchObject({ accountType: 'credit-card' });
  });

  it('runs with Node’s type stripping and writes the file it is given', () => {
    const target = join(root, 'demo-dataset.json');

    const run = spawnSync(process.execPath, ['scripts/generate-demo-data.ts', target], {
      cwd: backendRoot,
      encoding: 'utf8',
    });

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(readFileSync(target).equals(readFileSync(committedFile))).toBe(true);
  });
});
