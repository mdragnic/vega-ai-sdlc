import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// T1: every dependency in every package.json is pinned to an exact version (AC1).
// It lives in shared because it covers every workspace and the repo has no root test folder.

type Manifest = Record<string, unknown> & { workspaces?: string[] };

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const;
const exactVersion = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

function readManifest(dir: string): Manifest {
  return JSON.parse(readFileSync(join(repoRoot, dir, 'package.json'), 'utf8')) as Manifest;
}

function inexactVersions(manifest: Manifest): string[] {
  return sections.flatMap((section) =>
    Object.entries((manifest[section] ?? {}) as Record<string, string>)
      .filter(([, version]) => !exactVersion.test(version))
      .map(([name, version]) => `${section}.${name}: ${version}`),
  );
}

const root = readManifest('.');
const manifestDirs = ['.', ...(root.workspaces ?? [])];

describe('exact versions', () => {
  it('finds every workspace', () => {
    expect(manifestDirs).toEqual(['.', 'shared', 'backend', 'frontend', 'e2e']);
  });

  it.each(manifestDirs)('%s/package.json pins every dependency exactly', (dir) => {
    expect(inexactVersions(readManifest(dir))).toEqual([]);
  });

  it('flags ranges and tags', () => {
    const manifest = {
      dependencies: { a: '^1.0.0', b: '~1.0.0', c: '*', d: '>1.0.0', e: 'latest', f: '1.0.0' },
    };

    expect(inexactVersions(manifest)).toEqual([
      'dependencies.a: ^1.0.0',
      'dependencies.b: ~1.0.0',
      'dependencies.c: *',
      'dependencies.d: >1.0.0',
      'dependencies.e: latest',
    ]);
  });
});
