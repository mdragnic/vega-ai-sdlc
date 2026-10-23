import { test as base } from '@playwright/test';

import { FIXED_NOW, TIME_ZONE } from './constants';

export { expect } from '@playwright/test';

/**
 * Every E2E test runs in TIME_ZONE with the page clock and the backend clock at FIXED_NOW (#54, #80).
 * Page timers keep running, only Date is fixed: move it with `page.clock.setFixedTime`. The backend
 * clock is shared by all tests, so it is reset before each one: move it with PUT /api/test/clock.
 */
export const test = base.extend<{ backendClock: void }>({
  timezoneId: TIME_ZONE,
  backendClock: [
    async ({ request }, use) => {
      const reset = await request.put('/api/test/clock', { data: { now: FIXED_NOW } });
      if (!reset.ok()) throw new Error(`Could not reset the backend clock: HTTP ${reset.status()}`);
      await use();
    },
    { auto: true },
  ],
  page: async ({ page }, use) => {
    await page.clock.install({ time: FIXED_NOW });
    await page.clock.setFixedTime(FIXED_NOW);
    await use(page);
  },
});
