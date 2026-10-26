import type { BankAccount } from '../bank-data/bank-data-provider.js';

/**
 * The account number as the API shows it: `**** **** **** 2598`, the last 4 digits only (#25). The one reader of
 * the full number outside bank-data/ and demo/ (test/bank-data-source.test.ts). A stored number with fewer than
 * 4 digits throws rather than showing something else.
 */
export function maskAccountNumber({ accountNumber }: Pick<BankAccount, 'accountNumber'>): string {
  const lastFour = accountNumber.replace(/\D/g, '').slice(-4);
  if (lastFour.length < 4) {
    throw new RangeError('An account number has at least 4 digits');
  }
  return `**** **** **** ${lastFour}`;
}
