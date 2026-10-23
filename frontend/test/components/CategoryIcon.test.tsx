import type { ExpenseCategory } from '@finebank/shared';
import { render, screen } from '@testing-library/react';
import type { ComponentType, SVGProps } from 'react';
import { describe, expect, it } from 'vitest';

import { Food, Housing, Movie, Others, Shopping, Transport, Wallet } from '../../src/assets/icons';
import { CategoryIcon } from '../../src/components';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/** The markup of an icon from the icon index, rendered on its own. */
function iconMarkup(Icon: Icon): string {
  const { container, unmount } = render(<Icon />);
  const markup = container.querySelector('svg')!.innerHTML;
  unmount();
  return markup;
}

// The mapping checked against the PNGs by rendering and diffing (task 004 Log, #56).
const mapping: [ExpenseCategory | null, string, Icon][] = [
  ['housing', 'Housing', Housing],
  ['food', 'Food', Food],
  ['transportation', 'Transportation', Transport],
  ['entertainment', 'Entertainment', Movie],
  ['shopping', 'Shopping', Shopping],
  ['others', 'Others', Others],
  [null, 'Income', Wallet],
];

const variants = ['recent', 'breakdown', 'header', 'goal', 'plain'] as const;

// T8: the mapped icon, named by the category label, or "Income" (AC8, #56).
describe('CategoryIcon', () => {
  it.each(mapping)('shows the mapped icon for %j, named %j', (category, label, Icon) => {
    render(<CategoryIcon category={category} variant="recent" />);
    const icon = screen.getByRole('img', { name: label });

    expect(icon.querySelector('svg')!.innerHTML).toBe(iconMarkup(Icon));
  });

  it.each(variants)('keeps the icon and its name in the %s variant', (variant) => {
    render(<CategoryIcon category="shopping" variant={variant} />);

    expect(screen.getByRole('img', { name: 'Shopping' }).querySelector('svg')!.innerHTML).toBe(iconMarkup(Shopping));
  });

  it('has no name and is hidden from assistive technology when decorative', () => {
    const { container } = render(<CategoryIcon category="food" variant="goal" decorative />);

    expect(screen.queryByRole('img')).toBeNull();
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('svg')!.innerHTML).toBe(iconMarkup(Food));
  });
});
