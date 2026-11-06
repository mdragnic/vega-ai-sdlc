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

  it('writes the phone columns only in UsersService.updateProfile, by one update keyed on the user’s ID', () => {
    const writers = files.filter(
      ({ code }) => /\bphone(CountryCode|Number)\s*[,:}]/.test(code) && /\.update\(/.test(code),
    );

    expect(writers.map(({ path }) => path)).toEqual(['users/users.service.ts']);
    const service = file('users/users.service.ts').code;
    const body = /async updateProfile\([\s\S]*?\n {2}\}/.exec(service)?.[0] ?? '';
    expect(body.match(/\.update\(/g)).toHaveLength(1);
    expect(body).toMatch(
      /\.update\(\s*User,\s*\{\s*id:\s*userId\s*\},\s*\{\s*fullName,\s*username,\s*phoneCountryCode,\s*phoneNumber\s*\}/,
    );
    expect(body).not.toMatch(/\.(save|insert|upsert|query)\(/);
    expect(body).not.toMatch(/\b(existsBy|findOneBy|findBy|exists)\(\s*User,\s*\{\s*username/);
  });

  it('takes the paths from the contract and the user from the session', () => {
    const controller = file('users/profile.controller.ts').code;

    expect(controller).toMatch(/@Get\(profileContract\.get\.path\)/);
    expect(controller).toMatch(/@Patch\(profileContract\.update\.path\)/);
    expect(controller).not.toMatch(/(['"`])\/?profile\1/);
    expect(controller.match(/@CurrentUser\(\)/g)).toHaveLength(2);
    expect(controller).toMatch(/@Body\(\{\s*schema:\s*profileContract\.update\.request\s*\}\)/);
  });
});
