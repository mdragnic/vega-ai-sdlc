import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CHART_HEIGHT } from '../../src/components/ComparisonBarChart/geometry';
import { GAUGE_HEIGHT, GAUGE_WIDTH } from '../../src/components/TargetVsAchievementMeter/geometry';

const componentsDir = resolve(import.meta.dirname, '../../src/components');
const tokensCss = readFileSync(resolve(import.meta.dirname, '../../src/styles/tokens.css'), 'utf8');

const svgComponents = [
  'ComparisonBarChart/ComparisonBarChart.tsx',
  'TargetVsAchievementMeter/TargetVsAchievementMeter.tsx',
];

const geometryAttributes =
  'x|y|x1|x2|y1|y2|cx|cy|r|rx|ry|dx|dy|width|height|d|points|transform|viewBox|strokeWidth|stroke-width';

/**
 * SVG geometry attributes with a number written in the markup: `x="12"`, `r={6}`, `y={top + 4}`.
 * Digits inside names (`x1`, `GRID_LINE`) do not count. Named constants and expressions over them pass (#92).
 */
function looseLiterals(source: string): string[] {
  const name = new RegExp(`\\b(?:${geometryAttributes})=(?="|\\{)`, 'g');
  return [...source.matchAll(name)]
    .map((match) => source.slice(match.index, valueEnd(source, match.index + match[0].length)))
    .filter((attribute) => /(?<![\w.])\d/.test(attribute));
}

/** The end of an attribute value: after its closing quote, or after the brace matching its opening one. */
function valueEnd(source: string, start: number): number {
  if (source[start] === '"') return source.indexOf('"', start + 1) + 1;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return index + 1;
  }
  return source.length;
}

/** A token's value in px from tokens.css. */
function tokenPx(name: string): number {
  const match = new RegExp(`${name}: (\\d+)px;`).exec(tokensCss);
  if (!match) throw new Error(`No px token ${name}`);
  return Number(match[1]);
}

// T17: SVG colors, typography and outer size come from tokens; internal geometry from named constants (AC16, #92).
describe('chart SVG geometry', () => {
  it.each(svgComponents)('%s writes no number into a geometry attribute', (file) => {
    expect(looseLiterals(readFileSync(resolve(componentsDir, file), 'utf8'))).toEqual([]);
  });

  it.each([
    ['x="12"', ['x="12"']],
    ['r={6}', ['r={6}']],
    ['y={top + 4}', ['y={top + 4}']],
    ['d="M0,155V87Z"', ['d="M0,155V87Z"']],
    // A number after an interpolation in a template literal (code review of task 006).
    ['transform={`rotate(${angle} 64 64)`}', ['transform={`rotate(${angle} 64 64)`}']],
    ['x1={GRID_LEFT} y1={lineTop(row) + GRID_LINE / HALF}', []],
    ['x2={PLOT_RIGHT} x={`${percent}%`}', []],
    ['textAnchor="end" aria-valuemin={0}', []],
  ])('reads %s as %j', (markup, expected) => {
    expect(looseLiterals(markup)).toEqual(expected);
  });

  it.each([
    ['--size-chart-height', CHART_HEIGHT],
    ['--size-gauge-width', GAUGE_WIDTH],
    ['--size-gauge-height', GAUGE_HEIGHT],
  ])('sizes the SVG with %s, the constant its geometry is drawn in', (token, constant) => {
    expect(tokenPx(token)).toBe(constant);
  });
});
