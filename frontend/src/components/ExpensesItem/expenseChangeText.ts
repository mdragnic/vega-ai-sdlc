import { type ExpenseChange, formatPercent } from '@finebank/shared';

/**
 * What a screen reader says for a category's change against last month (#21, #61): "up 7% compared to last month",
 * "down 17% compared to last month", or "0% compared to last month" with no direction. One sentence for Overview's
 * `ExpensesItem` and the Expenses cards (`ExpensesBreakdown`), which hide their percentage and arrow. Formats as sent.
 */
export function expenseChangeText({ percent, direction }: ExpenseChange): string {
  return `${direction === null ? '' : `${direction} `}${formatPercent(percent)} compared to last month`;
}
