import type { ExpenseCategory } from '../contract/category.js';

const LABELS: Record<ExpenseCategory, string> = {
  housing: 'Housing',
  food: 'Food',
  transportation: 'Transportation',
  entertainment: 'Entertainment',
  shopping: 'Shopping',
  others: 'Others',
};

/** The display name of an expense category (#56). */
export function categoryLabel(category: ExpenseCategory): string {
  return LABELS[category];
}
