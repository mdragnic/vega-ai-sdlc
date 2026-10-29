import { describe, expect, it } from 'vitest';

import { categoryLabel, expenseCategorySchema, hyphenatedCategoryLabel } from '../src/index.js';

const SOFT_HYPHEN = '­';

// T1: the 6 fixed expense categories, the same for every user, in the designed order (#56, #61).
describe('expenseCategorySchema', () => {
  it.each(['housing', 'food', 'transportation', 'entertainment', 'shopping', 'others'])('accepts %j', (value) => {
    expect(expenseCategorySchema.parse(value)).toBe(value);
  });

  // No "bills" category (#56), no display names, no empty value.
  it.each(['bills', 'Housing', '', null, undefined])('rejects %j', (value) => {
    expect(expenseCategorySchema.safeParse(value).success).toBe(false);
  });

  it('lists the categories in the order of Expenses Breakdown (104) and the Expenses page (109)', () => {
    expect(expenseCategorySchema.options).toEqual([
      'housing',
      'food',
      'transportation',
      'entertainment',
      'shopping',
      'others',
    ]);
  });
});

describe('categoryLabel', () => {
  it.each([
    ['housing', 'Housing'],
    ['food', 'Food'],
    ['transportation', 'Transportation'],
    ['entertainment', 'Entertainment'],
    ['shopping', 'Shopping'],
    ['others', 'Others'],
  ] as const)('shows %j as %j', (category, label) => {
    expect(categoryLabel(category)).toBe(label);
  });
});

// T1b, AC14: the names with soft hyphens at their dictionary break points, for text that can wrap (#115 b).
describe('hyphenatedCategoryLabel', () => {
  it.each([
    ['housing', ['Hous', 'ing']],
    ['food', ['Food']],
    ['transportation', ['Trans', 'por', 'ta', 'tion']],
    ['entertainment', ['En', 'ter', 'tain', 'ment']],
    ['shopping', ['Shop', 'ping']],
    ['others', ['Oth', 'ers']],
  ] as const)('breaks %j only as %j', (category, syllables) => {
    expect(hyphenatedCategoryLabel(category).split(SOFT_HYPHEN)).toEqual(syllables);
  });

  it.each(expenseCategorySchema.options)('equals the label of %j with the soft hyphens removed', (category) => {
    expect(hyphenatedCategoryLabel(category).replaceAll(SOFT_HYPHEN, '')).toBe(categoryLabel(category));
  });
});
