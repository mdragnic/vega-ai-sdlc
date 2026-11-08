import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const srcDir = resolve(import.meta.dirname, '../../src');
const SHELL_STYLES = join(srcDir, 'app', 'AppShell.module.css');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(entry.name) ? [path] : [];
  });
}

/** Each rule of a stylesheet as its selector and its declarations, comments removed. */
function rules(css: string): { selector: string; body: string }[] {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...plain.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
    selector: selector!.trim(),
    body: body!.trim(),
  }));
}

// T4: AC4, task 032 item 1. Radix's scroll lock gives `body[data-scroll-locked]` a right margin while a popup or
// dropdown is open; app pages already keep the scrollbar's space (#100), so the margin is cancelled once, beside the
// stable gutter and under the same condition (#134 b). The e2e proof is e2e/tests/scroll-lock.spec.ts.
describe('the scroll lock on app pages', () => {
  const shell = rules(readFileSync(SHELL_STYLES, 'utf8'));

  it('keeps the stable gutter on app pages', () => {
    expect(shell).toContainEqual({ selector: ':global(html):has(.shell)', body: 'scrollbar-gutter: stable;' });
  });

  it('cancels the lock margin on app pages only, in one rule more specific than the library one', () => {
    expect(shell).toContainEqual({
      selector: ':global(html):has(.shell) :global(body[data-scroll-locked])',
      body: 'margin-right: 0 !important;',
    });
  });

  it('is handled nowhere else in the frontend: not in Popup, Dropdown, a page or a component', () => {
    const others = sourceFiles(srcDir)
      .filter((path) => path !== SHELL_STYLES)
      .filter((path) => readFileSync(path, 'utf8').includes('data-scroll-locked'))
      .map((path) => relative(srcDir, path));
    expect(others).toEqual([]);
  });
});
