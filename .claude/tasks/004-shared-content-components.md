# Task 004: Shared components: section cards, tabs, data states, category icons, date and amount boxes

- Status: done
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
    - Error: the message "Something went wrong." and a "Retry" `ButtonSmall` below it in the widget, the same for every widget (#88), `role="alert"` on the message. Retry calls `refetch` and shows the skeleton until it settles. Only when there is no data to show (the first load failed): when the widget already shows data and a background refetch fails, it keeps showing that data, with no error state and no indicator (#89).
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
14. Given a failed query with no data to show (the first load failed), then `DataState` shows "Something went wrong." and a Retry button below it (#88) in the widget. When I click Retry, `refetch` is called once and the skeleton shows until it settles. Given a widget that already shows data, when a background refetch fails, then it keeps showing that data, with no error state and no indicator (#89).
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
| T13b | unit | `DataState` with data, then the query fails with that data (a fake, and a real `useQuery` whose refetch fails); the gallery demo "Background refetch fails" | The data stays; no alert, no Retry, no skeleton | 14 |
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

### 2026-10-23, before building (`/next-task 004`)
- All cited decisions are closed (#6, #11, #19, #36, #37, #55, #56, #65, #66, #84, #87, #88). No task was `awaiting-human`.
- **No Figma MCP calls in this task** (budget 0): PNGs in `docs/figma/` and the export `docs/figma/components/418-6433.png` only.

### 2026-10-23, build (TDD)
- **Method.** A PNG decoder with Node built-ins, plus a render-and-diff harness (Playwright Chromium, Inter Variable, device scale 2), both in the session scratchpad. Candidates are rendered at 2x and diffed against PNG crops: mean absolute difference per channel, 0 to 255, lower is better. CSS px are 2x px halved.
- **Text styles** (best first, next in brackets):
  - Section title (104 "Total Balance"): glyphs x 305–442, y 112–128, Gray/02. Regular 22/32: 400 5.65 (500 18.1, 300 26.7). Title line box y 104–136, card top 144, so the gap is 8.
  - "View All": Regular 12/16 Gray/02, 400 7.6 (14px 26+). Chevron: `ChevronRight` at 16px (glyph 6x10). Gap from the text to the chevron box: 8; a render with 8 puts the text within 1 px at 2x.
  - Note "*Compare to last month": Regular 12/16 Gray/03, 12/400 12.1 (14/400 18.4). Its text box is flush right and sits on the bottom of the title row.
  - Tabs, 16/24. Active "All": teal Bold, 700 8.97 (600 14.4). Inactive: Secondary `#525256` Semibold, 600 21.1 / 19.2 (700 24.5 / 20.7); 650 scores between them but is not a token.
  - Date box 104: month Regular 12/16 Gray/01 (400 summed 16.6, 600 18.0, 500 19.5); day Exbold 22/32 Default Black (800 23.2 / 19.6, 700 28.7 / 24.5).
  - Date box 108: month Semibold 16/24 Gray/02 (550 5.2 / 4.8, 600 5.6 / 5.1, 500 5.9 / 5.8); day Exbold 22/32 Secondary (800 17.8 / 15.1).
  - Amount box 104 "$150": 16/24 Extra Bold, Secondary (800 14.7 / 9.6, 700 18.1 / 9.9).
  - Amount box 108: Exbold 18/24 Default Black (800 24.5 / 13.3, 700 35.1 for $559).
  - `Button small` "Details" (export): Regular 16/24 white, 400 8.65 (500 11.5); 84x32, radius 4, text 17.5 / 17 from the edges.
- **Geometry and colors.**
  - Tab underline: 2px teal, x 328–365 (8 past the label on each side), y 502–504. The label line box starts at the card content top (472), so a tab is 32 high.
  - Tab gap: renders with 16, 20 and 24 scored 9.7, 5.7 and 13.0, so 20 (with the bold-width copy; 7.9 without it). 107 has the same geometry, shifted.
  - Tiles:
    - 104 Recent Transaction: 40x40, Gray/06, icon Gray/01.
    - 104 Expenses Breakdown: 40x56, Gray/06, icon Gray/02.
    - 109 card header: 40x46, `#D1D1D1` (Special/BG within 1), icon Secondary.
    - 110 Goals: 40x48, `#F4F4F4` (Gray/06 within 1), icon Secondary.
    - Every tile has a 24px icon, centered. Corner radius 16 (104) or about 18 (109, 110) at 2x, so 8.
  - 107 rows: a plain 24px icon in Secondary at x 340. Secondary scored 0.09 to 1.16; Gray/01 2.6 to 4.1; Default Black 7.8 to 9.6.
  - Date box: 104 is 44x66 (the task 000 token is 64); 108 is 72x82. Amount box: 104 is 68x40, 108 is 108x48, both with a 1px Gray/05 border. The 108 radii equal the 104 ones.
- **Category icon mapping.** Every exported icon was rendered at 24px in the measured colors on the measured tile and diffed per tile. Best icon, then the next best:
  - 104 Recent Transaction:
    - Polo Shirt: `Shopping` 0.16 (MenuReport 18.0)
    - Biriyani: `Food` 0.29 (Shopping 18.3)
    - Taxi Fare: `Transport` 0.08 (Clock 25.0)
    - Keyboard: `Shopping` 0.16
    - GTR 5: `Gamepad2` 0.55. #56 makes it Entertainment, so it shows `Movie`, a known difference.
  - 104 Expenses Breakdown:
    - Housing: `Housing` 0.28 (MenuPayment 10.0)
    - Food: `Food` 0.14 (Shopping 9.1)
    - Transportation: `Transport` 0.04 (Clock 12.5)
    - Entertainment: `Movie` 0.14 (ChevronRight 11.6)
    - Shopping: `Shopping` 0.08 (MenuReport 9.0)
    - Others: `Others` 0.00 (Wallet 10.1)
  - 109 headers: Housing 0.40, Food 0.21, Transport 0.06, Movie 0.21, Shopping 0.12, Others 0.00. Next best 13.4 to 18.6.
  - 110 Goals: Housing 0.49, Food 0.25, Transport 0.08, Movie 0.25, Shopping 0.15, Others 0.00. Next best 16.2 to 22.5.
  - 107 rows: Gamepad2 0.58 (GTR 5), Shopping 0.17, Food 1.16, Movie 0.60, Transport 0.09.
  - Income uses `Wallet` (#56). No PNG shows an income icon, so this one is not checked against a design.
- **Tokens added** to `tokens.md` and `tokens.css`, each with its source:
  - spacing: `--space-view-all-gap` 8, `--space-tab-padding-x` 8, `--space-tab-gap` 20, `--space-date-box-gap` 4, `--space-amount-box-padding-x` 12, `--space-amount-box-padding-x-lg` 16, `--space-button-small-padding-x` 16;
  - size: `--size-amount-box-width` 68, `--size-amount-box-width-lg` 108, `--size-amount-box-height-lg` 48, `--size-date-box-width-lg` 72, `--size-date-box-height-lg` 80, `--size-category-tile` 40, `--size-category-tile-tall` 56, `--size-category-tile-medium` 48, `--size-tab-height` 32, `--size-button-small-width` 84, `--size-button-small-height` 32;
  - radius: `--radius-category-tile` 8.
- **Rounding choices**, each noted at its token:
  - 109 tile 46 → 48, so it shares 110's size (46 is a tie);
  - 108 date box 82 → 80, down like the 104 height;
  - date box gap: 4.8 on 108 and 2.4 on 104, so 4;
  - compact amount inset: 14 measured, rounded down to 12, within what the 68 box leaves;
  - large amount inset 16: chosen, because 108 centers the text in a fixed box.
- **Components** in `frontend/src/components/`, exported from `index.ts`:
  - `Section`: `title`, `gap` (`sm` 8, `lg` 16, required) and either `viewAllTo` or `note`, enforced by the types. The `<section>` is labelled by its `<h2>`, and "View All" is described by it. The chevron box is flush with the row's right edge.
  - `Card`: `padding` (`default` or `none`) and `className` for layout.
  - `MenuTab`:
    - Props: generic values, `label`, `tabs`, `value`, `onChange`, `panelId`. Every tab has `aria-controls` set to `panelId`.
    - `menuTabId(panelId, value)` gives the tab id the widget's tabpanel is labelled by. Import it from `components/MenuTab/MenuTab`: the index holds components only.
    - Roving tab stop. Left and Right wrap; Home and End; moving activates the tab. Clicking the selected tab calls nothing.
    - An `aria-hidden`, invisible bold copy of each label keeps every tab as wide as its bold label, so the tabs do not shift when the selection moves.
  - `CategoryIcon`: `category` (`null` is income) and `variant` by context (`recent`, `breakdown`, `header`, `goal`, `plain`). It has `role="img"` and the label, or is `aria-hidden` when `decorative`.
  - `DateBox` and `AmountBox`: `size` is `compact` or `large`. `AmountBox` takes `Money`. The Figma width is the minimum.
  - `ButtonSmall`, `Skeleton` (`shape`: `text`, `block` or `circle`, plus `className`).
  - `DataState` and `WidgetErrorBoundary`:
    - `DataStateQuery<TData>` is the part of a TanStack result it reads. A `success` query has its data, and `UseQueryResult` fits the type.
    - The skeleton shows while pending, when an error is fetching again, and while a Retry is in progress. TanStack resolves `refetch` before it re-renders the widget (its notify scheduler is `setTimeout(0)`). So a Retry ends when the query on screen shows the refetched result, or at the first newer query after the refetch settled. Otherwise the old error would flash.
    - The empty rule and `children(data)` render inside the boundary.
    - The boundary is unmounted during a Retry, so it remounts fresh, and it also resets when the data changes. React logs the caught error (one `console.error`).
- **Shared:** `expenseCategorySchema` (`z.enum`, designed order), `ExpenseCategory`, `categoryLabel`, `formatDateBox` (date-fns `MMM` and `dd`; plain dates only, anything else throws a `RangeError`).
- **Undesigned states** (`frontend-design`, tokens only, no new colors, fonts or spacing):
  - skeleton: Gray/05 blocks, radius 4 (text, block) or 50% (circle), a slow opacity pulse (1.6s, down to 50%) that stops under reduced motion. No shimmer gradient: it would need colors that are not tokens;
  - empty message: Regular 14/20 Gray/01, centered. Gray/02 would only reach 3.6:1 contrast on white, Gray/01 reaches 5.7:1;
  - error: "Something went wrong." in Regular 14/20 Secondary, with Retry (`ButtonSmall`) 16 below, centered. The message fills a parent with a fixed height, or grows in a flex column;
  - focus: the #87 ring on the tabs, "View All" and `ButtonSmall`.
- **Gallery:**
  - The local `Section` helper is renamed `GallerySection`, because the component now has that name.
  - The Section and DataState blocks are wide, with 104 widths: 352 per card, 728 for the Expenses Breakdown note and for the widget pair.
  - The DataState examples use `useQuery` with local query functions (`retry` and window-focus refetch off), never the network. Error fails again after 0.8 s on every Retry. The boundary demo puts 12.5 cents into the first widget's query with "Render a bad amount".
  - The long amounts sit in a slot as narrow as the smallest box, so a box that did not widen would show.
- **Red before green.**
  - shared: 32 new tests failed on the missing exports.
  - frontend: 40 new tests failed, and the MenuTab file failed to import. The name guard failed on the 8 code-only components until their rows were added.
- **Mutation checks.**
  - Ending a Retry as soon as `refetch` resolves: at first no test failed. The resolve ran outside `act`, so React had not re-rendered when the test asserted. With `act`, the test fails on the mutation and passes on the real code.
  - A MutationObserver "no flash" check on the real TanStack test could not fail in jsdom (React's scheduler runs there after TanStack's timeout), so it was removed. The fake-query test covers the flash.
  - E2E style tests were written after the CSS, so they were mutation-checked. 7 CSS mutations at once (bold copy, 109 tile color, reduced motion, title gap, "View All" ring, amount `nowrap`, date box gap): 6 of the 7 targeted tests failed.
  - The `nowrap` mutation did not fail. An amount has no line-break opportunity, so it cannot wrap anyway. A `min-width` → `width` mutation (text past the border) did fail the test.

### 2026-10-23, validation
1. **Lint and typecheck.**
   - The first `npm run lint` failed (rework loop 1) on 13 errors across 4 rules:
     - `react/no-did-update-set-state` in the boundary, so it now resets through `getDerivedStateFromProps`;
     - `consistent-function-scoping` ×3 and `require-mock-type-parameters` ×8 in the DataState test;
     - `no-unsafe-type-assertion` on `data as TData`, so `DataStateQuery` became a union in which `success` has its data.
   - Then typecheck failed (rework loop 2): the union needed an explicit `status !== 'success'` early return, and tuple arrays needed `as const`.
   - Final: `npm run lint` exit 0 (oxlint, Stylelint, Prettier); `npm run typecheck` exit 0 in all 4 workspaces.
2. **Unit tests.** `npm test`: shared 220/220 (187 before), backend 43/43, frontend 328/328 (275 before). No act warnings and no stderr.
3. **E2E.**
   - The first run had 27/28 passing (rework loop 3). The tab-width check compared viewport boxes, and the click scrolled the page: x and width were equal, y moved from 14438 to 496. The test now measures the tabs relative to the tablist. Then 28/28.
   - One later run aborted because my own dev server still held port 5173. That was not a code failure, and the leftover Vite process was ended.
   - Final `npm run e2e`: 28/28, with 9 new tests in `content-components.spec.ts`. The gallery spec lists the 9 new sections (T19, no console errors or warnings).
4. **Visual.**
   - Renders: Playwright MCP, a new context at 1440x1024 and device scale 2, scrollbars hidden. Evidence in `.claude/tasks/evidence/004/`:
     - `render-*.png`: the gallery examples at 2x;
     - `compare-*.png`: design | render | difference ×4;
     - `focus-*.png`, `render-boundary-*.png`, `render-datastate-*.png`, `render-skeleton-reduced-motion.png`;
     - `gallery-task-004-sections-1x.png`: an overview of the new sections at 1x.
   - Mean diff per channel, render against the PNG crop at 2x:
     - section title row and card top: 2.83;
     - Recent Transaction "View All": 5.95 at zero shift;
     - 104 tabs: 4.35 at zero shift; 107 tabs: 12.74, because 107 has them on the page background and the gallery on white;
     - tiles: 104 0.01 to 0.18; 109 1.10 to 1.35; 110 0.87 to 1.18;
     - 107 icons: 0.16 to 2.07;
     - date boxes: 104 11.4 and 9.5, 108 6.6 and 5.3;
     - `ButtonSmall` inside: 4.39;
     - GTR 5 tile 14.8 and row icon 50.1: expected (#56).
   - Ink positions match within 0.5 px:
     - "Total Balance" (x 1–138.5, y 8–24.5);
     - Recent Transaction "View All";
     - the tab labels (x 8–28, 66–132.5, 170–245) and the underline (x 0–37, y 30–32), in both 104 and 107;
     - the date box days (y 34–50.5 in 104, 46–62.5 in 108).
   - **Differences:**
     1. 104 Upcoming Bill "View All" is 12.5 px further left in Figma: its chevron box ends 12 px inside the card edge. Recent Transaction's ends at the edge. Both are built flush, which matches Recent Transaction.
     2. Date box month: 2 px higher in 104 (the box is 64 against 66, task 000) and 1.5 px lower in 108 (80 against 82). The day is in place in both.
     3. Amounts show `$150.00` instead of `$150` (#11). The compact box is therefore 92 wide instead of 68; the large one stays 108 (text 73 + 32).
     4. GTR 5 shows `Movie` (Entertainment, #56) instead of gamepad-2.
     5. Inactive tab labels: the ink is up to 1.5 px narrower ("Expenses" ends at 243.5 against 245), and labels sit 0.5 px lower. Figma's inactive weight is between Semibold and Bold.
     6. "Expenses Breakdown" title: 1.5 px wider ink (Inter Variable). The note sits 0.5 to 1 px right of Figma.
     7. 109 tile `#D2D2D2` against `#D1D1D1`, and 48 against 46 high. 110 tile `#F3F3F3` against `#F4F4F4`.
     8. Page background Gray/06 against `#F4F5F7` (known since task 000).
5. **Manual checks** (Playwright MCP, gallery at 2x):
   - Interactive tabs: clicks give income, expense and all; the arrows give income, expense, all (wrap), expense; End stays; Home gives all; Left wraps to expense. Focus follows the selection, and the panel follows.
   - Tab order through the new sections: "View All", then one tab stop per tab set (×4), "Details", Retry, "Render a bad amount", the second widget's tab. Each has a 2px teal solid ring with a 2px offset. A mouse click shows none (E2E T16).
   - Error example: Retry shows the skeleton (busy, no alert), then the error again after 0.8 s. The card grows with the skeleton (116 to 228 px), and the message stays centered.
   - Boundary demo: "Render a bad amount" shows "Something went wrong." with Retry in the first widget only. The second widget's tabs still work (Expenses selected, panel updated). Retry shows `$150.00`. The only console message is the expected `RangeError: Money must be integer cents, got 12.5`.
   - Skeleton: `animation-name` is the pulse by default and `none` with reduced motion, and the pulse returns when reduced motion is turned off.
   - No console errors or warnings on load.
- **Build.** `npm run build` exit 0. `frontend/dist` contains no "Component gallery" and no "Render a bad amount".
- No `security-review` (not on the Skills line).

### 2026-10-23, code review (`superpowers:requesting-code-review`)
- No critical findings; 2 important and 6 minor. Verdict: "With fixes".
- The reviewer traced the DataState retry against the installed TanStack source and found no stuck skeleton and no flash. It also confirmed that no render error escapes the boundary.
- Fixed:
  1. Important: the task Log had no build entry yet, although code comments and the human checkpoint cite it. Written above.
  2. Important: when a background refetch fails while data is on screen, the widget shows the error state in place of that data. #6 and #88 do not cover this, so it is **open question #89** in `docs/decisions.md`, with a proposal: keep the data and show the error only when there is nothing to show. Until it is answered, the current behavior (the error state for every failed query, as AC14 reads) is pinned by a test that cites #89.
  3. Minor: two Retry-fails tests and the end of T14 would have passed if Retry did nothing. They now assert one `refetch` call and the skeleton in between, and T14 asserts one more logged `RangeError` after the second Retry. Mutation check: a Retry that skips `refetch` fails 6 tests.
  4. Minor: the boundary's reset on new data was never exercised. A new test breaks the widget and then sets valid data without Retry. Mutation check: without the reset, that test fails.
  5. Minor: MenuTab swallowed modified keys (Alt+Left is the browser's Back). They are now left to the browser. A value that matches no tab keeps the first tab as the tab stop instead of throwing on Left. Both were test-first: 5 new tests failed, then passed.
  6. Minor cleanups:
     - the gallery test reads `aria-busy` with `querySelector`;
     - the reason given for `--space-amount-box-padding-x` no longer mentions `$150`, since #11 always shows `$150.00`;
     - the MenuTab Code-only row now says where to import `menuTabId` from.
- Kept, with reasons:
  - Several identical "Retry" buttons when many widgets fail: each widget is a region named by its `Section` title, so the context is there. Labelled Retry buttons are not in the ACs; noted for the screen tasks.
  - Offline (`pending` + `paused`) shows the skeleton until the network returns. This is intended (#6 loading), and the network mode is `QueryClient` config for task 008.
  - The `fetchStatus !== 'fetching'` clause in the retry rule: kept as a safety net.
- The reviewer's "Declined to judge" list:
  - the raw `1.6s` and `0.5` in the skeleton animation: durations and opacity are not token properties, and Spinner sets the precedent;
  - a custom MenuTab instead of Radix Tabs;
  - the pixel accuracy of measured tokens (for this gate);
  - several `role="alert"` messages at once (AC14 requires it);
  - disabled queries showing a skeleton (query hooks are out of scope);
  - reusing tokens named for other roles (#6 allows it);
  - `process.env.TZ` restoring as the string "undefined" (copied from the task 001 test pattern);
  - how the date box reads to a screen reader.

  All are outside this task or already decided, so none is acted on.
- **Re-validation after the fixes:**
  - `npm run lint` exit 0;
  - `npm run typecheck` exit 0;
  - `npm test`: shared 220/220, backend 43/43, frontend 328/328;
  - `npm run e2e` 28/28;
  - `npm run build` exit 0, no gallery code in `dist`.

### 2026-10-23 18:54, rejected by Marko (`/approve-task 004 reject`)
Human interventions +1, Rework loops +1. Feedback, verbatim:

> 004 reject #89: keep the data. Record #89 as closed (Marko, 2026-10-23): when a widget already shows data and a background refetch fails, keep showing that data, with no error state and no indicator; the error state with Retry shows only when there is no data to show (first load failed). Update DataState, AC14, the pinning test and the gallery demo to match. Components are otherwise approved as built. Re-run all validation, then stop at the gate again.

Done, only what the feedback asks:
1. **#89 closed** in `docs/decisions.md` with Marko's answer, Marko, 2026-10-23. INDEX: open questions none.
   - The per-widget error boundary is unchanged: a render error still shows the error state, which the rest of task 004 approved as built.
2. **`DataState`.**
   - The error state shows only when the query has no data (`data === undefined`: the first load failed).
   - A query that reports an error but still has data keeps rendering that data, with no error state and no indicator. This also holds while it fetches again: the skeleton shows only while there is no data.
   - A failed refetch while the empty message shows keeps the empty message.
   - The doc comment and the Code-only row in `components.md` cite #89.
3. **AC14**, its Scope bullet and a new T13b row describe the #89 rule.
4. **Tests.**
   - The pinning test is flipped: data stays after a failed refetch, both idle and fetching again.
   - New tests: the empty message stays; a real `useQuery` whose refetch fails (no retries) reports `error` while `$150.00` stays, with no alert and no skeleton.
   - The 4 new and flipped tests failed first, for the right reason (the data was replaced), then passed.
   - Mutation check: restoring the old rule (the error state for any failed query) fails 5 tests, including the gallery test.
5. **Gallery demo.**
   - New DataState example "Background refetch fails: the data stays". "Refetch and fail" makes the next fetch fail; the caption shows the query status (gallery only). Status turns `error`, `$150.00` stays, and there is no alert and no skeleton. A gallery unit test covers it.
   - Evidence: `render-refetch-fails-before.png` and `render-refetch-fails-after.png`.
   - While checking it I found that the demo card's flex column stretched the amount box to the full card width, in this demo and in the boundary demo's first widget. That has been so since the card got its min-height before the gate (visible in the gate's `render-boundary-recovered.png`). Both demos now give the amount its own block, so the box keeps its width (92 px). The `render-boundary-*.png` evidence was retaken. Gallery only; no component changed.

Validation, re-run in full after the fixes:
- `npm run lint` exit 0; `npm run typecheck` exit 0.
- `npm test`: shared 220/220, backend 43/43, frontend 332/332.
- `npm run e2e` 28/28.
- `npm run build` exit 0, no gallery code in `dist`.
- Browser (Playwright MCP at 2x):
  - no console errors or warnings on load;
  - the new demo behaves as above;
  - first-load Error: Retry shows the skeleton, then the error again;
  - boundary demo: break, then Retry recovers; the only console message is the expected `RangeError`.

Status `awaiting-human` again.

### 2026-10-23 19:06, approved by human
- Approved by human (Marko, `/approve-task 004 approve`). Human interventions +1. Status `done`.
- Acceptance criteria 19 of 19 (AC14 as updated by #89).

## Metrics
- Started: 2026-10-23 17:52
- Finished: 2026-10-23 19:06
- Human interventions: 2
- Rework loops: 4
- Notes on prompts that failed: none. Rework: 2 loops on lint and typecheck (oxlint rules, then type narrowing), 1 on E2E (a test compared viewport positions across a scroll), 1 from the human gate (#89: keep the data on a failed background refetch). No Figma calls.
