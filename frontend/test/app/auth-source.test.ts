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
