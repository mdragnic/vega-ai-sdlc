# Task 031: Finish: follow-ups, architecture and stability check

- Status: todo
- Gate: human
- Depends on: 030
- Size: L
- Skills: `superpowers:test-driven-development` (parts 3 to 5 and the new tests of parts 1 and 2 written first and seen failing; parts 1 and 2 are refactors under their existing tests, which stay unchanged except imports), `superpowers:systematic-debugging` (part 7: each failing test's cause found before its fix), `superpowers:verification-before-completion`, `superpowers:requesting-code-review`. **Not included: `security-review`**, because no part touches authentication, sessions, uploads, money, user scoping or what the backend accepts: parts 1 and 2 move frontend rendering code and CSS without changing what is shown or sent; part 3 adds a test; part 4 removes a frontend dependency nothing imports (the lockfile diff checked to remove only its tree); part 5 pins a developer tool that is not part of the app; part 6 is documentation; part 7 changes tests. One condition: if a part 7 fix has to change production code on the session-end path (the app-shell flake's area: the cached data removed when a session ends, task 014), `security-review` runs on that change before the gate and its report goes to the evidence. `dataviz` not applied: no chart's drawing, colors or data change (part 1 moves the card around `ComparisonBarChart`, not the chart). `frontend-design` not applied: no undesigned state is added.

## Goal
The follow-ups from the earlier gates are done: one shared comparison chart card behind Overview's Statistics and the Expenses chart; one shared card-state hook and title CSS behind Goals' Savings Goal and Saving Summary cards; a project-wide test that every `styles.<name>` in `frontend/src` exists in its CSS module; `recharts` removed; `@playwright/mcp` pinned. The documentation describes the finished app, and the suites have passed repeatedly on an idle machine, with every test that failed fixed at its cause.

## References
- INDEX row 031 (the follow-ups and where each came from: the task 024 code review and gate; the task 026 detailing, gate and review; the task 023 and 028 gates).
- Task files: 017 (`Statistics`), 024 (`ExpensesComparison`; its code review's Minor: "`ExpensesComparison` mirrors `Statistics` (the same CSS, the TSX differing in its strings, label formatter and group count); a shared comparison-chart card could serve both"), 025 (`SavingsGoal`), 026 (`SavingSummary`; its review: "`useCardQuery` and the title and placeholder CSS duplicate the Savings Goal card's ... a follow-up could extract a shared months-gated query hook"; its "SavingSummaryChart classes" test, the model for part 3), 030 (T19's per-file CSS-module check).
- Figma (budget 0, no MCP calls: PNGs only): 104 `docs/figma/104. Overview.png` (Statistics), 109 `docs/figma/109. Expenses.png` (Expenses Comparison), 110 `docs/figma/110. Goals.png` (Savings Goal, Saving Summary).
- Components (`docs/figma/components.md`): `Statistics`, `ExpensesComparison`, `ComparisonBarChart`, `ComparisonBarChartSkeleton`, `ChartLegend`, `Dropdown` (`comparison`, `box`, `plain`), `DataState`, `Card`, `Section`, `SavingsGoal`, `SavingSummary`, `Skeleton`.
- Decisions: the ones the moved code already follows, unchanged: #6, #20, #29, #55, #91 c, #93 a, #105 a, #113 (the chart card's states, header row, box and hidden table); #30, #60, #89, #114, #123, #124 e (the Goals cards' states and selectors); #65 (tokens only); #73 (the stack: no new dependency); the General rule (nothing undesigned added). No new question: each part is a follow-up Marko asked for, and the behaviour is fixed by the existing tests.
- Marko's notes for this task: everything from INDEX row 031, in this order, each as its own part with its own acceptance criteria: (1) `ExpensesComparison` and `Statistics` merged into one shared chart card, both looking and behaving exactly as now (their existing tests pass unchanged except imports; visual check of both against 104 and 109); (2) the shared card-state hook and title CSS for the Savings Goal and Saving Summary cards, the same rule; (3) the project-wide `styles.<name>` test, every miss fixed and listed; (4) `recharts` removed if nothing imports it (the lockfile updated, no other dependency change); (5) `@playwright/mcp` pinned in `.mcp.json` to the exact version installed (say which); (6) the docs: `docs/architecture.md` to the final state without "as built through task N", the README Status to "all screens built" with the task range, `docs/metrics.md` Totals from the rows (wall clock and build time where known, human interventions, rework loops, breaks, tests that passed by construction, Figma calls, decisions raised per phase), unknown values marked unknown; (7) last, on an idle machine (no leftover `npm run dev` processes; say how it was checked), `npm run e2e -- --repeat-each=3` and `npm test` three times, every test that fails even once fixed by waiting for the real state (no retries, no longer timeouts, nothing removed), first the two known flakes, each fixed test re-run 30 times. Visual check of every screen touched by (1) and (2) against its PNG at 1440x1024, Figma budget 0. `security-review` only if a part touches security, otherwise say why not (the Skills line).
- Facts found at detailing (each re-checked at the build):
  - `Statistics` and `ExpensesComparison` have the same structure and the same CSS (`.content`, `.header`, `.chartBox`). They differ only in the option ("Weekly Comparison" / "Monthly Comparison"), the control's name ("Statistics" / "Expenses Comparison"), the legend, the group count (7 / 12), the hidden table's caption, the empty message and how the response becomes labels and values (`days` with `formatDayLabel` / `months` with `formatMonthAxisLabel`). No test imports either component: the app tests find them by role, and `gallery.test.tsx` finds their gallery sections by the headings "Statistics" and "ExpensesComparison".
  - `SavingsGoal` and `SavingSummary` each declare the same `useCardQuery` (differing only in the second query's type) and the same `.title` and `.selectorPlaceholder` rules. `.selectorBlock` differs (a 32 high box against a 16 high text line) and stays in each card.
  - A rough scan of `frontend/src` (119 CSS-module imports, 928 static `<module>.<name>` uses) found no static miss. Five components index their module dynamically, which a static scan cannot see: `styles[size]` in `AmountBox` and `DateBox`, `styles[variant]` in `CategoryIcon` and `Dropdown`, `styles[shape]` in `Skeleton`. The part 3 test decides.
  - `recharts` 3.10.1 is in `frontend/package.json` and `package-lock.json`. No file in the repo imports it; only task files and the INDEX name it.
  - `.mcp.json` runs `@playwright/mcp@latest` through `cmd /c npx -y`. The npx cache holds `@playwright/mcp` 0.0.84, resolved from `@latest` (cache folder dated 2026-11-07).
  - `npm run e2e -- --repeat-each=3`: the root script ends in `npm run e2e -w e2e`, and that inner npm reads a `--flag` that has no `--` of its own as npm configuration (the memory on `-g`, which became `--global`). So the flag may never reach Playwright. The build checks the count Playwright reports (3 times the test count). If the flag was dropped, it runs the same check with the flag passed through (`npm run e2e -- -- --repeat-each=3`, or `npm run build -w shared` and then `npx playwright test --repeat-each=3` in `e2e/`) and records which one ran.
  - `docs/architecture.md`'s Testing section says "at most 3 breaks per task"; `/next-task` step 6 says 3 to 5.

## Scope
The parts follow Marko's order. Each part is done, with its tests passing, before the next starts. Part 7 comes last.

### Part 1: one shared comparison chart card
- New Code-only `ComparisonChartCard` (`frontend/src/components/ComparisonChartCard/`). It holds all of today's `Statistics` / `ExpensesComparison` content: the header row, with `Dropdown` `comparison` at the left and `ChartLegend` at the right in every state (#93 a); under it the chart's box (`--size-chart-height`, #92) with `DataState`, showing `ComparisonBarChartSkeleton` of N groups, the error state, the empty message when the backend sends no ticks (#91 c), or `ComparisonBarChart` (#113 b's hidden table included). Its one CSS module holds today's three rules, once. It is generic over the response and takes `query` plus a description of the comparison: the option (value and label), the control's accessible name, the legend's two names, the group count, the hidden table's caption, the empty message, and `toChart(data)`, which returns the labels, the two series and the ticks as sent. It formats and maps; it calculates nothing (#11, #55).
- `Statistics` and `ExpensesComparison` stay as its two named uses, so the pages, the gallery and the tests are unchanged. Each holds only its description, passed to `ComparisonChartCard`:
  - `Statistics`: "Weekly Comparison", "Statistics", "This week" / "Last week", 7 groups, "Expenses per day, this week and last week", "No expenses this week or last week", the days through `formatDayLabel`.
  - `ExpensesComparison`: "Monthly Comparison", "Expenses Comparison", "This year" / "Last year", 12 groups, "Expenses per month, this year and last year", "No expenses this year or last year", the months through `formatMonthAxisLabel`.
  Neither has markup or CSS of its own: `Statistics.module.css` and `ExpensesComparison.module.css` are deleted. The DOM, the class rules applied and every text stay as now.
- Why the two names stay (checkpoint): removing them would rename the gallery sections the existing tests find by name ("Statistics", "ExpensesComparison") and change both pages, against Marko's rule that the existing tests stay unchanged except imports.
- `docs/figma/components.md`: a Code-only row `ComparisonChartCard`; the `Statistics` and `ExpensesComparison` rows say they are its two descriptions; the added-by sentence gains "task 031 added `ComparisonChartCard`". `components/index.ts` exports it. It gets no gallery section of its own, because the two existing sections show it in every state.

### Part 2: the Goals cards' shared card state and title CSS
- The `useCardQuery` copied into `SavingsGoal` and `SavingSummary` becomes one hook, `useGatedQuery(gate, query)`, in `frontend/src/components/DataState/useGatedQuery.ts`. While the gate query (the months) has no data, it answers a pending query, or a failed one when the gate failed, and its Retry asks for the gate again. Once the gate has data, it answers the query itself. The logic is the same, typed generically; both cards use it and no copy is left.
- The title rule (Secondary, Semibold 16 on a 24 line, no margin, no wrap) and the selector placeholder rule, now copied in `SavingsGoal.module.css` and `SavingSummary.module.css`, move to one shared module, `frontend/src/styles/cardHeader.module.css` (`.title`, `.selectorPlaceholder`), which both components import. Each card keeps its own `.selectorBlock` (the sizes differ) and the rest of its CSS. No `composes`: the project does not use it yet.
- The cards' DOM, computed styles, texts and behaviour stay as now.

### Part 3: every `styles.<name>` exists in its CSS module
- New `frontend/test/styles/css-module-classes.test.ts`, covering every `.ts` and `.tsx` file in `frontend/src`:
  - Every default import of a `*.module.css` file is checked, whatever its local name (`styles`, `inputStyles`, ...): each `<name>.<key>` use must have a selector `.key` in that module. A selector counts, including one in a comma list or a compound selector; a comment or a value does not.
  - Every dynamic access (`<name>[expr]`) must be listed in the test's table of each file's dynamic keys and their possible values, taken from the prop's type (for example `AmountBox`'s `size`). Each value is checked like a static key. A dynamic access missing from the table fails the test, so a new one cannot slip past.
  - Any other import form of a CSS module (`import * as`, named imports) fails the test.
- Self-check cases on inline fixtures prove the detector: a missing key, a key only in a comment, a key in a comma list, a dynamic access not in the table, an unlisted import form.
- Every miss the test finds is fixed, by adding the rule the code means or by removing a class use where nothing was meant, and each is listed in the Log with what was done. The per-file checks from tasks 026 and 030 stay as they are: they are other tests.

### Part 4: remove `recharts`
- Run only after a search confirms that no file imports it. `npm uninstall recharts -w frontend`, and no other command that changes dependencies: `frontend/package.json` loses it and npm updates `package-lock.json`. The lockfile diff may only remove `recharts` and the packages nothing else needs (each removed entry checked). No remaining package's version, resolved URL or integrity changes.
- A new test in `shared/test/` (the repo-level tests live there) checks that `recharts` is in no workspace manifest, that `package-lock.json` has no `node_modules/recharts` entry, and that no source or test file under `frontend/`, `backend/`, `shared/` or `e2e/` imports it.
- `docs/architecture.md` already says the charts are hand-drawn SVG and never names Recharts.

### Part 5: pin `@playwright/mcp`
- `.mcp.json`'s playwright server runs `@playwright/mcp@<version>`, the exact version installed at the build: 0.0.84 at detailing, re-checked at the build from the npx cache and the running server, and named in the Log and at the gate.
- `shared/test/exact-versions.test.ts` gains a check that every package an `.mcp.json` server runs through `npx` is named with an exact version (the file's `exactVersion` rule). A self-check confirms that `@latest`, a range and a bare package name are flagged.
- The running MCP server is not restarted in this session; the pin takes effect in the next one. The visual checks use the server as it runs now.

### Part 6: the documentation in its final state
- `docs/architecture.md`:
  - "This document describes the system as built through task 030" is dropped; the sentence describes the system as it is.
  - Every statement is checked against the code as it stands after parts 1 to 5, and corrected where it differs: the endpoints table against the contract entries; the module list against `backend/src`; the Frontend section gains the shared chart card and the gated query only if it names components at that level; the Testing section's "at most 3 breaks" becomes `/next-task`'s 3 to 5, and the section names the CSS-module test.
  - Provenance such as "(task 029)" stays where it explains a rule.
- `README.md` Status: all screens built, tasks 000 to 031 (`.claude/tasks/INDEX.md`), replacing "the screen tasks follow".
- `docs/metrics.md` Totals, from the rows 000 to 030 and their task Logs. Task 031's own row joins at approval, and the totals are updated with it then. Every value must be traceable to a row; unknown values are written "unknown".
  - Total time: the sum of the wall clock column. Build time is summed where known (021 to 030 recorded, 013 to 020 from their Logs), stating how many tasks are unknown.
  - Human interventions and rework loops: the column sums.
  - Breaks: per task, as the rows and Logs record them (breaks and mutations, caught and missed); unknown where not recorded.
  - Tests that passed by construction: the count the rows and Logs record (027's row names 016, 019 and 027); unknown for tasks that did not count them.
  - Figma calls: the total from the Figma table (5: 3 by `/write-spec`, 2 in task 000), and per phase.
  - Decisions raised per phase, from `docs/decisions.md`'s header and table: `/write-spec`, applying it to the spec, the assumption markers, `/clarify-spec`, refinements, `/set-stack`, `/plan-tasks`, then per task by where each was raised (detailing, build, code review, security review, gate, Marko). Numbers the header does not place (85, 121) are placed from their rows, or marked unknown.
  - Biggest time sinks: from the rows (the longest wall clock and build times, with their recorded reasons).
  - "Lessons learned": the Totals line "What I would change in version 2" renamed to "Lessons learned" (there is no version 2, Marko at approval) and left for Marko. It is a judgement, not a sum.
- `.claude/tasks/INDEX.md`: "Detailed so far: 000 to 030" becomes "000 to 031" (done at detailing).

### Part 7: the stability check (last)
- Idle machine first. No `npm run dev` process is left: ports 3000 and 5173 are free in `netstat -ano`, and `Get-CimInstance Win32_Process` shows no `node.exe` whose command line runs `nest`, `vite`, `concurrently` or `tsc --watch`. The commands and their output go in the Log. Nothing else heavy starts during the runs.
- Then `npm run e2e -- --repeat-each=3` (with the count checked, see References) and `npm test` three times. Each run's exit code and counts go in the Log. For every failure, the test, the error and the run are kept as results in the evidence; raw output stays in the scratchpad.
- Every test that failed even once is fixed, starting with the two known flakes. Both are investigated even if they pass in these runs:
  - `e2e/tests/goals.spec.ts` "opens 110.1 for Mar, 2026 over the content area, closes it each way, and saves the month": the outside click on the overlay arrives before Radix's dismissable layer starts listening (it waits for a zero-delay timer). Seen in full runs.
  - `frontend/test/app/app-shell.test.tsx` "removes the date with the rest of the cached data": seen under load during task 023, cause not captured.
- The rule for every fix:
  - The cause is found first (systematic debugging), reproduced where possible under the condition that shows it (the full run, or CPU load).
  - The test then waits for the real state it means, for example the popup ready for an outside click, or the session query settled before the cache is read.
  - Never a retry, a longer timeout, a sleep or fixed delay, a removed or weakened assertion, or a skipped test.
  - If the cause is the app dropping a real user's action (a click a fast user could make), the app is fixed, a test that reproduces the drop is added first, and the Log and the gate say so.
- Each fixed test then runs 30 times in a row, and all 30 pass: e2e with `--repeat-each=30` on that test alone; unit as 30 runs of its file, plus its suite under the load that showed the failure, where it was load-dependent. The counts go in the Log.
- After the fixes, the full `npm run e2e` and `npm test` run once more on the final code.

## Out of scope
- Any change to what a screen shows or does; any new feature or state (the parts are refactors, tests, tooling and documentation; the General rule).
- Merging any other components, such as `SavingSummaryChart` with `ComparisonBarChart`, the skeletons, or the Overview Goals card with `SavingsGoal`. Only the two named follow-ups are merged.
- Any dependency change other than removing `recharts`: no upgrade, no new package, no `npm audit fix`, no lockfile refresh.
- Pinning or changing the other MCP server (Figma's is an HTTP URL with no version), or any other tool configuration.
- Retries, longer timeouts, `skip` / `fixme` or quarantine for flaky tests; any change to `playwright.config.ts`'s workers, retries or timeouts.
- Rewriting `docs/decisions.md`, the spec or earlier task files; filling in "Lessons learned".
- Mobile (#4).

## Acceptance criteria
**Part 1: one shared comparison chart card**

1. Given Overview and Expenses, then Statistics and the Expenses chart look and behave exactly as before: their existing tests pass with no change except imports (`overview-statistics.test.tsx`, `expenses.test.tsx`, the Statistics and ExpensesComparison cases of `gallery.test.tsx`, `overview-statistics.spec.ts`, `expenses.spec.ts`, `charts.spec.ts`, `component-gallery.spec.ts`). At 1440x1024 both cards render the same pixels as before the change, and they match 104 and 109 with the same differences tasks 017 and 024 listed, no new one.
2. Given the frontend source, then both cards' header row, chart box, `DataState` and chart exist once, in `ComparisonChartCard` and its one CSS module. `Statistics` and `ExpensesComparison` hold only their descriptions: no `Dropdown`, `ChartLegend`, `DataState` or `ComparisonBarChart` of their own, and no CSS module. Given `ComparisonChartCard` rendered with a description, then it shows the option, the control's name, the legend, N skeleton groups while loading, the error state, the empty message without ticks, and the chart with the caption and the labels and values `toChart` returns. It is in `components.md` and exported.

**Part 2: the Goals cards' shared card state and title CSS**

3. Given Goals, then the Savings Goal and Saving Summary cards look and behave exactly as before: their existing tests pass with no change except imports (`goals.test.tsx`, `goals-category-limits.test.tsx`, `overview-goals.test.tsx`, the SavingsGoal and SavingSummary cases of `gallery.test.tsx`, `goals.spec.ts` (its known flake aside, part 7), `goals-category-limits.spec.ts`). At 1440x1024 both cards render the same pixels as before the change, and Goals matches 110 with the same differences tasks 025 to 027 listed, no new one.
4. Given the frontend source, then the months-gated card state exists once: `useGatedQuery`, used by both cards, with no `useCardQuery` left. The title and selector placeholder rules exist once, in `cardHeader.module.css`, imported by both cards; neither card's module defines `.title` or `.selectorPlaceholder`. Given the hook alone, then it answers pending while the gate loads; error when the gate failed, where Retry calls the gate's refetch and answers its outcome; and the query itself once the gate has data, also when the query is pending, failed or refetching.

**Part 3: every `styles.<name>` exists in its CSS module**

5. Given every `.ts` and `.tsx` file in `frontend/src`, then every class it uses from a CSS module, static or through a listed dynamic key, has a selector in that module. The test fails for a missing class, a class found only in a comment, an unlisted dynamic access and another import form (the self-checks). Every miss it found is fixed and listed in the Log, or the Log says "none found" with the counts checked.

**Part 4: remove `recharts`**

6. Given the repo, then `recharts` is in no `package.json`, `package-lock.json` has no entry for it, and nothing imports it. The lockfile diff only removes `recharts` and packages only it needed; no other dependency's version, resolved URL or integrity changes. `npm ls` exits 0, and lint, typecheck, the tests and `npm run build` pass.

**Part 5: pin `@playwright/mcp`**

7. Given `.mcp.json`, then the playwright server runs `@playwright/mcp@<the exact installed version>`, named in the Log and at the gate. The exact-versions test fails for `@latest`, a range or a bare package name in an `.mcp.json` `npx` argument.

**Part 6: the documentation in its final state**

8. Given `docs/architecture.md`, then it has no "as built through task" or "not built yet" wording. Every route in the shared contract appears in its endpoints table, and nothing in the table is missing from the contract. Its module list matches `backend/src`. Its Testing section matches `/next-task` (3 to 5 breaks) and names the CSS-module test. Nothing in it names Recharts.
9. Given `README.md`, then its Status section says all screens are built, tasks 000 to 031, with no "screen tasks follow".
10. Given `docs/metrics.md`, then each Totals figure listed in Scope is filled in from the rows 000 to 030 and traceable to them; values not recorded say "unknown"; the Totals line "What I would change in version 2" is renamed "Lessons learned" and left for Marko.

**Part 7: the stability check**

11. Given the stability runs, then before them the Log shows the idle check (the commands and their output: ports 3000 and 5173 free, no dev-server `node.exe`).
12. Given `npm run e2e -- --repeat-each=3` (Playwright's count 3 times the test count) and three `npm test` runs, then the Log has each run's exit code and counts. Every test that failed even once is listed with its cause and its fix. The two known flakes are investigated and fixed at their cause whether or not they failed in these runs.
13. Given the fixes, then none adds a retry, raises a timeout, adds a sleep or fixed delay, removes or weakens an assertion, or skips a test. Each waits for the state it means, or fixes the app where the app dropped a user's action, with a reproducing test added first. Each fixed test passes 30 times in a row.
14. Given the final code, then lint, typecheck, `npm test` and `npm run e2e` pass.

## Test scenarios
| ID | Type | Scenario | Expected | Covers AC |
|----|------|----------|----------|-----------|
| T1 | unit + e2e | The existing tests of Statistics and the Expenses chart (AC1's list), run before and after part 1; `git diff` on those files | Pass both times; the diff shows imports only (none expected) | 1 |
| T2 | unit | `frontend/test/components/ComparisonChartCard.test.tsx` (StrictMode): a test description on held, failing, all-zero (no ticks) and answered queries | The option, the control's name, the legend in every state; N skeleton groups; the error state with Retry; the empty message; the chart's caption, labels and values as `toChart` returned them; nothing calculated | 2 |
| T3 | unit | Source check: `Statistics.tsx`, `ExpensesComparison.tsx`, the two deleted CSS modules, `components.md`, `index.ts`, `names.test.ts` | Each file imports `ComparisonChartCard` and no `Dropdown`, `ChartLegend`, `DataState` or `ComparisonBarChart`; neither CSS module exists; the row and the export exist; the names test passes | 2 |
| T4 | unit + e2e | The existing tests of the Goals cards (AC3's list), run before and after part 2; `git diff` on those files | Pass both times (the goals flake handled in part 7); the diff shows imports only (none expected) | 3 |
| T5 | unit | `frontend/test/components/useGatedQuery.test.tsx` (`renderHook`, StrictMode): the gate pending; the gate failed, then Retry with the gate answering, and with it failing again; the gate answered with the query pending, failed, answered and refetching | Pending; error, with Retry calling the gate's `refetch` once and answering pending or error; then the query object itself in each case | 4 |
| T6 | unit | Source check: `SavingsGoal.tsx`, `SavingSummary.tsx`, their modules and `cardHeader.module.css` | No `useCardQuery`; both call `useGatedQuery` and use `cardHeader.module.css`'s `title` and `selectorPlaceholder`; neither module defines `.title` or `.selectorPlaceholder`; the shared module defines each once | 4 |
| T7 | unit | `frontend/test/styles/css-module-classes.test.ts` over `frontend/src` | Every static and listed dynamic class found in its module; the number of files, imports and uses checked reported in the test names (a run that finds no files fails) | 5 |
| T8 | unit | The detector's self-checks on inline fixtures: a missing key, a key only in a comment, a key in a comma list and in a compound selector, an unlisted `styles[x]`, `import * as styles` and a named import | Missing, comment-only, unlisted dynamic and the two import forms flagged; comma-list and compound selectors accepted | 5 |
| T9 | unit | `shared/test/` recharts check: every workspace manifest, `package-lock.json`, every `.ts`/`.tsx`/`.js`/`.mjs` file under the four workspaces | No `recharts` dependency, no `node_modules/recharts` entry, no import of it | 6 |
| T10 | check | The lockfile diff after `npm uninstall`: every removed entry, then every changed line; `npm ls`; `npm run build` | Only removals, each a package only `recharts` needed (listed in the Log); no changed version, resolved or integrity line; `npm ls` exit 0; the build exit 0 | 6 |
| T11 | unit | `shared/test/exact-versions.test.ts`: the `.mcp.json` check, and its self-check with `@playwright/mcp@latest`, `@playwright/mcp@^0.0.84` and `@playwright/mcp` | The repo's `.mcp.json` passes; the three are flagged | 7 |
| T12 | check | The documentation checks, run as commands with their output in the Log: a search for "as built through" and "not built yet" in `docs/architecture.md`; the contract's routes (read from the built `@finebank/shared` contract) against the endpoints table; the module folders of `backend/src` against the module list; the Testing section's break rule against `/next-task`; the README Status; every Totals line filled | No match; the two route lists equal; the module lists equal; 3 to 5; "all screens built", 000 to 031; no empty Totals line but Marko's | 8, 9, 10 |
| T13 | check | The idle check: `netstat -ano` for 3000 and 5173; `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` command lines | No listener; no `nest`, `vite`, `concurrently` or `tsc --watch` process | 11 |
| T14 | check | `npm run e2e -- --repeat-each=3` (the reported count checked, the command used recorded); `npm test` three times | Each run's exit code and counts in the Log; every failure listed with its test, error and run | 12 |
| T15 | check | Each fixed test 30 times in a row: e2e `npx playwright test <file> --grep "<title>" --repeat-each=30` in `e2e/`; unit 30 runs of its file, and its suite under load where the failure was load-dependent | 30 of 30 passed for each, counts in the Log | 13 |
| T16 | check | `git diff` of every test file and of `playwright.config.ts` and the Vitest configs, scanned for added `retries`, `timeout`, `waitForTimeout`, `setTimeout`, `sleep`, `.skip`, `.fixme` or `.only`, removed `expect` lines, and changed config | None added or removed; each fix's diff explained in the Log | 13 |
| T17 | unit + e2e | `npm run lint`, `npm run typecheck`, `npm test`, `npm run e2e` on the final code | Exit 0 each | 14 |

## Validation steps (in this order, stop on first failure)
1. Lint and typecheck pass (`npm run lint`, `npm run typecheck`).
2. Unit tests pass (`npm test`).
3. E2E tests pass (`npm run e2e`), with ports 3000 and 5173 free first.
4. Proof by breaking it on purpose: none, because no part changes security, user scoping, money or dates (`/next-task` step 6 limits breaks to those). The new detector of part 3 is proven by its own self-checks (T8), and the refactors of parts 1 and 2 by their unchanged tests and the before-and-after pixels (step 5).
5. Visual, Playwright MCP at 1440x1024 (device scale 2, scrollbars hidden, the fixed clock, a demo user, as tasks 013 to 030):
   - Before parts 1 and 2 (on the commit the task starts from): Overview, Expenses and Goals, plus the chart cards' and the Goals cards' loading, error and empty states from the gallery.
   - After both parts: the same captures, compared pixel by pixel, card by card. They should be identical; any pixel that differs is listed and explained, or fixed.
   - Then each screen compared with `docs/figma/104. Overview.png` (Statistics), `docs/figma/109. Expenses.png` (Expenses Comparison) and `docs/figma/110. Goals.png` (Savings Goal, Saving Summary), every difference listed (expected: tasks 017, 024, 025 and 026's own differences and the demo numbers, #12).
   - Saved to `.claude/tasks/evidence/031/`.
6. Manual browser checks with Playwright MCP on `npm run dev`:
   - Overview: the Statistics control opened by mouse and keyboard, the list showing "Weekly Comparison" only, closed with Escape.
   - Expenses: the same for "Monthly Comparison".
   - Goals: the Savings Goal and Saving Summary month selectors each set to another month; the backend stopped and a month picked (the error state and Retry); the backend started and Retry pressed.
   - Then `npm run dev` stopped and its processes ended (the memory on Windows orphans).
7. Part 7, the stability check (Scope), on an idle machine: T13, then T14, then a fix and T15 for every test that failed and for the two known flakes, then T16.
8. The final runs (T17) after the code review's fixes. Every "passes" claim backed by its command output.

## Human checkpoint (only if Gate: human)
- Part 1 as built: one `ComparisonChartCard`, with `Statistics` and `ExpensesComparison` kept as its two descriptions (why: the gallery sections and pages the existing tests find by name); the existing tests unchanged; the before-and-after pixels identical; 104 and 109 with the same differences as before.
- Part 2 as built: `useGatedQuery` in `components/DataState/`; `.title` and `.selectorPlaceholder` (the placeholder rule included, as the task 026 review named it) in `frontend/src/styles/cardHeader.module.css`, imported by both cards with no `composes`; the existing tests unchanged; the pixels identical; 110 with the same differences as before.
- Part 3: the test's rules (the dynamic-key table, other import forms refused) and the list of misses it found with what was done for each, or none.
- Part 4: `recharts` removed; the list of lockfile entries removed with it; nothing else changed.
- Part 5: `@playwright/mcp` pinned to the version named in the Log (0.0.84 at detailing); it takes effect in the next session.
- Part 6: `docs/architecture.md` in its final state (the corrections listed in the Log); the README Status; the metrics Totals, with the unknown values and "Lessons learned" (renamed from "What I would change in version 2") left for Marko; task 031's own row added to the totals at approval.
- Part 7: how the idle machine was checked; the counts of the three e2e and three unit runs; each failing test with its cause and fix (the two known flakes first), and whether any fix changed app code; 30 of 30 for each fixed test; the test-diff scan clean.
- Validation and the documentation's checks were recorded as command results (T10, T12 to T16), not unit tests, where no unit test can hold them.
- `security-review` not run, for the reasons on the Skills line (or, if a part 7 fix changed the session-end path, its report in the evidence).

## Log
<!-- Claude appends: date, what was done, decisions, issues, validation results, review findings -->
- 2026-11-07: Detailed from INDEX row 031 with Marko's notes (seven parts in his order, each with its own acceptance criteria). No question raised: every part is a follow-up from an earlier gate or review, its behaviour fixed by the existing tests. Facts checked at detailing are listed in References (the identical structure and CSS of the chart cards; the copied hook and rules of the Goals cards; a rough scan finding no static CSS-module miss and five dynamic accesses; `recharts` imported nowhere; `@playwright/mcp` 0.0.84 in the npx cache; the inner npm possibly dropping `--repeat-each`; the Testing section's stale break count). INDEX header updated to "Detailed so far: 000 to 031". No Figma calls.
- 2026-11-07: The task file approved by Marko as written, with one change: in part 6 the Totals line left for him is "Lessons learned" (there is no version 2), renamed from "What I would change in version 2" (Scope, Out of scope, AC10 and the Human checkpoint updated). Counted as 1 human intervention. Build not started.

## Metrics
- Started:
- Finished:
- Human interventions: 1
- Rework loops: 0
- Notes on prompts that failed:
