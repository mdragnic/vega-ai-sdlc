import { randomBytes, scrypt, type ScryptOptions, timingSafeEqual } from 'node:crypto';

const R = 8;
const P = 1;
const SALT_BYTES = 16;
const KEY_BYTES = 64;
/** The most memory a stored hash may ask scrypt for (about 128 * N * r bytes): 1 GiB. */
const MAX_MEMORY = 2 ** 30;

/** `scrypt$N$r$p$salt$key`, salt and key in base64url. */
const storedFormat = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/;

/**
 * Hashes and verifies passwords with scrypt from node:crypto, asynchronously (#75). Each hash
 * is stored with its own N, r, p and salt, so it keeps verifying when the cost changes (#95).
 * Passwords and hashes are never logged or put in an error.
 */
export class PasswordHasher {
  private constructor(
    private readonly cost: number,
    private readonly dummyHash: string,
  ) {}

  /** A hasher for new hashes at cost N, with a dummy hash at that cost for timing (see verify). */
  static async create(cost: number): Promise<PasswordHasher> {
    const dummyHash = await hashWith(randomBytes(SALT_BYTES).toString('base64url'), cost);
    return new PasswordHasher(cost, dummyHash);
  }

  hash(password: string): Promise<string> {
    return hashWith(password, this.cost);
  }

  /**
   * Whether the password matches the stored hash. A user without a hash (Google-only, #2) is
   * checked against the dummy hash and always fails, so the time taken does not tell them apart.
   */
  async verify(password: string, stored: string | null): Promise<boolean> {
    const matches = await matchesStored(password, stored ?? this.dummyHash);
    return stored !== null && matches;
  }
}

async function hashWith(password: string, cost: number): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, { N: cost, r: R, p: P });
  return ['scrypt', cost, R, P, salt.toString('base64url'), key.toString('base64url')].join('$');
}

async function matchesStored(password: string, stored: string): Promise<boolean> {
  const match = storedFormat.exec(stored);
  if (!match) return false;
  const [, n, r, p, salt, key] = match;
  const options = { N: Number(n), r: Number(r), p: Number(p) };
  const expected = Buffer.from(key!, 'base64url');
  if (expected.length !== KEY_BYTES || 128 * options.N * options.r > MAX_MEMORY) return false;
  try {
    return timingSafeEqual(await derive(password, Buffer.from(salt!, 'base64url'), options), expected);
  } catch {
    // Parameters scrypt rejects (N not a power of 2) never match.
    return false;
  }
}

function derive(password: string, salt: Buffer, options: Required<Pick<ScryptOptions, 'N' | 'r' | 'p'>>) {
  // scrypt needs about 128 * N * r bytes; the default limit of 32 MiB is too low for N 2^17.
  const maxmem = 2 * 128 * options.N * options.r;
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, { ...options, maxmem }, (error, key) => (error ? reject(error) : resolve(key)));
  });
}
