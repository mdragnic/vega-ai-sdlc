# Task 005: Shared components: Popup, amount input, Dropdown

- Status: done
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
4. Given a popup is open, when I click the sidebar (a link) or the header, then nothing happens: the URL stays, nothing behind reacts, and the popup stays open. A click on the dimmed area closes it (#35, AC5). The wheel does not scroll the page. Tab and Shift+Tab cycle inside the popup. Everything outside it is hidden from assistive technology (#35).
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
| T4 | e2e | With the popup open: click the "Balances" nav link in the sidebar and the header search; wheel; Tab ×6 and Shift+Tab ×6 | URL unchanged, popup open, scroll position unchanged; focus stays inside; the nav and main are `aria-hidden` or inert | 4 |
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

### 2026-10-24, before building (`/next-task 005`)
- All cited decisions are closed (#6, #11, #26, #30, #31, #33, #35, #36, #37, #43, #60, #63, #64, #65, #69, #71, #79, #84, #86, #87, #90). No task was `awaiting-human`.
- **No Figma MCP calls in this task** (budget 0): PNGs in `docs/figma/` and the export `docs/figma/components/418-6433.png` only, measured with a Node script using built-ins (session scratchpad).
- The session was interrupted once during visual validation (connection dropped); it resumed from the working tree and this task file. No step was redone except the renders retaken after later fixes.

### 2026-10-24, build (TDD)
- Each component's tests were written first and seen failing (component missing), then the code. Files:
  - New:
    - Components: `frontend/src/components/Popup/` (`Popup.tsx`, `Popup.module.css`), `frontend/src/components/PopupInputSmall/` (`PopupInputSmall.tsx`, `PopupInputSmall.module.css`), `frontend/src/components/GoalPopupInput/` (`GoalPopupInput.tsx`, `GoalPopupInput.module.css`), `frontend/src/components/Dropdown/` (`Dropdown.tsx`, `Dropdown.module.css`).
    - Dev page: `frontend/src/app/dev/PopupDemo.tsx`, `frontend/src/app/dev/PopupDemo.module.css`.
    - Tests: `frontend/test/components/Popup.test.tsx`, `PopupInputSmall.test.tsx`, `GoalPopupInput.test.tsx`, `Dropdown.test.tsx`; `frontend/test/app/popup-demo.test.tsx`; `e2e/tests/popup-amount-dropdown.spec.ts`.
    - Evidence: `.claude/tasks/evidence/005/`, 45 PNGs (14 compare, 15 render, 8 focus, 5 open-list, 3 trigger).
  - Changed:
    - App and components: `frontend/src/components/AppLayout/AppLayout.tsx`, `frontend/src/components/index.ts`, `frontend/src/app/routes.tsx`, `frontend/src/app/dev/ComponentGallery.tsx`, `frontend/src/app/dev/ComponentGallery.module.css`.
    - Tokens: `docs/figma/tokens.md`, `frontend/src/styles/tokens.css`.
    - Docs: `docs/figma/components.md`, `.claude/tasks/INDEX.md`, this task file.
    - Tests: `frontend/test/setup.ts`, `frontend/test/styles/tokens.test.ts`, `frontend/test/app/gallery.test.tsx`, `frontend/test/app/gallery-build.test.ts`.
- The rest of this entry is recovered from the draft the interrupted session left in its scratchpad (`log-draft.md`, written 09:51). The tokens, the token test and the jsdom stubs below were checked against the code on 2026-10-24.
- **Measurements (2x PNGs, halved):**
  - Popup (104.1, 110.1, 110.2): panel x 1208–2183, y 552 (276 CSS) in all three. X glyph x 2085–2122, y 613–650, so the 32px icon box sits 24 from the top and right. Save x 1504–1887 (192). Field border `#D1D1D1`. Value and placeholder `#878787`, from x 1385–1386 (24 inset). Overlay from x 560, y 176, `#DDDDDD` over white.
  - Label weight: rendered at 500, 600 and 700 against 104.1. Semibold matches: "Target Amounts" ink is 122.5 wide; 500 gives 120.5, 700 gives 124.5; mean difference 10.5 / 2.7 / 7.0.
  - 110 Savings Goal box: x 984–1295, y 344–407 (156x32), fill `#F4F4F4`, border `#E8E8E8`, corner radius about 7–8 at 2x (4). Text `#666666` from x 1018. Chevron `#525256`, glyph x 1238–1257. Text to chevron 17 at 2x (8). Saving Summary: text from x 1772, chevron glyph from x 1902, the same gap.
  - 111 "+880": `#878787`, ink x 723–800, y 1164–1188.
- **Tokens added** (`tokens.md` rows with their sources): `--space-popup-top` 276, `--space-popup-close-inset` 24, `--space-popup-input-padding-x` 24, `--space-dropdown-padding-x` 16, `--space-dropdown-chevron-gap` 8, `--size-popup-button-width` 192, `--size-dropdown-box-height` 32, `--radius-dropdown` 4. The popup top padding is 64, equal to `--space-popup-padding-x`, so it has no token of its own (Scope).
- **Decisions in the build:**
  - Overlay geometry: `AppLayout` gives its `<main>` through `ContentAreaContext`. The overlay is fixed, starts at the 280 sidebar token, and its top is measured once as it mounts: the header's bottom edge, or 0 once the header is scrolled away (the page cannot scroll while it is open). The panel is fixed at `--space-popup-top` with left 280, right 0, width 488 and auto margins, so it is centered on the content area without dividing in CSS.
  - **#35 reading, AC4 against AC5.** The content area is all dimmed, so a press on "the content behind" lands on the overlay and closes the popup like any press on the dimmed area (#35, AC5). It never reaches the content: the "View All" under it does not navigate. The e2e test checks exactly this. AC4 and T4 still say that a press on the content behind does nothing; their wording was not changed and is raised at the gate. The sidebar and header are not dimmed but blocked: a press there does nothing and the popup stays open.
  - Blocked presses keep focus. Radix turns pointer events off outside the popup, so a press on the sidebar or header lands on `<html>` and moved focus to `<body>`. Radix Dialog reports outside presses only on the following click (`deferPointerDownOutside`), which is too late, so `Popup` cancels a `pointerdown` on the page root while it is open.
  - Focus on open: Radix selects the first field's text; `Popup` puts the caret at the end instead, with nothing selected, as drawn. Focus returns to the opener. There is no Radix trigger, so the opener is recorded on open.
  - `$`: shown by the field and hidden by CSS while the placeholder shows (`:placeholder-shown`), so it follows the real field text however it is set (typing, `register` defaults, `reset`).
  - Typing: a native `beforeinput` listener cancels any insert whose result `isAllowedAmountInput` rejects (keys, pastes, drops), so the value and the caret stay. React's `onBeforeInput` does not see pastes. IME composition cannot be cancelled, so `onChange` undoes a change to text that is not allowed and does not pass it on (`parseAmountInput` would throw on it). The input has `inputMode="decimal"` and `autoComplete="off"`.
  - Undesigned looks (`frontend-design`, existing tokens only):
    - field focus border `--color-secondary`, the popup's label and X color;
    - the error border stays red with focus (#87);
    - the server error is centered above Save, 16 apart (`--space-form-small-gap`);
    - the open list follows #90 (a): options Regular 14/20 Gray/01, the highlighted one with a Gray/06 fill and Default Black text, the selected one teal Semibold (like the active tab), 8 padding, 8 from the trigger (`--space-form-label-gap`);
    - the `input` variant's focus border is `--color-input-active`, like `Input`.
  - Dropdown focus ring: Radix moves focus by script, and Chrome then shows `:focus-visible` on the trigger even after a mouse choice. The trigger records whether the last interaction with it or its list was a pointer or a key, and hides the ring only after a pointer (#87: a mouse click shows no ring).
  - `tokens.test.ts`: the "only existing tokens" guard now also accepts exactly two Radix runtime variables, `--radix-select-trigger-width` and `--radix-select-content-available-height` (the open list's minimum width and its window-fit maximum height). They are listed by name, so a typo still fails.
  - `test/setup.ts`: jsdom stubs for `hasPointerCapture`, `releasePointerCapture` and `scrollIntoView` (Radix Select), skipped in node-environment tests.
  - Dev page: react-hook-form with `shouldUnregister`, so a reopened popup shows the initial values. "Save fails" waits 800 ms, then shows "The amounts could not be saved. Try again."

### 2026-10-24, validation re-run (resumed session)
After the two interruptions, every validation step was run again on the existing code, in order. No step failed, so nothing was fixed and no rework loop was added.
1. **Lint and typecheck:** `npm run lint` exit 0 (oxlint, Stylelint, Prettier: "All matched files use Prettier code style!"). `npm run typecheck` exit 0 in shared, backend, frontend and e2e.
2. **Unit:** `npm test` 670/670 (shared 220, backend 43, frontend 407), with no warnings in the output.
3. **E2E:** `npm run e2e` 40/40, the 12 tests of this task included. The `AmountBox` error printed by the web server is the deliberate boundary demo of task 004.
4. **Build:** `npm run build` exit 0. `frontend/dist` contains none of "Component gallery", "Open two-field popup", "Open one-field popup", "Save fails", "/dev/popup".
5. **Visual** (Playwright MCP, 1440x1024 at device scale 2, in a separate browser context, because the CDP scale override did not hold on the MCP page). All 45 renders in `.claude/tasks/evidence/005/` were retaken with the same names, and the 14 `compare-*.png` images were rebuilt with the earlier session's script (design crop | render crop | difference x4). Mean difference per channel (0 to 255): panels 104.1 1.18, 110.1 1.17, 110.2 0.95, export `416:6381` 1.38; X 0.07, Save 0.29, labels 3.80 and 3.51, fields 4.62 and 3.31; Dropdown box left 9.95, box right 2.64, plain 7.87, inline 5.57. Ink positions from the panel's top-left: the X glyph and the Save text are identical; the labels and the value are within 0.5 px. Differences:
   - The panel is at x 616–1104, 12 px right of the PNGs' x 604 (expected, #90 c). Its top edge is at y 276 in both renders; heights 392 and 280.
   - The Target field has the darker focus border in the render: focus moves to the first field on open (AC1), and the PNGs draw no focus.
   - Placeholder "Write present amount here" against "Write presents amounts here" (expected, #18).
   - The page background under the dim is `#F3F3F3` (`--color-gray-06`, tasks 000 and 003) against `#F4F5F7` in 104.1, so the first dimmed row reads `#D2D2D2` against `#D4D4D6`. The overlay itself matches: white under it is `#DDDDDD` in both, and the header's bottom border row is `#E8E8E8` and not dimmed in both. Not from this task.
   - The dev page content behind the overlay (expected).
   - Dropdown box: the label `Mar, 2026` against "01 May ~ 31 May", so the box is 113.8 wide against 156 (expected, #60). The chevron glyph is about 1 px narrower and 1 px nearer the right edge. Plain: `Mar, 2026` against "Mar 2022" (#60); the shared glyphs line up.
   - Inline "+880": the same ink width (39 px), with a sub-pixel offset.
   - Undesigned states, for the human checkpoint: Save while saving (spinner, disabled), the server error above Save, the X and Save rings, the field focus and error borders, the four open lists and the 60-month list (y 10–984 in the 1024 window, flipped above its trigger, scrolling inside).
6. **Manual browser checks** (Playwright MCP):
   - On `/dev/popup`:
     - Open: the dialog is named "Goal amounts", with `aria-modal="true"`, and focus is in Target with the caret at the end.
     - Tab and Shift+Tab cycle Target, Present, Save, Close and back.
     - Presses on a sidebar link and on the header change nothing: the URL stays, the popup stays open, focus stays in the field. The wheel does not scroll the page. `nav` and `main` are `aria-hidden`; the body has `overflow: hidden`.
     - X, Esc and the dimmed area close the popup in both popups, and focus returns to the opener (10 runs, 9 to 50 ms after the dialog unmounts). A press inside the panel does not close it. A changed value is gone after closing and reopening.
     - Typing: allowed text stands; `,`, `$`, letters, space, `-`, a second `.` and a third decimal are rejected with the value and caret unchanged, also mid-text. A lone `.` and `.5` stand.
     - Real clipboard pastes into `12`: `1,000`, `.345` and `$5` are rejected whole; `.34` and `00` stand. Into an empty field: `1250.50` stands and ` 5` is rejected.
     - Save shows "Target: 125050 cents. Present: 50 cents."; Enter in a field submits; an empty field and a lone `.` read as `empty`.
     - "Save fails": Save is disabled with `aria-busy` and the spinner, then the alert shows and Save is enabled again. A reopened popup is clean. Closing during a save leaves no late error.
   - In the gallery, for all four variants:
     - The list opens by click, Enter, Space and ArrowDown, on the selected option. ArrowUp, ArrowDown, Home and End move it; a click or Enter chooses; focus returns to the trigger. Esc and a click outside change nothing. Typing "S" goes to Savings.
     - The 60-month list has 60 options, fits the window and scrolls inside (0 to 1204); the page scroll is unchanged.
   - No console errors or warnings. The only non-info lines are Chrome's VERBOSE "Password field is not contained in a form" hints from the task 002 password examples.
   - Four alarms in these checks came from my check scripts, not from the components; none led to a change:
     - focus read right after the dialog unmounted, before Radix restores it in a `setTimeout(0)`;
     - a clipboard copy made while the focus trap was active, which copied the field's own text;
     - arrow keys read before Radix moved item focus, which it also does in a `setTimeout`;
     - role queries on a trigger that Radix hides from roles while its list is open.

### 2026-10-24, security review (`security-review`, Skills line: money)
- No findings. Checked:
  - the money input path: `isAllowedAmountInput` on `beforeinput` and `onChange`; `parseAmountInput` builds integer cents without a float; nothing is sent to the backend;
  - HTML sinks: none (no `dangerouslySetInnerHTML`, `innerHTML`, `eval`). The only DOM write is a numeric `style.top`;
  - dev routes in production: a lazy import inside the existing `import.meta.env.DEV` branch, checked by `gallery-build.test.ts`;
  - no secrets, no external URLs in the CSS, no logging added.

### 2026-10-24, code review (`superpowers:requesting-code-review`)
- Verdict "With fixes": no critical findings, 2 important, 9 minor. The reviewer re-ran the 5 new Vitest files (71/71) and checked behaviour in Chromium.
- Fixed, each test first:
  1. Important: a paste of a spreadsheet cell (`500\r\n`, as Excel on Windows copies it) was rejected. The check ran on the raw clipboard text, while Chrome drops trailing line breaks before inserting. Reproduced in Chromium: a plain input got `500`, the amount field stayed empty; `5\n00` and `\n500` become `5 00` and ` 500` in a plain input. `PopupInputSmall` now trims trailing line breaks before the check. A line break inside the text still fails the check, because the browser would paste a space there. New tests: 2 unit tests (`500\r\n`, `500\n`, which failed first), `5\n00` added to the rejected pastes, and an e2e real-clipboard paste of `500\r\n` giving 50000 cents.
  2. Important: the AC4 and T4 wording against #35 and AC5, and the build choices that were not logged. The choices are now logged above. AC4 and T4 are not reworded: they are raised at the gate.
  3. Minor: `value` and `defaultValue` of `PopupInputSmall` accepted numbers, so `defaultValue={cents}` would compile and show 100 times the amount. Both are now `string`. A type test (`@ts-expect-error` on both) failed the typecheck first.
  4. Minor: the docs said unsaved changes are discarded on close. That holds only for state inside the popup; a `useForm` above it keeps edited values unless it has `shouldUnregister: true` or resets on open. The `Popup` and `GoalPopupInput` docs now say so.
  5. Minor: after keyboard focus on a trigger, a mouse open and a click outside brought focus back with the teal ring. When Radix moved focus into the list, the trigger's blur cleared the pointer flag, and the outside press was never recorded. `Select.Content` now records it (`onPointerDownOutside`). New tests: a unit test (failed first), a guard that a keyboard open and Esc keep the keyboard ring, and an e2e step in T17.
  6. Minor: the `input` trigger lost its active border while its list was open (`#D0D5DD` instead of `#4B5768`), because focus is then in the list. `.input[data-state='open']` now shares the `:focus` rule. New e2e step in T17. `open-list-input.png` was retaken.
- Not fixed (follow-ups, for the gate):
  - 7: Save moves focus to `<body>` when it becomes disabled while saving. This comes from `ButtonPrimary` (task 002); Tab and Esc recover.
  - 8: long lists show no scroll hint; Radix hides the scrollbar and #90 (a) defines the list look.
  - 9: if a popup's first focusable element were hidden, focus would stay outside. No popup has one (YAGNI).
  - 10: `Dropdown` has no `id` prop for a visible `<label htmlFor>`; `aria-labelledby` names it. Task 022 can add one.
  - 11: nits. `ContentAreaContext` is exported next to `AppLayout` (Fast Refresh does a full reload), and tokens are reused by value under other names, as "existing tokens only" requires.
- Set aside by the reviewer as outside the plan, all agreed:
  - below about 670 px window height, the fixed panel cuts off Save (desktop 1440x1024, #90 c);
  - with a classic scrollbar, the panel centers on 280–1440 while the content spans 280–1425;
  - a press on the dim released inside the panel closes the popup;
  - no z-index layering yet;
  - the `$` is `aria-hidden`;
  - the caret after a click on the `$`;
  - leading zeros and limits belong to tasks 001 and 014/025/027;
  - closing while saving is allowed;
  - visual fidelity is for the human checkpoint.
- Red-green for the new e2e assertions: with the three fixes taken out (the files backed up, then restored and checked identical with `cmp`), the paste test failed (`""` for `500`). T17 failed on the ring (`solid` for `none`), and, with only the CSS fix still out, on the open border (`rgb(208, 213, 221)` for `rgb(75, 87, 104)`).

### 2026-10-24, verification before the gate (`superpowers:verification-before-completion`)
- Run fresh on the final tree, after the review fixes:
  - `npm run lint` exit 0;
  - `npm run typecheck` exit 0;
  - `npm test` 676/676 (shared 220, backend 43, frontend 413: 6 new);
  - `npm run e2e` 40/40;
  - `npm run build` exit 0, with no dev-page strings in `frontend/dist`.
- Every acceptance criterion maps to a passing test: T1–T17, T19 and T20 by name. T18 (AC18) is covered by the guards from task 002: `names.test.ts` checks every exported component and folder against the Code name columns, the Code-only table included. Stylelint and `tokens.test.ts` cover "tokens only". `components.md` has the `Popup` and `Dropdown` Code-only rows and the `GoalPopupInput` and `PopupInputSmall` Code name rows.
- No Figma MCP calls in this session.
- Status `awaiting-human`.

### 2026-10-24 11:15, approved by human
- Approved by human (Marko, `/approve-task 005 approve`). Human interventions +1. Status `done`.
- On Marko's request, before the commit:
  - AC4 and T4 now name the sidebar and the header instead of "the content behind": a click on the dimmed area closes the popup (#35, AC5). That is what the implementation and the e2e test already do.
  - `INDEX.md` row 009 now also covers "ButtonPrimary loading keeps keyboard focus on the button (task 005 review: focus moved to the page body while saving)".
  - Row 022 now also covers "Dropdown id prop for a visible label (task 005 review)".
  - Rework loops keep the convention: code-review fixes are not counted.
- Acceptance criteria 19 of 19 (AC4 as reworded).

## Metrics
- Started: 2026-10-24 08:54 (from the build session's own log draft; the "before building" entry has no time)
- Finished: 2026-10-24 11:15
- Human interventions: 1
- Rework loops: 1 (at least: the Log mentions renders retaken "after later fixes" without a count, and the build entry was cut off). The re-validation found no failures, so none were added.
- Notes on prompts that failed: Session interrupted twice; one false-positive safety stop. The 5 code-review fixes are not counted as rework loops, as in tasks 002 to 004.
