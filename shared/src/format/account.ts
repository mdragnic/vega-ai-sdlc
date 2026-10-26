import type { AccountType } from '../contract/account.js';

const LABELS: Record<AccountType, string> = {
  'credit-card': 'Credit Card',
  checking: 'Checking',
  savings: 'Savings',
  investment: 'Investment',
  loan: 'Loan',
};

/** The display name of an Account Type (#26). */
export function accountTypeLabel(type: AccountType): string {
  return LABELS[type];
}
