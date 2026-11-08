# Task 032: Fixes from the final review

- Status: todo
- Gate: human
- Depends on: 031
- Size: M
- Skills: `superpowers:systematic-debugging` (item 1: the cause shown on the real app before any fix), `superpowers:test-driven-development` (every item's tests written first and seen failing; item 1's e2e test fails before the fix with the 15 px it measures), `frontend-design:frontend-design` (only the undesigned parts of item 3: the "Not available" tooltip, the keyboard focus on the new buttons and the gray of Balances' "Remove"; tokens only, no new colour, font or spacing), `superpowers:verification-before-completion`, `superpowers:requesting-code-review`. **Not included: `security-review`**, because no item touches authentication, sessions, uploads, user scoping or what the backend accepts or sends: item 1 is one CSS rule; item 2 colours amounts the frontend already shows with their sign (the amount, the sign and the direction come unchanged from the backend, and nothing is calculated, #11); item 3 turns controls that do nothing into disabled buttons that do nothing (no request, no route, no form). The backend is not changed. `dataviz` not applied: no chart changes.

## Goal
Opening or closing any popup or dropdown no longer moves the page by even a pixel; signed transaction amounts show income in green and expenses in red; and Balances' Add Accounts, Edit Accounts and Remove are focusable buttons shown disabled and described as "Not available", instead of text that looks clickable and does nothing.

## References
- INDEX row 032: the three items found by Marko at the task 031 gate.
- Decisions: #132 and #133 (closed, Marko, task 031 gate); #134 (raised at this detailing, closed as proposed: (a) a1, two new tokens, since no existing one passes 4.5:1; (b) b1, the scrollbar's thumb hidden while open; (c) c1, Account Details' "Remove" follows #133 too). The Scope below follows #134's answers. Also #11 (nothing calculated), #19 (signs; its colours replaced by #132), #22 and #23 (still no behaviour), #35 (an open popup blocks the whole page), #65 (tokens only), #73 (no new dependency), #87 (focus ring), #100 and #101 (the stable gutter, 15 px), #122 b (the Expenses card items stay unsigned), #127 b (the `aria-disabled` pattern: focus kept, clicks cancelled), the General rule.
- Task files: 005 (`Popup` on Radix Dialog, `Dropdown` on Radix Select; the popup's dim placed once since the page cannot scroll), 011 (`scrollbar-gutter: stable`, `--size-scrollbar-gutter`), 014, 017, 022, 024 to 028 (the popups and dropdowns listed in Scope), 016, 020, 021 (the three amount components), 019 (Balances; its T9 and T17 pin the build #133 replaces), 021 and 022 (Account Details' "Remove").
- Figma, budget 0 (no MCP calls, PNGs only): `docs/figma/104. Overview.png`, `104.1. Overview.png`, `105. Balances.png`, `106. Account Details.png`, `107. Transactions.png`, `109. Expenses.png`, `110. Goals.png`, `110.1. Goals.png`, `110.2. Goals.png`, `111. Settings.png`.
- Components (`docs/figma/components.md`): `Popup`, `Dropdown`, `GoalPopupInput`, `SavingsGoalPopup`, `CategoryLimitPopup`, `ComparisonChartCard`, `SavingsGoal`, `SavingSummary`, `AccountDetailsForm`, `SettingsPhoneInput`, `RecentTransactionItem`, `TransactionItem`, `TransactionsHistoryItem`, `ExpensesLineItem`, `AddAccountsCell`, `AddAccountsButtonBig`, `AccountType`, `AccountDetailsCard`, `ButtonPrimary`.
- Spec: US-08 criterion 3 (the amount "in the designed colour", #19), US-11 criteria 2, 3 and 5 ("teal Remove", "gray Edit Accounts text link", "nothing happens"), US-12 criteria 3 and 10 (Account Details' "Remove"), US-13 (the Amount column). Spec wins over code: the criteria #132 to #134 change are updated to cite them.
- Facts found at detailing (each re-checked at the build):
  1. **The likely cause of the jitter.** `Popup` (Radix Dialog) and `Dropdown` (Radix Select) lock the page's scroll through `react-remove-scroll` 2.7.2 and `react-remove-scroll-bar` 2.3.8 (in `radix-ui` 1.8.1). On open, it sets `data-scroll-locked` on `body` and adds a style: `overflow: hidden !important`, `position: relative !important` and `margin-right: <gap>px !important`, where the gap is `innerWidth - documentElement.clientWidth`, measured as it opens, meant to replace the scrollbar it hides. On app pages `html` has `scrollbar-gutter: stable` (#100), so with a classic scrollbar the gap is 15 and the gutter stays reserved after the overflow is hidden: `body` loses 15 px. Measured on a static page (a stable gutter, a tall body, the library's rule) in Playwright's Chromium at 1440 with classic scrollbars: `body` 1425 wide, 1410 while locked, an element at its right edge moving from x 1425 to 1410; `clientWidth` reads 1440 while locked although the `html` box stays 1425. With `margin-right: 0 !important` on a more specific `body[data-scroll-locked]` selector, `body` stays 1425 while locked. Not yet measured on the app itself: AC1.
  2. **Why no test saw it.** The e2e browser hides scrollbars (`--hide-scrollbars`, Playwright's headless default): the gap is 0, so no margin is added and nothing moves (the memory on the e2e gutter). Launched without that flag (`launchOptions.ignoreDefaultArgs: ['--hide-scrollbars']`), headless Chromium on this machine draws a classic 15 px scrollbar (`clientWidth` 1425 at 1440). The new spec uses that, for its own file only.
  3. **The popups and dropdowns on app pages** (every use of `Popup` and `Dropdown` outside the dev gallery):
     - Popups: (P1) Overview, Goals card, "Edit savings goal": `SavingsGoalPopup` (104.1); (P2) Goals, Savings Goal card, "Adjust Goal": `SavingsGoalPopup` (110.1); (P3) Goals, Expenses Goals by Category, each category's "Adjust": `CategoryLimitPopup` (110.2).
     - Dropdowns: (D1) Overview, Statistics, "Weekly Comparison" (`comparison`); (D2) Expenses, "Monthly Comparison" (`comparison`); (D3) Goals, Savings Goal month (`box`); (D4) Goals, Saving Summary month (`plain`); (D5) Account Details edit mode, Account Type (`input`); (D6) Settings Account tab, Country code (`inline`).
     - Not opened by anything: the Security tab's Country code is read-only (disabled). No auth page has one. The dev gallery uses both components, but it has no stable gutter (not an app page), so the library's margin is right there.
  4. **Amount colours today.** `RecentTransactionItem` `.amount` is Secondary; `TransactionItem` and `TransactionsHistoryItem` `.amount` are Default Black. Each renders `formatSignedMoney(amount, direction)` with the direction as sent. Contrast on white: Special/Green 2.74:1, Special/Red 4.13:1, Primary 3.32:1, so no existing green or red passes (#134 a). No test asserts an amount's colour today.
  5. **Balances today.** `AddAccountsButtonBig` is a `span` (Primary fill, white Bold 16/24, 208x48, default cursor); `AddAccountsCell` holds it and the `span` "Edit Accounts" (Gray/03, Medium 16/24), the cell and its `<li>` `aria-hidden`; `AccountType`'s "Remove" is a `span`, Primary, Regular 16/24, `aria-hidden`. Account Details' "Remove" is a `span` (Gray/01, Medium 14/20), `aria-hidden` and `inert`, in `AccountDetailsCard` and `AccountDetailsForm` (#134 c). Tests that pin the old build: `frontend/test/app/balances.test.tsx` (the helpers that leave out the hidden cell, lines 52 to 83; T9, lines 238 to 270: clicks do nothing, each inside `aria-hidden`) and `e2e/tests/balances.spec.ts` (T17, lines 208 to 240: no request, no dialog, no focus, no pointer, inside `aria-hidden`); and Account Details' tests of "Remove" (`account-details.test.tsx`, `account-details-edit.test.tsx`, `account-details.spec.ts`).
  6. **What can be reused.** `ButtonPrimary` with `aria-disabled` is the app's disabled button: the Active=No look (`--color-button-secondary` fill, `--color-input-active` text, default cursor), clicks cancelled, focus kept, the #87 ring ("Save changes", #127 b; "Update Password"). No tooltip exists in the app. Radix Tooltip ships in the installed `radix-ui` 1.8.1 (`@radix-ui/react-tooltip`), so no new dependency (#73).

## Scope
The items are built in this order, each with its tests passing before the next starts.

### Item 1: no movement when a popup or dropdown opens or closes
- **The cause first**, on the real app, before any change (systematic debugging): `npm run dev`, the headed Playwright MCP browser (classic 15 px scrollbar) at 1440x1024, a demo user. For P1 and D1 at least: the `html` and `body` boxes, `body`'s computed `margin-right` and `overflow`, `data-scroll-locked`, the header's right-side items and one card's box, closed, open and closed again. The Log states the cause with these numbers. If it differs from fact 1, the Log says what it is and the fix follows the real cause; if it cannot be fixed once in the shared styles or setup, STOP and ask.
- **The e2e test, before the fix**: new `e2e/tests/scroll-lock.spec.ts`, with `test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })` for its file only. Each test first checks that the scrollbar takes 15 px (`innerWidth - documentElement.clientWidth` is 15 before anything opens), so it cannot pass on a hidden scrollbar. For each of P1 to P3 and D1 to D6 (every category's "Adjust" for P3): the page's boxes are read closed, open and closed again, and must be equal to the pixel: `html`, `body`, the header and each of its right-side items, the sidebar, `main` and every section and card box on the page; also `scrollX` and `scrollY`, and the `html` box's right edge (the gutter's place, 1425). Each opens by a click on its control and closes with Escape. The boxes are read through CSS selectors, since Radix hides the rest of the page from role locators while a dropdown is open (the memory). The test runs and fails before the fix; the failures (which, by how much) go in the Log.
- **The fix, once**, in the shared app-shell styles, beside the rule it pairs with: in `frontend/src/app/AppShell.module.css`, under the same `html:has(.shell)` condition as `scrollbar-gutter: stable`, `body[data-scroll-locked]` keeps `margin-right: 0` (with `!important`, in a selector more specific than the library's, which uses `!important` too). The stable gutter already keeps the scrollbar's space, so the library's margin only takes it twice. A comment names the cause, the library and its attribute, and cites #100, #101 and #134 b. Nothing else changes: not `Popup`, `Dropdown`, any page or any component. Pages without the stable gutter (auth, dev) keep the library's margin.
- As #134 (b1) decided: the scrollbar's thumb is hidden while a popup or dropdown is open (its gutter stays) and comes back on close; the page still cannot scroll while one is open (#35).
- `docs/architecture.md`, Frontend, Layout: one sentence that app pages keep a stable scrollbar gutter and that the scroll lock of popups and dropdowns adds no margin there (the fix touches the shared app-shell styles). The Testing section names the classic-scrollbar spec.

### Item 2: signed amounts in green and red (#132)
- As #134 (a1) decided: two colour tokens, `--color-income` `#3A8553` and `--color-expense` `#DD3817`, added to `docs/figma/tokens.md` (Color table; source: #132 and #134 a, the lightest shades of Special/Green and Special/Red at their own hue and saturation that reach 4.5:1 on white, 4.51:1 each) and then to `frontend/src/styles/tokens.css` (`tokens.test.ts` keeps them equal).
- One shared CSS module, `frontend/src/styles/signedAmount.module.css`, with `.income` and `.expense` (the colour only), imported by `RecentTransactionItem`, `TransactionItem` and `TransactionsHistoryItem`. Each gives its amount the class of the row's direction as sent, never by reading the sign of the formatted text. The text, sign, font, size, weight, alignment and wrapping stay as now. Each module's comment that cites "#19 ... for income and expenses alike" cites #132 instead.
- Unchanged: `ExpensesLineItem` (unsigned, its colour kept, #122 b) and every other amount (Total Balance, account balances, bills, goals, the Expenses and Overview totals, charts).
- `components.md`: the three rows say the amount's colour follows the direction (#132). Spec: US-08 criterion 3 and the US-12 and US-13 criteria that describe the amount say "income in green, expense in red (decisions #132, #134 a)".

### Item 3: Balances' controls shown disabled (#133)
- A new Code-only component (name fixed at the build from `components.md`'s rules, for example `NotAvailableTooltip`), on Radix Tooltip, wrapping one button. It gives the button the accessible description "Not available" at all times (`aria-describedby` to text that is always in the DOM, not only while the tooltip shows) and shows "Not available" next to it on mouse hover and on keyboard focus. The tooltip stays while the pointer is on the control or the tooltip, or while the control has focus; Escape hides it; it goes on leave or blur (WCAG 1.4.13). Not designed: its look comes from `frontend-design`, tokens only (an existing dark fill with white text, an existing radius and shadow), above the control. Not a `title` attribute.
- "Add Accounts": `AddAccountsButtonBig` renders `ButtonPrimary` with `aria-disabled` (the Active=No look, gray), 208x48 as now, in the new wrapper.
- "Edit Accounts": a `button`, `aria-disabled="true"`, its look as now (Gray/03, Medium 16/24: already gray), in the wrapper.
- Each Balances card's "Remove" (`AccountType`): in the same state as Add and Edit Accounts (fact 5), so it follows #133: a `button`, `aria-disabled="true"`, gray (Gray/03, the designed colour of the other control that does nothing, instead of teal), its font, size and place as now, in the wrapper.
- As #134 (c1) decided: Account Details' "Remove" in view and edit mode (`AccountDetailsCard`, `AccountDetailsForm`) the same: a `button`, `aria-disabled="true"`, its look unchanged (Gray/01, Medium 14/20), in the wrapper; `inert` and `aria-hidden` removed.
- Every one of them: focusable (a Tab stop where it is drawn; on Balances each card's "Remove" before its "Details", then "Add Accounts" and "Edit Accounts" last), `type="button"`, and nothing happens on a click, Enter or Space: no request, no navigation, no dialog, focus stays on it. The default cursor; the #87 ring on keyboard focus only. The Add Accounts cell and its `<li>` are no longer `aria-hidden`, so the list has the five accounts and the cell.
- The tests that pin task 019's build (fact 5) change because #133 replaces it: their "nothing happens on a click" assertions stay; "not focusable" and "inside `aria-hidden`" become the new rule's assertions. Nothing is loosened: the Log lists each changed assertion with its replacement.
- `components.md`: the new component's Code-only row and the added-by sentence; the rows of `AddAccountsCell`, `AddAccountsButtonBig`, `AccountType`, `AccountDetailsCard` and `AccountDetailsForm` say the controls are disabled buttons described as "Not available" (#133, #134 c). The gallery gets a section for the new export. Spec: US-11 criteria 2, 3 and 5 and US-12 criteria 3 and 10 say the controls are shown disabled, described as "Not available", and still do nothing (#133, #134 c).

## Out of scope
- Any behaviour for Add Accounts, Edit Accounts or Remove: no form, flow or confirmation (#22, #23 stand).
- Other visual-only controls (the header's search and bell, Total Balance's round arrow and the like): unchanged.
- The colour of any amount other than the signed transaction amounts of item 2 (#122 b).
- Changes to `Popup`, `Dropdown`, Radix or how scroll is locked; any patch to a dependency; any new dependency or version change (#73).
- `playwright.config.ts` and the other specs: the classic scrollbar is set in the new spec's file only.
- The dev gallery's and the auth pages' scroll lock.
- Mobile (#4).

## Acceptance criteria
**Item 1: no movement when a popup or dropdown opens or closes**

1. Given the app before the fix, then the Log states the cause with its measurements from the headed browser on the real app (which rule moves what, by how many pixels, on which pages) and why the e2e suite did not see it.
2. Given every app page with a popup or dropdown, at 1440x1024 with a classic 15 px scrollbar, when each of P1 to P3 (every category's "Adjust") and D1 to D6 opens and then closes, then nothing moves by even 1 px: the `html` and `body` boxes, the header and its right-side items, the sidebar, `main`, every section and card, the scroll position and the gutter's place (the `html` box's right edge, 1425) are equal closed, open and closed again. The test fails before the fix and passes after it.
3. Given a popup or dropdown open on a page that can scroll, then the page still does not scroll by the wheel (#35), and the scrollbar's thumb is hidden until it closes (#134 b1).
4. Given the source, then the fix is one rule in `AppShell.module.css` under `html:has(.shell)`; `Popup.tsx`, `Dropdown.tsx`, the pages and the components that use them are not changed by item 1; `data-scroll-locked` appears nowhere else in `frontend/src`. `docs/architecture.md` says it.

**Item 2: signed amounts in green and red**

5. Given Recent Transaction on Overview (each tab), Transactions (each tab, and the rows Load More adds) and the Account Details history (and the rows Load More adds), then every income amount is in `--color-income` and every expense amount in `--color-expense`, chosen by the direction as sent; its text, sign, font, size, weight and alignment are as before.
6. Given the two tokens, then each is in `tokens.md` and `tokens.css` and at least 4.5:1 on `--color-white`, computed from the token values by a test; the Log and the gate name them and their ratios.
7. Given the Expenses card line items and every other amount, then their colour is as before (#122 b).
8. Given the spec and `components.md`, then US-08, US-12 and US-13 and the three item rows describe the colours and cite #132.

**Item 3: Balances' controls shown disabled**

9. Given Balances, then "Add Accounts", "Edit Accounts" and each card's "Remove" are buttons named by their text, `aria-disabled="true"`, with the accessible description "Not available"; each is a Tab stop in the order of AC and Scope; the Add Accounts cell is not hidden from assistive technology. Given Account Details in view and edit mode, the same for "Remove" (#134 c1).
10. Given a click, Enter or Space on any of them, then nothing happens: no request, no navigation, no dialog, and focus stays on it.
11. Given mouse hover or keyboard focus on any of them, then "Not available" shows next to it, as an element on the page (not a `title` attribute), and stays while the pointer is on the control or the tooltip, or while it has focus; Escape hides it; it goes on leave and blur.
12. Given their look at 1440x1024, then "Add Accounts" is in `ButtonPrimary`'s Active=No look at 208x48; "Edit Accounts" and Account Details' "Remove" look as before; each card's "Remove" is Gray/03 instead of teal, its size and place unchanged; the default cursor; the #87 ring on keyboard focus and none on a mouse click. Nothing else on either page moves.
13. Given the spec and `components.md`, then US-11 and US-12 and the rows listed in Scope describe the disabled controls and cite #133 and #134 c; the new component has its Code-only row, its export and a gallery section.

**All items**

14. Given every touched screen at 1440x1024 (104, 104.1, 105, 106, 107, 109, 110, 110.1, 110.2, 111), then the differences from its PNG are listed: the two decided ones (#132: green and red amounts; #133 and #134 c: the gray Add Accounts and Remove, the tooltip on hover or focus) and the ones earlier tasks listed, no other. Figma calls: 0.
15. Lint, typecheck, `npm test` and `npm run e2e` pass.

## Test scenarios
| ID | Type | Scenario | Expected | Covers AC |
|----|------|----------|----------|-----------|
| T1 | check | Headed MCP browser, `npm run dev`, 1440x1024, before any change: P1 and D1 closed, open, closed; the boxes and styles listed in Scope | The cause and its numbers in the Log (expected: `body` 1425 to 1410, `margin-right: 15px`) | 1 |
| T2 | e2e | `scroll-lock.spec.ts`, classic scrollbar (the 15 px precondition), P1 to P3 (every category's Adjust) and D1 to D6: open by click, close by Escape, boxes and scroll position read three times | Equal to the pixel each time; run before the fix: fails (recorded); after: passes | 2 |
| T3 | e2e | Same file: with P2 and D3 open on Goals scrolled part way (or the tallest page that scrolls at 1024), a wheel over the page | `scrollY` unchanged; closed, the wheel scrolls again | 3 |
| T4 | unit | Source check: `AppShell.module.css` holds the rule under `html:has(.shell)`; `data-scroll-locked` in no other file of `frontend/src`; `git diff` of `Popup.tsx`, `Dropdown.tsx` and the components of fact 3 empty for item 1 | As stated | 4 |
| T5 | unit | `RecentTransactionItem`, `TransactionItem`, `TransactionsHistoryItem` rendered with an income and an expense row | The amount has `signedAmount.module.css`'s `income` or `expense` class by direction, and its text as before | 5 |
| T6 | unit | Source check of `signedAmount.module.css` (each class sets only `color`, to its token) and of the three modules (no `color` left on `.amount`) | As stated | 5 |
| T7 | e2e | Overview (All, Revenue, Expenses), Transactions (each tab, after Load More), Account Details history (after Load More): each amount's computed colour against its sign | Income `--color-income`, expense `--color-expense`, every row | 5 |
| T8 | unit | `tokens.test.ts`: the two tokens' contrast on `--color-white` computed from `tokens.css` | Each at least 4.5 | 6 |
| T9 | e2e | Expenses card line items' computed colour; `ExpensesLineItem` source has no `signedAmount` import | As before (Secondary or what task 024 set) | 7 |
| T10 | unit | The new component (StrictMode): hover, keyboard focus, Escape, leave, blur; the description with the tooltip hidden | Shows on hover and focus, hides on Escape, leave and blur; `aria-describedby` names "Not available" at all times; no `title` | 11 |
| T11 | unit | `balances.test.tsx`: the three controls by role; Tab order; click, Enter and Space with fetch watched and the router's location read | Buttons, `aria-disabled`, description "Not available"; Tab order as Scope; no request, location unchanged, focus kept; six list items | 9, 10 |
| T12 | unit | `account-details.test.tsx`, `account-details-edit.test.tsx`: "Remove" in view and edit mode | As T11 for "Remove" (#134 c1) | 9, 10 |
| T13 | e2e | `balances.spec.ts` (T17 replaced) and `account-details.spec.ts`: Tab to each control, hover each, click each; computed look | Tooltip visible on focus and hover, gone on Escape; no request, no dialog, URL unchanged, focus kept; Add Accounts' Active=No colours, Remove Gray/03, the ring on keyboard focus only; card and cell boxes as before | 10, 11, 12 |
| T14 | unit | `gallery.test.tsx` and `names.test.ts`: the new export's section and its `components.md` row | Pass | 13 |
| T15 | check | The spec, `components.md` and `docs/architecture.md` diffs | The criteria and rows of AC4, 8 and 13 updated, citing the decisions | 4, 8, 13 |
| T16 | unit + e2e | `npm run lint`, `npm run typecheck`, `npm test`, `npm run e2e` | Exit 0 each | 15 |

## Validation steps (in this order, stop on first failure)
1. Lint and typecheck pass (`npm run lint`, `npm run typecheck`).
2. Unit tests pass (`npm test`).
3. E2E tests pass (`npm run e2e`), with ports 3000 and 5173 free first (no leftover `npm run dev`, the memory on Windows orphans).
4. Proof by breaking it on purpose, item 2 only (it shows money's direction; items 1 and 3 touch no security, user scoping, money or dates): (1) `RecentTransactionItem` gives income the expense class; (2) `TransactionItem` the same; (3) `TransactionsHistoryItem` the same; (4) `ExpensesLineItem` gets the expense class. Each runs only its test files, is restored, and the `git diff HEAD` and `git status --short` hashes are checked. One break summary in `.claude/tasks/evidence/032/`.
5. Visual, Playwright MCP at 1440x1024 (device scale 2, the fixed clock, a demo user, as tasks 013 to 031):
   - Item 1, with the classic scrollbar shown (headed): P1 and D1 before and after the fix, closed and open, the header's right side and the gutter in view; before shows the 15 px shift, after shows none.
   - Each touched screen against its PNG, scrollbars hidden as before: 104 and 104.1, 105 (also hovered and focused "Add Accounts" with its tooltip), 106 (history and "Remove"), 107, 109 (D2 open), 110, 110.1, 110.2, 111 (D6 open). Every difference listed: the decided ones (#132, #133, #134) and those earlier tasks listed, no other.
   - Saved to `.claude/tasks/evidence/032/`.
6. Manual browser checks with Playwright MCP on `npm run dev`: each of P1 to P3 and D1 to D6 opened and closed with the classic scrollbar, watching the header's right side; Balances and Account Details tabbed through, hovered, Escape on a shown tooltip; the accessibility snapshot showing each control's name, disabled state and "Not available". Then `npm run dev` stopped and its processes ended.
7. The final runs (T16) after the code review's fixes. Every "passes" claim backed by its command output.

## Human checkpoint (only if Gate: human)
- #134 as answered (a1, b1, c1): the two colour tokens and their ratios as built; the thumb hidden while open; Account Details' "Remove" disabled like Balances'.
- Item 1: the cause as found on the app (the Log's numbers); the one rule in `AppShell.module.css`; the nine popups and dropdowns covered; how the spec gets a classic scrollbar; before-and-after captures.
- Item 2: the colours on Overview, Transactions and Account Details; the Expenses card items unchanged.
- Item 3: the disabled controls on Balances (and Account Details), the "Not available" tooltip's look (not designed), the gray "Remove", the seven new Tab stops on Balances; the old tests' assertions replaced, each listed.
- The visual differences listed; no Figma calls.

## Log
<!-- Claude appends: date, what was done, decisions, issues, validation results, review findings -->
- 2026-11-08: Detailed from INDEX row 032 and Marko's notes. Recorded #132 and #133 (closed, Marko, task 031 gate). Raised #134 (open): (a) no existing colour token reaches 4.5:1 on white (Special/Green 2.74:1, Special/Red 4.13:1), proposed two new tokens at 4.51:1; (b) the scrollbar's thumb while a popup or dropdown is open, proposed hidden (nothing moves); (c) Account Details' "Remove", proposed the same rule. Facts 1 and 2 measured on a static page in Playwright's Chromium (working files in the scratchpad, removed); no Figma calls.
- 2026-11-08: #134 answered by Marko, all as proposed: (a) a1, `--color-income` `#3A8553` and `--color-expense` `#DD3817` (4.51:1 each); (b) b1; (c) c1. Recorded in `docs/decisions.md` (closed); References, Scope and the Human checkpoint now cite the answers. The task file approved as written. Counted as 1 human intervention. Build not started.

## Metrics
- Started:
- Finished:
- Human interventions: 1
- Rework loops: 0
- Notes on prompts that failed:
