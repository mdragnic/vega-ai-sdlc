import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { testClockStateSchema } from '@finebank/shared';

export type NodeEnv = 'development' | 'test' | 'production';

export interface AppConfig {
  nodeEnv: NodeEnv;
  databaseFile: string;
  uploadsDir: string;
  /** Where the clock starts with NODE_ENV=test. */
  testNow: string;
}

const nodeEnvs: readonly NodeEnv[] = ['development', 'test', 'production'];

/** Same instant as FIXED_NOW in e2e/constants.ts (a test keeps them equal). */
const defaultTestNow = '2026-10-22T10:00:00Z';

const isNodeEnv = (value: string): value is NodeEnv => nodeEnvs.some((nodeEnv) => nodeEnv === value);

// Resolves to backend/ from both src/config (tests) and dist/config (built app).
const backendRoot = fileURLToPath(new URL('../../', import.meta.url));
const dataDir = join(backendRoot, 'data');

/** Loads backend/.env into process.env if it exists. Variables already set win. */
export function loadEnvFile(): void {
  const envFile = join(backendRoot, '.env');
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
}

/** Every variable the backend reads is read here and listed in backend/.env.example. */
export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!isNodeEnv(nodeEnv)) {
    throw new Error(`NODE_ENV must be one of ${nodeEnvs.join(', ')}, got "${nodeEnv}"`);
  }

  // The same rule as the test clock route: an ISO instant in UTC (`Z`), never local time.
  const testNow = env.TEST_NOW ?? defaultTestNow;
  if (!testClockStateSchema.shape.now.safeParse(testNow).success) {
    throw new Error(`TEST_NOW must be an ISO instant in UTC like ${defaultTestNow}, got "${testNow}"`);
  }

  return {
    nodeEnv,
    databaseFile: join(dataDir, nodeEnv === 'test' ? 'finebank.test.sqlite' : 'finebank.sqlite'),
    uploadsDir: join(dataDir, 'uploads'),
    testNow,
  };
}

/** Creates the data and uploads folders if missing. */
export function ensureDataDirs(config: AppConfig): void {
  mkdirSync(config.uploadsDir, { recursive: true });
}
