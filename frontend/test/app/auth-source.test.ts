import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { authMessages, loginRequestSchema, signUpRequestSchema } from '@finebank/shared';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

const srcDir = resolve(import.meta.dirname, '../../src');
// The development-only gallery (task 002) shows sample texts in its FieldError and FormError examples. It checks
// no input and is dropped from the production build (test/app/gallery-build.test.ts).
const devDir = join(srcDir, 'app', 'dev');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (path === devDir) return [];
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

/** The messages a shared schema gives for `failing`, read from the schema itself. */
function schemaMessages(schema: z.ZodType, failing: unknown[]): string[] {
  return failing.flatMap((input) => {
    const result = schema.safeParse(input);
    return result.success ? [] : result.error.issues.map((issue) => issue.message);
  });
}

/** The texts of `texts` written in frontend/src, as `file: text`. */
function writtenInSource(texts: string[]): string[] {
  return sourceFiles(srcDir).flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    return texts.filter((text) => source.includes(text)).map((text) => `${relative(srcDir, file)}: ${text}`);
  });
}

// Task 009 T16: the Login form takes its rules and texts from @finebank/shared; none is redeclared (AC19, #74).
describe('login texts', () => {
  const texts = [
    ...new Set([
      ...schemaMessages(loginRequestSchema, [
        { email: '', password: '', keepSignedIn: true },
        { email: 'a@b', password: 'x'.repeat(129), keepSignedIn: true },
      ]),
      ...Object.values(authMessages),
    ]),
  ];

  it('reads every login message from the shared schema', () => {
    expect(texts).toEqual([
      'Email is required',
      'Password is required',
      'Enter a valid email address',
      'Password must be at most 128 characters',
      'Email or password is incorrect',
      'An account with this email already exists',
      'Google sign-in failed. Please try again.',
    ]);
  });

  it('never writes one of them in frontend/src', () => {
    expect(writtenInSource(texts)).toEqual([]);
  });
});

// Task 010 T14: the Sign up form takes its rules and texts from @finebank/shared; none is redeclared (AC18, #74).
describe('sign up texts', () => {
  const texts = [
    ...new Set([
      ...schemaMessages(signUpRequestSchema, [
        { fullName: '', email: '', password: '' },
        { fullName: 'x'.repeat(101), email: 'a@b', password: 'abc1' },
        { fullName: 'Tanzir', email: 'tanzir@example.com', password: 'x'.repeat(129) },
        { fullName: 'Tanzir', email: 'tanzir@example.com', password: 'abcdefgh' },
      ]),
      authMessages.emailTaken,
    ]),
  ];

  it('reads every sign up message from the shared schema', () => {
    expect(texts).toEqual([
      'Name is required',
      'Email is required',
      'Password is required',
      'Name must be at most 100 characters',
      'Enter a valid email address',
      'Password must be at least 8 characters',
      'Password must be at most 128 characters',
      'Password must contain at least one letter and one number',
      'An account with this email already exists',
    ]);
  });

  it('never writes one of them in frontend/src', () => {
    expect(writtenInSource(texts)).toEqual([]);
  });
});

/** The source of `file` without its comments, which may name the rules they point to. */
function codeOf(file: string): string {
  return readFileSync(file, 'utf8')
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
    .trim();
}

/** The places in frontend/src whose code matches one of `patterns`, as `file: pattern`. */
function matchedInCode(patterns: RegExp[]): string[] {
  return sourceFiles(srcDir).flatMap((file) => {
    const code = codeOf(file);
    return patterns.filter((pattern) => pattern.test(code)).map((pattern) => `${relative(srcDir, file)}: ${pattern}`);
  });
}

// Task 012 T22: the route paths, the return-target rule, the Google routes, the marker and the failure message exist
// once, in @finebank/shared; the frontend imports them (AC16, #74).
describe('Google sign-in and return target sources', () => {
  const routesDir = join(srcDir, 'routes');

  it('re-exports the route paths from @finebank/shared', () => {
    expect(codeOf(join(routesDir, 'paths.ts'))).toBe("export { accountDetailsPath, paths } from '@finebank/shared';");
  });

  it('re-exports the return-target rule and declares only loginPathFor', () => {
    const code = codeOf(join(routesDir, 'return-to.ts'));

    expect(code).toContain("export { RETURN_TO_PARAM, returnTarget } from '@finebank/shared';");
    expect([...code.matchAll(/\b(?:function|const|let|var)\s+(\w+)/g)].map((match) => match[1])).toEqual([
      'loginPathFor',
    ]);
  });

  // A route path, the returnTo or googleSignIn parameter, the marker, a Google route, a return-target helper. Not a
  // bare 'failed': it is also a transaction status (#27).
  const ownRules = [
    /(['"`])\/(login|sign-up|forgot-password|overview|balances|transactions|bills|expenses|goals|settings)\b/,
    /(['"`])returnTo\1/,
    /(['"`])googleSignIn\1/,
    /googleSignIn=/,
    /\/auth\/google/,
    /\b(isSafeRelativePath|decodeOrNull|isAuthPath)\b/,
  ];

  it('writes no path, marker, Google route or rule helper of its own', () => {
    expect(matchedInCode(ownRules)).toEqual([]);
  });

  it.each([
    "const login = '/login';",
    'const marker = `googleSignIn=failed`;',
    "params.get('googleSignIn') === 'failed'",
    "fetch('/api/auth/google')",
    "new URLSearchParams({ 'returnTo': target })",
    'function isSafeRelativePath(value) {}',
  ])('flags %s', (code) => {
    expect(ownRules.some((pattern) => pattern.test(code))).toBe(true);
  });

  it("allows a transaction status 'failed'", () => {
    expect(ownRules.some((pattern) => pattern.test("status === 'failed'"))).toBe(false);
  });
});
