# Task 006: Shared components: comparison bar chart and target vs achievement gauge

- Status: done
- Gate: human
- Depends on: 001, 004
- Size: L
- Skills: `superpowers:test-driven-development`, `superpowers:verification-before-completion`, `superpowers:requesting-code-review`, `dataviz` (mark specs, recessive grid and axes, legend and text tokens, the palette validator, the accessibility pass; see the deviations in Scope), `security-review` (money: the tick and progress calculations the backend will use), `frontend-design:frontend-design` (undesigned states only: the chart's loading skeleton, and where the empty and error states sit in the chart)

## Goal
The bar chart of 104 Statistics and 109 Expenses, its legend and the gauge of 104 Goals and 110 Savings Goal exist as tested, presentational components drawn in SVG from tokens. The chart draws the values and y-axis ticks it is given; the gauge draws the progress it is given. The two rules behind them, the #55 ticks and the #18/#31 progress, are pure functions in `shared/` that the backend will use (#11). The gallery shows every chart state, inside `DataState`. Screen tasks use them and never rebuild them.

## References
- Spec: `docs/spec/brief.md` Global rules (compact format), Charts, States, Not designed (Charts); `docs/spec/stories.md` US-09 criteria 1 to 3 and 5 to 7, US-15 criteria 1, 2, 8 and 9 (the chart), US-06 criteria 3 and 4, US-16 criterion 2 (the gauge); `docs/spec/demo-data.md` "What a first login shows" (Statistics highest bar $322.00 on a $0 to $400 axis, #91 amended; gauge $16,250 of $20,000)
- Figma (budget 0, no MCP calls: PNGs and `docs/figma/components/` only; neither export holds a chart):
  - 104. Overview `66:4732`: Statistics section `66:4933` (bars `Graph bar 01` / `Bar` `411:7368` and siblings, no component), Goals section `405:5491` with the frame `Target vs Achievement Meter` `407:5628` (no component). PNG `docs/figma/104. Overview.png`
  - Flattened (#37): 109. Expenses `66:5698` (Monthly Comparison chart), 110. Goals `66:5829` (the same gauge in Savings Goal). PNGs with the same names in `docs/figma/`
- Names: `docs/figma/components.md` ("Possible detached components": `Target vs Achievement Meter`, `Graph bar 01` / `Bar`; charts have no components)
- Decisions: `docs/decisions.md` #6, #11, #12, #18, #20, #29, #31, #36, #37, #55, #65, #82, #86, #87, #89, #91, #92

## Scope
- **Shared rules** in `shared/src/chart/`, exported from the package root, pure and tested in `shared/test/`. The backend uses them in tasks 014, 017, 024 and 025; the frontend never calls them (#11).
  - `axisTicks(highest: Money): Money[]`: the five y-axis ticks of a bar chart (#55, #91): $0 and 4 equal steps up to the top. The top is the smallest "nice" value (1, 2, 2.5, 4, 5, 6 or 8 times a power of 10, #91 amended) at or above `highest` whose step (top / 4) is a whole number of cents (#91 a) and whose 5 labels are exact in the compact format (#91 b): `formatCompactMoney` shows each tick without rounding (under $1,000 always; with k a multiple of $100; with M a multiple of $100,000; #11, #82). `highest` is the largest value of both series. It throws a `RangeError` for a highest of 0 or less (all zero is the empty state, never an axis, #55) and for anything that is not integer cents.
    - The tops this allows, checked against `formatCompactMoney` while detailing: $0.04, $0.08, $0.20, $0.40, $0.60, $0.80; then 1, 2, 4, 6 and 8 times every power of 10 from $1 up; 5 times every power of 10 from $5 up except $5k and $5M; and 2.5 times a power of 10 at $25, $250, $250k, $250M, $2,500M and up.
    - The nice values it skips: $0.01, $0.02, $0.05, $0.06, $0.10, $0.25, $0.50 and $2.50 (steps not whole cents); $2.5k and $5k (a `$1.2k` label), $25k (`$6.2k`), $2.5M and $5M (`$1.2M`), $25M (`$6.2M`).
  - `goalProgress(present: Money, target: Money): number`: Present / Target as a fraction from 0 to 1, capped at 1 when Present exceeds Target (#18, #31). It throws a `RangeError` for a Target of 0 or less, a negative Present, or anything that is not integer cents. It is a fraction for drawing, never shown as a number.
  - Integer money (#11): ticks are built from integer cents without a float. The guard `shared/test/integer-money-source.test.ts` also checks `chart/`.
- **Components** in `frontend/src/components/<CodeName>/`, CSS Modules with tokens only. Every value is measured on the PNGs at 2x and halved (#65); new tokens go to `tokens.md` and `tokens.css` with their source. No new dependency: the SVG is written by hand.
  - SVG values (#92, decided while building): tokens for every color and typography, and for the outer size of each SVG (CSS). The internal geometry (coordinates, radii, angles, dash lengths, the computed bar positions) is numeric in viewBox units, derived in the component from named constants, never loose literals. Radius tokens under 4px keep their measured value (#92 b, #86 as a general rule).
  - `ComparisonBarChart` (code-only; Figma bars `Graph bar 01` / `Bar`): the plot of 104 Statistics and 109 Monthly Comparison, below the card's header row.
    - Props: `title` (the accessible name), `labels` (one x-axis label per group, in order: `17 Sun`, `Jan`; the screen tasks make them), `previous` and `current` (each `{ name, values }`, one `Money | null` per label: the earlier period in gray, the current one in teal) and `ticks` (`Money[]` from the backend's `axisTicks`, ascending from $0).
    - Y-axis: one label per tick, `formatCompactMoney` (task 001, #11, #82), right-aligned in a column about 48 wide, Gray/03 (`#9F9F9F` in 104 and 109), each centered on its grid line. Grid: one 1px Gray/06 line per tick (`--color-gray-06`, measured in task 000), 36 apart, from 16 right of the label column to the plot's right edge. The bottom line is $0; the last tick is the top of the plot (144 high with 5 ticks).
    - Bars (dataviz mark spec, as drawn): per group the `previous` bar (Gray/05 `#E8E8E8`) then the `current` bar (Primary), each 16 wide and 8 apart, with 4px rounded top corners, square at the baseline, standing on the $0 line. Height = value / top tick × plot height. A value of 0 draws no visible bar.
    - Groups: 40 wide, spread evenly from about 22 right of the grid's left end to about 50 left of the plot's right edge, so the pitch follows the width: 84 for 7 groups in the 680 wide plot of 104, 80 for 12 groups in the 1056 wide plot of 109. Each x label is centered under its group, Gray/03, about 14 below the $0 line.
    - Future periods (#55): a `null` value draws no bar. Its label and the other series' bar stay.
    - No interaction (#20, general rule): no tooltip, no hover style, no `<title>`, nothing focusable.
    - Accessibility: the SVG is hidden from assistive technology. A visually hidden `<table>` captioned by `title` carries the data: one row per label, one column per series named by its `name`, values in `formatMoney` (#11: outside axes and gauges), an empty cell for `null`.
  - `ComparisonBarChartSkeleton` (code-only): the chart's loading skeleton (#6) for `DataState`, from `Skeleton` (task 004). Prop `groups`. Same box as the chart, so nothing moves when the data arrives; label lines and bar blocks, no text (`frontend-design`, existing tokens only).
  - `ChartLegend` (code-only): the legend at the right of the chart card's header row in 104 and 109, and later in 110 Saving Summary (task 026). Props: `previous` and `current` (the labels). Each item: a 16x8 swatch (Primary for `current`, Gray/05 for `previous`) about 8 before its label, Regular 12/16 in Secondary (`#525256`); `current` first, items about 24 apart. Text wears a text token, never the series color (dataviz).
  - `TargetVsAchievementMeter` (code-only; Figma frame `Target vs Achievement Meter` `407:5628`): the gauge of 104 Goals and 110 Savings Goal.
    - Props: `present` and `target` (`Money`) for the labels, and `progress` (0 to 1, from the backend's `goalProgress`). It throws a `RangeError` for a progress outside 0 to 1.
    - Arc: a semicircle about 128 wide (104: ink x 872–999), stroke about 12.5 with round caps. The track is Gray/05 over the whole half circle. The Primary arc runs from the left end clockwise over 180° × `progress`: none at 0, the whole track at 1.
    - Needle: Primary, tapered, from a dot of about 12 at the arc's center toward the progress angle (left at 0, up at 0.5, right at 1).
    - Labels under the arc ends: the min `$0` and the max `formatCompactMoney(target)`, each centered under its arc end, in Special/BG (`#D1D1D1`, within 1). Between them `formatCompactMoney(present)` in Default Black, Semibold (weight measured). Under them the caption "Target vs Achievement" in Default Black, centered. Present above Target shows the full arc and the Present in the center (`$25k` with `$20k` at the right end).
    - Accessibility: `role="meter"` named by the caption, `aria-valuemin` 0, `aria-valuemax` 1, `aria-valuenow` the progress, `aria-valuetext` the center label.
  - Focus (#87): no chart has a focusable element. In the chart's error state, Retry has the teal ring from task 004.
- **States** (#6, #89): the chart renders inside `DataState` (task 004). The card's header row (the screen's control and `ChartLegend`) stays in every state. `DataState` fills the plot's box (one height token for the chart, its skeleton and the box), so the card keeps its height: the skeleton while loading, the empty message when every value is 0 (#55), the error state with Retry, a failed background refetch keeping the chart (#89). The gauge renders inside its card's `DataState` (tasks 014, 025), which owns that skeleton and "No goal for this month" (#58).
- **dataviz** applies with these deviations, each from a decision: no hover layer or tooltips (#20, general rule); no direct value labels (not drawn); no dark mode (desktop app, not designed, #4); no texture fill; no `tabular-nums` on the axis (it would change the drawn glyph widths). The palette validator runs on Primary and Gray/05 against white, and its result goes to the Log; the colors are the design's and do not change. The hidden table is the dataviz "table view".
- `docs/figma/components.md`: Code-only rows for `ComparisonBarChart`, `ComparisonBarChartSkeleton`, `ChartLegend` and `TargetVsAchievementMeter`, each with its purpose and decisions.
- Gallery sections (sample data written in the gallery, ticks included, so the frontend computes nothing; no network):
  - `ChartLegend`: "This week" / "Last week" and "This year" / "Last year".
  - `ComparisonBarChart`, each in a white `Card` with a header row (a plain text stand-in for the screen's control, then `ChartLegend`):
    - Statistics sample, 728 wide like 104 (two card widths and a gap): `19 Mon` to `25 Sun`, last week's highest $322.00, ticks $0, $100, $200, $300, $400 (#91 amended, as `demo-data.md` now says), this week `null` from Fri to Sun (as on the demo first login).
    - Expenses sample, 1104 wide like 109 (three card widths, two gaps): `Jan` to `Dec`, this year `null` for Nov and Dec.
    - `DataState` states of the Statistics sample: loading (the skeleton), all zero (the empty message "No expenses this week or last week", #91 c), error (Retry), and ready.
  - `TargetVsAchievementMeter`: $12,500 of $20,000 (104), $16,250 of $20,000 (demo), $0 of $20,000, $25,000 of $20,000 (over-achieved, full arc), $1,000,000,000 of $1,000,000,000 (`$1,000M`).

## Out of scope
- The screens' data, endpoints and contracts: per-day and per-month sums, the week and year boundaries, the x-axis label text, the all-zero check in the response, and the goal endpoints (tasks 014, 017, 024, 025).
- The "Weekly Comparison" and "Monthly Comparison" controls and the card header layout of each screen (#20, #29; tasks 017, 024). Passing the empty message texts of #91 (c) to each screen's `DataState` (tasks 017, 024); the gallery uses the Statistics text.
- The Saving Summary line chart, its negative axis (#59, #68, #72) and its legend placement (task 026). `axisTicks` covers values above $0 only.
- The Goals cards around the gauge: Target Achieved, This month Target, the pencil, Adjust Goal, the card skeleton and the empty message (tasks 014, 025).
- Tooltips, hover styles and any chart interaction (#20, general rule).

## Acceptance criteria
1. Given `axisTicks`, then a highest value of $322.00 gives $0, $100, $200, $300, $400; $500.00 gives $0, $125, $250, $375, $500; $500.01 gives a top of $600; $1.00 gives $0, $0.25, $0.50, $0.75, $1; $5,500 gives $0, $1,500, $3,000, $4,500, $6,000 (`$1.5k` to `$6k`); $7,000 gives a top of $8,000; $20,000.00 gives a top of $20,000. The top is the smallest allowed nice value (1, 2, 2.5, 4, 5, 6 or 8 times a power of 10) at or above the highest (#55, #91 amended).
2. Given a highest value whose next nice value has a step that is not a whole cent, then that value is skipped (#91 a): $2.30 gives $0, $1, $2, $3, $4 ($2.50 skipped); $0.45 gives $0, $0.15, $0.30, $0.45, $0.60 ($0.50 skipped); $0.01 gives $0, $0.01, $0.02, $0.03, $0.04. Given a highest value whose next nice value would have a label the compact format cannot show exactly, then that value is skipped (#91 b): $2,100 gives $0, $1,000, $2,000, $3,000, $4,000 (`$1k` to `$4k`; $2,500 skipped); $4,500 gives a top of $6,000 ($5,000 skipped); $22,000 gives $0, `$10k`, `$20k`, `$30k`, `$40k` ($25,000 skipped); $2,000,000.01 gives a top of $4,000,000 ($2,500,000 skipped). Every tick is integer cents. Given a highest of 0, a negative one or one that is not integer cents, then it throws a `RangeError` (#11, #55).
3. Given `goalProgress`, then $12,500 of $20,000 gives 0.625, $16,250 of $20,000 gives 0.8125, $0 gives 0, and $25,000 of $20,000 gives 1 (#18, #31). Given a Target of 0 or less, a negative Present or an amount that is not integer cents, then it throws a `RangeError`.
4. Given the `shared/src/chart/` source, then the integer money guard finds no float money (#11).
5. Given `ComparisonBarChart` with the ticks $0, $125, $250, $375, $500, then the y labels read `$0`, `$125`, `$250`, `$375`, `$500` from the bottom, right-aligned in Gray/03 and centered on five 1px Gray/06 grid lines 36 apart, as in 104 and 109. Given ticks up to $50,000, then they read `$0`, `$12.5k`, `$25k`, `$37.5k`, `$50k`; given ticks up to $250, `$0`, `$62.50`, `$125`, `$187.50`, `$250` (#11, #82, #91).
6. Given a group with both values, then a Gray/05 bar and a Primary bar stand on the $0 line, 16 wide and 8 apart, with 4px rounded top corners and square bottoms, each as high as its value relative to the top tick (a $250 bar on a $500 axis is 72 high). A value of 0 has no visible bar.
7. Given 7 groups in a 680 wide plot and 12 groups in a 1056 wide plot, then the groups are 84 and 80 apart, spread as measured in 104 and 109, and each label is centered under its group in Gray/03.
8. Given a `null` value in `current`, then that group has no teal bar, while its label and its gray bar stay; earlier groups are drawn in full (#55).
9. Given I hover or click a bar, then nothing changes and no tooltip shows; the chart has no focusable element and no `<title>` (#20, #87).
10. Given the chart, then the SVG is hidden from assistive technology and a table named by `title` lists each label with its two values in `formatMoney`, empty for `null`.
11. Given `ChartLegend`, then it shows the `current` item (Primary swatch) then the `previous` item (Gray/05 swatch), with 16x8 swatches and Regular 12/16 Secondary labels, as in 104 and 109.
12. Given the chart inside `DataState`, then while loading the skeleton shows in the chart's box; when every value is 0 the empty message shows in that box (#55); on a failed first load "Something went wrong." and Retry show in that box; when a background refetch fails the chart stays (#89). The header row stays in every state, and the card height does not change between states.
13. Given `TargetVsAchievementMeter` with $12,500 of $20,000 and progress 0.625, then the Gray/05 half circle shows with a Primary arc over its first 62.5% and the needle at 112.5° from the left end; `$0` and `$20k` sit under the arc ends in Special/BG, `$12.5k` in Default Black between them, and "Target vs Achievement" under them, in the measured sizes of 104 and 110 (#11, #18).
14. Given progress 0, then no Primary arc shows and the needle points left. Given $25,000 of $20,000 and progress 1, then the whole arc is Primary, the needle points right and the center reads `$25k` (#31). Given a progress outside 0 to 1, then it throws a `RangeError`.
15. Given the gauge, then it is a `meter` named "Target vs Achievement", with `aria-valuenow` the progress and `aria-valuetext` the center label.
16. Given the component folders, then `ComparisonBarChart`, `ComparisonBarChartSkeleton`, `ChartLegend` and `TargetVsAchievementMeter` are in the Code-only table, all CSS values use tokens only, and the SVGs take colors, typography and their outer size from tokens and their internal geometry from named constants, never loose literals (#92).
17. Given `npm run dev`, then the gallery shows every section listed in Scope with no console errors or warnings. Given a production build, then the gallery is not in it.

## Test scenarios
| ID | Type | Scenario | Expected | Covers AC |
|----|------|----------|----------|-----------|
| T1 | unit | `axisTicks` on $322.00, $500.00, $500.01, $1.00, $5,500, $7,000, $20,000.00; then each allowed top in Scope, exactly and one cent above it, from $0.04 to $8,000M | The ticks AC1 lists ($5,500 gives `$6k`, $7,000 gives `$8k`); 5 ticks, $0 first, equal steps; a highest equal to an allowed top gives that top, one cent more gives the next allowed top | 1 |
| T2 | unit | `axisTicks` on the #91 cases: $2.30, $0.45, $0.09, $0.05, $0.01 (a); $2,100, $4,500, $22,000, $25,000, $2,000,000.01 (b); and every tick of every case | The ticks AC2 lists ($2,100 gives `$4k`; $0.09 gives $0.20, $0.05 gives $0.08, $25,000 gives $40,000); every tick integer cents, and `formatCompactMoney` of every tick reads back to that amount exactly | 2 |
| T3 | unit | `axisTicks` on 0, -1, 1.5 cents | `RangeError` | 2 |
| T4 | unit | `goalProgress` on the listed pairs; Target 0 and -1; Present -1; 1.5 cents | 0.625, 0.8125, 0, 1; `RangeError` for the rest | 3 |
| T5 | unit | Integer money guard with `chart/` added | No match in `chart/` | 4 |
| T6 | unit | `ComparisonBarChart` with the Statistics sample | Five y labels in order; one grid line per tick; 11 bars (7 gray, 4 teal: no teal bar Fri to Sun); bar heights in proportion to the top tick | 5, 6, 8 |
| T7 | e2e | Gallery Statistics and Expenses samples at 1440x1024 | Label column, label color and alignment, grid line color, width, spacing and extent; bar widths, gap, fill, corner radius, baseline; group pitch 84 and 80; label centers under the groups | 5, 6, 7 |
| T8 | unit | Ticks up to $50,000 and up to $250 | `$0`, `$12.5k`, `$25k`, `$37.5k`, `$50k`; `$0`, `$62.50`, `$125`, `$187.50`, `$250` | 5 |
| T9 | unit | `null` values in `current`; a value of 0 | No teal bar for `null`, the label and gray bar stay; a 0 value has no height | 6, 8 |
| T10 | e2e | Hover and click a bar; Tab through the chart card | No change in the DOM or the pixels, no tooltip; focus skips the chart; no `<title>` | 9 |
| T11 | unit | Chart accessibility | The SVG is `aria-hidden`; `getByRole('table', { name: title })` has a row per label and the values in `formatMoney`, empty for `null` | 10 |
| T12 | unit + e2e | `ChartLegend` | Item order, swatch size and colors, label font and color as measured | 11 |
| T13 | unit + e2e | Gallery `DataState` states of the chart: loading, all zero, error, ready; a ready query whose refetch then fails | Skeleton, empty message, alert with Retry, chart; the chart stays after the failed refetch; the card height is the same in all four; Retry shows the teal ring on keyboard focus | 12 |
| T14 | unit | Gauge at 0.625, 0, 1 and 0.8125 | Arc and needle angles from the progress; labels from `formatCompactMoney`; `RangeError` for -0.1 and 1.1 | 13, 14 |
| T15 | e2e | Gallery gauge samples | Arc box, stroke, colors, needle and dot, label and caption positions, fonts and colors as measured in 104 and 110 | 13, 14 |
| T16 | unit | Gauge accessibility | `getByRole('meter', { name: 'Target vs Achievement' })` with `aria-valuenow` and `aria-valuetext` | 15 |
| T17 | unit | Component name guard from task 002; Stylelint and `tokens.test.ts` (radius tokens under 4px allowed off the grid, #92 b); a source guard on the chart components: no numeric literal in an SVG geometry attribute; the outer-size tokens equal the components' constants | Pass with the new components and their Code-only rows; the guard flags `x="12"` and `r={6}` | 16 |
| T18 | e2e | `/dev/components` with the new section names | Every section visible, no console errors or warnings | 17 |
| T19 | unit | Gallery build test from task 002 with the new section markers | Not in the production build; found in a development build | 17 |

## Validation steps (in this order, stop on first failure)
1. Lint + typecheck pass.
2. Unit tests pass.
3. E2E tests pass.
4. Visual: Playwright MCP screenshots at 1440x1024 and device scale 2, compared element by element with crops of the PNGs. CSS px after halving, approximate; measure them exactly:
   - `104. Overview.png` Statistics card x 680–1408, y 448–706 (258 high), against the gallery's 728 wide Statistics sample:
     - y labels right edge x 752, Gray/03; grid lines x 768–1384 at y 511, 547, 583, 619, 655, Gray/06;
     - bars 16 wide, 8 apart, first gray bar x 790, group pitch 84, Gray/05 and Primary, top corners 4;
     - x labels centered under the groups, glyphs from y 670.5, Gray/03;
     - legend swatches 16x8 at x 1194 and 1301, labels Secondary.
   - `109. Expenses.png` chart card x 304–1408, y 152–410 (258 high), against the 1104 wide Expenses sample: grid x 392–1380, first gray bar x 414, group pitch 80, the same vertical structure as 104.
   - `104. Overview.png` gauge ink x 872–999, y 228–296; labels glyphs from y 304 (`$0` centered at x 877, `$20k` at x 993); caption glyphs y 338.5–350.5, centered at x 936. `110. Goals.png` the same gauge at x 512–639.
   - Run the dataviz palette validator on Primary and Gray/05 against white and log the result.
   Save the screenshots and comparison images to `.claude/tasks/evidence/006/` and list every difference. Expected differences:
     - the y labels follow #55 instead of Figma's `$0`, `$2k`, `$10k`, `$50k`, `$250k`, so every bar height differs (#12, #55);
     - the gallery's sample labels and values (`19 Mon` to `25 Sun`, Fri to Sun without teal bars) instead of `17 Sun` to `23 Sat`;
     - 109: the legend reads "This year" / "Last year" instead of "This Week" / "Last Week" (#29), and the months read `Jul` instead of "July" (#55); Figma's grid lines stop 4 short of the plot's right edge (x 1380 against 1384 in 104), the render runs them to the edge in both;
     - the header row's control is a text stand-in (tasks 017, 024);
     - the gauge center reads `$12.5k` instead of "12K" (#18), and the arc and needle follow the progress: Figma draws about 75% for $12,500 of $20,000 (62.5%).
5. Manual browser checks with Playwright MCP: in the gallery, hover and click the bars and the gauge; Tab through every chart card; run the `DataState` loading, empty and error samples and Retry; read the hidden table and the meter with the accessibility snapshot.

## Human checkpoint (only if Gate: human)
- The bar chart against 104 Statistics and 109 Monthly Comparison: axis column, grid, bars, group spacing, labels and legend; future periods without a teal bar (#55).
- The y-axis rule (#55, #91 amended): nice values 1, 2, 2.5, 4, 5, 6 and 8, whole-cent steps for small values (#91 a), and only exact compact labels (#91 b), so a highest of $2,100 gets a $4,000 top. The demo axis is now $0 to $400 ($322 highest); US-09 criterion 3 and `demo-data.md` say the same since commit 6aaf2fa.
- The gauge against 104 and 110: arc, needle, labels and caption, at 0, 62.5%, 81.25% and over-achieved (#18, #31).
- That progress and ticks come from the backend through the shared functions, and the components only draw them (#11).
- Undesigned visuals: the chart skeleton, and the empty and error states in the chart's box with the header row kept.
- The dataviz deviations listed in Scope, and the hidden table and meter semantics.
- #93 (open, raised by the code review): the chart card header row sits 8 lower than in 104 and 109 with `Card`'s 24px padding, and the card is 260 high (258 in Figma). Keep (proposed), or pull the header up and grow the chart box to 196?
- #92 as applied: tokens for colors, typography and SVG outer sizes; internal SVG geometry from named constants; radius tokens under 4px off the grid.

## Log
<!-- Claude appends: date, what was done, decisions, issues, validation results, review findings -->

### 2026-10-24, detailing (`/next-task 006`)
- Detailed from the outline row with Marko's notes: bar chart per #20, #29 and #55 (5 labels, nice top value, no bar for future periods, all zero is the empty state), axis labels in the compact format of #11 and #82; the chart is presentational and draws the values and ticks it is given; the #55 tick rule is a pure function in `shared/` that the backend uses (#11). Gauge per #18 and #31 (progress Present / Target, capped at 100%, center in compact format), custom SVG. Charts render inside `DataState` (#6, #89). dataviz skill; focus #87; Figma budget 0.
- Names: charts have no Figma components. `ComparisonBarChart`, `ComparisonBarChartSkeleton` and `ChartLegend` are code-only. The gauge takes its Figma frame's name, `TargetVsAchievementMeter` (`Target vs Achievement Meter` `407:5628`, #36), in the Code-only table because the frame is not a component.
- Scope choices:
  - Progress follows the same pattern as the ticks: #11 puts percentages in the backend, so `goalProgress` is a shared pure function for the backend (tasks 014, 025) and the gauge draws the `progress` it is given. It is a fraction for drawing; no percentage is shown, so no rounding rule is needed.
  - `ChartLegend` is its own component because 104, 109 and 110 Saving Summary (task 026) draw the same legend. The header row and its control stay in the screen tasks (task 005 already left the comparison controls to 017 and 024).
  - The chart skeleton is in this task because 017 and 024 share the plot's shape. The gauge's card skeleton stays with its card (014, 025).
  - The hidden table and the meter role follow the dataviz accessibility pass without adding anything visible or any behavior.
- Quick probes on the PNGs (Node built-ins, session scratchpad), 2x values halved:
  - 104 Statistics card x 680–1408, y 448–706; 109 chart card x 304–1408, y 152–410. Both 258 high, with the grid top 63 below the card top.
  - Grid: 1px `#F3F3F3` lines 36 apart, five of them; 104 x 768–1384, 109 x 392–1380.
  - y labels `#9F9F9F`, right edge x 752 (104) and 375.5 (109), 48 from the content edge, centered on the lines.
  - Bars 16 wide, 8 apart, `#E8E8E8` then `#299D91`, top corners about 4 (the edge starts 8 px in at 2x), bottoms square on the $0 line. Group pitch 84 (104, 7 groups) and 80 (109, 12 groups). The groups span from 21.75 right of the grid start to 50.25 left of the content edge in both.
  - x labels `#9F9F9F`, centered under the groups (centers equal within 0.5).
  - Legend: swatches 16x8, teal and `#E8E8E8`; text `#525256`, about 12px.
  - Gauge (104 and 110 identical): ink 127.5x68, stroke about 12.5 with round caps, track `#E8E8E8`, arc and needle `#299D91`, dot about 12. Min and max labels `#D1D1D1`, center `#191919`, caption `#191919`. Figma draws the arc and needle at about 75%, not the 62.5% of $12,500 / $20,000.
- Raised **#91 (open)** in `docs/decisions.md`:
  - (a) #55 gives steps that are not whole cents for small highest values ($2.30 gives $0.625 steps), which #11 and the compact formatter cannot show;
  - (b) the compact labels of equal steps can look uneven (`$6.2k`, `$12.5k`, `$18.7k`), proposed as is;
  - (c) the empty message texts of the two bar charts, which no story gives (needed by 017 and 024, not by this task).
  This task waits for (a) and (b).
- INDEX: 006 covers the decisions above; open questions list #91.
- No Figma calls.

### 2026-10-24, #91 closed
- Marko's answers, recorded in `docs/decisions.md` #91 (closed, Marko, 2026-10-24):
  - (a) Agreed: skip a nice value whose step is not a whole cent.
  - (b) Not kept as proposed: also skip a nice value if any of its 5 labels cannot be shown exactly in the compact format (#11, #82), and take the next one. One rule: the smallest nice value at or above the highest whose steps are whole cents and whose labels are exact. A highest of $22,000 gives $0, `$12.5k`, `$25k`, `$37.5k`, `$50k`.
  - (c) Agreed: Statistics "No expenses this week or last week", Expenses chart "No expenses this year or last year".
  - Gauge: the backend sends the progress (`goalProgress`), as proposed.
- The rule was checked against `formatCompactMoney` from `shared/dist` with a scratch script. Nice values it skips: below $0.20, $0.25, $0.50 and $2.50 (steps not whole cents); $2.5k, $5k, $25k, $2.5M, $5M and $25M (labels `$1.2k`, `$6.2k`, `$1.2M`, `$6.2M`). From $1,000M up every nice value is allowed. A consequence now in AC2 and the human checkpoint: a highest from $2,000.01 to $10,000 gets a $10,000 top.
- Updated: Scope (`axisTicks` rule, the allowed and skipped tops, the gallery empty text), Out of scope, AC1, AC2, AC5, T1, T2, T8 and the human checkpoint. The demo axis ($322 gives $0 to $500) is unchanged.
- INDEX: open questions none; rows 017 and 024 now cite #91 (the empty message texts).
- Not started, as Marko asked. No Figma calls.

### 2026-10-24, #91 amended
- Marko extended the nice values to 1, 2, 2.5, 4, 5, 6 and 8 times a power of 10, filtered by the same rule (whole-cent steps, all 5 labels exact in the compact format). `docs/decisions.md` #91 now has the amended rule and examples, and the note "(amended 2026-10-24: nice values 1, 2, 2.5, 4, 5, 6, 8)".
- Checked again against `formatCompactMoney` from `shared/dist` with the scratch script; every example in AC1 and AC2 was printed from it.
  - The new values fill the gaps: $2,100 gets $4k (was $10k), $5,500 gets $6k, $7,000 gets $8k, $22,000 gets $40k (was $50k).
  - Skipped now: $0.01, $0.02, $0.05, $0.06, $0.10, $0.25, $0.50 and $2.50 (steps not whole cents); $2.5k, $5k, $25k, $2.5M, $5M and $25M (labels). The smallest top is $0.04.
  - This supersedes the skip list and the "$2,000.01 to $10,000 gets a $10,000 top" consequence in the previous entry.
- **The demo axis changes:** the highest bar of $322.00 now gets $0, $100, $200, $300, $400 (4 × $100 is a nice value), not $0 to $500. US-09 criterion 3 and `docs/spec/demo-data.md` ("What a first login shows") still say $0, $125, $250, $375, $500. `docs/spec/` was not changed (not asked); raised in the report so Marko can decide whether the spec follows.
- Updated: References (demo data), Scope (`axisTicks` nice values, the allowed and skipped tops, the gallery Statistics ticks), AC1, AC2, T1, T2 and the human checkpoint. AC5 keeps $0 to $500 as given ticks (still a valid axis, for a highest from $400.01 to $500).
- Not started, as Marko asked. No Figma calls.

### 2026-10-24, build (`/next-task 006`)
- Started 12:37. Every cited decision was closed. The spec already followed amended #91 (commit 6aaf2fa): `demo-data.md` and US-09 criterion 3 now say $0 to $400, so the "still says $0 to $500" notes above are out of date.
- Measured on the PNGs at 2x, halved (scratch scripts with Node built-ins, no Figma calls):
  - 104 and 109:
    - y and x labels are Regular 14 (cap height 10, digit pitch 8.5, ink matches 400 at 14px), not 12;
    - grid lines y 511 to 655, 1px `#F3F3F3`;
    - bars 16 wide, 8 apart, top radius 4, standing on the $0 line's lower edge (they cover the line);
    - first gray bar 22 right of the grid start, last teal bar 50 left of the content edge, pitch 84 and 80;
    - x label glyphs y 671 to 681;
    - legend swatches 16x8 with a 2px corner radius;
    - the header row is centered at y 476, 4 below the card's 24px padding, so it starts above the padding.
  - Gauge (104 and 110 the same):
    - the arc's outer edge fits a circle of radius 64.05; the stroke is 12.5;
    - the round caps stay inside the half disc (the ends start half a stroke above the center line);
    - the dot is 12 at (64.1, 62.2) from the arc box, about 2 above the arc's center;
    - the needle tip is 40.7 from the center and its base about 6;
    - labels: the limits are 12px, the center is Semibold 16 (its ink matches 600), the caption is Medium 12 (131 wide; its ink matches 500).
- Raised **#92**, answered at once by Marko and recorded closed:
  - (a) SVG values: tokens for color, typography and each SVG's outer size; internal geometry numeric from named constants, never loose literals, including the bar chart's computed positions.
  - (b) The legend swatch radius 2px. #86 becomes a general rule: radius tokens under 4px stay off the grid.
  - Updated the task's Scope (Components), AC16 and T17 to follow #92, `tokens.md` (the sources paragraph), and INDEX (row 006 cites #86 and #92).
- Built with TDD; each test file was run red before its code:
  - Shared: `axisTicks` and `goalProgress` in `shared/src/chart/`, exported from the root. The integer money guard now also checks `chart/`.
    - `axisTicks` walks 1, 2, 2.5, 4, 5, 6, 8 times powers of 10 in integer cents.
    - It skips a top that is not divisible by 4 (#91 a), and one with a label outside the compact format's resolution: exact under $1,000, $100 steps in k, $100,000 steps in M (#91 b).
    - It throws `RangeError` for 0, negatives, non-integers and a highest with no safe-integer top.
  - Components:
    - `ComparisonBarChart`: an SVG without a viewBox (user units are CSS px, its width follows the card). Each group is a nested `<svg x="P%">` with a numeric `translate`, so the pitch follows the width with no measuring.
      - Bars are paths with rounded tops and square bottoms. A value of 0 or `null` draws no bar.
      - It throws `RangeError` for a value outside $0 to the top tick, a top tick of $0 or less, and a series without one value per label.
      - A visually hidden table (Radix `VisuallyHidden`, already a dependency) carries the data.
    - `ChartLegend`: an HTML list.
    - `ComparisonBarChartSkeleton`: `Skeleton` lines and blocks, existing tokens only.
    - `TargetVsAchievementMeter`: a viewBox SVG sized by tokens. It has a track and a Primary arc (paths), the needle (a polygon rotated by `180 × progress − 180` degrees), the dot, and the three labels as SVG text. The caption is an HTML `<p>` that names the `role="meter"`.
  - Tokens (all measured):
    - `--size-chart-height` 188;
    - `--size-chart-legend-swatch-width` 16 and `-height` 8;
    - `--radius-chart-legend-swatch` 2;
    - `--space-chart-legend-swatch-gap` 8 and `--space-chart-legend-item-gap` 24;
    - `--size-gauge-width` 128 and `--size-gauge-height` 92;
    - `--space-gauge-caption-gap` 16.
  - Chart box (`--size-chart-height`): built first as 184, from the top label's line box to the x labels' line box. The render then put the top label right under the header row. It is now 188: the plot under a 24px header row (the screens' control is Semibold 16 with a 24px chevron), with the top grid line 15 down. In a 24px-padded card the grid and x labels land exactly on 104 (y 511 to 655, labels on 681), and the card is 260 high (104: 258).
  - Guard `chart-svg.test.ts`: no number written in an SVG geometry attribute of the two SVG components, and the outer-size tokens equal the components' constants.
  - Gallery sections:
    - `ChartLegend`: both label pairs;
    - `ComparisonBarChart`: the Statistics sample (728 wide), the Expenses sample (1104), and Loading, All zero ("No expenses this week or last week"), Error, Ready and a failed background refetch, each in a card with a text stand-in header row and the legend;
    - `ComparisonBarChartSkeleton`: 7 and 12 groups;
    - `TargetVsAchievementMeter`: the five samples.
- dataviz palette validator (light, surface `#FFFFFF`) on `#299D91,#E8E8E8`:
  - Lightness band FAIL: `#E8E8E8` at 0.931.
  - Chroma floor FAIL: `#E8E8E8` at 0, it reads gray.
  - CVD separation PASS (ΔE 26.5 protan, tritan 31.3); normal-vision floor PASS (ΔE 31.7).
  - Contrast vs surface WARN: `#E8E8E8` at 1.23:1.
  - Gray/05 is the design's de-emphasis series, and the colors do not change (Scope). The legend and the hidden table carry the identity and the values, which is the relief the WARN requires.
- Undesigned states (`frontend-design`, existing tokens only):
  - The skeleton's five 16px axis lines are centered on the chart's grid rows (16 to 160).
  - Its bars stand 4 lower than the chart's (164 against 160).
  - The empty message and the error state use `DataState`'s centered message inside the chart's box.

### 2026-10-24, validation, visual check and reviews
- Validation, final run after the review fixes:
  1. Lint (oxlint, Stylelint, Prettier) and typecheck: pass.
  2. Unit tests pass:
     - shared 407 of 407;
     - backend 43 of 43;
     - frontend 474 of 474, including the production-build gallery test with the new marker.
  3. E2E: 47 of 47 pass.
- Rework loops:
  - Loop 1, e2e: three `charts.spec.ts` failures, all in the tests.
    - Two used `locator('svg')`, which also matched the nested group SVGs (strict mode). They now use `svg[aria-hidden="true"]`.
    - One used Playwright's `boundingBox` on a stroked path. It pads the box by half the stroke times the miter limit (25px), so stroked shapes are now read with `getBoundingClientRect`.
  - Loop 2, lint after the review fixes: an array interpolated into a template literal.
- Visual check:
  - Rendered at 1440x1024, device scale 2. Compared crops of 104, 109 and 110 (design | render | difference x4) in `.claude/tasks/evidence/006/`; mean differences are in `compare-stats.json`.
  - Matching within 1px:
    - 104: the grid lines (y 511 to 655, x 768 to 1384); the bars (16 wide, 8 apart, first gray bar x 790, pitch 84, standing on y 656); the y labels' right edge; the x label glyph row (y 671 to 681).
    - 109: the first gray bar at x 414 and the pitch of 80.
    - The gauge: the arc outline, the track ends, the label row (glyph tops 76 against 76.2 below the arc top) and the caption (111 against 111.2, centered within 0.6).
  - Differences:
    - 104 y labels read $0 to $400 (#55, #91), not `$0`, `$2k`, `$10k`, `$50k`, `$250k`. Bar heights follow the sample data (#12). Expected.
    - The sample labels read `19 Mon` to `25 Sun`, with no teal bars from Fri to Sun, not `17 Sun` to `23 Sat`. Expected.
    - The header row is a text stand-in without the chevron (tasks 017, 024). Expected.
    - With `Card`'s 24px padding, the header row (control and legend) sits 8 lower than in 104 and 109, and the card is 260 high, not 258 (#93, open).
    - The legend: the "This week" item is 2.5 to 3 right of 104 and the "Last week" text 1 right; the right edge is equal. This comes from the 8 swatch gap (8.5 measured) and the 24 item gap (25 measured), #65.
    - 109: the legend reads "This year" / "Last year" (#29) and the months `Jul` (#55). The grid lines run to the plot edge (x 1384; Figma stops at 1380). The y labels are $0 to $4k.
    - Gauge: the center reads `$12.5k`, not "12K" (#18). The arc and the needle are at 62.5%, where Figma draws about 75%. Expected.
    - Gauge: the dot sits 1.8 lower than in Figma, because it is centered on the arc's center (the needle's pivot); Figma draws it about 2 above that.
    - Gauge: the max label's center is 1 left (120.5 against 121.4).
    - Gauge: the needle is a straight-sided triangle (base 6, length 41).
- Manual checks (Playwright MCP, `manual-checks.txt`):
  - Hovering and clicking the bars and the gauge leaves the DOM unchanged, with no tooltip and no `<title>`.
  - Tab goes from Retry to "Refetch and fail" and out of the page; no chart element takes focus.
  - Retry shows the skeleton, then the error again.
  - The accessibility tree has the table named by the title (`formatMoney` cells, empty for `null`) and the meter "Target vs Achievement".
  - No console errors or warnings.
- Security review (`security-review`, subagent): no findings.
  - `axisTicks` and `goalProgress` use integer cents only and throw `RangeError` on bad input.
  - No unsafe sinks.
  - The gallery is still out of production builds.
- Code review (`requesting-code-review`, subagent): no critical, 2 important, 5 minor.
  - It cross-checked `axisTicks` against an independent rule on 156,763 inputs, with 0 mismatches.
  - Fixes:
    - I1, header row offset and card height: the `--size-chart-height` source now says the 24px header row is assumed. The offset is in the differences above. Raised **#93 (open)** in `docs/decisions.md`: keep the offset (proposed), or pull the header up 8 and grow the chart box to 196. INDEX rows 006, 017, 024 and 026 cite it, and the human checkpoint lists it.
    - I2, the Log: this entry.
    - M3, stale "$0 to $500" text: References, the gallery sample line and the human checkpoint now say the spec matches #91 (commit 6aaf2fa).
    - M4, the SVG guard stopped at the first `}` of a template literal: a failing case for `rotate(${angle} 64 64)`, then a brace-depth scan. The real files still pass.
    - M5, the ticks contract: the chart throws `RangeError` unless it gets 5 ticks from $0 in equal steps above $0. Four new tests, run red, then green. `TICK_COUNT` in `geometry.ts` is shared with the skeleton.
    - M7, e2e gaps: the legend's weight 400 and line height 16, the error state centered in the box, and the 109 x labels centered under their groups.
  - Declined:
    - M6 (React keys from the label text): the labels are days and months, unique by construction.
    - The recommendations of an exported chart-box class and a guard against frontend imports of the shared rules: the screens use the token, and no such import exists (#11).
    - The reviewer's 12 "declined to judge" items were read and agreed as Scope or out of scope. Examples: a sub-pixel bar for a tiny value; `aria-valuetext` holding only the Present (AC15); the needle and the arc end up to about 6° apart.
- No Figma calls in this task.

### 2026-10-25, human gate (`/approve-task 006 approve`)
- Approved by human.
- **#93 closed** (Marko, 2026-10-25): (a) keep. The header row stays inside `Card`'s 24px padding (8px lower than Figma), the chart as in Figma, the card 260 high. Recorded in `docs/decisions.md`; the `--size-chart-height` source in `tokens.md` now says kept. No code change.
- **#94 (open)** raised by Marko: page width. The design is 1440 wide (#4, #5), but pages should fill the whole screen; sidebar, content area and card grid behavior on wider screens and the minimum width are to be decided before task 011. Added to `docs/decisions.md`, to row 011 of INDEX and to its open questions.
- No Figma calls.

## Metrics
- Started: 2026-10-24 12:37
- Finished: 2026-10-25 09:42
- Human interventions: 2 (#92 answered during the build; approval with #93 answered at the gate)
- Rework loops: 2 (e2e: test locators and stroke boxes; lint after the review fixes)
- Notes on prompts that failed:
