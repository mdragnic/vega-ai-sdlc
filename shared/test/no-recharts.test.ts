import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// Task 031 T9 (AC6): `recharts` is removed. No chart uses it: the charts are hand-drawn SVG (task 006, task 026).
// It lives in shared because it covers every workspace and the repo has no root test folder.

/** A package.json's dependency sections, each a map of package names to versions. */
type Manifest = Partial<Record<(typeof sections)[number], Record<string, string>>>;
type Lockfile = { packages: Record<string, { dependencies?: Record<string, string> } & Record<string, unknown>> };

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const thisFile = relative(repoRoot, fileURLToPath(import.meta.url)).replaceAll('\\', '/');
const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const;
const workspaces = ['shared', 'backend', 'frontend', 'e2e'] as const;
/** Folders that hold no source: installed, built or generated files. */
const skipped = new Set([
  'node_modules',
  'dist',
  'test-results',
  'playwright-report',
  'blob-report',
  'coverage',
  'data',
]);

const readJson = (path: string): unknown => JSON.parse(readFileSync(join(repoRoot, path), 'utf8'));

/** An import of the package or one of its paths: static, dynamic, `require` or a type import. */
const importsRecharts =
  /\bfrom\s+['"]recharts(\/[^'"]*)?['"]|\bimport\s*\(\s*['"]recharts|\brequire\s*\(\s*['"]recharts|^\s*import\s+['"]recharts/m;

function sourceFiles(dir: string): string[] {
  return readdirSync(join(repoRoot, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return skipped.has(entry.name) ? [] : sourceFiles(path);
    return /\.(ts|tsx|js|mjs|cjs)$/.test(entry.name) ? [path] : [];
  });
}

describe('recharts removed', () => {
  it.each(['.', ...workspaces])('%s/package.json does not depend on it', (dir) => {
    const manifest = readJson(`${dir}/package.json`) as Manifest;

    expect(sections.filter((section) => 'recharts' in (manifest[section] ?? {}))).toEqual([]);
  });

  it('has no entry in package-lock.json and no package there depends on it', () => {
    const { packages } = readJson('package-lock.json') as Lockfile;

    expect(Object.keys(packages).filter((path) => /(^|\/)node_modules\/recharts$/.test(path))).toEqual([]);
    expect(Object.keys(packages).filter((path) => 'recharts' in (packages[path]!.dependencies ?? {}))).toEqual([]);
  });

  it('is imported by no source or test file in the four workspaces', () => {
    const files = workspaces.flatMap((dir) => sourceFiles(dir)).filter((file) => file !== thisFile);

    expect(files.length).toBeGreaterThan(300);
    expect(files.filter((file) => importsRecharts.test(readFileSync(join(repoRoot, file), 'utf8')))).toEqual([]);
  });

  it.each([
    ["import { LineChart } from 'recharts';", true],
    ['import type { TooltipProps } from "recharts/types/component/Tooltip";', true],
    ["const charts = await import('recharts');", true],
    ["const { BarChart } = require('recharts');", true],
    ["import 'recharts';", true],
    ['// the charts are hand-drawn, not recharts', false],
    ["import { ComparisonBarChart } from './charts';", false],
  ])('the import check on %s: %s', (code, flagged) => {
    expect(importsRecharts.test(code)).toBe(flagged);
  });
});
