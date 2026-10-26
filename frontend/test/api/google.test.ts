import { describe, expect, it } from 'vitest';

import { googleSignInUrl } from '../../src/api/google';

// Task 012 T18: the start route, with the return target as its returnTo (AC1, #3, #75).
describe('googleSignInUrl', () => {
  it('is the start route without a return target', () => {
    expect(googleSignInUrl()).toBe('/api/auth/google');
  });

  it('carries the return target, its query and hash encoded', () => {
    expect(googleSignInUrl('/bills?x=1#y')).toBe('/api/auth/google?returnTo=%2Fbills%3Fx%3D1%23y');
  });
});
