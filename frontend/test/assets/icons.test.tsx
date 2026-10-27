import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render } from '@testing-library/react';
import type { ComponentType, SVGProps } from 'react';
import { describe, expect, it } from 'vitest';

import { Logo } from '../../src/assets';
import { adobeUrl, FigmaWordmark, figmaUrl, googleUrl, mastercardUrl, visacardUrl } from '../../src/assets/brand';
import * as icons from '../../src/assets/icons';

// Code names from task 000 step 13 (docs/figma/components.md).
const codeNames = [
  'ArrowRight16',
  'ArrowRight24',
  'ArrowUpRight',
  'ArrowDown2',
  'Award',
  'BackArrow',
  'Bill',
  'ChevronRight',
  // Not in the Figma export: the Lucide `chevrons-right` and `ellipsis-vertical` (see LICENSE-lucide.txt),
  // for the header's "»" and the profile's three dots (task 003, #66).
  'ChevronsRight',
  'EllipsisVertical',
  'Clock',
  'DownArrow24',
  'DownArrow16',
  'Edit',
  'Expenses',
  'IconEye',
  'IconEyeOff',
  // Not in the Figma export: the Lucide `check` (see LICENSE-lucide.txt), for the RemindMe check mark (task 002, #66).
  'IconCheck',
  'Food',
  'LogoutIcon',
  'Gamepad2',
  'Goal',
  'Housing',
  'LeftArrow',
  'MdiAchievementAward',
  'Movie',
  'NotificationIcon',
  'OcticonGoal16',
  'Others',
  'SearchIcon',
  'IconSeparator',
  'Shopping',
  'Target',
  'Transaction',
  'Transport',
  'UpArrow',
  'Wallet',
  'X32',
  'X24',
  'MenuBell',
  'MenuCar',
  'MenuOverview',
  'MenuPayment',
  'MenuReport',
  'MenuSettings',
  'MenuTransaction',
];

type SvgComponent = ComponentType<SVGProps<SVGSVGElement>>;
const components: [string, SvgComponent][] = [...Object.entries(icons), ['Logo', Logo]];

const allowedPaint = /^(currentColor|none|url\(#[^)]+\))$/;
const tokenStyle = /^fill: var\(--[a-z0-9-]+\);?$/;

function renderSvg(Component: SvgComponent): SVGSVGElement {
  const { container } = render(
    <div style={{ color: 'rgb(1, 2, 3)' }}>
      <Component />
    </div>,
  );
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('no <svg> rendered');
  return svg;
}

/** The `d` of every path in an SVG's markup, in order. */
const pathsOf = (svg: string) => [...svg.matchAll(/ d="([^"]+)"/g)].map((match) => match[1]);

/** Elements that paint, so not inside <mask> where black and white are mask values. */
function paintedElements(svg: SVGSVGElement): Element[] {
  return [svg, ...svg.querySelectorAll('*')].filter((el) => !el.closest('mask'));
}

// T11: the logo and every icon are inline SVGs colored by CSS `color` (AC9).
describe('icons', () => {
  it('exports every icon by its code name', () => {
    expect(Object.keys(icons).toSorted()).toEqual(codeNames.toSorted());
  });

  describe.each(components)('%s', (_, Component) => {
    it('renders an inline svg with a viewBox and no fixed size', () => {
      const svg = renderSvg(Component);

      expect(svg.getAttribute('viewBox')).toMatch(/^0 0 \d+(\.\d+)? \d+(\.\d+)?$/);
      expect(svg.hasAttribute('width')).toBe(false);
      expect(svg.hasAttribute('height')).toBe(false);
    });

    it('has no raw color outside <mask>', () => {
      const raw = paintedElements(renderSvg(Component)).flatMap((el) => {
        const paints = ['fill', 'stroke', 'stop-color', 'color']
          .map((attr) => ({ attr, value: el.getAttribute(attr) }))
          .filter(({ value }) => value !== null && !allowedPaint.test(value));
        const style = el.getAttribute('style');
        if (style !== null && !tokenStyle.test(style)) paints.push({ attr: 'style', value: style });
        return paints.map(({ attr, value }) => `${el.tagName} ${attr}="${value}"`);
      });

      expect(raw).toEqual([]);
    });

    it('takes its color from the parent', () => {
      const painted = paintedElements(renderSvg(Component)).filter(
        (el) => el.getAttribute('fill') === 'currentColor' || el.getAttribute('stroke') === 'currentColor',
      );

      expect(painted.length).toBeGreaterThan(0);
    });
  });

  it('colors the notification dot with the primary token and the bell with currentColor', () => {
    const svg = renderSvg(icons.NotificationIcon);
    const paths = [...svg.querySelectorAll('path')];

    // React writes the style back with a trailing semicolon.
    const dots = paths.filter((p) => /^fill: var\(--color-primary\);?$/.test(p.getAttribute('style') ?? ''));
    expect(dots).toHaveLength(1);
    expect(paths.filter((p) => p.getAttribute('fill') === 'currentColor')).toHaveLength(2);
  });
});

describe('brand logos', () => {
  const brandDir = resolve(import.meta.dirname, '../../src/assets/brand');
  const figmaDir = resolve(import.meta.dirname, '../../../docs/figma/assets/icon');

  it.each(['Mastercard', 'Visacard', 'Figma', 'Adobe'])('%s is copied unchanged from the Figma export', (name) => {
    expect(readFileSync(resolve(brandDir, `${name}.svg`), 'utf8')).toBe(
      readFileSync(resolve(figmaDir, `${name}.svg`), 'utf8'),
    );
  });

  // Google's sign-in branding guidelines require the standard color gradient "super G" from their download
  // bundle; Google.svg is that bundle's G with the button background removed.
  it('is the gradient Google G from the sign-in bundle, without the button background', () => {
    const google = readFileSync(resolve(brandDir, 'Google.svg'), 'utf8');

    expect(google).toContain('viewBox="10 10 20 20"');
    expect(google).toContain('d="M29.3987 18.1814H19.9849V22.0445H25.3598');
    expect(google).toContain('conic-gradient');
    for (const color of ['#3186FF', '#FF4641']) expect(google).toContain(color);
    expect(google).not.toContain('#F2F2F2');
  });

  // Task 015 (#111 c): 104's Upcoming Bill row draws the Figma wordmark alone, in Gray/01.
  it('cuts the Figma wordmark from the Figma export: its paths alone, in its clip box, colored by CSS', () => {
    const exported = readFileSync(resolve(figmaDir, 'Figma.svg'), 'utf8');
    const wordmarkGroup = /<g clip-path="url\(#clip1_411_5839\)">([\s\S]*?)<\/g>/.exec(exported)![1]!;
    const svg = renderSvg(FigmaWordmark);

    expect(pathsOf(svg.outerHTML)).toEqual(pathsOf(wordmarkGroup));
    expect(exported).toContain(
      '<rect width="65.3333" height="23.3333" fill="white" transform="translate(40 8.33301)"/>',
    );
    expect(svg.getAttribute('viewBox')).toBe('40 8.33301 65.3333 23.3333');
    expect(svg.hasAttribute('width') || svg.hasAttribute('height')).toBe(false);
    expect([...svg.querySelectorAll('path')].map((path) => path.getAttribute('fill'))).toEqual(
      Array(4).fill('currentColor'),
    );
  });

  // Vite inlines small SVGs as data URLs and serves larger ones as files; both work as <img src>.
  it('exports every brand logo as an image URL', () => {
    for (const url of [mastercardUrl, visacardUrl, figmaUrl, adobeUrl, googleUrl]) {
      expect(url).toMatch(/\.svg$|^data:image\/svg\+xml,/);
    }
  });
});
