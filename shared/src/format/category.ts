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

// Soft hyphens (U+00AD) at the dictionary break points: browsers without a hyphenation dictionary, such as Chromium
// on Windows, break a name there with a hyphen drawn, never inside a syllable (#115 b).
const HYPHENATED_LABELS: Record<ExpenseCategory, string> = {
  housing: 'Hous­ing',
  food: 'Food',
  transportation: 'Trans­por­ta­tion',
  entertainment: 'En­ter­tain­ment',
  shopping: 'Shop­ping',
  others: 'Oth­ers',
};

/**
 * The display name of an expense category with soft hyphens at its break points, for display where the name can
 * wrap (#115 b). Without them it is `categoryLabel`, which accessible names use.
 */
export function hyphenatedCategoryLabel(category: ExpenseCategory): string {
  return HYPHENATED_LABELS[category];
}
