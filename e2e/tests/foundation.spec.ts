import type { ConsoleMessage, Page } from '@playwright/test';

import { FIXED_NOW, FRONTEND_URL, TIME_ZONE, VIEWPORT } from '../constants';
import { expect, test } from '../fixtures';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** The computed color a token resolves to, read through a probe element. */
async function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = `var(${name})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  }, token);
}

// T13: the root page loads at 1440x1024, without console errors, on the page background token (AC2, AC5).
test('root page loads at 1440x1024 on the page background without console errors', async ({ page }) => {
  const errors = collectErrors(page);

  await page.goto('/');

  await expect(page.getByRole('main')).toBeVisible();
  expect(page.viewportSize()).toEqual(VIEWPORT);
  const body = await page.evaluate(() => {
    const style = getComputedStyle(document.body);
    return { background: style.backgroundColor, font: style.fontFamily };
  });
  expect(body.background).toBe(await tokenColor(page, '--color-gray-06'));
  expect(body.background).toBe('rgb(243, 243, 243)');
  expect(body.font).toContain('Inter Variable');
  expect(errors).toEqual([]);
});

// Tests run in file order on one backend: this one moves the backend clock, and T14 below then
// proves the fixture puts it back to FIXED_NOW before the next test.
test('a test may move the backend clock', async ({ request }) => {
  const moved = await request.put('/api/test/clock', { data: { now: '2027-01-01T00:00:00.000Z' } });

  expect(await moved.json()).toEqual({ now: '2027-01-01T00:00:00.000Z' });
});

// T14: the page and the backend share one fixed instant, and the page runs in Europe/Belgrade (AC5, AC10).
test('page and backend clocks are fixed at the same instant in the test zone', async ({ page, request }) => {
  await page.goto('/');

  const browser = await page.evaluate(() => ({
    now: Date.now(),
    zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }));
  expect(browser).toEqual({ now: Date.parse(FIXED_NOW), zone: TIME_ZONE });

  const backend = await request.get('/api/test/clock');
  expect(backend.status()).toBe(200);
  expect(await backend.json()).toEqual({ now: new Date(FIXED_NOW).toISOString() });
});

// T15: the API client calls the backend through the Vite proxy (one origin) with X-Time-Zone (AC2, AC11).
test('API client sends X-Time-Zone through the Vite proxy', async ({ page }) => {
  await page.goto('/');
  const sent = page.waitForRequest('**/api/test/clock');

  const body: unknown = await page.evaluate(async () => {
    // The real client module, served by the Vite dev server. The response schema is a pass-through stub.
    const clientModule = '/src/api/client.ts';
    const { apiRequest } = await import(clientModule);
    return apiRequest({
      method: 'GET',
      path: '/test/clock',
      request: undefined,
      response: { parse: (value: unknown) => value },
    });
  });

  const request = await sent;
  expect(new URL(request.url()).origin).toBe(FRONTEND_URL);
  expect(await request.headerValue('x-time-zone')).toBe(TIME_ZONE);
  expect((await request.response())?.status()).toBe(200);
  expect(body).toEqual({ now: new Date(FIXED_NOW).toISOString() });
});
