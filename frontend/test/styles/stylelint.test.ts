// @vitest-environment node
import { resolve } from 'node:path';

import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';

const configFile = resolve(import.meta.dirname, '../../stylelint.config.js');

async function warnings(code: string): Promise<string[]> {
  const { results } = await stylelint.lint({ code, configFile, codeFilename: 'fixture.module.css' });
  return results.flatMap((result) => result.warnings.map((warning) => warning.text));
}

// T2: frontend CSS may use tokens and a few keywords only (AC4).
describe('stylelint token rule', () => {
  it.each([
    ['a raw color', 'a { color: #fff; }'],
    ['a raw color function', 'a { background-color: rgb(0 0 0); }'],
    ['raw padding', 'a { padding: 12px; }'],
    ['a raw radius', 'a { border-radius: 8px; }'],
    ['a raw shadow', 'a { box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }'],
    ['a raw border shorthand', 'a { border: 1px solid red; }'],
    ['a raw font size', 'a { font-size: 14px; }'],
    ['a raw font family', 'a { font-family: Arial, sans-serif; }'],
    ['a raw line height', 'a { line-height: 1.5; }'],
    ['a raw width', 'a { width: 352px; }'],
    ['a raw gap', 'a { gap: 24px; }'],
    ['a raw offset', 'a { top: 4px; }'],
    ['a raw outline', 'a { outline: 2px solid blue; }'],
    ['a raw fill', 'a { fill: #000; }'],
    ['calc with raw values', 'a { margin-top: calc(100% - 8px); }'],
    ['a raw font shorthand with size/line-height', 'a { font: 400 14px/20px "Inter"; }'],
    ['a raw font shorthand', 'a { font: bold 14px Arial; }'],
    ['a token with a raw fallback', 'a { padding-left: var(--x, 12px); }'],
    ['a raw text shadow', 'a { text-shadow: 0 1px 2px #000; }'],
    ['a raw flex basis', 'a { flex-basis: 280px; }'],
    ['a raw letter spacing', 'a { letter-spacing: 0.5px; }'],
  ])('rejects %s', async (_, code) => {
    expect(await warnings(code)).not.toEqual([]);
  });

  it.each([
    ['token colors', 'a { color: var(--x); background-color: var(--y); fill: var(--z); }'],
    ['token spacing', 'a { padding: var(--x) var(--y); gap: var(--z); margin: 0 auto; }'],
    ['a token radius and shadow', 'a { border-radius: var(--x); box-shadow: var(--y); }'],
    ['a token border shorthand', 'a { border: var(--x) solid var(--y); }'],
    ['a token font shorthand', 'a { font: var(--font-regular-14-20); }'],
    ['the size keywords', 'a { width: 100%; min-height: 100vh; max-width: none; height: auto; }'],
    ['the content keywords', 'a { width: fit-content; min-width: min-content; max-width: max-content; }'],
    ['the color keywords', 'a { color: currentColor; background-color: transparent; border-color: inherit; }'],
    ['the reset keywords', 'a { padding: 0; inset: 0; outline: none; margin: initial; gap: unset; }'],
    ['a token outline shorthand', 'a { outline: var(--x) solid var(--y); outline-offset: var(--z); }'],
    ['token text shadow, flex basis and letter spacing', 'a { text-shadow: var(--x); flex-basis: var(--y); }'],
  ])('accepts %s', async (_, code) => {
    expect(await warnings(code)).toEqual([]);
  });
});
