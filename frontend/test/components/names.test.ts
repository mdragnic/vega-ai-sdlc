import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as components from '../../src/components';

const componentsMd = readFileSync(resolve(import.meta.dirname, '../../../docs/figma/components.md'), 'utf8');
const componentsDir = resolve(import.meta.dirname, '../../src/components');

const cells = (row: string) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');

/** Backticked names in every table column headed "Code name", including the Code-only table (#36). */
function codeNames(markdown: string): Set<string> {
  const names = new Set<string>();
  let columns: number[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.startsWith('|')) {
      columns = [];
      continue;
    }
    const row = cells(line);
    if (columns.length === 0) {
      columns = row.flatMap((cell, index) => (cell.trim() === 'Code name' ? [index] : []));
      continue;
    }
    for (const index of columns) {
      for (const match of (row[index] ?? '').matchAll(/`([A-Za-z0-9]+)`/g)) names.add(match[1]!);
    }
  }
  return names;
}

const unlisted = (exported: string[], listed: Set<string>) => exported.filter((name) => !listed.has(name));

// T15: every exported component has its code name in docs/figma/components.md (AC13, #36).
describe('component names', () => {
  it('lists every exported component in components.md', () => {
    expect(Object.keys(components).length).toBeGreaterThan(0);
    expect(unlisted(Object.keys(components), codeNames(componentsMd))).toEqual([]);
  });

  it('exports every component folder, so none escapes the check', () => {
    const folders = readdirSync(componentsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    expect(folders.filter((folder) => !(folder in components))).toEqual([]);
  });

  it('reads names from every Code name column and skips the other columns', () => {
    const markdown = [
      '| Component | Code name | Node ID |',
      '|-----------|-----------|---------|',
      '| Input | `Input` | `402:5191` |',
      '| Category icons | `Housing`, `Food` | see below |',
      '',
      '| Component | Code name | | Component | Code name |',
      '|-----------|-----------|-|-----------|-----------|',
      '| Clock | `Clock` | | x | `X24` |',
      '',
      '| Code name | Purpose | Decision |',
      '|-----------|---------|----------|',
      '| `FieldError` | Inline message under a field | #6 |',
    ].join('\r\n');

    expect([...codeNames(markdown)].toSorted()).toEqual(['Clock', 'FieldError', 'Food', 'Housing', 'Input', 'X24']);
  });

  it('reports a component that is not listed', () => {
    expect(unlisted(['Input', 'MadeUpWidget'], new Set(['Input']))).toEqual(['MadeUpWidget']);
  });
});
