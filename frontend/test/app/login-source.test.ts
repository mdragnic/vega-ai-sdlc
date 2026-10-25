import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { authMessages, loginRequestSchema } from '@finebank/shared';
import { describe, expect, it } from 'vitest';

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

/** The messages the shared login schema gives, read from the schema itself. */
function schemaMessages(): string[] {
  const failing = [
    { email: '', password: '', keepSignedIn: true },
    { email: 'a@b', password: 'x'.repeat(129), keepSignedIn: true },
  ];
  return failing.flatMap((input) => {
    const result = loginRequestSchema.safeParse(input);
    return result.success ? [] : result.error.issues.map((issue) => issue.message);
  });
}

// T16: the Login form takes its rules and texts from @finebank/shared; none is redeclared (AC19, #74).
describe('login texts', () => {
  const texts = [...new Set([...schemaMessages(), ...Object.values(authMessages)])];

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
    const found = sourceFiles(srcDir).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return texts.filter((text) => source.includes(text)).map((text) => `${relative(srcDir, file)}: ${text}`);
    });

    expect(found).toEqual([]);
  });
});
