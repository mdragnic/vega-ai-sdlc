import type { Money } from '@finebank/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TargetVsAchievementMeter } from '../../src/components';
import styles from '../../src/components/TargetVsAchievementMeter/TargetVsAchievementMeter.module.css';
import {
  ARC_RADIUS,
  arcPath,
  CENTER_X,
  CENTER_Y,
  GAUGE_WIDTH,
  needleRotation,
  STROKE_WIDTH,
} from '../../src/components/TargetVsAchievementMeter/geometry';

const dollars = (amount: number): Money => ({ cents: amount * 100, currency: 'USD' });

function renderMeter(present: number, target: number, progress: number) {
  const { container } = render(
    <TargetVsAchievementMeter present={dollars(present)} target={dollars(target)} progress={progress} />,
  );
  return container.querySelector('svg')!;
}

const one = (root: Element, className: string | undefined) => root.querySelector(`.${className}`);

/** The end point of an arc path: its last two numbers. */
function endPoint(d: string): [number, number] {
  const numbers = d.match(/-?[\d.]+(?:e-?\d+)?/g)!.map(Number);
  return [numbers.at(-2)!, numbers.at(-1)!];
}

/** Degrees clockwise from the gauge's left end to a point on the arc. */
const degreesFromLeft = ([x, y]: [number, number]) => 180 - (Math.atan2(CENTER_Y - y, x - CENTER_X) * 180) / Math.PI;

// T14: the arc and the needle follow the progress; the labels use the compact format (AC13, AC14, #11, #18, #31).
describe('TargetVsAchievementMeter', () => {
  it('draws the Gray/05 track over the half circle, round-capped inside it', () => {
    const svg = renderMeter(12_500, 20_000, 0.625);
    const track = one(svg, styles.track)!;
    const [startX, startY] = arcPath(0)
      .match(/^M([\d.]+),([\d.]+)/)!
      .slice(1)
      .map(Number) as [number, number];

    expect(track).toHaveAttribute('d', arcPath(1));
    expect(track).toHaveAttribute('stroke-width', String(STROKE_WIDTH));
    expect(track).toHaveAttribute('stroke-linecap', 'round');
    // The caps end on the horizontal through the center: the ends start half a stroke above it.
    expect(CENTER_Y - startY).toBeCloseTo(STROKE_WIDTH / 2);
    expect(startX).toBeLessThan(CENTER_X);
    expect(degreesFromLeft(endPoint(arcPath(1)))).toBeCloseTo(180 - degreesFromLeft([startX, startY]));
    expect(ARC_RADIUS + STROKE_WIDTH / 2).toBe(GAUGE_WIDTH / 2);
  });

  it.each([
    [12_500, 20_000, 0.625, '$12.5k', -67.5],
    [16_250, 20_000, 0.8125, '$16.2k', -33.75],
  ])(
    'draws $%i of $%i over its first %d of the track, the needle at %s',
    (present, target, progress, center, rotation) => {
      const svg = renderMeter(present, target, progress);
      const arc = one(svg, styles.progress)!;
      const [start, end] = [degreesFromLeft(endPoint(arcPath(0))), degreesFromLeft(endPoint(arcPath(1)))];

      expect(arc).toHaveAttribute('d', arcPath(progress));
      expect((degreesFromLeft(endPoint(arcPath(progress))) - start) / (end - start)).toBeCloseTo(progress);
      expect(one(svg, styles.needle)).toHaveAttribute('transform', `rotate(${rotation} ${CENTER_X} ${CENTER_Y})`);
      // -67.5 turns the needle from pointing right to 112.5 degrees clockwise from the left end.
      expect(180 + rotation).toBeCloseTo(180 * progress);
      expect(one(svg, styles.value)).toHaveTextContent(center);
      expect(one(svg, styles.limitMin)).toHaveTextContent('$0');
      expect(one(svg, styles.limitMax)).toHaveTextContent('$20k');
    },
  );

  it('draws no Primary arc at 0, with the needle pointing left', () => {
    const svg = renderMeter(0, 20_000, 0);

    expect(one(svg, styles.progress)).toBeNull();
    expect(needleRotation(0)).toBe(-180);
    expect(one(svg, styles.needle)).toHaveAttribute('transform', `rotate(-180 ${CENTER_X} ${CENTER_Y})`);
    expect(one(svg, styles.value)).toHaveTextContent('$0');
  });

  it('fills the whole track over the Target, with the needle pointing right and the Present in the center', () => {
    const svg = renderMeter(25_000, 20_000, 1);

    expect(one(svg, styles.progress)).toHaveAttribute('d', arcPath(1));
    expect(one(svg, styles.needle)).toHaveAttribute('transform', `rotate(0 ${CENTER_X} ${CENTER_Y})`);
    expect(one(svg, styles.value)).toHaveTextContent('$25k');
    expect(one(svg, styles.limitMax)).toHaveTextContent('$20k');
  });

  it('shows $1,000M of $1,000M in the compact format', () => {
    const svg = renderMeter(1_000_000_000, 1_000_000_000, 1);

    expect(one(svg, styles.value)).toHaveTextContent('$1,000M');
    expect(one(svg, styles.limitMax)).toHaveTextContent('$1,000M');
  });

  it('centers the limit labels under the arc ends', () => {
    const svg = renderMeter(12_500, 20_000, 0.625);
    const [endX] = endPoint(arcPath(1));
    const startX = Number(arcPath(0).match(/^M([\d.]+)/)![1]);

    expect(one(svg, styles.limitMin)).toHaveAttribute('x', String(startX));
    expect(one(svg, styles.limitMax)).toHaveAttribute('x', String(endX));
    expect(one(svg, styles.value)).toHaveAttribute('x', String(CENTER_X));
    for (const label of svg.querySelectorAll('text')) expect(label).toHaveAttribute('text-anchor', 'middle');
  });

  it.each([-0.1, 1.1, Number.NaN])('rejects a progress of %d', (progress) => {
    expect(() => renderMeter(12_500, 20_000, progress)).toThrow(RangeError);
  });
});

// T16: a meter named by the caption (AC15).
describe('TargetVsAchievementMeter accessibility', () => {
  it('is a meter named "Target vs Achievement" with the progress and the center label', () => {
    const svg = renderMeter(12_500, 20_000, 0.625);
    const meter = screen.getByRole('meter', { name: 'Target vs Achievement' });

    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '1');
    expect(meter).toHaveAttribute('aria-valuenow', '0.625');
    expect(meter).toHaveAttribute('aria-valuetext', '$12.5k');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Target vs Achievement')).toHaveClass(styles.caption!);
  });
});
