import { defineConfig, devices } from '@playwright/test';

import { BACKEND_PORT, FIXED_NOW, FRONTEND_PORT, FRONTEND_URL, VIEWPORT } from './constants';

// Chromium only, desktop 1440x1024 only (#4, #5). Zone and clock come from fixtures.ts (#80).
export default defineConfig({
  testDir: './tests',
  // One backend with one test clock is shared by every test, so tests run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: FRONTEND_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: VIEWPORT, deviceScaleFactor: 1 },
    },
  ],
  webServer: [
    {
      // Resets backend/data/finebank.test.sqlite and applies every migration, then starts the API.
      command: 'npm run build -w shared && npm run start:e2e -w backend',
      cwd: '..',
      port: BACKEND_PORT,
      env: { NODE_ENV: 'test', TEST_NOW: FIXED_NOW },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -w frontend',
      cwd: '..',
      port: FRONTEND_PORT,
      env: { NODE_ENV: 'test' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
