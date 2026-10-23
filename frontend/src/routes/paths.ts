/**
 * Route paths of every screen and tab. Screens, links and redirects use only these (task 003).
 * `accountDetails` is the route pattern; links to one account use `accountDetailsPath`.
 */
export const paths = {
  login: '/login',
  signUp: '/sign-up',
  forgotPassword: '/forgot-password',
  overview: '/overview',
  balances: '/balances',
  // Account Details belongs to Balances (#47).
  accountDetails: '/balances/:accountId',
  transactions: '/transactions',
  bills: '/bills',
  expenses: '/expenses',
  goals: '/goals',
  settingsAccount: '/settings/account',
  settingsSecurity: '/settings/security',
} as const;

/** The Account Details path of one account. The id is encoded, so it stays one path segment. */
export function accountDetailsPath(accountId: string): string {
  return `${paths.balances}/${encodeURIComponent(accountId)}`;
}
