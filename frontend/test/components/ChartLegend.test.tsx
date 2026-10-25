import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ChartLegend } from '../../src/components';
import styles from '../../src/components/ChartLegend/ChartLegend.module.css';

// T12 (unit): the current period first, each label after its swatch; text never wears the series color (AC11).
describe('ChartLegend', () => {
  it('lists the current item, then the previous one', () => {
    render(<ChartLegend current="This week" previous="Last week" />);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');

    expect(items.map((item) => item.textContent)).toEqual(['This week', 'Last week']);
  });

  it('puts a Primary swatch before the current label and a Gray/05 swatch before the previous one', () => {
    render(<ChartLegend current="This year" previous="Last year" />);
    const [current, previous] = screen.getAllByRole('listitem');

    for (const [item, swatchClass] of [
      [current!, styles.current!],
      [previous!, styles.previous!],
    ] as const) {
      const swatch = item.firstElementChild!;
      expect(swatch).toHaveClass(styles.swatch!, swatchClass);
      expect(swatch).toHaveAttribute('aria-hidden', 'true');
      expect(swatch.textContent).toBe('');
    }
  });
});
