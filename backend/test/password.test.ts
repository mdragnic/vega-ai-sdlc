import { scrypt } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import { PasswordHasher } from '../src/auth/password.js';
import { readConfig } from '../src/config/config.js';

/** `scrypt$N$r$p$salt$key`, salt and key in base64url: the stored format with its parameters. */
const storedFormat = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/;

function parts(stored: string) {
  const match = storedFormat.exec(stored);
  expect(match).not.toBeNull();
  const [, n, r, p, salt, key] = match!;
  return {
    n: Number(n),
    r: Number(r),
    p: Number(p),
    salt: Buffer.from(salt!, 'base64url'),
    key: Buffer.from(key!, 'base64url'),
  };
}

/** scrypt from node:crypto, called here independently of the app. */
function scryptKey(password: string, salt: Buffer, n: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: n, r: 8, p: 1, maxmem: 256 * n * 8 }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

// T6: passwords are hashed with scrypt, stored with their parameters, verified in constant time (#75, #95).
describe('PasswordHasher', () => {
  let hasher: PasswordHasher;

  beforeAll(async () => {
    hasher = await PasswordHasher.create(2 ** 14);
  });

  it('stores N, r 8, p 1, a 16-byte salt and a 64-byte scrypt key of the password', async () => {
    const stored = await hasher.hash('abcdef12');

    const { n, r, p, salt, key } = parts(stored);
    expect({ n, r, p, saltBytes: salt.length, keyBytes: key.length }).toEqual({
      n: 2 ** 14,
      r: 8,
      p: 1,
      saltBytes: 16,
      keyBytes: 64,
    });
    expect(key.equals(await scryptKey('abcdef12', salt, n))).toBe(true);
    expect(stored).not.toContain('abcdef12');
  });

  it('verifies the right password and rejects any other', async () => {
    const stored = await hasher.hash('abcdef12');

    expect(await hasher.verify('abcdef12', stored)).toBe(true);
    expect(await hasher.verify('abcdef13', stored)).toBe(false);
    expect(await hasher.verify('ABCDEF12', stored)).toBe(false);
    expect(await hasher.verify(' abcdef12', stored)).toBe(false);
    expect(await hasher.verify('', stored)).toBe(false);
  });

  it('gives two users with the same password different hashes', async () => {
    const first = await hasher.hash('abcdef12');
    const second = await hasher.hash('abcdef12');

    expect(first).not.toBe(second);
    expect(parts(first).salt.equals(parts(second).salt)).toBe(false);
  });

  it('verifies a hash stored with N 2^17 by reading the stored parameters, not its own cost', async () => {
    const strong = await (await PasswordHasher.create(2 ** 17)).hash('abcdef12');

    expect(parts(strong).n).toBe(2 ** 17);
    expect(await hasher.verify('abcdef12', strong)).toBe(true);
    expect(await hasher.verify('abcdef13', strong)).toBe(false);
  });

  it('rejects every password for a user without a hash', async () => {
    expect(await hasher.verify('abcdef12', null)).toBe(false);
    expect(await hasher.verify('', null)).toBe(false);
  });

  it.each([
    ['empty', ''],
    ['another scheme', 'bcrypt$2b$10$abc'],
    ['a missing key', 'scrypt$16384$8$1$c2FsdHNhbHRzYWx0c2FsdA'],
    ['a key of the wrong length', 'scrypt$16384$8$1$c2FsdHNhbHRzYWx0c2FsdA$c2hvcnQ'],
    ['an N that is not a power of 2', 'scrypt$1000$8$1$c2FsdHNhbHRzYWx0c2FsdA$' + 'A'.repeat(86)],
  ])('rejects a stored value that is %s without throwing', async (_case, stored) => {
    expect(await hasher.verify('abcdef12', stored)).toBe(false);
  });
});

// T6: the cost is the OWASP minimum outside tests and 2^14 with NODE_ENV=test (#95).
describe('scrypt cost from NODE_ENV', () => {
  it.each([
    ['development', 2 ** 17],
    ['production', 2 ** 17],
    ['test', 2 ** 14],
  ])('NODE_ENV=%s gives N %i', (nodeEnv, cost) => {
    expect(readConfig({ NODE_ENV: nodeEnv }).scryptCost).toBe(cost);
  });

  it('gives N 2^17 when NODE_ENV is not set', () => {
    expect(readConfig({}).scryptCost).toBe(2 ** 17);
  });

  it.each(['TEST', ' test', 'staging', ''])('refuses NODE_ENV=%j rather than pick a cost', (nodeEnv) => {
    expect(() => readConfig({ NODE_ENV: nodeEnv })).toThrow(/NODE_ENV/);
  });

  it('hashes with the configured cost', async () => {
    const stored = await (await PasswordHasher.create(readConfig({ NODE_ENV: 'production' }).scryptCost)).hash('x');

    expect(parts(stored).n).toBe(2 ** 17);
  });
});
