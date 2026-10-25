import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures';
import { computed, tokenColor } from '../helpers';

async function openGallery(page: Page) {
  await page.goto('/dev/components');
  await expect(page.getByRole('heading', { level: 1, name: 'Component gallery' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const figure = (page: Page, region: string, name: string) =>
  page.getByRole('region', { name: region, exact: true }).getByRole('figure', { name, exact: true });

type Box = { x: number; y: number; width: number; height: number };
const box = async (locator: Locator): Promise<Box> => (await locator.boundingBox())!;
const boxes = async (locator: Locator) => Promise.all((await locator.all()).map(box));
/**
 * The geometry box of an SVG shape. Playwright's boundingBox reads Chrome's content quads, which pad a stroked
 * path by half its stroke times the miter limit, so stroked shapes are read with getBoundingClientRect.
 */
const shapeBox = (locator: Locator): Promise<Box> =>
  locator.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  });
/** A chart's own SVG, not the nested coordinate systems of its groups. */
const plot = (locator: Locator) => locator.locator('svg[aria-hidden="true"]');

/** The SVG text, line and path elements of a chart, read in the page: boxes, colors and fonts. */
async function readChart(chart: Locator) {
  const elements = await chart
    .locator('svg')
    .first()
    .evaluate((svg) =>
      [svg, ...svg.querySelectorAll('text, line, path')].map((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          tag: element.tagName,
          text: element.textContent,
          anchor: element.getAttribute('text-anchor'),
          x,
          y,
          width,
          height,
          fill: style.fill,
          stroke: style.stroke,
          strokeWidth: style.strokeWidth,
          fontSize: style.fontSize,
        };
      }),
    );
  const [svg, ...parts] = elements;
  const texts = parts.filter((part) => part.tag === 'text');
  return {
    svg: svg!,
    yLabels: texts.filter((text) => text.anchor === 'end'),
    xLabels: texts.filter((text) => text.anchor === 'middle'),
    lines: parts.filter((part) => part.tag === 'line'),
    bars: parts.filter((part) => part.tag === 'path'),
  };
}

/** Within half a CSS pixel: SVG text boxes come from font metrics. */
const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.5);

// T7: the axis column, the grid, the bars and the groups as measured on 104 and 109 (AC5, AC6, AC7).
test.describe('ComparisonBarChart layout', () => {
  test('the Statistics sample is laid out like 104', async ({ page }) => {
    await openGallery(page);
    const sample = figure(page, 'ComparisonBarChart', 'Statistics sample, like 104');
    const card = sample.locator('xpath=./*[2]/*[1]');
    const chart = await readChart(sample);
    const gray03 = await tokenColor(page, '--color-gray-03');
    const gray05 = await tokenColor(page, '--color-gray-05');
    const gray06 = await tokenColor(page, '--color-gray-06');
    const teal = await tokenColor(page, '--color-primary');
    const cardBox = await box(card);

    // 104: card 728 wide, content x 704 to 1384 (680) under the 24px header row.
    expect(cardBox.width).toBe(728);
    expect(chart.svg.x - cardBox.x).toBe(24);
    expect(chart.svg.width).toBe(680);
    expect(chart.svg.height).toBe(188);
    expect(chart.svg.y - cardBox.y).toBe(24 + 24);

    // y labels: right edge at 48 (104: x 752), Gray/03 14px, centered on the lines; $0 at the bottom.
    expect(chart.yLabels.map((label) => label.text)).toEqual(['$0', '$100', '$200', '$300', '$400']);
    for (const [index, label] of chart.yLabels.entries()) {
      near(label.x + label.width - chart.svg.x, 48);
      expect(label.fill).toBe(gray03);
      expect(label.fontSize).toBe('14px');
      near(label.y + label.height / 2 - chart.svg.y, 15.5 + 36 * (4 - index));
    }

    // Grid: 1px Gray/06 lines from x 64 (104: 768) to the right edge, 36 apart; the top one 63 below the card top.
    expect(chart.lines).toHaveLength(5);
    for (const [index, line] of chart.lines.entries()) {
      expect(line.x - chart.svg.x).toBe(64);
      expect(line.x + line.width).toBe(chart.svg.x + chart.svg.width);
      expect(line.y - chart.svg.y).toBe(15.5 + 36 * (4 - index));
      expect(line.stroke).toBe(gray06);
      expect(line.strokeWidth).toBe('1px');
    }
    expect(chart.lines[4]!.y - 0.5 - cardBox.y).toBe(63);

    // Bars: 7 gray and 4 teal, 16 wide, 8 apart, standing on the $0 line's lower edge (104: y 656).
    const gray = chart.bars.filter((bar) => bar.fill === gray05);
    const tealBars = chart.bars.filter((bar) => bar.fill === teal);
    expect([gray.length, tealBars.length]).toEqual([7, 4]);
    for (const bar of chart.bars) {
      expect(bar.width).toBe(16);
      expect(bar.y + bar.height - chart.svg.y).toBe(160);
    }
    // $322.00 on the $400 axis: 115.92 high.
    expect(gray[3]!.height).toBeCloseTo((322 / 400) * 144, 1);
    tealBars.forEach((bar, index) => expect(bar.x - (gray[index]!.x + 16)).toBe(8));

    // Groups: the first gray bar 86 in (104: x 790), 84 apart; each x label centered under its group.
    near(gray[0]!.x - chart.svg.x, 86);
    gray.slice(1).forEach((bar, index) => near(bar.x - gray[index]!.x, 84));
    expect(chart.xLabels.map((label) => label.text)).toEqual([
      '19 Mon',
      '20 Tue',
      '21 Wed',
      '22 Thu',
      '23 Fri',
      '24 Sat',
      '25 Sun',
    ]);
    for (const [index, label] of chart.xLabels.entries()) {
      near(label.x + label.width / 2, gray[index]!.x + 20);
      expect(label.fill).toBe(gray03);
      expect(label.fontSize).toBe('14px');
    }
  });

  test('the Expenses sample is laid out like 109', async ({ page }) => {
    await openGallery(page);
    const sample = figure(page, 'ComparisonBarChart', 'Expenses sample, like 109');
    const chart = await readChart(sample);
    const gray05 = await tokenColor(page, '--color-gray-05');
    const gray = chart.bars.filter((bar) => bar.fill === gray05);

    // 109: content x 328 to 1384 (1056), grid from x 392, first gray bar x 414, 12 groups 80 apart.
    expect(chart.svg.width).toBe(1056);
    expect(chart.lines[0]!.x - chart.svg.x).toBe(64);
    expect(gray).toHaveLength(12);
    expect(chart.bars).toHaveLength(22);
    near(gray[0]!.x - chart.svg.x, 86);
    gray.slice(1).forEach((bar, index) => near(bar.x - gray[index]!.x, 80));
    near(chart.svg.x + chart.svg.width - (gray[11]!.x + 40), 50);
    expect(chart.yLabels.map((label) => label.text)).toEqual(['$0', '$1k', '$2k', '$3k', '$4k']);
    expect(chart.xLabels.map((label) => label.text)).toEqual([
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]);
    chart.xLabels.forEach((label, index) => near(label.x + label.width / 2, gray[index]!.x + 20));
  });
});

// T12: the legend in the header row, as in 104 and 109 (AC11).
test('ChartLegend shows Primary then Gray/05 swatches, 16x8, before Secondary 12px labels', async ({ page }) => {
  await openGallery(page);
  const legend = figure(page, 'ComparisonBarChart', 'Statistics sample, like 104').getByRole('list');
  const items = legend.getByRole('listitem');
  const swatches = items.locator('span');
  const [first, second] = await boxes(swatches);
  const [firstItem, secondItem] = await boxes(items);
  const secondary = await tokenColor(page, '--color-secondary');

  await expect(items).toHaveText(['This week', 'Last week']);
  expect(await computed(swatches.nth(0), 'background-color')).toBe(await tokenColor(page, '--color-primary'));
  expect(await computed(swatches.nth(1), 'background-color')).toBe(await tokenColor(page, '--color-gray-05'));
  for (const swatch of [first!, second!]) expect([swatch.width, swatch.height]).toEqual([16, 8]);
  expect(await computed(swatches.nth(0), 'border-radius')).toBe('2px');
  for (const item of [items.nth(0), items.nth(1)]) {
    // Regular 12/16 in Secondary.
    expect(await computed(item, 'color')).toBe(secondary);
    expect(await computed(item, 'font-size')).toBe('12px');
    expect(await computed(item, 'font-weight')).toBe('400');
    expect(await computed(item, 'line-height')).toBe('16px');
  }
  // The label 8 after its swatch, the next swatch 24 after the first label.
  expect(firstItem!.x).toBe(first!.x);
  expect(second!.x - (firstItem!.x + firstItem!.width)).toBe(24);
  expect(secondItem!.x + secondItem!.width).toBe((await box(legend)).x + (await box(legend)).width);

  // On the right of the header row, centered on it; the header row ends at the card's padding.
  const card = await box(
    figure(page, 'ComparisonBarChart', 'Statistics sample, like 104').locator('xpath=./*[2]/*[1]'),
  );
  const legendBox = await box(legend);
  expect(legendBox.x + legendBox.width).toBe(card.x + card.width - 24);
});

// T13: the chart's states fill the same box; the header row stays; Retry has the teal ring (AC12, #6, #87, #89).
test('the chart card keeps its height and its header row in every DataState state', async ({ page }) => {
  await openGallery(page);
  const card = (name: string) => figure(page, 'ComparisonBarChart', name).locator('xpath=./*[2]/*[1]');

  await expect(
    figure(page, 'ComparisonBarChart', 'All zero').getByText('No expenses this week or last week'),
  ).toBeVisible();
  await expect(figure(page, 'ComparisonBarChart', 'Error').getByRole('alert')).toHaveText('Something went wrong.');
  await expect(plot(figure(page, 'ComparisonBarChart', 'Ready'))).toBeVisible();
  await expect(figure(page, 'ComparisonBarChart', 'Loading').locator('[aria-busy="true"]')).toBeVisible();

  const heights = await Promise.all(
    ['Loading', 'All zero', 'Error', 'Ready'].map(async (name) => (await box(card(name))).height),
  );
  expect(new Set(heights)).toEqual(new Set([260]));
  for (const name of ['Loading', 'All zero', 'Error', 'Ready']) {
    await expect(card(name).getByText('Weekly Comparison')).toBeVisible();
    await expect(card(name).getByRole('listitem')).toHaveText(['This week', 'Last week']);
  }

  // The empty message and the error state are centered in the chart's box.
  const chartBox = await box(card('All zero').locator('xpath=./*[2]'));
  const message = await box(card('All zero').getByText('No expenses this week or last week'));
  near(message.y + message.height / 2, chartBox.y + chartBox.height / 2);
  // The error message and Retry together, as one block.
  const errorBox = await box(card('Error').locator('xpath=./*[2]'));
  const alert = await box(card('Error').getByRole('alert'));
  const retryBox = await box(card('Error').getByRole('button', { name: 'Retry' }));
  near((alert.y + retryBox.y + retryBox.height) / 2, errorBox.y + errorBox.height / 2);
  near(retryBox.x + retryBox.width / 2, errorBox.x + errorBox.width / 2);

  const retry = card('Error').getByRole('button', { name: 'Retry' });
  await retry.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(retry).toBeFocused();
  expect(await computed(retry, 'outline-style')).toBe('solid');
  expect(await computed(retry, 'outline-color')).toBe(await tokenColor(page, '--color-primary'));

  // A failed background refetch keeps the chart (#89).
  const refetch = figure(page, 'ComparisonBarChart', 'Background refetch fails: the chart stays');
  await expect(plot(refetch)).toBeVisible();
  await refetch.getByRole('button', { name: 'Refetch and fail' }).click();
  await expect(refetch.getByText('Query status: error')).toBeVisible();
  await expect(refetch.locator('svg path')).toHaveCount(11);
  await expect(refetch.getByRole('alert')).toHaveCount(0);
});

// T10: no interaction: hover and click change nothing, no tooltip, nothing to focus (AC9, #20, #87).
test('hovering, clicking and tabbing through a chart change nothing', async ({ page }) => {
  await openGallery(page);
  const sample = figure(page, 'ComparisonBarChart', 'Statistics sample, like 104');
  const svg = plot(sample);
  const bar = svg.locator('path').nth(3);
  const before = await svg.evaluate((element) => element.outerHTML);
  const pixels = await svg.screenshot();

  await bar.hover();
  expect(await svg.evaluate((element) => element.outerHTML)).toBe(before);
  expect(await svg.screenshot()).toEqual(pixels);
  await bar.click();
  expect(await svg.evaluate((element) => element.outerHTML)).toBe(before);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(sample.locator('title')).toHaveCount(0);

  // Tab from the page before the sample: focus never lands inside the chart card.
  await page.getByRole('region', { name: 'Dropdown', exact: true }).getByRole('combobox').last().focus();
  for (let step = 0; step < 4; step += 1) {
    await page.keyboard.press('Tab');
    expect(await sample.evaluate((element) => element.contains(document.activeElement))).toBe(false);
  }
});

// T15: the gauge as measured in 104 and 110 (AC13, AC14).
test.describe('TargetVsAchievementMeter', () => {
  test('draws the arc, the needle, the labels and the caption as in 104', async ({ page }) => {
    await openGallery(page);
    const meter = figure(page, 'TargetVsAchievementMeter', '$12,500 of $20,000 (104)').getByRole('meter');
    const svg = meter.locator('svg');
    const svgBox = await box(svg);
    const caption = meter.getByText('Target vs Achievement');
    const captionBox = await box(caption);
    const teal = await tokenColor(page, '--color-primary');
    const black = await tokenColor(page, '--color-default-black');
    const [track, arc] = await svg.locator('path').all();

    // 104: ink x 872 to 1000, the arc's top at y 228.
    expect([svgBox.width, svgBox.height]).toEqual([128, 92]);
    const trackBox = await shapeBox(track!);
    // The arc's center line: its ends 6.59 in (the caps reach the edge), its top 6.25 down.
    near(trackBox.x, svgBox.x + 6.59);
    near(trackBox.y, svgBox.y + 6.25);
    near(trackBox.x + trackBox.width, svgBox.x + 121.41);
    expect(await computed(track!, 'stroke')).toBe(await tokenColor(page, '--color-gray-05'));
    expect(await computed(track!, 'stroke-width')).toBe('12.5px');
    expect(await computed(arc!, 'stroke')).toBe(teal);
    expect(await computed(svg.locator('polygon'), 'fill')).toBe(teal);
    expect(await computed(svg.locator('circle'), 'fill')).toBe(teal);
    const dot = await box(svg.locator('circle'));
    expect([dot.width, dot.height]).toEqual([12, 12]);
    expect([dot.x + 6 - svgBox.x, dot.y + 6 - svgBox.y]).toEqual([64, 64]);

    // Labels: `$0` and `$20k` under the arc ends in Special/BG 12px, `$12.5k` Semibold 16 in Default Black.
    const labels = svg.locator('text');
    await expect(labels).toHaveText(['$0', '$12.5k', '$20k']);
    const [min, value, max] = await boxes(labels);
    near(min!.x + min!.width / 2 - svgBox.x, 6.59);
    near(max!.x + max!.width / 2 - svgBox.x, 121.41);
    near(value!.x + value!.width / 2 - svgBox.x, 64);
    for (const index of [0, 2]) {
      expect(await computed(labels.nth(index), 'fill')).toBe(await tokenColor(page, '--color-special-bg'));
      expect(await computed(labels.nth(index), 'font-size')).toBe('12px');
    }
    expect(await computed(labels.nth(1), 'fill')).toBe(black);
    expect(await computed(labels.nth(1), 'font-size')).toBe('16px');
    expect(await computed(labels.nth(1), 'font-weight')).toBe('600');

    // Caption: Medium 12 in Default Black, centered under the gauge, 16 below it (104: glyphs from y 339).
    expect(await computed(caption, 'color')).toBe(black);
    expect(await computed(caption, 'font-size')).toBe('12px');
    expect(await computed(caption, 'font-weight')).toBe('500');
    near(captionBox.x + captionBox.width / 2, svgBox.x + 64);
    expect(captionBox.y - (svgBox.y + svgBox.height)).toBe(16);
  });

  test('turns the needle with the progress and fills the arc over the Target', async ({ page }) => {
    await openGallery(page);
    const gauge = (name: string) => figure(page, 'TargetVsAchievementMeter', name).locator('svg');

    // At 0: no Primary arc and the needle points left; at 1 the arc covers the track and the needle points right.
    await expect(gauge('$0 of $20,000').locator('path')).toHaveCount(1);
    const left = await box(gauge('$0 of $20,000').locator('polygon'));
    const leftSvg = await box(gauge('$0 of $20,000'));
    expect(left.x + left.width).toBeCloseTo(leftSvg.x + 64, 0);
    near(left.x, leftSvg.x + 64 - 41);

    const over = gauge('$25,000 of $20,000, over-achieved');
    const [track, arc] = await over.locator('path').all();
    expect(await arc!.getAttribute('d')).toBe(await track!.getAttribute('d'));
    const right = await box(over.locator('polygon'));
    const overSvg = await box(over);
    near(right.x, overSvg.x + 64);
    near(right.x + right.width, overSvg.x + 64 + 41);
    await expect(over.locator('text')).toHaveText(['$0', '$25k', '$20k']);
  });
});
