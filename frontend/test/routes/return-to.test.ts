import { describe, expect, it } from 'vitest';

import { loginPathFor, returnTarget } from '../../src/routes/return-to';

// T10: the return target is a relative path inside the app, never an open redirect (AC14, #3).
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
  });

  it.each([
    ['an absolute URL', 'https://evil.example/overview'],
    ['an absolute URL on the app origin', `${window.location.origin}/bills`],
    ['a protocol-relative URL', '//evil.example'],
    ['a backslash after the slash', '/\\evil.example'],
    // The value as read from the query: `?returnTo=/%09/evil.example` decodes to a tab, which the URL parser drops.
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
  });
});

describe('loginPathFor', () => {
  it('carries the path, query and hash of the page asked for', () => {
    expect(loginPathFor({ pathname: '/balances/12', search: '?view=1', hash: '#top' })).toBe(
      '/login?returnTo=%2Fbalances%2F12%3Fview%3D1%23top',
    );
  });

  it('carries a plain path', () => {
    expect(loginPathFor({ pathname: '/bills', search: '', hash: '' })).toBe('/login?returnTo=%2Fbills');
  });
});
