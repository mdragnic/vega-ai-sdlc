import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { RecentTransactionRow, TransactionHistoryRow, TransactionRow } from '@finebank/shared';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { RecentTransactionItem, TransactionItem, TransactionsHistoryItem } from '../../src/components';
import signed from '../../src/styles/signedAmount.module.css';

const srcDir = resolve(import.meta.dirname, '../../src');
const source = (path: string) => readFileSync(resolve(srcDir, path), 'utf8');

/** Each rule of a stylesheet as its selector and its declarations, comments removed. */
function rules(css: string): { selector: string; body: string }[] {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...plain.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
    selector: selector!.trim(),
    body: body!.replace(/\s+/g, ' ').trim(),
  }));
}

const usd = (cents: number) => ({ cents, currency: 'USD' as const });

// Hand-written rows: one income and one expense, the amounts and their signed texts derived by hand.
const recentIncome: RecentTransactionRow = {
  item: 'Dividend',
  shopName: 'AB Bank Ltd',
  category: null,
  direction: 'income',
  occurredAt: '2026-10-15T12:00:00.000Z',
  amount: usd(8_400),
};
const recentExpense: RecentTransactionRow = {
  item: 'Jeans',
  shopName: 'Denim House',
  category: 'shopping',
  direction: 'expense',
  occurredAt: '2026-10-22T12:00:00.000Z',
  amount: usd(26_600),
};
const listIncome: TransactionRow = { ...recentIncome, paymentMethod: 'checking' };
const listExpense: TransactionRow = { ...recentExpense, paymentMethod: 'credit-card' };
const historyIncome: TransactionHistoryRow = {
  occurredAt: '2026-10-15T12:00:00.000Z',
  status: 'complete',
  direction: 'income',
  receipt: 'z7YBsODpLNW',
  amount: usd(8_400),
};
const historyExpense: TransactionHistoryRow = { ...historyIncome, direction: 'expense', amount: usd(26_600) };

type Case = { name: string; render: (direction: 'income' | 'expense') => void };

const tableBody = (row: ReactNode) => (
  <table>
    <tbody>{row}</tbody>
  </table>
);

const cases: Case[] = [
  {
    name: 'RecentTransactionItem',
    render: (direction) =>
      render(
        <ul>
          <RecentTransactionItem transaction={direction === 'income' ? recentIncome : recentExpense} divided={false} />
        </ul>,
      ),
  },
  {
    name: 'TransactionItem',
    render: (direction) =>
      render(
        tableBody(<TransactionItem transaction={direction === 'income' ? listIncome : listExpense} divided={false} />),
      ),
  },
  {
    name: 'TransactionsHistoryItem',
    render: (direction) =>
      render(
        tableBody(
          <TransactionsHistoryItem
            transaction={direction === 'income' ? historyIncome : historyExpense}
            divided={false}
          />,
        ),
      ),
  },
];

// T5: task 032 AC5. The amount's colour follows the row's direction as sent (#132), never its formatted text; the text
// stays as before (#19).
describe.each(cases)('$name', ({ render: renderRow }) => {
  it('gives an income amount the income colour and keeps its text', () => {
    renderRow('income');
    const amount = screen.getByText('+$84.00');
    expect(amount).toHaveClass(signed.income!);
    expect(amount).not.toHaveClass(signed.expense!);
  });

  it('gives an expense amount the expense colour and keeps its text', () => {
    renderRow('expense');
    const amount = screen.getByText('-$266.00');
    expect(amount).toHaveClass(signed.expense!);
    expect(amount).not.toHaveClass(signed.income!);
  });
});

// T6: task 032 AC5. The shared module sets the colour only, to the two tokens of #134 (a1); the three items no longer
// set a colour on the amount, so nothing overrides it.
describe('the signed amount styles', () => {
  it('sets only the colour of each direction, to its token', () => {
    expect(rules(source('styles/signedAmount.module.css'))).toEqual([
      { selector: '.income', body: 'color: var(--color-income);' },
      { selector: '.expense', body: 'color: var(--color-expense);' },
    ]);
  });

  it.each([
    ['RecentTransactionItem', '.amount'],
    ['TransactionItem', '.row > .amount'],
    ['TransactionsHistoryItem', '.row > .amount'],
  ])('%s sets no colour on its amount', (name, selector) => {
    const amountRules = rules(source(`components/${name}/${name}.module.css`)).filter(
      (rule) => rule.selector === selector,
    );
    expect(amountRules).toHaveLength(1);
    expect(amountRules[0]!.body).not.toMatch(/(^|;\s*)color:/);
  });

  // T9: task 032 AC7. The Expenses card items are unsigned and keep their designed colour (#122 b).
  it('leaves the Expenses card items in Secondary, without the signed colours', () => {
    expect(source('components/ExpensesLineItem/ExpensesLineItem.tsx')).not.toContain('signedAmount');
    const amountRules = rules(source('components/ExpensesLineItem/ExpensesLineItem.module.css')).filter(
      (rule) => rule.selector === '.amount',
    );
    expect(amountRules).toHaveLength(1);
    expect(amountRules[0]!.body).toContain('color: var(--color-secondary);');
  });
});
