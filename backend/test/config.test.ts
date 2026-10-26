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

// Task 012 T9: the Google OAuth client from GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or none (#75, #102).
describe('readConfig google', () => {
  const both = { GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'client-secret' };

  it('reads both variables, with the #75 redirect URI', () => {
    expect(readConfig({ NODE_ENV: 'development', ...both }).google).toEqual({
      clientId: 'client-id.apps.googleusercontent.com',
      clientSecret: 'client-secret',
      redirectUri: 'http://localhost:5173/api/auth/google/callback',
    });
  });

  it.each([
    ['the ID empty', { ...both, GOOGLE_CLIENT_ID: '' }],
    ['the secret empty', { ...both, GOOGLE_CLIENT_SECRET: '' }],
    ['the ID unset', { GOOGLE_CLIENT_SECRET: both.GOOGLE_CLIENT_SECRET }],
    ['the secret unset', { GOOGLE_CLIENT_ID: both.GOOGLE_CLIENT_ID }],
    ['neither', {}],
  ])('has no Google client with %s', (_case, env) => {
    expect(readConfig({ NODE_ENV: 'development', ...env }).google).toBeNull();
  });

  it('reads them with NODE_ENV=test too; the app then uses the fake regardless (auth-google.test.ts)', () => {
    expect(readConfig({ NODE_ENV: 'test', ...both }).google).not.toBeNull();
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

    expect([...read].toSorted()).toEqual(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'NODE_ENV', 'TEST_NOW']);
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
