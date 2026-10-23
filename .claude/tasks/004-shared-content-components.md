# Task 004: Shared components: section cards, tabs, data states, category icons, date and amount boxes

- Status: todo
- Gate: human
- Depends on: 001, 002
- Size: L
- Skills: `superpowers:test-driven-development`, `superpowers:verification-before-completion`, `superpowers:requesting-code-review`, `frontend-design:frontend-design` (undesigned states only: loading skeleton, empty and error states, focus styles)

## Goal
The content parts that the app screens (104 to 112) share exist as tested, presentational components: the section title row and white card, the All / Revenue / Expenses tabs, the loading, empty and error states with a per-widget error boundary, the category icons, and the date and amount boxes. The dev gallery shows every state. Screen tasks use them and never rebuild them.

## References
- Spec: `docs/spec/brief.md` Layout (app screens), States, Data (categories), "Tabs" and "Interaction states" under Not designed; `docs/spec/stories.md` US-05 to US-16 as visuals and states: US-07 criterion 2 and US-14 criterion 3 (date box, amount box), US-08 criteria 2, 3 and 5 and US-13 criteria 2, 3 and 5 (tabs, category icons), US-10 criterion 3, US-15 criterion 4 and US-16 (category tiles), every story's "Missing from design" loading, empty and error states
- Figma (budget 0, no MCP calls: PNGs and `docs/figma/components/` only):
  - 104. Overview `66:4732`: Total Balance `405:5461` (title and card), Upcoming Bill `405:5530` (title with "View All", rows `405:5538` / `405:5554`, amount boxes `405:5552` / `405:5571`), Recent Transaction `66:4747` (`Menu Tab` frame `66:4755`, category tiles), Expenses Breakdown `66:4999` (title with note, category tiles). PNG `docs/figma/104. Overview.png`
  - Flattened (#37): 107. Transactions `66:5474` (tabs, plain category icons), 108. Bills `66:5609` (large date and amount boxes), 109. Expenses `66:5698` (tiles on the gray card header), 110. Goals `66:5829` (category tiles), 105 and 106 (title-to-card gap). PNGs with the same names in `docs/figma/`
  - Component export `docs/figma/components/418-6433.png` (frame `418:6433`, 2x): `Button small` `2:42` (the 84x32 teal "Details"), the `Bill item` row with its date and amount box, `Item` and `Expences Item` with their tiles
  - Icons: `Housing` `42:903`, `Food` `42:751`, `Trasnport` `42:749`, `Movie` `42:748`, `Shopping` `42:750`, `Others` `42:747`, `wallet` `12:335`, `chevron-right` `14:745`, all already in `frontend/src/assets/icons/`
- Names: `docs/figma/components.md` (`ButtonSmall`, `ChevronRight`, category icon code names; Code-only table for the rest)
- Decisions: `docs/decisions.md` #6, #11, #19, #36, #37, #55, #56, #65, #66, #84, #87, #88

## Scope
- Shared (`@finebank/shared`), pure and tested:
  - `shared/src/contract/category.ts`: `expenseCategorySchema`, a Zod enum of the 6 fixed categories in the designed order: housing, food, transportation, entertainment, shopping, others (#56, #61). Its type comes from `z.infer`. Task 008 uses it for the data model; nothing redeclares it (#74).
  - `shared/src/format/category.ts`: `categoryLabel(category)` gives Housing, Food, Transportation, Entertainment, Shopping, Others (#56).
  - `shared/src/format/date.ts`: `formatDateBox(plainDate)` gives `{ month, day }` for the date box: `{ month: 'May', day: '15' }` for `2023-05-15` and `{ month: 'Sep', day: '05' }` for `2023-09-05`: the day always has two digits and the month always 3 letters (#88). Throws on anything but a plain date, like `formatDate`.
- Components in `frontend/src/components/<CodeName>/`, CSS Modules with tokens only. Every value is measured on the PNGs at 2x and halved (#65); new tokens go to `tokens.md` and `tokens.css` with their source.
  - `Section`: a `<section>` named by its title, an `<h2>` in the designed section title style (104 "Total Balance": Gray/02, 22/32). The title row can hold, on the right, either:
    - a "View All" link with `ChevronRight` to a given path (104 Upcoming Bill and Recent Transaction). Two "View All" links share one page, so each is described by its section title (`aria-describedby`), with no new visible text;
    - a note (104 Expenses Breakdown "*Compare to last month"), at its measured position.
    The children follow at the gap the screen's PNG shows: `--space-section-title-gap` (8, Overview) or `--space-section-title-gap-lg` (16, the other screens).
  - `Card`: the white content card: `--radius-card`, `--shadow-card`, `--space-card-padding`. A `padding="none"` option for content that sets its own insets (tables, Settings).
  - `MenuTab` (Figma frame `Menu Tab` `66:4755`): the All / Revenue / Expenses tabs of 104 and 107.
    - Active: teal text and the 2px teal underline (`--border-width-tab-indicator`). Inactive: Secondary `#525256`. Whichever tab is selected uses the Active style (#19). No hover style (not designed).
    - An ARIA tablist: one tab stop, Left and Right move the selection with wrap, Home and End go to the first and last, and moving activates the tab. Each tab has `aria-controls` for the panel the widget renders.
    - Labels and values come from props; the widgets map them to all, income and expense (#19).
  - `CategoryIcon`: the icon for one expense category, or for income (no category, #56):
    - Mapping: Housing `Housing`, Food `Food`, Transportation `Transport`, Entertainment `Movie`, Shopping `Shopping`, Others `Others`, income `Wallet` (#56). Check each against its PNG by rendering and diffing, as task 003 did for the nav icons.
    - Variants, as measured: a tile on white (Gray/06, 104 Recent Transaction about 40x40, 104 Expenses Breakdown about 40x56, 110 Goals about 40x48), a tile on the gray card header of 109 (about `#D1D1D1`, likely `--color-special-bg`), and plain with no tile (107 table rows). One size option per distinct measured size.
    - Its accessible name is the category label ("Income" for income), unless the widget marks it decorative because the category name shows next to it.
  - `DateBox`: the gray date box, month over day, from `formatDateBox`, inside `<time dateTime>`. Two sizes: compact (104, existing tokens `--size-date-box-*`, `--radius-date-box`) and large (108, about 72x80).
  - `AmountBox`: the bordered amount box (border Gray/05), showing `formatMoney` (`$150.00`, #11; Figma's `$150` predates #11). Two sizes: compact (104, about 68x40) and large (108, about 108x48). The Figma width is the minimum; a longer amount widens the box and never wraps or overflows.
  - `ButtonSmall` (Figma `Button small` `2:42`, 84x32, from the export): a small teal button. Used for Retry.
  - `Skeleton`: a token-colored placeholder block (text line, block or circle). The widget's CSS sets each block's size with tokens. A gentle pulse that stops under `prefers-reduced-motion`.
  - `DataState`: the shared states (#6) for the content of one widget, list, table or chart:
    - It takes a TanStack Query result (any object with `status`, `fetchStatus`, `data` and `refetch`), the widget's `skeleton`, an optional `isEmpty(data)` with the widget's empty message, and `children(data)`.
    - Loading (no data yet, or retrying after an error): the widget's skeleton, `aria-hidden`, in a container with `aria-busy="true"`.
    - Empty: the given message in the widget, no illustration, no button.
    - Error: the message "Something went wrong." and a "Retry" `ButtonSmall` below it in the widget, the same for every widget (#88), `role="alert"` on the message. Retry calls `refetch` and shows the skeleton until it settles.
    - Error boundary: `children` render inside a per-widget React error boundary (a small class component in the `DataState` folder, no new dependency). A render error, such as `formatMoney` throwing on 12.5 cents (task 001), shows that widget's error state with Retry. The rest of the page keeps working. Retry refetches, then resets the boundary and renders again with the fetched data; if it throws again, the error state shows again.
  - Focus (#87): `MenuTab` tabs, the "View All" link and `ButtonSmall` get the teal `:focus-visible` ring (`--border-width-focus-ring`, `--space-focus-ring-offset`). A mouse click shows no ring.
- Code-only rows added to `docs/figma/components.md`: `Section`, `Card`, `MenuTab`, `CategoryIcon`, `DateBox`, `AmountBox`, `Skeleton`, `DataState`, each with its purpose and decision. `ButtonSmall` already has its Code name row.
- Dev gallery sections:
  - `Section`: plain, with "View All", with the note, each with a `Card` (like 104 Total Balance, Upcoming Bill, Expenses Breakdown).
  - `Card`: default and `padding="none"`.
  - `MenuTab`: All active, Revenue active, Expenses active, and one interactive set.
  - `CategoryIcon`: the 6 categories and income in every variant.
  - `DateBox`: compact and large, for `2023-05-15`, `2023-06-16` and `2023-09-05`.
  - `AmountBox`: compact and large, for `$150.00`, `$559.00` and `$1,000,000,000.00`.
  - `ButtonSmall`, `Skeleton`.
  - `DataState`: loading, empty, error and ready. Plus an error boundary demo: two widgets side by side, healthy on load. A "Render a bad amount" button makes the first one render an `AmountBox` with 12.5 cents; its Retry fetches valid data again. The demo uses a local query function, never the network.

## Out of scope
- Widget contents and their skeleton shapes: each screen task composes its own skeleton from `Skeleton` (tasks 013 to 027).
- Query hooks, API endpoints and the data model (task 008 and the screen tasks). 401 handling and redirects (tasks 009, 011).
- Row and card components of one screen: `RecentTransactionItem`, `ExpensesItem`, `TransactionItem`, `BillItem`, `ExpensesBreakdown`, `GoalItem`, the Total Balance carousel, the gauge (tasks 006, 013 to 027).
- The Settings Account / Security tabs (111, 112): one screen, with a different look (inactive Gray/03 `#9F9F9F`, not Secondary, and a wider underline). Task 028 builds them and reuses `Card`.
- Load More and its loading state (tasks 020, 021, with `ButtonPrimary` `loading` from task 002).
- Charts and the all-zero chart empty rule (#55; tasks 006, 017, 024, 026), Popup, Dropdown and the amount input (task 005), the Expenses Breakdown arrow hover (#21, task 018).
- Page grids and the content inset (task 003 `AppLayout`, screen tasks).
- Hover styles that are not designed (tabs, "View All"): none (general rule).

## Acceptance criteria
1. Given `expenseCategorySchema`, then it parses the 6 categories and rejects any other value, and its options are in the order Housing, Food, Transportation, Entertainment, Shopping, Others. `categoryLabel` gives the 6 display names (#56, #61).
2. Given `formatDateBox("2023-05-15")`, then it gives month "May" and day "15". Given `2023-09-05`, it gives "Sep" and "05": two-digit day, 3-letter month (#88). Anything but a plain date throws.
3. Given `Section` with a title, then it renders a region named by an `<h2>` in the measured title style, with the children below at the gap the screen picks (8 or 16).
4. Given `Section` with a "View All" path, then a "View All" link with `ChevronRight` sits on the right of the title row and goes to that path, described by the section title. Given a note, the note shows there instead. Given neither, only the title shows.
5. Given `Card`, then it is white with `--radius-card`, `--shadow-card` and 24px padding; with `padding="none"` it has no padding.
6. Given `MenuTab` with All, Revenue and Expenses and All selected, then it renders a tablist of 3 tabs. All has the Active style (teal text, 2px teal underline) and `aria-selected="true"`; the others have the Inactive style. Given Revenue or Expenses selected, it has the same Active style (#19).
7. Given `MenuTab`, when I click an inactive tab, then `onChange` is called once with its value; clicking the selected tab calls nothing. From the keyboard there is one tab stop; Left and Right (with wrap), Home and End move the selection and call `onChange`.
8. Given `CategoryIcon` for each category, then it shows the mapped icon (Housing, Food, Transport, Movie, Shopping, Others), and income shows `Wallet` (#56). Its accessible name is the category label, or "Income"; marked decorative, it has none.
9. Given `CategoryIcon` in each variant, then size, tile color and icon color match the measured context: 104 Recent Transaction, 104 Expenses Breakdown, 109 card header, 110 Goals, 107 table row.
10. Given `DateBox` compact and large for `2023-05-15`, then each shows "May" over "15" in the measured styles of 104 and 108, inside `<time dateTime="2023-05-15">`.
11. Given `AmountBox` for 15000 cents, then it shows `$150.00` in the bordered box of 104 (compact) or 108 (large). Given `$1,000,000,000.00`, the box widens, and the text stays on one line inside the border.
12. Given a query that is pending, then `DataState` shows the widget's skeleton, `aria-hidden`, inside a container with `aria-busy="true"`, and does not render `children`.
13. Given a successful query whose data `isEmpty`, then `DataState` shows the given empty message and no Retry. Given data that is not empty, it renders `children(data)`.
14. Given a failed query, then `DataState` shows "Something went wrong." and a Retry button below it (#88) in the widget. When I click Retry, `refetch` is called once and the skeleton shows until it settles.
15. Given two widgets on a page, when one widget's children throw while rendering (an `AmountBox` with 12.5 cents), then only that widget shows the error state with Retry; the other widget and the rest of the page keep rendering and stay usable. When I click Retry and valid data arrives, the widget renders normally. If it throws again, the error state shows again.
16. Given keyboard focus on a tab, the "View All" link, Retry or `ButtonSmall`, then the teal 2px ring with a 2px offset shows. A mouse click shows no ring (#87).
17. Given `prefers-reduced-motion: reduce`, then `Skeleton` does not animate.
18. Given the component folder, then the 8 code-only components are in the Code-only table, `ButtonSmall` matches its Code name row, and all CSS uses tokens only.
19. Given `npm run dev`, then the gallery shows every section listed in Scope, with no console errors or warnings on load.

## Test scenarios
| ID | Type | Scenario | Expected | Covers AC |
|----|------|----------|----------|-----------|
| T1 | unit | `expenseCategorySchema` with the 6 values, `"bills"`, `"Housing"` and `""`; `.options`; `categoryLabel` for each | 6 pass, 3 rejected; order as in AC1; the 6 names | 1 |
| T2 | unit | `formatDateBox` for `2023-05-15`, `2023-06-16`, `2023-09-05`; `"2023-5-15"`, `"2023-02-30"`, a UTC timestamp | `May`/`15`, `Jun`/`16`, `Sep`/`05`; the last three throw | 2 |
| T3 | unit | `Section` with title only; with `viewAllTo`; with `note` | Region named "Total Balance" with an `h2`; link "View All" with the path and `aria-describedby` to the title; the note text; no link or note when not given | 3, 4 |
| T4 | e2e | Gallery `Section` and `Card` examples | Title color, size and line height equal the tokens; title-to-card gap 8 and 16; card background, radius, shadow and padding equal the tokens; `padding="none"` is 0 | 3, 5 |
| T5 | unit | `MenuTab` with value `all`, then `income` | Tablist with 3 tabs; only the selected one has `aria-selected="true"` and `tabindex="0"`; `aria-controls` set | 6 |
| T6 | unit | Click Revenue, then click Revenue again; focus the tablist and press Right, Right, Right, Home, End, Left | `onChange("income")` once, nothing for the second click; then income, expense, all (wrap), all, expense, income | 7 |
| T7 | e2e | Gallery tabs: computed color of the active and inactive labels, the underline width and color | Active `--color-primary` with a 2px `--color-primary` underline; inactive `--color-secondary`; the same for each selected tab | 6 |
| T8 | unit | `CategoryIcon` for the 6 categories and `null`; one marked decorative | The mapped icon renders (by test id from the icon index); accessible names are the 6 labels and "Income"; the decorative one is `aria-hidden` | 8 |
| T9 | e2e | Gallery `CategoryIcon` variants | Tile sizes, tile colors and icon colors equal the measured tokens for each context | 9 |
| T10 | unit | `DateBox` for `2023-05-15`; `AmountBox` for 15000 cents and 100000000000 cents | `<time dateTime="2023-05-15">` with "May" and "15"; `$150.00`; `$1,000,000,000.00` | 10, 11 |
| T11 | e2e | Gallery `DateBox` and `AmountBox`, compact and large | Box sizes, radius, colors and type equal the measured tokens; the long amount's text box fits inside the border and its height equals the short one's | 10, 11 |
| T12 | unit | `DataState` with a pending query; with a success query of `[]` and `isEmpty`; with `[1]` | Skeleton inside `aria-busy="true"`, `aria-hidden`, children not called; the empty message and no button; children called with the data | 12, 13 |
| T13 | unit | `DataState` with a failed query, click Retry with a `refetch` that stays pending, then resolves | "Something went wrong." with `role="alert"` and a Retry button; `refetch` called once; the skeleton while pending | 14 |
| T14 | unit | Two `DataState` widgets; the first renders `AmountBox` with 12.5 cents; click its Retry with a `refetch` that resolves to valid data; then a `refetch` that resolves to bad data again | First widget shows the error and Retry, the second shows its content; after Retry with valid data the first shows `$150.00`; with bad data the error shows again. `console.error` is spied, and only the expected `RangeError` is logged | 15 |
| T15 | e2e | Gallery error boundary demo: click "Render a bad amount", then Retry | The first widget shows the error state, the second still shows its content and its tab still works; after Retry, the first shows its amount. The only console error is the expected `RangeError` | 15 |
| T16 | e2e | Tab to a tab, "View All", Retry and `ButtonSmall`; then click each | Outline `--color-primary`, 2px, offset 2px on keyboard focus; no outline after a click | 16 |
| T17 | e2e | Gallery `Skeleton` with `reducedMotion: 'reduce'` | `animation-name` is `none` (or no running animation) | 17 |
| T18 | unit | Component name guard from task 002; icon test from task 000 | Pass with the new components and the Code-only rows | 18 |
| T19 | e2e | `/dev/components` with the new section names added to the gallery spec | Every section visible; no console errors or warnings on load | 19 |

## Validation steps (in this order, stop on first failure)
1. Lint + typecheck pass.
2. Unit tests pass.
3. E2E tests pass.
4. Visual: Playwright MCP screenshots of the gallery at 1440x1024 and device scale 2, compared element by element with crops of the PNGs. Positions are CSS px after halving, approximate; measure them exactly:
   - `104. Overview.png`:
     - "Total Balance" title glyphs x 305–442, y 112–128; card top y 144 (gap 8).
     - Upcoming Bill "View All" and chevron x about 1326–1390, y about 115–124, right edge on the card's right edge (x 1408).
     - "*Compare to last month" x about 1271–1406, y about 757–768.
     - Recent Transaction tabs: labels y about 478–493; "All" underline x about 328–364, y 502–503.
     - Category tiles: Recent Transaction about 40x40 from x 328; Expenses Breakdown about 40x56 from x 720.
     - Upcoming Bill date box x 1080–1123, y 177–240; amount box about x 1316–1383, y 190–228.
   - `107. Transactions.png`: tabs, "All" underline x about 304–340, y 190–191; plain category icon glyph x about 341–362, y about 300–315.
   - `108. Bills.png`: date box x 328–399, y 265–344; amount box about x 1266–1373, y 282–328.
   - `109. Expenses.png`: card header tile, about 40x48 at x 328.
   - `110. Goals.png`: category tile, about 40x48 at x 328.
   - `105`, `106`: title-to-card gap 16.
   - Export `418-6433.png`: `Button small` "Details", 84x32.
   Save the screenshots and the comparison images to `.claude/tasks/evidence/004/` and list every difference. Expected differences: `$150.00` instead of `$150` (#11), and the category mapping where Figma differs (#56).
5. Manual browser checks with Playwright MCP in the gallery: click and arrow through each tab set, tab through every focusable new element, run the error boundary demo (break, check the other widget still works, Retry), and view the skeleton with reduced motion on and off.

## Human checkpoint (only if Gate: human)
- Each component matches its PNG crop: section title row, card, tabs, category tiles and plain icons, date and amount boxes, `ButtonSmall`.
- The category icon mapping, with the diff numbers from the Log.
- Undesigned visuals: the skeleton look and pulse, the empty message, the error message and Retry, and the focus rings.
- The error boundary: one broken widget shows its error state and the rest of the page keeps working; Retry recovers.
- The tab keyboard behavior (arrows move and activate).
- #88 applied: "Something went wrong." above Retry on every widget, and the two-digit day in the date box (`Sep` over `05`).

## Log
<!-- Claude appends: date, what was done, decisions, issues, validation results, review findings -->

### 2026-10-23, detailing (`/next-task 004`)
- Detailed from the outline row with Marko's notes: a per-widget error boundary in the #6 error state, so a formatter throw shows that widget's error with Retry and never breaks the page; focus per #87; Figma budget 0.
- Raised #88 (open): the error message text, and the date box day under 10 and month length. This task waits for it.
- Quick color probes on the PNGs (Node built-ins, session scratchpad), to set the scope:
  - Inactive tabs are Secondary `#525256` on 104 and 107, but Gray/03 `#9F9F9F` on 111 and 112. So the Settings tabs are a different look on one screen and stay in task 028.
  - Tile background: `#F3F3F3` (Gray/06) on 104 and 110, `#D1D1D1` on the 109 header, which is `#E8E8E8` (Gray/05).
  - Date box: `#F3F3F3`, 44x64 on 104 and 72x80 on 108. Amount box border: `#E8E8E8` on both.
  - Section title (104): darkest pixel `#878787` (Gray/02).
- INDEX: task 028 now also depends on 004, because Settings reuses `Card` (and `DataState`).
- No Figma calls.

### 2026-10-23, #88 closed
- Marko answered #88: (a) "Something went wrong." above Retry, the same on every widget, as proposed; (b) the date box day has two digits, like the short formats in #42 and #84 (`05` under `Sep`), not the proposed `5`. The month is always 3 letters. Scope, AC2, AC14, T2, T13 and the gallery now use these values.
- The task is ready to start. Not started, as Marko asked.

## Metrics
- Started:
- Finished:
- Human interventions: 0
- Rework loops: 0
- Notes on prompts that failed:
