// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { build } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';

const frontendDir = resolve(import.meta.dirname, '../..');
// The gallery heading, the popup page's open button, both route paths and a chart sample: all are in the dev pages
// only. Then the e2e scroll fixture's text and its paths (task 023): in a development build with VITE_E2E_FIXTURES only.
const markers = [
  'Component gallery',
  '/dev/components',
  'Open two-field popup',
  '/dev/popup',
  'Expenses sample, like 109',
  'Scroll fixture page',
  '/test/scroll/a',
  '/test/scroll/b',
];
const outDirs: string[] = [];

/**
 * Builds the app like `vite build` with the given NODE_ENV and `VITE_E2E_FIXTURES=true` (as Playwright's frontend web
 * server sets it), and returns the markers found in the output.
 */
async function markersInBuild(nodeEnv: 'production' | 'development'): Promise<string[]> {
  const outDir = mkdtempSync(join(tmpdir(), 'finebank-build-'));
  outDirs.push(outDir);
  const previous = { nodeEnv: process.env.NODE_ENV, fixtures: process.env.VITE_E2E_FIXTURES };
  process.env.NODE_ENV = nodeEnv;
  process.env.VITE_E2E_FIXTURES = 'true';
  try {
    await build({
      root: frontendDir,
      configFile: resolve(frontendDir, 'vite.config.ts'),
      logLevel: 'silent',
      build: { outDir, emptyOutDir: true },
    });
  } finally {
    process.env.NODE_ENV = previous.nodeEnv;
    if (previous.fixtures === undefined) delete process.env.VITE_E2E_FIXTURES;
    else process.env.VITE_E2E_FIXTURES = previous.fixtures;
  }
  const files = readdirSync(outDir, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile());
  const text = files.map((entry) => readFileSync(join(entry.parentPath, entry.name), 'utf8')).join('\n');
  return markers.filter((marker) => text.includes(marker));
}

afterAll(() => {
  for (const dir of outDirs) rmSync(dir, { recursive: true, force: true });
});

// T14 (task 002), T20 (task 005), T19 (task 006), T23 (task 023): the production build contains no dev page code and
// no e2e fixture, even with VITE_E2E_FIXTURES set.
describe('production build', () => {
  it('contains no gallery code and no scroll fixture', async () => {
    expect(await markersInBuild('production')).toEqual([]);
  }, 120_000);

  // Control: the same search finds the gallery and the fixture when the build keeps development code.
  it('finds the gallery and the scroll fixture in a development build with VITE_E2E_FIXTURES', async () => {
    expect(await markersInBuild('development')).toEqual(markers);
  }, 120_000);
});
