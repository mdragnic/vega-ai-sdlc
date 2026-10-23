import { matchPath } from 'react-router';
import { describe, expect, it } from 'vitest';

import { accountDetailsPath, paths } from '../../src/routes/paths';

// The one list of route paths later tasks use (task 003 Scope).
describe('route paths', () => {
  it('has a distinct absolute path for every screen and tab', () => {
    const all = Object.values(paths);

    expect(Object.keys(paths).toSorted()).toEqual(
      [
        'accountDetails',
        'balances',
        'bills',
        'expenses',
        'forgotPassword',
        'goals',
        'login',
        'overview',
        'settingsAccount',
        'settingsSecurity',
        'signUp',
        'transactions',
      ].toSorted(),
    );
    expect(all.every((path) => path.startsWith('/'))).toBe(true);
    expect(new Set(all).size).toBe(all.length);
  });

  it('builds an Account Details path that the route pattern reads back', () => {
    const match = matchPath(paths.accountDetails, accountDetailsPath('acc-42'));

    expect(accountDetailsPath('acc-42')).toBe('/balances/acc-42');
    expect(match?.params.accountId).toBe('acc-42');
  });

  it('keeps an account id with reserved characters in one path segment', () => {
    const path = accountDetailsPath('a b/c?d');
    const match = matchPath(paths.accountDetails, path);

    expect(path).toBe('/balances/a%20b%2Fc%3Fd');
    expect(match && decodeURIComponent(match.params.accountId!)).toBe('a b/c?d');
  });

  // Account Details belongs to Balances (#47), so its path sits under the Balances path.
  it('puts Account Details under Balances', () => {
    expect(accountDetailsPath('x').startsWith(`${paths.balances}/`)).toBe(true);
  });
});
