import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ComparisonBarChartSkeleton } from '../../src/components';
import styles from '../../src/components/ComparisonBarChartSkeleton/ComparisonBarChartSkeleton.module.css';

const count = (root: Element, className: string | undefined) => root.querySelectorAll(`.${className}`).length;

// The chart's loading skeleton (#6): the chart's box, label lines and bar blocks, no text (T13 unit).
describe('ComparisonBarChartSkeleton', () => {
  it.each([7, 12])('draws %i groups of two bar blocks and a label line, and 5 axis label lines', (groups) => {
    const { container } = render(<ComparisonBarChartSkeleton groups={groups} />);
    const root = container.firstElementChild!;

    expect(root).toHaveClass(styles.skeleton!);
    expect(count(root, styles.group)).toBe(groups);
    expect(count(root, styles.bar)).toBe(groups * 2);
    expect(count(root, styles.groupLabel)).toBe(groups);
    expect(count(root, styles.axisLabel)).toBe(5);
    expect(root.textContent).toBe('');
  });
});
