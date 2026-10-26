import { describe, expect, it } from 'vitest';

import { inAppReturnTarget, paths, RETURN_TO_PARAM, returnTarget } from '../src/index.js';

// Task 012 T16: the task 009 table, now in Node, where the backend uses the same rule (AC4, AC16, #3). The frontend
// runs it in the browser in frontend/test/routes/return-to.test.ts.
describe('returnTarget', () => {
  it.each([
    ['/balances', '/balances'],
    ['/balances/12?x=1#y', '/balances/12?x=1#y'],
    ['/settings/security', '/settings/security'],
    ['/bills?tab=1#x', '/bills?tab=1#x'],
    // A space is not a parser trick: it is encoded, not dropped.
    ['/bills?q=a b', '/bills?q=a%20b'],
    // Unknown in-app paths are allowed here; task 011 sends them to Overview.
    ['/no-such-page', '/no-such-page'],
  ])('keeps the in-app path %s', (value, target) => {
    expect(returnTarget(value)).toBe(target);
    expect(inAppReturnTarget(value)).toBe(target);
  });

  it.each([
    ['an absolute URL', 'https://evil.example/overview'],
    ['an absolute URL on the app origin', 'http://localhost:5173/bills'],
    ['a protocol-relative URL', '//evil.example'],
    ['a backslash after the slash', '/\\evil.example'],
    ['a decoded tab trick', '/\t/evil.example'],
    ['a decoded newline trick', '/\n/evil.example'],
    ['a decoded carriage return trick', '/\r/evil.example'],
    ['an encoded tab trick', '/%09/evil.example'],
    ['an encoded slash trick', '/%2F%2Fevil.example'],
    ['an encoded backslash trick', '/%5Cevil.example'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a path without the leading slash', 'balances'],
    ['an empty value', ''],
    ['no value', null],
    ['Login', '/login'],
    ['Login with a query', '/login?returnTo=%2Fbills'],
    ['Sign up', '/sign-up'],
    ['Forgot Password', '/forgot-password'],
    ['Login in capitals', '/LOGIN'],
    ['Login with a trailing slash', '/login/'],
  ])('opens Overview for %s', (_name, value) => {
    expect(returnTarget(value)).toBe('/overview');
    expect(inAppReturnTarget(value)).toBeNull();
  });

  it('names the query parameter returnTo (#75)', () => {
    expect(RETURN_TO_PARAM).toBe('returnTo');
  });
});

// The paths the backend redirects to are the frontend's route paths (task 003).
describe('paths', () => {
  it('has Login and Overview', () => {
    expect(paths.login).toBe('/login');
    expect(paths.overview).toBe('/overview');
  });
});
