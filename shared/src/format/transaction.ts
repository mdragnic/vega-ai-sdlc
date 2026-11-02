import type { TransactionDirection, TransactionStatus } from '../contract/transaction.js';

const STATUS_LABELS: Record<TransactionStatus, string> = {
  complete: 'Complete',
  pending: 'Pending',
  failed: 'Failed',
};

const TYPE_LABELS: Record<TransactionDirection, string> = {
  income: 'Credit',
  expense: 'Debit',
};

/** The Status column's text (#27): Complete, Pending or Failed. */
export function transactionStatusLabel(status: TransactionStatus): string {
  return STATUS_LABELS[status];
}

/** The Transaction Type column's text, from the direction (#27): Credit for income, Debit for an expense. */
export function transactionTypeLabel(direction: TransactionDirection): string {
  return TYPE_LABELS[direction];
}
