import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { ensureDataDirs, readConfig } from '../src/config/config.js';

const dataDir = fileURLToPath(new URL('../data', import.meta.url));

// AC13: the SQLite files and uploads live in backend/data/.
describe('readConfig', () => {
  it('uses finebank.sqlite outside tests', () => {
    const config = readConfig({ NODE_ENV: 'development' });

    expect(config.nodeEnv).toBe('development');
    expect(config.databaseFile).toBe(join(dataDir, 'finebank.sqlite'));
    expect(config.uploadsDir).toBe(join(dataDir, 'uploads'));
  });

  it('uses finebank.test.sqlite with NODE_ENV=test', () => {
    const config = readConfig({ NODE_ENV: 'test' });

    expect(config.nodeEnv).toBe('test');
    expect(config.databaseFile).toBe(join(dataDir, 'finebank.test.sqlite'));
  });

  it('defaults to development when NODE_ENV is missing', () => {
    expect(readConfig({}).nodeEnv).toBe('development');
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => readConfig({ NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });
});

// AC13: the data folder is gitignored (base .gitignore kept) and .env.example lists every variable read.
describe('repo files for the backend', () => {
  const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

  it('ignores backend/data/ and keeps the base .gitignore entries', () => {
    const gitignore = readFileSync(join(repoRoot, '.gitignore'), 'utf8').split(/\r?\n/);

    expect(gitignore).toEqual(expect.arrayContaining(['backend/data/', '.env', '.env.*', '!.env.example']));
  });

  it('lists every environment variable the backend reads in backend/.env.example', () => {
    const srcDir = join(repoRoot, 'backend/src');
    const read = new Set(
      sourceFiles(srcDir).flatMap((file) =>
        [...readFileSync(file, 'utf8').matchAll(/\b(?:process\.)?env\.([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]!),
      ),
    );
    const listed = new Set(
      [...readFileSync(join(repoRoot, 'backend/.env.example'), 'utf8').matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(
        (m) => m[1]!,
      ),
    );

    expect([...read].toSorted()).toEqual(['NODE_ENV', 'TEST_NOW']);
    expect([...read].filter((name) => !listed.has(name))).toEqual([]);
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('ensureDataDirs', () => {
  let root: string;

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('creates the uploads folder when it is missing', () => {
    root = mkdtempSync(join(tmpdir(), 'finebank-'));
    const uploadsDir = join(root, 'data', 'uploads');

    ensureDataDirs({ ...readConfig({ NODE_ENV: 'test' }), uploadsDir });

    expect(existsSync(uploadsDir)).toBe(true);
  });
});
