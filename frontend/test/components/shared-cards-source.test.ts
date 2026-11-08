import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as components from '../../src/components';

const componentsDir = resolve(import.meta.dirname, '../../src/components');
const source = (path: string) => readFileSync(resolve(componentsDir, path), 'utf8');
const componentsMd = readFileSync(resolve(import.meta.dirname, '../../../docs/figma/components.md'), 'utf8');

/** Every module a file imports from, in order. */
const imports = (text: string) => [...text.matchAll(/^import [^;]*? from '([^']+)';/gms)].map((match) => match[1]!);

// T3: Statistics and ExpensesComparison are two descriptions of one ComparisonChartCard (task 031 AC2).
describe('the shared comparison chart card', () => {
  it.each(['Statistics/Statistics.tsx', 'ExpensesComparison/ExpensesComparison.tsx'])(
    '%s imports only ComparisonChartCard and the shared package, and draws nothing of its own',
    (path) => {
      const text = source(path);

      expect(imports(text)).toEqual(['@finebank/shared', '../ComparisonChartCard/ComparisonChartCard']);
      expect(text).toMatch(/<ComparisonChartCard\b/);
      for (const component of ['Dropdown', 'ChartLegend', 'DataState', 'ComparisonBarChart']) {
        expect(text).not.toMatch(new RegExp(`<${component}\\b`));
      }
    },
  );

  it.each(['Statistics/Statistics.module.css', 'ExpensesComparison/ExpensesComparison.module.css'])(
    '%s no longer exists',
    (path) => {
      expect(existsSync(resolve(componentsDir, path))).toBe(false);
    },
  );

  it('holds the header row, the chart box, DataState and the chart once, in its one CSS module', () => {
    const text = source('ComparisonChartCard/ComparisonChartCard.tsx');

    for (const component of [
      'Dropdown',
      'ChartLegend',
      'DataState',
      'ComparisonBarChart',
      'ComparisonBarChartSkeleton',
    ]) {
      expect(text.match(new RegExp(`<${component}\\b`, 'g'))).toHaveLength(1);
    }
    expect(imports(text).filter((from) => from.endsWith('.module.css'))).toEqual(['./ComparisonChartCard.module.css']);
  });

  it('is exported and listed in components.md as Code-only', () => {
    expect('ComparisonChartCard' in components).toBe(true);
    expect(componentsMd).toMatch(/^\| `ComparisonChartCard` \|/m);
  });
});

const stylesDir = resolve(import.meta.dirname, '../../src/styles');
/** How many rules a CSS module has for a class: selectors only, comments dropped. */
const ruleCount = (css: string, name: string) =>
  [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(new RegExp(`\\.${name}\\b(?=[^{}]*\\{)`, 'g'))].length;

// T6: the Goals cards' months-gated state and their title CSS exist once (task 031 AC4).
describe('the Goals cards’ shared card state and title CSS', () => {
  const cards = ['SavingsGoal/SavingsGoal', 'SavingSummary/SavingSummary'];

  it.each(cards)('%s.tsx uses useGatedQuery and cardHeader.module.css, with no useCardQuery of its own', (card) => {
    const text = source(`${card}.tsx`);

    expect(text).not.toMatch(/\buseCardQuery\b/);
    expect(imports(text)).toContain('../DataState/useGatedQuery');
    expect(text).toMatch(/\buseGatedQuery\(/);
    expect(text).toMatch(/^import cardHeader from '\.\.\/\.\.\/styles\/cardHeader\.module\.css';$/m);
    expect(text).toMatch(/\bcardHeader\.title\b/);
    expect(text).toMatch(/\bcardHeader\.selectorPlaceholder\b/);
  });

  it.each(cards)('%s.module.css defines no .title or .selectorPlaceholder', (card) => {
    const css = source(`${card}.module.css`);

    expect(ruleCount(css, 'title')).toBe(0);
    expect(ruleCount(css, 'selectorPlaceholder')).toBe(0);
  });

  it('defines .title and .selectorPlaceholder once each in cardHeader.module.css', () => {
    const css = readFileSync(resolve(stylesDir, 'cardHeader.module.css'), 'utf8');

    expect(ruleCount(css, 'title')).toBe(1);
    expect(ruleCount(css, 'selectorPlaceholder')).toBe(1);
  });

  it('keeps the hook in DataState’s folder', () => {
    expect(existsSync(resolve(componentsDir, 'DataState/useGatedQuery.ts'))).toBe(true);
  });
});
