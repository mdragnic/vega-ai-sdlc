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

// Task 031 T11 (AC7): every package an `.mcp.json` server runs through `npx` is named with an exact version, so a
// developer tool cannot change under the project between sessions (`@playwright/mcp@latest` did).

type McpConfig = { mcpServers?: Record<string, { command?: string; args?: string[] }> };

/** The package each `npx` server runs: the first argument after `npx` that is not a flag. */
function npxPackages(config: McpConfig): { server: string; spec: string }[] {
  return Object.entries(config.mcpServers ?? {}).flatMap(([server, { command, args = [] }]) => {
    const argv = [command ?? '', ...args];
    const npx = argv.findIndex((arg) => /(^|[\\/])npx(\.cmd)?$/i.test(arg));
    const spec = npx === -1 ? undefined : argv.slice(npx + 1).find((arg) => !arg.startsWith('-'));
    return spec === undefined ? [] : [{ server, spec }];
  });
}

/** The specs whose version is missing or not exact: `@scope/name@1.2.3` and `name@1.2.3` pass. */
function unpinnedPackages(config: McpConfig): string[] {
  return npxPackages(config)
    .filter(({ spec }) => {
      const at = spec.indexOf('@', spec.startsWith('@') ? 1 : 0);
      return at === -1 || !exactVersion.test(spec.slice(at + 1));
    })
    .map(({ server, spec }) => `${server}: ${spec}`);
}

const mcpConfig = JSON.parse(readFileSync(join(repoRoot, '.mcp.json'), 'utf8')) as McpConfig;

/** A server run as `.mcp.json` runs the Playwright one on Windows. */
const npxServer = (spec: string) => ({ command: 'cmd', args: ['/c', 'npx', '-y', spec] });

describe('exact versions in .mcp.json', () => {
  it('finds the npx servers', () => {
    expect(npxPackages(mcpConfig).map(({ server }) => server)).toEqual(['playwright']);
  });

  it('runs every npx package at an exact version', () => {
    expect(unpinnedPackages(mcpConfig)).toEqual([]);
  });

  it('flags @latest, a range and a bare package name, and passes an exact version', () => {
    const config: McpConfig = {
      mcpServers: {
        latest: npxServer('@playwright/mcp@latest'),
        range: npxServer('@playwright/mcp@^0.0.84'),
        bare: npxServer('@playwright/mcp'),
        unscoped: { command: 'npx', args: ['some-tool'] },
        exact: npxServer('@playwright/mcp@0.0.84'),
        http: {},
      },
    };

    expect(unpinnedPackages(config)).toEqual([
      'latest: @playwright/mcp@latest',
      'range: @playwright/mcp@^0.0.84',
      'bare: @playwright/mcp',
      'unscoped: some-tool',
    ]);
  });
});
