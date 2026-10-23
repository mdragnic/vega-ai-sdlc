import type { Money } from '../contract/money.js';
import { assertCents, groupThousands, splitCents } from './cents.js';

/** Amounts everywhere outside charts and inputs: `$25,056.00`, `-$1,234.00` (#11). */
export function formatMoney({ cents }: Money): string {
  assertCents(cents);
  const { dollars, fraction } = splitCents(Math.abs(cents));
  return `${cents < 0 ? '-' : ''}$${groupThousands(dollars)}.${fraction}`;
}

/** Listed transaction amounts: `+$160.00` for income, `-$160.00` for an expense (#19). */
export function formatSignedMoney(money: Money, direction: 'income' | 'expense'): string {
  assertCents(money.cents);
  if (money.cents < 0) {
    throw new RangeError(`A transaction amount is never negative, its direction gives the sign; got ${money.cents}`);
  }
  return `${direction === 'income' ? '+' : '-'}${formatMoney(money)}`;
}

/** Compact units, largest first, with the number of dollar digits each one drops. */
const COMPACT_UNITS = [
  { suffix: 'M', digits: 6 },
  { suffix: 'k', digits: 3 },
] as const;

/**
 * Chart axes and goal gauges (#11, #82): `$12.5k`, `$2.5M`, `$999`, `$999.50`, `-$1.2k`.
 * k and M keep one decimal, rounded toward zero, and drop `.0`. Under $1,000 the amount is exact,
 * with decimals only when it has cents.
 */
export function formatCompactMoney({ cents }: Money): string {
  assertCents(cents);
  const minus = cents < 0 ? '-' : '';
  const { dollars, fraction } = splitCents(Math.abs(cents));

  for (const { suffix, digits } of COMPACT_UNITS) {
    if (dollars.length > digits) {
      // The whole units and the first dropped digit; ignoring the rest rounds toward zero.
      const whole = dollars.slice(0, -digits);
      const tenth = dollars.charAt(whole.length);
      return `${minus}$${groupThousands(whole)}${tenth === '0' ? '' : `.${tenth}`}${suffix}`;
    }
  }

  return `${minus}$${dollars}${fraction === '00' ? '' : `.${fraction}`}`;
}
