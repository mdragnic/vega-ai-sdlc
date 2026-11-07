import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// T17: hashing never blocks the event loop, and secrets never come from Math.random (#75).
const srcDir = resolve(import.meta.dirname, '../src');
const folders = ['auth', 'users'];
const forbidden = [/\bscryptSync\b/, /\bMath\.random\b/];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('auth and users sources', () => {
  const files = folders.flatMap((folder) => sourceFiles(join(srcDir, folder)));

  it('finds the source files', () => {
    expect(files.map((file) => relative(srcDir, file).replaceAll('\\', '/'))).toEqual(
      expect.arrayContaining(['auth/password.ts', 'users/username.ts']),
    );
  });

  it('never use scryptSync or Math.random', () => {
    const offenders = files.filter((file) => forbidden.some((pattern) => pattern.test(readFileSync(file, 'utf8'))));

    expect(offenders).toEqual([]);
  });

  it.each(['scryptSync(password, salt, 64)', 'const n = Math.random();'])('flags %s', (code) => {
    expect(forbidden.some((pattern) => pattern.test(code))).toBe(true);
  });
});

/** A file's code without its comments, which may name the rules they point to. */
const codeOf = (file: string): string =>
  readFileSync(file, 'utf8')
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');

// Task 012 AC16: the backend redirects with the route paths, the Google routes, the marker and the message of
// @finebank/shared; it writes none of them itself (#74).
describe('Google sign-in sources', () => {
  const ownRules = [
    /(['"`])\/(login|sign-up|forgot-password|overview)\b/,
    /(['"`])returnTo\1/,
    /(['"`])googleSignIn\1/,
    /googleSignIn=/,
    /\/auth\/google/,
    /Google sign-in failed\. Please try again\./,
  ];

  it('writes no path, Google route, marker or message of its own', () => {
    const offenders = sourceFiles(srcDir)
      .filter((file) => ownRules.some((pattern) => pattern.test(codeOf(file))))
      .map((file) => relative(srcDir, file).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it.each([
    "const login = '/login';",
    "query.set('returnTo', target);",
    'const marker = `googleSignIn=failed`;',
    "@Get('/auth/google/callback')",
  ])('flags %s', (code) => {
    expect(ownRules.some((pattern) => pattern.test(code))).toBe(true);
  });
});

/** The body of a method: from its signature to the first line that closes it at its own indentation. */
function methodBody(code: string, name: string): string {
  const lines = code.split('\n');
  const first = lines.findIndex(
    (line) => /^ {2}(async )?\w+\(/.test(line) && line.trimStart().replace('async ', '').startsWith(`${name}(`),
  );
  if (first === -1) return '';
  const last = lines.findIndex((line, index) => index > first && line === '  }');
  return lines.slice(first, last === -1 ? undefined : last + 1).join('\n');
}

/** A log call: Nest's `Logger`, a `logger` field, or the console. */
const logCall = /\blogger\b|\bLogger\b|\bconsole\./;

/** Every `update(User, criteria, values)` call of a file's code: its criteria and values as written. */
const userUpdatesOf = (code: string) =>
  [...code.matchAll(/\.update\(\s*User,\s*(\{[^}]*\}),\s*(\{[^}]*\})\s*\)/g)].map(([, criteria, values]) => ({
    criteria: criteria!.replace(/\s+/g, ' '),
    values: values!.replace(/\s+/g, ' '),
  }));

// Task 030 T18: AC18, a password hash is set for a change only in AuthService.changePassword, by one update keyed on the
// session user's ID and the verified hash; nothing in the change's path logs.
describe('the password change in backend/src', () => {
  const rel = (file: string) => relative(srcDir, file).replaceAll('\\', '/');
  const files = sourceFiles(srcDir).filter((file) => !rel(file).startsWith('database/migrations/'));

  it('sets a hash only in AuthService.changePassword, keyed on the ID and the verified hash', () => {
    const setting = files.flatMap((file) =>
      userUpdatesOf(codeOf(file))
        .filter(({ values }) => /\bpasswordHash\b/.test(values) && !/passwordHash: null/.test(values))
        .map((update) => ({ file: rel(file), ...update })),
    );

    expect(setting).toEqual([
      {
        file: 'auth/auth.service.ts',
        criteria: '{ id: userId, passwordHash: verifiedHash }',
        values: '{ passwordHash }',
      },
    ]);
    expect(methodBody(codeOf(join(srcDir, 'auth/auth.service.ts')), 'changePassword')).toMatch(
      /manager\.update\(User, \{ id: userId, passwordHash: verifiedHash \}, \{ passwordHash \}\)/,
    );
  });

  it('writes no password_hash in raw SQL', () => {
    const offenders = files.filter((file) => /password_hash/.test(codeOf(file))).map(rel);

    // The entity's column name only.
    expect(offenders).toEqual(['users/user.entity.ts']);
  });

  it('logs nothing in the handler or the service method', () => {
    const controller = methodBody(codeOf(join(srcDir, 'auth/auth.controller.ts')), 'changePassword');
    const service = methodBody(codeOf(join(srcDir, 'auth/auth.service.ts')), 'changePassword');

    expect(controller).toContain('this.auth.changePassword(');
    expect(service).toContain('this.passwords.verify(');
    for (const body of [controller, service]) expect(body).not.toMatch(logCall);
  });

  // Each detector flags its own case (code review: one assertion per detector).
  it('reads an update keyed on the ID only as such, not as the compare and set', () => {
    expect(userUpdatesOf('await manager.update(User, { id: userId }, { passwordHash });')).toEqual([
      { criteria: '{ id: userId }', values: '{ passwordHash }' },
    ]);
  });

  it.each(['this.logger.warn(body);', "new Logger('AuthController').warn(text);", 'console.log(body);'])(
    'flags the log call %s',
    (code) => {
      expect(code).toMatch(logCall);
    },
  );
});
