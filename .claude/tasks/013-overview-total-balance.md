# Task 013: Overview: page grid and Total Balance

- Status: todo
- Gate: human
- Depends on: 004, 008, 011
- Size: L
- Skills: `superpowers:test-driven-development`, `superpowers:verification-before-completion`, `superpowers:requesting-code-review`, `security-review` (money and user scoping: balances calculated in the backend from the signed-in user's own data only, full account numbers never leave the backend, a new signed-in endpoint with the time zone header as input: run it on the task's changes and fix every finding before the gate), `frontend-design:frontend-design` (undesigned states only: the Total Balance loading skeleton, its "No accounts yet" message and its error state, the focus rings on "All Accounts", Previous and Next)

## Goal
Overview shows its full-width page grid (#94) with all six sections where 104 places them, and the Total Balance card with the signed-in user's own data: the total of their account balances, calculated in the backend (opening balance plus Complete transactions dated up to today), and a carousel with one teal card per account (type, masked number, card network logo, balance) under Previous, one dot per account and Next. The other five cards stay empty until tasks 014 to 018.

## References
- Spec: `docs/spec/stories.md` US-05 (all 9 criteria and its States); `docs/spec/brief.md` Layout (app screens); `docs/spec/demo-data.md` Accounts (order, card networks, numbers, opening balances) and "What a first login shows" (Total Balance $130,254.67: Credit Card $21,019.18, Checking $33,362.48, Savings $27,356.80, Investment $29,503.00, Loan $19,013.21).
- Figma (budget 0, no MCP calls: PNGs only): 104. Overview `66:4732`: top content row `407:5632`; Total Balance `405:5461` with the teal card `405:5469` (Figma frame `Account type`, not the `Account Type` component), the round arrow `405:5479` (`Frame 40276`), the control `405:5480` (`Slider option`) and `Mastercard` `408:5979`; Goals `405:5491`; Upcoming Bill `405:5530`; Recent Transaction `66:4747`; Statistics `66:4933`; Expenses Breakdown `66:4999`. PNG `docs/figma/104. Overview.png`. The VISA logo: `Visacard` `410:5467`, seen in `docs/figma/105. Balances.png` (on a white card).
- Measured on 104 at 2x and halved (Log, detailing): columns x 304–656, 680–1032, 1056–1408; top row cards y 144–376 (232 high); Recent Transaction card y 448–990 (542); Statistics card y 448–706 (258, built as 260 by #93); Expenses Breakdown card y 778–990 (212). Gaps: `--space-card-gap` 24 between columns, `--space-card-row-gap` 32 from a card to the next section title, `--space-section-title-gap` 8 from a title to its card.
- Components (`docs/figma/components.md`): `Section`, `Card`, `DataState`, `Skeleton` (task 004); `ChevronRight`, `ArrowUpRight` icons and `mastercardUrl`, `visacardUrl` brand logos (task 000, `<img>` with their own colors); `AppShell` (task 011). Paths: `paths.overview`, `paths.balances`, `paths.bills`, `paths.transactions` (`@finebank/shared`). Contract: `moneySchema`, `accountTypeSchema`, `cardNetworkSchema` (tasks 000, 008). Backend: `BANK_DATA_PROVIDER` `listAccounts`, `VisibleTransactions.list` (task 008), `@CurrentUser()` (task 007), `@TimeZone()` (task 000). Shared: `formatMoney` (task 001).
- Decisions: `docs/decisions.md` #6 (loading, empty, error), #11 (integer cents, `$25,056.00` everywhere), #12 (demo numbers differ from Figma), #17 (Total Balance, one slide per account, dots follow the accounts, Previous and Next disabled at the ends, "All Accounts" to Balances, round arrow visual only), #22 and #23 (no add or remove), #24 (card network optional, logo only when set, accounts oldest first), #25 (backend masks, `**** **** **** 2598`, never the full number), #26 (Account Type values), #39 and #46 (own data only), #53 (entries dated after today not counted), #54 and #80 (today in the browser's zone, `Clock`), #57 (balance = opening + Complete transactions), #74 (shared contract), #75 (session guard), #77 (`BankDataProvider`, calculations in app services), #87 (teal `:focus-visible` ring), #88 (error text), #89 (a failed refetch keeps the data), #93 (Statistics card 260 high), #94 (full width, columns grow, gaps as tokens), #96 (currency `USD` added in responses), #101 (classic scrollbar gutter), #105 (the five unbuilt cards as titled empty cards, every Overview card at its 104 height as a minimum; "No accounts yet" in place of the whole Total Balance content).

## Scope
- **Shared** (`@finebank/shared`):
  - `shared/src/contract/account.ts` (existing file, one per resource):
    - `accountSummarySchema`: `{ id, accountType, cardNetwork, maskedNumber, balance }`: `id` a positive integer; `accountType` from `accountTypeSchema`; `cardNetwork` from `cardNetworkSchema` or `null` (#24); `maskedNumber` matching `**** **** **** dddd` exactly (#25); `balance` a `moneySchema` (#11, #96).
    - `accountsResponseSchema`: `{ totalBalance, accounts }`, `totalBalance` a `moneySchema`, `accounts` oldest first (#24).
    - `accountsContract.list`: `GET /accounts`, no body. Exported through the contract index (#74). Task 019 extends the account shape (Bank Name) for Balances.
  - `shared/src/format/account.ts`: `accountTypeLabel(type)` gives Credit Card, Checking, Savings, Investment, Loan (#26). Exported from the format index.
- **Backend** (`backend/src/accounts/`, an `AccountsModule` registered in `AppModule`, importing `BankDataModule`):
  - `mask-account-number.ts`: `maskAccountNumber(account)` gives `**** **** **** ` and the last 4 digits of the stored number (#25). The one reader of `accountNumber` outside `bank-data/` and `demo/`: `backend/test/bank-data-source.test.ts` allows exactly this file, and still flags any other.
  - `accounts.service.ts`: `AccountsService.summary(userId, timeZone)`:
    - accounts from `BANK_DATA_PROVIDER` `listAccounts(userId)`, in its order (oldest first, #24);
    - transactions only through `VisibleTransactions.list(userId, timeZone)` (#53), never the provider's `listTransactions` (the task 008 source guard);
    - each balance: the opening balance plus the account's Complete transactions, income added and expense subtracted, in integer cents (#11, #57); Pending and Failed rows never count;
    - `totalBalance`: the sum of the balances (#17); 0 cents with no accounts;
    - every sum checked with `Number.isSafeInteger`; an unsafe one throws (a 500), never a wrong amount;
    - the response holds only the contract fields: never the full number, the opening balance, the bank name or a transaction.
  - `accounts.controller.ts`: `AccountsController`, `GET /api/accounts` from `accountsContract.list.path`, the user from `@CurrentUser()` (#39, #75), the zone from `@TimeZone()` (400 when missing or not a zone). Behind the global `SessionGuard`: signed out, 401. Responds with `accountsResponseSchema`, currency `USD` on every amount (#96).
- **Frontend**:
  - `frontend/src/api/accounts.ts`: `useAccounts()`, a query on `accountsContract.list` under the key `['accounts']`. The app's query defaults apply: refetch on window focus, 3 retries; removed with every cached query when a session starts or ends (`setSessionUser`, #39).
  - `frontend/src/app/pages/OverviewPage.tsx` and `.module.css`, the `paths.overview` route element in `routes.tsx` (the other app pages keep `element: null`):
    - The page grid (#94, tokens only): three equal columns, `repeat(3, minmax(0, 1fr))`, `--space-card-gap` between them, `--space-card-row-gap` between rows. Areas as in 104: row 1 Total Balance, Goals, Upcoming Bill; on the left Recent Transaction over rows 2 and 3; on the right, over columns 2 and 3, Statistics (row 2) and Expenses Breakdown (row 3). Recent Transaction's card stretches to the bottom of Expenses Breakdown's. The grid fills the content area at any width; no fixed or maximum width. At 1440 (no gutter) the columns are 352 wide at x 304, 680 and 1056, as in 104.
    - Six `Section`s with `gap="sm"` (#94, #105 a): "Total Balance"; "Goals"; "Upcoming Bill" with "View All" to Bills (#48); "Recent Transaction" with "View All" to Transactions (#49); "Statistics"; "Expenses Breakdown" with the note "*Compare to last month". Each holds a `Card`; only Total Balance's has content.
    - Card heights per #105 (a): each Overview card keeps its 104 height as a minimum in every state, size tokens measured on 104: the top row 232, Statistics 260 (#93), Expenses Breakdown 212, added to `tokens.md` and `tokens.css` with their source. Row 1 cards share the row's height.
  - Components in `frontend/src/components/<CodeName>/` (tokens only, values measured on 104 at 2x and halved, #65), with Code-only rows in `docs/figma/components.md`:
    - `TotalBalance`: the card content, from `accountsResponseSchema` data, as drawn in 104 (Figma `405:5461`):
      - The header row: the total, `formatMoney(totalBalance)` (`$130,254.67`; Figma's `$240,399` predates #11), and on the right "All Accounts", a `Link` to `paths.balances` (#17); then the divider line.
      - The slide: `AccountTypeSlide` for the shown account.
      - Below it: `SliderOption`.
      - It starts at the first account every time it mounts. When new data has fewer accounts, the position moves to the last one.
    - `AccountTypeSlide` (Figma frame `Account type` `405:5469`; the code name adds the purpose, since the `Account Type` component, `AccountType`, is the Balances card, #36): the teal card, `--radius-account-card`:
      - "Account Type", then `accountTypeLabel(accountType)`, then `maskedNumber` as given by the backend;
      - at the top right the card network logo, only when `cardNetwork` is set (#24): `mastercardUrl` for Mastercard, as drawn; `visacardUrl` for VISA (not drawn on a teal card: the exported asset in the same 48x32 box, at the same place), each an `<img>` named "Mastercard" or "VISA";
      - `formatMoney(balance)` (`$21,019.18`; Figma's `$25000` predates #11), and the round arrow: `ArrowUpRight` in a white circle (Figma `Frame 40276`, 24x24), visual only (#17): no button, not focusable, `aria-hidden`.
      - The slide is a group named "Account 1 of 5" (the position and count), inside a polite live region, so a screen reader hears the new account after Previous or Next.
      - Wider screens (#94): the card stretches with the column; its height and the logo, arrow and text sizes stay.
    - `SliderOption` (Figma frame `Slider option` `405:5480`): "Previous" with a left chevron (`ChevronRight` mirrored), one dot per account, "Next" with `ChevronRight` (#17):
      - Previous and Next are `<button>`s. At the first account Previous is disabled, at the last Next is; with one account both are. Disabled is `aria-disabled="true"` with the click ignored, so a button keeps keyboard focus when it becomes disabled under it (as `ButtonPrimary` and `Logout` do, tasks 009, 011), and the muted gray of 104's Previous, which Next takes too (US-05 criteria 4 and 7). Enabled: the dark text of 104's Next.
      - The active dot is teal, the others gray, as drawn; the dots are visual only (no click, `aria-hidden`): the slide's name carries the position.
      - Focus ring (#87) on Previous and Next; no hover style (not designed).
      - Wider screens: Previous at the left, the dots centered, Next at the right edge of the card content.
    - `TotalBalanceSkeleton`: the loading skeleton for `DataState` (#6, frontend-design, tokens only): lines for the total and "All Accounts", a block in the teal card's box, a line for the control, inside the card's 232 minimum.
  - Total Balance states through `DataState` (#6, #88, #89): the skeleton while loading; "Something went wrong." above Retry when the first load fails; a failed background refetch keeps the data shown; with no accounts, the empty message "No accounts yet" in place of all the card's content (#105 b). "All Accounts" shows with the data, inside `DataState`.
  - `frontend/test/support/app.tsx`: an `accounts` handler (the demo accounts, Total $130,254.67) in the signed-in defaults, so every test that opens Overview has an answer.
- **Tests** in `shared/test/`, `backend/test/` (Vitest, Supertest, the real SQLite test database with seeded users), `frontend/test/` (Vitest, Testing Library, MSW) and `e2e/tests/overview-total-balance.spec.ts` (Playwright, real stack, `FIXED_NOW` 2026-10-22T10:00:00Z, Europe/Belgrade, users from `e2e/helpers.ts`).
- **Existing tests changed by this task's Scope** (none weakened): task 011's shell tests that expect an empty content area and no `img` on every app page (`frontend/test/app/app-shell.test.tsx` T4, `e2e/tests/app-shell-slice.spec.ts` T15) keep both checks for the other app pages; on Overview they check the avatar inside the sidebar (the Mastercard logo is an `img`) and that `main` holds the six sections. `bank-data-source.test.ts` allows `accounts/mask-account-number.ts` only.

## Out of scope
- The content, data, skeletons and states of Goals (task 014), Upcoming Bill (015), Recent Transaction (016), Statistics (017) and Expenses Breakdown (018). Their cards stay empty here.
- Balances (task 019): its account list, Bank Names, "Details", Add and Edit Accounts. Account Details (tasks 021, 022).
- Any action on the round arrow (#17); the dots as controls; swiping, arrow keys, auto-rotation or a slide animation (none designed).
- The bottom inset under the content (task 003: owned by the first screen whose content scrolls; Overview fits 1440x1024, its cards end at y 992).
- Changes to `BankDataProvider`, `VisibleTransactions`, the data model, the demo dataset or the shell.
- Mobile (#4).

## Acceptance criteria
1. Given a user signed up at the fixed clock (2026-10-22T10:00:00Z, Europe/Belgrade), when Overview opens, then the Total Balance card shows `$130,254.67` and "All Accounts", and the first slide shows "Account Type", "Credit Card", `**** **** **** 2598`, the Mastercard logo, `$21,019.18` and the round arrow (US-05 criteria 1 and 2; #11, #17, #57; `demo-data.md`).
2. Given the same user, when I click Next four times, then the slides show, in order: Checking `**** **** **** 7310` with the VISA logo and `$33,362.48`; Savings `**** **** **** 4421`, no logo, `$27,356.80`; Investment `**** **** **** 6652`, no logo, `$29,503.00`; Loan `**** **** **** 9083`, no logo, `$19,013.21`. The total stays `$130,254.67` (US-05 criteria 2 and 5; #24, #25).
3. Given the control, then it shows "Previous" with a left chevron, 5 dots and "Next" with a right chevron. On the first account Previous is disabled and muted gray and the first dot is teal; on the last account Next is disabled and muted and the fifth dot is teal; in between both work. A click on a disabled button changes nothing. The dot count follows the accounts: 5, not Figma's 3; with 1 account, 1 dot and both buttons disabled (US-05 criteria 3, 4, 6 and 7; #17).
4. Given keyboard use, then Tab reaches "All Accounts", Previous (when enabled, and also when disabled) and Next, each with the teal 2px ring at a 2px offset, and a mouse click shows no ring. Enter or Space on Next shows the next account; when Next becomes disabled under focus, focus stays on it. The dots and the round arrow are not focusable. A screen reader hears "Account 2 of 5" and the new account after Next (#87).
5. Given I click "All Accounts", then Balances opens without a full page load, with Balances Active in the sidebar (US-05 criterion 8; #17).
6. Given I click the round arrow, then nothing happens: it is no button or link, the URL and the slide stay (US-05 criterion 9; #17).
7. Given `GET /api/accounts` with a session and a valid `X-Time-Zone`, then it answers 200 with `accountsResponseSchema`: `totalBalance` and every `balance` as `{ cents, currency: "USD" }` in integer cents, the 5 accounts oldest first with `id`, `accountType`, `cardNetwork` (Mastercard, VISA, then `null` three times) and `maskedNumber`. Without a session, 401; without the header or with one that is not a zone, 400 in the shared error shape. The schema and path exist once, in `shared/src/contract/account.ts` (#11, #54, #74, #75, #96).
8. Given any `GET /api/accounts` response, then it contains none of the user's full account numbers, nor more than their last 4 digits (no 12-digit prefix, no number without spaces), no opening balance, Bank Name or transaction. Outside `bank-data/` and `demo/`, only `accounts/mask-account-number.ts` reads `accountNumber` (#25; task 008 AC12).
9. Given an account, then its balance is the opening balance plus its Complete transactions dated up to today in my zone, income added and expense subtracted: Pending and Failed transactions never count, nor do transactions of other accounts or dated after today. Given the backend clock at 2026-10-22T21:59:00Z in Europe/Belgrade, then the total is `$130,254.67`; at 22:01:00Z (23 Oct in Belgrade) it is `$130,239.89` and Credit Card `$21,004.40` (the Biriyani of 23 Oct, `$14.78`, counts); in America/New_York at 22:01:00Z it is still `$130,254.67` (#53, #54, #57, #80).
10. Given two users, when one user's data changes (a transaction added to their Credit Card), then the other's `GET /api/accounts` is unchanged and lists only their own account IDs; no request parameter selects another user (#39, #46).
11. Given the backend reads transactions, then it reads them only through `VisibleTransactions.list` (the task 008 source guard passes, now with `accounts/`), and the balances are calculated only in the backend: the frontend formats the cents it gets and adds nothing (#11, #53, #77).
12. Given the accounts request is still running, then the Total Balance card shows its skeleton (`aria-busy`) at its minimum height. Given it fails after its retries, then "Something went wrong." and Retry show in the card, the rest of the page keeps working, and Retry loads the data. Given data is shown and a later refetch fails, then the data stays with no message. Given no accounts, then "No accounts yet" shows in the card instead of its content (#6, #88, #89, #105 b).
13. Given Overview at 1440x1024, then the six sections show where 104 places them: titles "Total Balance", "Goals", "Upcoming Bill" (with "View All" to `/bills`), "Recent Transaction" (with "View All" to `/transactions`), "Statistics", "Expenses Breakdown" (with "*Compare to last month"); the columns x 304–656, 680–1032 and 1056–1408 (no gutter); the top row cards y 144–376; Recent Transaction's card from y 448 to the bottom of Expenses Breakdown's; Statistics' card 260 high; Expenses Breakdown's card 212 high, under its title. The five cards other than Total Balance are empty. Each "View All" opens its page in the shell (#48, #49, #93, #105 a).
14. Given Overview at 1920x1080 and at 2560x1440, then the grid fills the content area: three equal columns from x 304 to 32 from the page's right edge, gaps of 24 between columns and 32 between rows, Statistics and Expenses Breakdown over columns 2 and 3; the teal card and the control stretch with the Total Balance card (Previous at its left, Next at its right) while their heights and the card heights stay. At 1280x1024 the same, with no horizontal scroll. With a classic scrollbar every x is measured from the page's right edge (window minus the gutter, #101) (#94).
15. Given Overview at 1440x1024, then the Total Balance card matches the PNG (`docs/figma/104. Overview.png`) with the differences listed in Validation step 4.

## Test scenarios
| ID | Type | Scenario | Expected | Covers AC |
|----|------|----------|----------|-----------|
| T1 | unit | `maskAccountNumber` on the 5 demo numbers and on a number given with spaces | `**** **** **** 2598`, `7310`, `4421`, `6652`, `9083`; the result never holds more than the last 4 digits | 8 |
| T2 | unit | `AccountsService.summary` with a fake provider and a fake `VisibleTransactions`: Complete income and expense, Pending and Failed rows, two accounts, no transactions, no accounts, a sum past `Number.MAX_SAFE_INTEGER` | Opening + Complete income − Complete expense per account; Pending and Failed ignored; the total the sum; 0 cents with no accounts; throws on the unsafe sum; `VisibleTransactions.list` called with the user and zone, the provider's `listTransactions` never | 9, 11 |
| T3 | unit | `GET /api/accounts` on a seeded user at the fixed clock (Belgrade); without a session; without `X-Time-Zone`; with `+01:00` and `Mars/Base` | 200 parsing with `accountsResponseSchema`: $130,254.67 and the 5 balances, order, networks and masks of AC1 and AC2; 401; 400 three times in the shared error shape | 1, 2, 7 |
| T4 | unit | The T3 body searched for each full number, each 12-digit prefix, the numbers with spaces, `openingBalance`, the Bank Names and a receipt ID | None found; only the contract's keys present | 8 |
| T5 | unit | Clock at 2026-10-22T21:59:00Z and 22:01:00Z, Belgrade and America/New_York | $130,254.67; $130,239.89 with Credit Card $21,004.40; $130,254.67 in New York | 9 |
| T6 | unit | Two seeded users; add a Complete expense to the second user's Credit Card through the repository | The first user's body unchanged and holding only their 5 IDs; the second's total lower by that amount | 10 |
| T7 | unit | `bank-data-source.test.ts` and `no-direct-time.test.ts` over `backend/src` with `accounts/`; the controller's path read from `accountsContract.list` | Pass: `accountNumber` only in `bank-data/`, `demo/` and `accounts/mask-account-number.ts`; `listTransactions` only in `bank-data/` and `demo/`; no system time | 8, 11 |
| T8 | unit | `accountSummarySchema` and `accountsResponseSchema` on valid and invalid bodies (a float, a negative id, a number not masked, a full number, `cardNetwork` missing); `accountTypeLabel` on the 5 types | Valid ones parse, invalid ones fail; Credit Card, Checking, Savings, Investment, Loan | 7, 8 |
| T9 | unit | Render Overview signed in (MSW `accounts` with the demo values) | The total `$130,254.67`, "All Accounts" linking to `/balances`, slide 1 per AC1 with an `img` named "Mastercard", "Account 1 of 5" | 1 |
| T10 | unit | Click Next four times, then Previous; click the disabled Previous at the start and the disabled Next at the end; a 1-account answer | The slides of AC2 in order with VISA only on Checking; the active dot moves; disabled clicks change nothing; `aria-disabled` and the muted class on the disabled button, focus kept; 1 dot and both disabled with 1 account | 2, 3, 4 |
| T11 | unit | Keyboard: Tab order, Enter and Space on Next, focus when Next becomes disabled; the round arrow and dots | Order "All Accounts", Previous, Next; the live region names "Account 2 of 5"; focus stays on the disabled Next; no tab stop on the arrow or dots, both `aria-hidden` | 4, 6 |
| T12 | unit | MSW `accounts` pending; 500 on every try, then 200 after Retry; 200 then 500 on the next focus; 200 with no accounts | Skeleton with `aria-busy`; "Something went wrong." and Retry, then the data; the data kept after the failed refetch; "No accounts yet" with no total, link or control | 12 |
| T13 | unit | Render Overview; the frontend source of `TotalBalance` and `OverviewPage` | Six `region`s named by their titles in 104's order, "View All" on Upcoming Bill (`/bills`) and Recent Transaction (`/transactions`), the note on Expenses Breakdown; no arithmetic on cents (only `formatMoney` of the given amounts) | 11, 13 |
| T14 | unit | Token guards: `tokens.test.ts` with the new size tokens; Stylelint over the new CSS; the component name guard with the new Code-only rows | Pass | 13, 14 |
| T15 | e2e | Sign up (`signUp(page.request)`), open Overview at the fixed clock; click Next four times, then Previous | AC1 values on slide 1; AC2 values per slide; the Mastercard and VISA logos only where set; the total unchanged; Previous and Next disabled at the ends | 1, 2, 3 |
| T16 | e2e | Record requests while Overview loads; read `GET /api/accounts` | Its `X-Time-Zone` is Europe/Belgrade; the body holds integer cents with `USD` and none of the 5 full numbers or 12-digit prefixes | 7, 8 |
| T17 | e2e | Move the backend clock to 2026-10-22T22:01:00Z (`/api/test/clock`) and reload, in Belgrade and in New York | `$130,239.89` with Credit Card `$21,004.40`; `$130,254.67` in New York | 9 |
| T18 | e2e | Tab through the Total Balance card; Enter on Next until the end; a mouse click on Next; click the round arrow; click "All Accounts" | Rings per AC4, focus kept on the disabled Next, no ring after the click; the arrow click changes nothing; `/balances` with no `load` event and Balances Active | 4, 5, 6 |
| T19 | e2e | `page.route` holds `/api/accounts`, then answers 500 to every try, then lets Retry through | The skeleton in the card, the other sections in place; the error state; after Retry the data | 12 |
| T20 | e2e | Overview at 1440x1024, 1920x1080, 2560x1440, 1280x1024: the boxes of the six sections and cards, the teal card and the control | AC13 positions at 1440 (from the page's right edge with a gutter, #101); AC14 columns, gaps and spans at every size; no horizontal scroll at 1280; the teal card's width follows the column and its height stays | 13, 14 |
| T21 | e2e | Click each "View All" | `/bills` and `/transactions` in the shell, no full page load | 13 |

## Validation steps (in this order, stop on first failure)
1. Lint + typecheck pass (`npm run lint`, `npm run typecheck`).
2. Unit tests pass (`npm test`).
3. E2E tests pass (`npm run e2e`). Ports 3000 and 5173 free first.
4. Visual: Playwright MCP screenshot of `/overview` at 1440x1024 (device scale 2, scrollbars hidden, as in tasks 003 and 011), signed up at the fixed clock on the demo data, compared with `docs/figma/104. Overview.png`: the Total Balance card in detail (total row, divider, teal card, logo, round arrow, control), the section titles and card boxes of the grid, the empty cards. Also slide 2 (VISA on teal) and the last slide (Next disabled), as evidence only (not drawn). Expected differences: the amounts (`$130,254.67` and `$21,019.18` against `$240,399` and `$25000`: demo numbers #12 and the format #11), 5 dots against 3 (#17), the five empty cards (#105 a), the Statistics card 2px taller and the Expenses Breakdown section 2px lower (#93), the header date and avatar and the page tone (task 011), the 15px gutter shift with classic scrollbars (#101). Also, as evidence only: `/overview` at 1920x1080 and 1280x1024 (#94), the skeleton, the error state and "No accounts yet" (MSW or `page.route`). Save to `.claude/tasks/evidence/013/` and list every difference.
5. Manual browser checks with Playwright MCP on `npm run dev` (headed Chromium on Windows, with classic scrollbars):
   - Sign up, land on Overview; read the total and every slide; Previous and Next to both ends, with the mouse and the keyboard.
   - "All Accounts", each "View All", the round arrow.
   - Resize to 1920, 1280 and back to 1440.
   - Stop the backend and reload: the skeleton, then the error state; start it and Retry. With data shown, stop it and refocus the window: the data stays.

## Human checkpoint (only if Gate: human)
- The Total Balance card matches 104 at 1440x1024 with the listed differences; the VISA logo on the teal card (not drawn).
- The carousel: slides in account order, dots per account, Previous and Next disabled and muted at the ends, keyboard focus and screen reader names.
- #94 as built for the grid: 1920 and 1280 wide, the teal card and the control stretching.
- #105 as applied: the five empty sections with titles, links and note, the card heights; the "No accounts yet" state.
- The undesigned states: the skeleton, the error state, the focus rings.
- Choices made at detailing (accepted by Marko, 2026-10-26, with the task file):
  - one endpoint, `GET /api/accounts` `{ totalBalance, accounts: [{ id, accountType, cardNetwork, maskedNumber, balance }] }`, which task 019 extends with the Bank Name;
  - balances from one `VisibleTransactions.list` call per request, summed per account in `AccountsService`;
  - `maskAccountNumber` in `backend/src/accounts/`, the one reader of `accountNumber` outside `bank-data/` and `demo/`;
  - `accountTypeLabel` in `shared/src/format/`;
  - the code names `TotalBalance`, `AccountTypeSlide`, `SliderOption` and `TotalBalanceSkeleton`;
  - disabled Previous and Next as `aria-disabled` (focus kept); the dots and the round arrow visual only; no slide animation; the carousel starts at the first account on every visit;
  - "All Accounts" inside the data state (not shown while loading or failed);
  - the "View All" links of Upcoming Bill and Recent Transaction built here with the grid (#105 a).
- The security review findings and their fixes.

## Log
<!-- Claude appends: date, what was done, decisions, issues, validation results, review findings -->

### 2026-10-26, detailing (`/next-task 013`)
- Detailed from the outline row with Marko's notes: the first screen with real data; the page grid per #94 with all Overview cards laid out, the other widgets' contents left to tasks 014 to 018; Total Balance per #17 and US-05; balances per #57 only through `VisibleTransactions` (#53); numbers masked in the backend (#25); integer cents with `USD` (#11, #96) in the shared contract (#74), user-scoped (#39); states through `DataState` (#6, #89); card network logos per #24; the first-login total $130,254.67 at the fixed e2e clock; the visual check against 104; `security-review` in Skills.
- Read before detailing: US-05, `demo-data.md`, the decisions cited, `components.md`, `inventory.md`, `tokens.md`, the PNGs 104 and 105, tasks 004, 008 and 011, the shared contract, `BankDataProvider`, `VisibleTransactions`, the source guard `bank-data-source.test.ts` (it already expects task 013's masking function as the one other reader of `accountNumber`), `Section`, `Card`, `DataState`, `routes.tsx`, the brand logos (both 48x32 exports), the task 011 tests that expect an empty content area.
- Measured on 104 (2x, halved), white card edges: columns x 304–656, 680–1032, 1056–1408; top row cards y 144–376; Recent Transaction y 448–990; Statistics y 448–706; Expenses Breakdown y 778–990.
- Checked in `backend/src/demo/demo-dataset.json`: the only transaction dated 23 Oct 2026 is the Complete Biriyani on Credit Card, 1478 cents, so the AC9 values after midnight in Belgrade are $130,254.67 − $14.78.
- Raised **#105 (open)** in `docs/decisions.md`: (a) what the five unbuilt cards show in this task and how high the Overview cards are; (b) the text and extent of the "no accounts" state. The decisions header now also records questions 104 and 105.
- INDEX: row 013 cites the decisions this file uses; the open questions line lists #105.
- Not started. No Figma calls.

### 2026-10-26, #105 closed
- Marko's answers, recorded in `docs/decisions.md` #105 (closed, Marko, 2026-10-26): (a) as proposed: the five unbuilt sections show their titles, links and note over empty cards, and every Overview card keeps its 104 height as a minimum in every state (232 top row, 260 Statistics, 212 Expenses Breakdown); (b) as proposed: "No accounts yet" in place of all of the Total Balance card's content. The task file is approved as written, with the choices in its Human checkpoint.
- Updated: References (#105 closed), Scope (the "as proposed" notes dropped), Human checkpoint (the choices accepted).
- INDEX: row 013 cites #105 as closed; no open questions remain.
- Not started: Marko asked for the detailing commit only. No Figma calls.

## Metrics
- Started:
- Finished:
- Human interventions: 0
- Rework loops: 0
- Notes on prompts that failed:
