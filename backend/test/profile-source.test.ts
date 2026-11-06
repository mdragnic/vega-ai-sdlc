import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const srcDir = resolve(import.meta.dirname, '../src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

/** A file's code without its comments, which may name the rules they point to. */
const codeOf = (file: string): string =>
  readFileSync(file, 'utf8')
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');

const files = sourceFiles(srcDir).map((file) => ({
  path: relative(srcDir, file).replaceAll('\\', '/'),
  code: codeOf(file),
}));
const file = (path: string) => files.find((candidate) => candidate.path === path)!;

// Task 028 T22: AC19, one write of the profile, on the session user's ID with the four columns named (#74, #75).
describe('the profile write in backend/src', () => {
  it('finds the profile controller and the users service', () => {
    expect(files.map(({ path }) => path)).toEqual(
      expect.arrayContaining(['users/profile.controller.ts', 'users/users.service.ts']),
    );
  });

  // Changed by task 029 (#128 c): the one update also writes the photo's three columns, keyed on the user's ID and, with a
  // photo, the name it replaces (`photoPath`); still one write, still `UsersService.updateProfile` only (AC19).
  it('writes the phone and photo columns only in UsersService.updateProfile, by one update keyed on the user’s ID', () => {
    const writers = files.filter(
      ({ code }) =>
        /\b(phone(CountryCode|Number)|photo(Path|MimeType|UpdatedAt))\s*[,:}]/.test(code) && /\.update\(/.test(code),
    );

    expect(writers.map(({ path }) => path)).toEqual(['users/users.service.ts']);
    const service = file('users/users.service.ts').code;
    const body = /async updateProfile\([\s\S]*?\n {2}\}/.exec(service)?.[0] ?? '';
    expect(body.match(/\.update\(/g)).toHaveLength(1);
    // The four text columns named, never a spread of the request (mass assignment).
    expect(body).toMatch(/\{\s*fullName,\s*username,\s*phoneCountryCode,\s*phoneNumber\s*\}/);
    expect(body).toMatch(
      /\.update\(\s*User,\s*stored\s*\?\s*\{\s*id:\s*userId,\s*photoPath:[^}]*\}\s*:\s*\{\s*id:\s*userId\s*\}/,
    );
    expect(body).not.toMatch(/\.(save|insert|upsert|query)\(/);
    expect(body).not.toMatch(/\b(existsBy|findOneBy|findBy|exists)\(\s*User,\s*\{\s*username/);
    // The photo's columns come from the stored file only: its name, its detected type, the clock.
    expect(service).toMatch(/photoPath:\s*name,\s*photoMimeType:\s*mimeType,\s*photoUpdatedAt:\s*this\.clock\.now\(\)/);
  });

  // Task 029: the photo's read is a third handler with the session user (the count 2 became 3, an addition).
  it('takes the paths from the contract and the user from the session', () => {
    const controller = file('users/profile.controller.ts').code;

    expect(controller).toMatch(/@Get\(profileContract\.get\.path\)/);
    expect(controller).toMatch(/@Patch\(profileContract\.update\.path\)/);
    expect(controller).not.toMatch(/(['"`])\/?profile\1/);
    expect(controller.match(/@CurrentUser\(\)/g)).toHaveLength(3);
    expect(controller).toMatch(/@Body\(\{\s*schema:\s*profileContract\.update\.request\s*\}\)/);
  });
});

// Task 029 T21: AC19, the photo: the uploads folder only through PhotoStore, names only from randomUUID(), the rule only
// from the shared photoSchema, the photo route's path from the contract and its user from the session.
describe('the photo in backend/src', () => {
  const users = files.filter(({ path }) => path.startsWith('users/'));

  it('touches the file system only in users/photo-store.ts', () => {
    expect(users.filter(({ code }) => /from 'node:fs|from 'fs/.test(code)).map(({ path }) => path)).toEqual([
      'users/photo-store.ts',
    ]);
  });

  it('makes a stored name only from randomUUID() and the detected type, in photo-store.ts', () => {
    expect(files.filter(({ code }) => /\brandomUUID\(/.test(code)).map(({ path }) => path)).toEqual([
      'users/photo-store.ts',
    ]);
    expect(file('users/photo-store.ts').code).toMatch(/`\$\{randomUUID\(\)\}\.\$\{extensions\[mimeType\]\}`/);
    // Nothing of the client's file is read: multer's originalname, mimetype or encoding.
    expect(files.filter(({ code }) => /\b(originalname|mimetype)\b/.test(code)).map(({ path }) => path)).toEqual([]);
  });

  it('has no size or type check of its own: the rule is the shared photoSchema', () => {
    const own = /0x89|0xff,\s*0xd8|2_?097_?152|1024\s*\*\s*1024|'image\/(jpeg|png)'\s*[=!]==|\.size\s*[<>]/i;

    expect(users.filter(({ code }) => own.test(code)).map(({ path }) => path)).toEqual([]);
    expect(file('users/profile-body.interceptor.ts').code).toMatch(/fileSize:\s*MAX_PHOTO_BYTES/);
  });

  it('serves the photo from the contract’s path, with no request value that could name a user or a file', () => {
    const controller = file('users/profile.controller.ts').code;

    expect(controller).toMatch(/@Get\(profileContract\.photo\.path\)/);
    expect(controller).not.toMatch(/@(Param|Query|Req|Headers)\(/);
  });
});
