# Task 005: Shared components: Popup, amount input, Dropdown

- Status: todo
- Gate: human
- Depends on: 001, 002, 003, 004
- Size: L
- Skills: `superpowers:test-driven-development`, `superpowers:verification-before-completion`, `superpowers:requesting-code-review`, `security-review` (money: the amount field turns typed text into cents), `frontend-design:frontend-design` (undesigned states only: the open Dropdown list, focus styles, the amount field's focus and error look, the popup's saving and server error states)

## Goal
The popup of 104.1, 110.1 and 110.2, its amount fields and the shared Dropdown exist as tested, presentational components on Radix. The popup blocks the whole page and traps focus (#35). The amount field types and reads amounts by the #64 and #84 rules. One Dropdown draws every open list (#60) and has the closed looks of 106 (edit mode), 110 and 111. A dev page shows the popup over the real app shell, and the gallery shows every field and Dropdown state. Screen tasks use them and never rebuild them.

## References
- Spec: `docs/spec/brief.md` Layout (Popups), Navigation (popups paragraph), Global rules (amount inputs, #64 and #84 lines), Not designed (Dropdowns, Goals, Interaction states); `docs/spec/stories.md` US-06 criteria 5 to 7 and 12 to 14, US-17 criteria 1 to 4 and 8 to 10 (popup, fields), US-12 criterion 5, US-16 criteria 2 to 5 and US-18 criteria 2 and 11 (Dropdown)
- Figma (budget 0, no MCP calls: PNGs and `docs/figma/components/` only):
  - 104.1. Overview `416:7385`: overlay `Rectangle 72` `416:7862`, `Popup Input` instance `416:7863`. PNG `docs/figma/104.1. Overview.png`
  - Flattened (#37): 110.1. Goals `416:6052` (two fields), 110.2. Goals `416:6413` (one field), 110. Goals `66:5829` (the two period selectors), 111. Settings `66:6324` (country code), 106. Account Details `416:7878` (view mode only; edit mode is not designed). PNGs with the same names in `docs/figma/`
  - Component export `docs/figma/components/418-6433.png` (frame `418:6433`, 2x): `Popup Input` `416:6381` (488x392, the two-field popup) and `Popup Input (small)` `416:6338` (360x88, label and field), `Input` `402:5191` (the closed look of the Account Type select, #26)
  - Icons: `x` 32x32 `63:1960` (`X32`), `Arrow down 2` `413:8604` (`ArrowDown2`), `Down arrow` `2:44` (`DownArrow24`), all already in `frontend/src/assets/icons/`
- Names: `docs/figma/components.md` (`GoalPopupInput`, `PopupInputSmall`, `X32`, `ArrowDown2`, `DownArrow24`; Code-only table for the rest)
- Decisions: `docs/decisions.md` #6, #11, #26, #30, #31, #33, #35, #36, #37, #43, #60, #63, #64, #65, #69, #71, #79, #84, #86, #87, #90

## Scope
- Components in `frontend/src/components/<CodeName>/`, CSS Modules with tokens only. Every value is measured on the PNGs at 2x and halved (#65); new tokens go to `tokens.md` and `tokens.css` with their source. Radix Dialog and Select come from `radix-ui` 1.8.1, already a dependency (#79): no new dependency.
  - `Popup` (code-only): the modal shell on Radix Dialog, used by every popup (#35).
    - Panel: white, `--size-popup-width` (488), `--radius-popup` (16), `--shadow-popup` (none). Position (#90 c): the top edge at y 276, as in all three PNGs, and centered horizontally on the content area (right of the 280px sidebar, the area the dim covers): x 616–1104 at 1440 wide (the PNGs draw it at x 604). Its height follows the content: 392 with two fields (104.1, 110.1), 280 with one (110.2).
    - Close button: `X32` in Secondary, a 32px button about 24 from the top and right edges, named "Close".
    - Content padding: 64 top and sides (`--space-popup-padding-x`), 48 bottom (`--space-popup-padding-bottom`).
    - Overlay: `--color-default-black-15` over the content area only, as in 104.1: right of the sidebar (x 280) and below the header (y 88, the header's bottom border is not dimmed). When the page is scrolled so that the header is off screen, it covers everything right of the sidebar.
    - The whole page is blocked (#35): a click on the sidebar, the header or the content behind does nothing, and the popup stays open. The page does not scroll, Tab and Shift+Tab stay in the popup, and everything outside is hidden from assistive technology.
    - Closes with X, Esc or a click on the dimmed area, and only then (#35). Focus returns to the element that opened it.
    - The content unmounts on close, so unsaved changes are discarded.
    - The page behind does not shift when the popup opens or closes.
    - It is a `dialog` named by a `title` prop. The title is visually hidden, because no popup title is designed. On open, focus goes to the first focusable element of the content (the first field). The X comes after the content in the tab order.
  - `PopupInputSmall` (Figma `Popup Input (small)` `416:6338`, 360x88): the labelled amount field of the popups.
    - Label: Secondary 16/24 (weight measured), 8 above the field (`--space-form-label-gap`).
    - Field: 360x56 (`--size-popup-input-height`), a 1px `--color-special-bg` border, `--radius-input`, about 24 inset, text Regular 16/24 in Gray/02. In 104.1 the prefilled value and the placeholder are both `#878787`.
    - The `$` sits directly before the number, with no space and no thousands separators (#64). The `$` is shown, never typed or stored in the value. Clicking it focuses the field.
    - Typing (#64, #84): a change stands only if `isAllowedAmountInput` (task 001) accepts the new text; otherwise the value and the caret stay as they were. This also applies to a paste, which is accepted or rejected as a whole. A lone `.` stands.
    - The value is the field text. The form prefills it with `formatAmountInput(cents)` (`500000`, `1250.50`) and reads it with `parseAmountInput(text)`: cents, or `null` for an empty field or a lone `.` (#84). The component works with react-hook-form (`register` or `Controller`).
    - An empty field with a `placeholder` shows only the placeholder, with no `$`, as drawn (Present Amounts, "Write present amount here", #71, #90 b). An empty field without one shows the `$` alone (Target, #69). The `$` appears once typing starts.
    - Focus: a darker border while the field has focus, like `Input` Active=Yes (#63). The token is chosen in the build from the existing ones.
    - Error: `error` shows `FieldError` under the field, linked with `aria-describedby`, with `aria-invalid` and the red border `--color-special-red`, also while focused (#6, #87).
  - `GoalPopupInput` (Figma `Popup Input` `416:6381`): the popup of 104.1, 110.1 and 110.2. It is a `Popup` holding a `<form>`.
    - The children are the `PopupInputSmall` fields, 24 apart (`--space-form-field-gap`).
    - "Save" (`ButtonPrimary`, `type="submit"`) is 192x48 and centered, 32 below the last field (`--space-form-section-gap`).
    - Props: `open`, `onOpenChange`, `title`, `onSubmit`, `saving` (Save disabled with its spinner, #6) and `formError` (`FormError` above Save, #6).
    - The popup measures 64 + 88 + 24 + 88 + 32 + 48 + 48 = 392 with two fields and 280 with one, as in the PNGs.
    - No validation rules and no saving: the forms and schemas are tasks 014, 025 and 027.
  - `Dropdown` (code-only): the one shared select on Radix Select (#60), reused by Account Type (#26), the Goals period selectors (#30, #60) and the country code (#33, #43).
    - Props: `options` (`{ value, label }[]` in display order), `value`, `onValueChange`, an accessible name (`aria-label` or `aria-labelledby`), optional `name` for forms, and `variant`.
    - Each variant is the closed look of one place, measured:
      - `box`: 110 Savings Goal. About 156x32 in Figma, fill `#F4F4F4` (Gray/06 within 1), a 1px Gray/05 border, text Regular 12/16 Gray/01, then `ArrowDown2` at 16px in Secondary (glyph about 9x5). The box hugs its label.
      - `plain`: 110 Saving Summary. The same text and chevron, with no box.
      - `inline`: 111 country code. The label only (`+880`), with no box and no chevron; it takes the font and color of the field it sits in (Gray/02, 16/24 in 111).
      - `input`: Account Type in 106 edit mode, "a select styled like an input" (#26), which is not designed. It has the closed look of `Input` (task 002), with `DownArrow24` in place of the eye icon and the `Input` focus border (#63).
    - The trigger shows the selected option's label.
    - Open list: Radix popper position, below the trigger with left edges aligned, at least as wide as the trigger, and flipping above when there is no room. The selected option is marked and scrolled into view. A long list (60 months, every country code) fits the space left in the window and scrolls inside.
    - Keyboard (Radix): Enter, Space and ArrowDown open the list; arrows, Home and End move; Enter selects; Esc closes; typing jumps to a matching label.
    - Choosing an option calls `onValueChange` once and returns focus to the trigger. Choosing the selected one calls nothing.
    - One open-list look for every variant (#60): `--radius-popup`, `--shadow-card` and a 1px `--color-gray-05` border (#90 a), with no new tokens. Option text, the highlighted option and the selected option use existing tokens only, with no new color, font or spacing (`frontend-design`).
    - The option lists themselves come from the screen tasks: the Account Type values (022), the months from the user's earliest data (025, 026), the country codes (028).
  - Focus (#87): X, Save and the `box`, `plain` and `inline` triggers get the teal `:focus-visible` ring. The amount field and the `input` trigger use the darker field border instead. A mouse click shows no ring.
- Tokens: the popup's measured values (close button inset, top padding if it differs from `--space-popup-padding-x`, field padding, Save width), the Dropdown trigger values (box padding, chevron gap, box radius) and the panel position, each with its PNG source.
- `docs/figma/components.md`: Code-only rows for `Popup` and `Dropdown`, each with its purpose and decisions. `GoalPopupInput` and `PopupInputSmall` already have Code name rows; their notes say 110.2 is `GoalPopupInput` with one field.
- Dev page `/dev/popup` (development only, like the gallery, and absent from the production build):
  - `AppLayout` with `NavBar`, `Header` and an Overview-like content of `Section` and `Card` blocks, so that the page scrolls.
  - Buttons "Open two-field popup" (104.1: Target prefilled with `formatAmountInput(50000000)`, Present empty with its placeholder) and "Open one-field popup" (110.2: Target prefilled).
  - Save closes the popup, and the page shows the cents that `parseAmountInput` read from each field (`empty` for `null`).
  - A "Save fails" switch shows `saving`, then a `formError` sample.
- Gallery sections:
  - `PopupInputSmall`: prefilled `500000` and `1250.50`, empty without a placeholder, empty with the placeholder, with an error, and one interactive field showing its parsed cents.
  - `Dropdown`: each variant with sample options (Account Type values; months as `formatMonthLabel` labels, newest first; the codes `+1`, `+44` and `+880`), plus a 60-month list.
  - A link to `/dev/popup`.

## Out of scope
- Goal forms, schemas, limits (Target greater than 0, maximum 1,000,000,000, Target required) and saving (tasks 014, 025, 027). Task 001 already put the goal limits in the goal contract schemas of task 014.
- The Goals card pencil and the "Adjust Goal" and "Adjust" buttons that open the popups (tasks 014, 025, 027).
- The option data: Account Type values and the edit mode of 106 (task 022), the month lists and the selectors' placement in their cards (tasks 025, 026), the country code list, its default `+1`, the phone divider and the Settings field (task 028).
- The Statistics "Weekly Comparison" and Expenses "Monthly Comparison" controls (#20, #29; tasks 017, 024).
- Popup titles and field labels for screen readers beyond the popup `title` prop: the screen tasks give the text.
- Hover styles that are not designed (X, triggers): none (general rule).

## Acceptance criteria
1. Given a `Popup` that opens, then a modal `dialog` named by its `title` shows (the title is visually hidden), and focus moves to the first field. The X button "Close" comes after the content in the tab order.
2. Given `GoalPopupInput` with two fields at 1440x1024, then the panel is white, 488x392, radius 16, with no shadow, its top edge at y 276 and centered horizontally on the content area right of the sidebar (x 616–1104 at 1440 wide, #90 c). The X (`X32`, Secondary) is about 24 from the top and right; the fields are 24 apart and Save is 192x48, centered, 32 below the last field, as in 104.1 and 110.1. With one field it is 488x280, as in 110.2.
3. Given a popup is open with the page at the top, then the area right of the sidebar and below the header is dimmed with Default Black at 15%, and the sidebar and header are not (104.1). Given the page was scrolled so the header is off screen, then everything right of the sidebar is dimmed. The page behind does not move when the popup opens or closes.
4. Given a popup is open, when I click a sidebar link, the header or the content behind, then nothing happens: the URL stays, nothing behind reacts, and the popup stays open. The wheel does not scroll the page. Tab and Shift+Tab cycle inside the popup. Everything outside it is hidden from assistive technology (#35).
5. Given a popup is open, when I click X, press Esc or click the dimmed area, then it closes, `onOpenChange(false)` is called once, and focus returns to the element that opened it. A click inside the panel does not close it. When I change a field, close and reopen, the field shows its initial value (#35).
6. Given `PopupInputSmall` prefilled with `formatAmountInput(50000000)` and with `formatAmountInput(125050)`, then it shows `$500000` and `$1250.50`: the `$` directly before the number, no space, no separators, in the measured label and field styles (#64).
7. Given an empty `PopupInputSmall` without a placeholder, then it shows the `$` alone (#69). Given one with the placeholder "Write present amount here", then it shows only the placeholder, with no `$`, as drawn; when I type `5`, it shows `$5` (#71, #90 b).
8. Given I type in `PopupInputSmall`, then digits and one decimal point with at most 2 decimals stand (`1250.5`, `.5`, `.`), and a comma, `$`, letter, space, minus, a second point or a third decimal is rejected: the value and the caret stay. A paste that is not allowed as a whole changes nothing (#64, #84).
9. Given the field text, then `parseAmountInput` reads `1250.5` as 125050, `.5` as 50, and `.` and the empty field as `null` (#84). The gallery and the dev page show these values.
10. Given `PopupInputSmall` with focus, then its border is darker (#63). Given an `error`, then its border is red, also while focused, and the message shows under the field, linked with `aria-describedby`, with `aria-invalid` (#6, #87). Its accessible name is the label.
11. Given `GoalPopupInput`, when I click Save or press Enter in a field, then `onSubmit` is called once. Given `saving`, then Save is disabled and shows the spinner. Given `formError`, then it shows above Save with `role="alert"` (#6).
12. Given `Dropdown` in each variant, then the trigger shows the selected label in the measured look: `box` and `plain` as in 110, `inline` as in 111 (no chevron, the field's font and color), `input` as the closed `Input` with `DownArrow24` (#26, #60).
13. Given a closed `Dropdown`, when I click it or press Enter, Space or ArrowDown, then a listbox opens below the trigger, at least as wide, with the selected option marked (`aria-selected`) and in view. The trigger is a combobox with `aria-expanded="true"`.
14. Given an open `Dropdown`, when I choose another option by click or by arrows and Enter, then `onValueChange` is called once with its value, the list closes, focus returns to the trigger, and the trigger shows the new label. Choosing the selected option calls nothing. Esc or a click outside closes the list with no change. Home, End and typeahead move the highlight.
15. Given a `Dropdown` with 60 options, when it opens, then the list fits inside the window and scrolls, and the page itself does not scroll.
16. Given an open `Dropdown` in any variant, then the list has one look: `--radius-popup`, `--shadow-card` and a 1px `--color-gray-05` border (#90 a), and option, highlighted and selected styles from existing tokens only (#60).
17. Given keyboard focus on X, Save or a `box`, `plain` or `inline` trigger, then the teal 2px ring with a 2px offset shows; the amount field and the `input` trigger show the darker border instead. A mouse click shows no ring (#87).
18. Given the component folder, then `Popup` and `Dropdown` are in the Code-only table, `GoalPopupInput` and `PopupInputSmall` match their Code name rows, and all CSS uses tokens only.
19. Given `npm run dev`, then the gallery shows every section listed in Scope, and `/dev/popup` opens both popups, with no console errors or warnings. Given a production build, then neither page is in it.

## Test scenarios
| ID | Type | Scenario | Expected | Covers AC |
|----|------|----------|----------|-----------|
| T1 | unit | Open a `Popup` with two fields from a button | `dialog` with `aria-modal`, named by the title; the first field has focus; Tab order field, field, X | 1 |
| T2 | e2e | `/dev/popup`, open both popups at 1440x1024, then at 1600x1024 | Panel box, background, radius, no shadow; X box and color; field and Save boxes; heights 392 and 280; top edge y 276; left edge x 616 at 1440 (content area 280–1440), x 696 at 1600 (content area 280–1600) (#90 c) | 2 |
| T3 | e2e | Open at scroll 0; scroll down past the header, open; record a card's box before and after opening | Overlay box x 280–1440, y 88–1024, color Default Black 15%; sidebar and header pixels unchanged. Scrolled: overlay from y 0. The card does not move | 3 |
| T4 | e2e | With the popup open: click the "Balances" nav link, the header search and a card behind; wheel; Tab ×6 and Shift+Tab ×6 | URL unchanged, popup open, scroll position unchanged; focus stays inside; the nav and main are `aria-hidden` or inert | 4 |
| T5 | unit | Close by X, by Esc and by a click on the overlay; a click on the panel; type, close, reopen | `onOpenChange(false)` once each; focus back on the opener; no close for the panel click; the initial value is back | 5 |
| T6 | unit | `PopupInputSmall` prefilled `500000`, `1250.50`; empty without and with the placeholder | `$` then `500000`, `$` then `1250.50`; the `$` alone; the placeholder alone with no `$`, and `$5` after typing `5` (#90 b) | 6, 7 |
| T7 | e2e | Gallery fields: label, field, `$`, value and placeholder styles | Sizes, border, radius, inset, colors and type equal the measured tokens | 6, 7 |
| T8 | unit | Type `1250.5`, `.5`, `.`; then `,`, `$`, `a`, ` `, `-`, a second `.`, a third decimal; paste `1,000` and `12.345` into `12` | Allowed text stands; each rejected key and paste leaves the value (and the caret) unchanged | 8 |
| T9 | unit | `parseAmountInput` on the field text in the interactive gallery field | `1250.5` → 125050, `.5` → 50, `.` → empty, `` → empty | 9 |
| T10 | unit | `PopupInputSmall` with an `error`; focused; react-hook-form `register` and `Controller` | `aria-invalid`, `aria-describedby` to the message, named by the label; the form receives the typed text | 10 |
| T11 | e2e | Gallery: focus a field; field with error, focused | Darker border on focus; red border with and without focus | 10 |
| T12 | unit | `GoalPopupInput`: click Save; Enter in a field; `saving`; `formError` | `onSubmit` once each; Save disabled with the spinner and `aria-busy`; the error above Save with `role="alert"` | 11 |
| T13 | e2e | Gallery Dropdown variants | Trigger boxes, fill, border, text and chevron styles equal the measured tokens; `inline` has no chevron and takes its parent's font and color | 12 |
| T14 | unit | Open a `Dropdown` by click, Enter, Space and ArrowDown; choose by click and by ArrowDown + Enter; choose the selected option; Esc; Home, End, typeahead "S" | Listbox opens with the selected option `aria-selected`; `onValueChange` once with the value; nothing for the same option and for Esc; focus back on the trigger | 13, 14 |
| T15 | e2e | Open each variant in the gallery; open the 60-month list near the bottom of the window | The list sits below the trigger (above when no room), at least as wide; the 60-month list stays inside the window and scrolls; the page scroll position is unchanged | 13, 15 |
| T16 | e2e | Open list styles in each variant | Same radius, `--shadow-card`, 1px Gray/05 border, option, highlighted and selected styles in every variant, all from tokens | 16 |
| T17 | e2e | Tab to X, Save and each trigger; then click each | Ring `--color-primary`, 2px, offset 2px on X, Save, `box`, `plain`, `inline`; darker border on the field and the `input` trigger; no ring after a click | 17 |
| T18 | unit | Component name guard from task 002; Stylelint test | Pass with the new components and the Code-only rows | 18 |
| T19 | e2e | `/dev/components` with the new section names; `/dev/popup` | Every section visible; both popups open and close; no console errors or warnings | 19 |
| T20 | unit | Gallery build test from task 002 with the `/dev/popup` markers | Not in the production build; found in a development build | 19 |

## Validation steps (in this order, stop on first failure)
1. Lint + typecheck pass.
2. Unit tests pass.
3. E2E tests pass.
4. Visual: Playwright MCP screenshots at 1440x1024 and device scale 2, compared element by element with crops of the PNGs. Positions are CSS px after halving and approximate; measure them exactly:
   - `104.1. Overview.png`, from `/dev/popup` with the two-field popup open. The x positions below are the PNG's; the render's panel sits at x 616–1104 (#90 c), so compare everything inside it relative to the panel's edges:
     - panel x 604–1092, y 276–668;
     - X glyph about x 1042–1061, y 306–325;
     - "Target Amounts" label glyphs x 668–790, y 346–361, field y 372–428;
     - "Present Amounts" label y 458–470, field y 484–540;
     - Save x 752–944, y 572–620;
     - overlay from x 280 and y 88, color `#DDDDDD` over white;
     - prefilled text glyphs from x 693, Gray/02.
   - `110.1. Goals.png`: the same panel. `110.2. Goals.png`: panel y 276–556, Save y 460–508.
   - `110. Goals.png`: Savings Goal box x 492–648, y 172–204 (text glyphs from x 509, chevron glyph x 620–628); Saving Summary text glyphs from x 886, chevron glyph x 952–960.
   - `111. Settings.png`: "+880" glyphs from x 362, y about 582–594 (the divider after it spans y 579–598).
   - Export `418-6433.png`: `Popup Input` and `Popup Input (small)`.
   Save the screenshots and the comparison images to `.claude/tasks/evidence/005/` and list every difference. Expected differences: the period label `Mar, 2026` instead of "01 May ~ 31 May" and "Mar 2022" (#60, so the box is narrower), the placeholder text "Write present amount here" instead of "Write presents amounts here" (#18), the dev page content behind the overlay, and the panel 12 px further right than in the PNGs (centered on the content area, #90 c).
5. Manual browser checks with Playwright MCP:
   - On `/dev/popup`: open each popup; tab around; try the sidebar, header and wheel while it is open; close with X, Esc and the overlay; type allowed and rejected text; Save; try "Save fails".
   - In the gallery: open each Dropdown by mouse and keyboard, scroll the 60-month list, and use Esc and a click outside.

## Human checkpoint (only if Gate: human)
- The popup over the app shell matches 104.1, 110.1 and 110.2: panel, X, fields, Save, the overlay on the content area only, and the position from #90 (c): top edge at y 276, centered on the content area right of the sidebar.
- The whole page is blocked while a popup is open: sidebar and header clicks do nothing and do not close it (the reading of #35 used here). Focus stays inside; X, Esc and the overlay close it; reopening discards changes.
- Amount field typing: allowed and rejected keys and pastes, the lone `.`, the `$` with and without the placeholder (#90 b), and the parsed cents.
- Each Dropdown trigger against 110 and 111, and the `input` look for Account Type (#26, not designed).
- Undesigned visuals: the open list (#60, #90 a), the field focus and error borders, the focus rings, Save while saving, and the server error above Save.

## Log
<!-- Claude appends: date, what was done, decisions, issues, validation results, review findings -->

### 2026-10-24, detailing (`/next-task 005`)
- Detailed from the outline row with Marko's notes: Popup per #35 on Radix Dialog; amount input per #64, #84, #69 and #71 with `isAllowedAmountInput`, `parseAmountInput` and `formatAmountInput` from task 001; Dropdown per #60 on Radix Select, one component reused by Account Type (#26) and the country code (#33, #43); focus per #87; Figma budget 0.
- Names: the Code name column already has `GoalPopupInput` (Figma `Popup Input` `416:6381`, the two-field popup) and `PopupInputSmall` (Figma `Popup Input (small)` `416:6338`, 360x88, the labelled field), so the scope uses them. `Popup` (the Radix Dialog shell) and `Dropdown` are code-only.
- Scope choices:
  - `GoalPopupInput` is in this task as a presentational form (fields, Save, saving, server error), because 104.1, 110.1 and 110.2 share it. Rules and saving stay in 014, 025 and 027.
  - `Dropdown` gets the four closed looks here, because each one is measured on a PNG. The option data stays in the screen tasks.
  - The `/dev/popup` page exists because the overlay and the blocking depend on the real `AppLayout`. So this task now depends on 003 and 004 too (both done).
- #35 reading: X, Esc and a click on the dimmed area are the only ways to close. The sidebar and header are not dimmed but blocked, so a click there does nothing and the popup stays open. Not raised as a question; listed in the human checkpoint.
- Quick probes on the PNGs (Node built-ins, session scratchpad):
  - Popup (104.1): panel x 1208–2183, y 552–1335 at 2x, so 488x392 at x 604, y 276. In 110.2 the panel is 280 high with the same top edge.
  - Vertical stack: 64 top, label 24, gap 8, field 56, gap 24, label 24, gap 8, field 56, gap 32, Save 48, bottom 48 = 392. With one field the sum is 280.
  - Overlay starts at y 176 and x 560 at 2x (below the header's bottom border, right of the sidebar), `#DDDDDD` over white.
  - X glyph Secondary `#525256`, about 24 from the top and right. Labels Secondary.
  - Field border `#D1D1D1` (Special/BG within 1). The prefilled value and the placeholder are both `#878787` (Gray/02), text about 24 inside the field. Save x 1504–1887, so 192 wide.
  - 110 Savings Goal selector: fill `#F4F4F4`, 1px `#E8E8E8` border, 156x32, text `#666666` 12px, chevron `#525256` with a 9x5 glyph (`ArrowDown2` at 16px). Saving Summary: the same text and chevron, no box.
  - 111 country code: "+880" in `#878787` with no chevron, then a 1px `#878787` divider and the number.
- Raised **#90 (open)** in `docs/decisions.md`:
  - (a) the open list has no visible edge with `--shadow-popup: none` on white cards;
  - (b) whether the `$` shows next to the Present Amounts placeholder;
  - (c) the popup position: centered as the brief says, or the PNGs' fixed top edge.
  This task waits for it.
- INDEX: 005 depends on 001, 002, 003 and 004; open questions list #90.
- No Figma calls.

### 2026-10-24, #90 closed
- Marko took the proposals for (a) and (b) and changed (c):
  - (a) The open list uses `--radius-popup`, `--shadow-card` and a 1px `--color-gray-05` border, with no new tokens.
  - (b) An empty field with a placeholder shows the placeholder alone, as drawn. An empty Target shows the `$` alone (#69), and the `$` appears once typing starts.
  - (c) Every popup's top edge is at y 276, as drawn. The panel is centered horizontally on the viewport, not on the content area: x 476–964 at 1440 wide, 128 px left of the PNGs' x 604.
- Scope, AC2, AC7, AC16, T2, T6, T16, validation step 4 (expected differences) and the human checkpoint now use these answers. T2 also checks the centering at 1600 wide.
- INDEX: open questions none.
- The task is ready to start. Not started, as Marko asked.

### 2026-10-24, #90 (c) corrected
- Marko corrected (c): the panel is centered horizontally on the content area, right of the 280px sidebar (the area the dim covers), not on the viewport. At 1440 wide it is at x 616–1104, 12 px right of the PNGs' x 604. The top edge stays at y 276. `docs/decisions.md` #90 notes "corrected 2026-10-24: content area, not viewport".
- Scope, AC2, T2 (x 696 at 1600 wide, content area 280–1600), validation step 4 (render position and expected difference) and the human checkpoint now use the content area.
- Not started, as Marko asked.

## Metrics
- Started:
- Finished:
- Human interventions: 0
- Rework loops: 0
- Notes on prompts that failed:
