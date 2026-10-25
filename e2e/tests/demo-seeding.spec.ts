import { randomUUID } from 'node:crypto';

import type { APIRequestContext } from '@playwright/test';

import { FRONTEND_URL } from '../constants';
import { expect, test } from '../fixtures';

/** Sign up fields with an email no other test uses: the test database is shared by the run. */
function newUser() {
  return { fullName: 'Tanzir Rahman', email: `${randomUUID()}@example.com`, password: 'abcdef12' };
}

// T18: AC15, sign ups seed the demo dataset through the Vite proxy, also when they run at the same time (#73, #78).
test('signs up 3 users at the same time, each with their own session', async ({ playwright }) => {
  // One cookie jar per user, like three browsers.
  const contexts: APIRequestContext[] = await Promise.all(
    [1, 2, 3].map(() => playwright.request.newContext({ baseURL: FRONTEND_URL })),
  );
  const users = contexts.map(() => newUser());

  try {
    const signups = await Promise.all(
      contexts.map(async (context, i) => {
        const started = performance.now();
        const response = await context.post('/api/auth/signup', { data: users[i] });
        return { status: response.status(), body: (await response.json()) as unknown, ms: performance.now() - started };
      }),
    );
    for (const [i, signup] of signups.entries()) {
      console.log(`Sign up ${i + 1} (scrypt and demo seeding, NODE_ENV=test): ${signup.ms.toFixed(0)} ms`);
    }

    expect(signups.map((signup) => signup.status)).toEqual([201, 201, 201]);
    for (const [i, signup] of signups.entries()) {
      expect(signup.body).toMatchObject({ fullName: users[i]!.fullName, email: users[i]!.email });
    }
    const mes = await Promise.all(contexts.map(async (context) => context.get('/api/auth/me')));
    expect(mes.map((response) => response.status())).toEqual([200, 200, 200]);
    expect(
      await Promise.all(mes.map(async (response) => ((await response.json()) as { email: string }).email)),
    ).toEqual(users.map((user) => user.email));
  } finally {
    await Promise.all(contexts.map((context) => context.dispose()));
  }
});
