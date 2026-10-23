// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { build } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';

const frontendDir = resolve(import.meta.dirname, '../..');
// The gallery heading and its route path: both are in the gallery code, nowhere else.
const markers = ['Component gallery', '/dev/components'];
const outDirs: string[] = [];

/** Builds the app like `vite build` with the given NODE_ENV, and returns the markers found in the output. */
async function markersInBuild(nodeEnv: 'production' | 'development'): Promise<string[]> {
  const outDir = mkdtempSync(join(tmpdir(), 'finebank-build-'));
  outDirs.push(outDir);
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  try {
    await build({
      root: frontendDir,
      configFile: resolve(frontendDir, 'vite.config.ts'),
      logLevel: 'silent',
      build: { outDir, emptyOutDir: true },
    });
  } finally {
    process.env.NODE_ENV = previous;
  }
  const files = readdirSync(outDir, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile());
  const text = files.map((entry) => readFileSync(join(entry.parentPath, entry.name), 'utf8')).join('\n');
  return markers.filter((marker) => text.includes(marker));
}

afterAll(() => {
  for (const dir of outDirs) rmSync(dir, { recursive: true, force: true });
});

// T14: the production build contains no gallery code (AC12).
describe('production build', () => {
  it('contains no gallery code', async () => {
    expect(await markersInBuild('production')).toEqual([]);
  }, 120_000);

  // Control: the same search finds the gallery when the build keeps development code.
  it('finds the gallery in a development build', async () => {
    expect(await markersInBuild('development')).toEqual(markers);
  }, 120_000);
});
