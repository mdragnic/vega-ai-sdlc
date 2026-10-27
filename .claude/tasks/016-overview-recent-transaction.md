# Task 016: Overview: Recent Transaction

- Status: done
- Gate: human
- Depends on: 004, 013
- Size: M
- Skills: `superpowers:test-driven-development`, `superpowers:verification-before-completion`, `superpowers:requesting-code-review`, `security-review` (a new user-scoped `GET` of transaction data: the user from the session only, transactions only through `VisibleTransactions`, today from `Clock` and `X-Time-Zone`, money in integer cents with `USD`, only the contract's keys in the response: run it on the task's changes and fix every finding before the gate), `frontend-design:frontend-design` (undesigned states only: the Recent Transaction loading skeleton, its error state, the empty message, a tab with fewer than 5 rows and the wrapped row)

## Goal
The Overview Recent Transaction card shows the tabs All, Revenue and Expenses and, for the selected tab, the signed-in user's latest 5 transactions of that kind dated up to today in their time zone, newest first: each with its category icon, the item, the shop, the signed amount and the date. The rows come from a new read-only endpoint in the shared contract that applies every tab's filter in the backend, through `VisibleTransactions` only.

## References
- Spec: `docs/spec/stories.md` US-08 (all 6 criteria and its States); `docs/spec/brief.md` Layout (Overview: "Recent Transaction with All / Revenue / Expenses tabs, the latest 5 per tab, newest first"), Lists (#40), Navigation (#49); `docs/spec/demo-data.md` Transactions (the monthly template, the amounts per month, the Figma conflicts), "What a first login shows" (Recent Transaction (All): Jeans -$266.00 (22 Oct), Movie ticket -$17.64, Pizza -$24.64, Taxi fare -$10.64, Restaurant bill -$147.84), Review points 6 and 7.
- Figma (budget 0, no MCP calls: PNGs only): 104. Overview `66:4732`, Recent Transaction `66:4747`, the tabs `Menu Tab` `66:4755` (no component; `MenuTab`, task 004), the rows: component `Item` `407:5649` (303x88; code name `RecentTransactionItem`, `docs/figma/components.md`). PNG `docs/figma/104. Overview.png`.
- Measured at detailing (104 at 2x, halved, a Node script on the PNG in the session scratchpad; weights from the ink density against Chromium renders; text widths in headless Chromium with Inter Variable; approximate, the build measures exactly):
  - The card x 304–656, y 448–990 (352x542, stretched by the grid to the bottom of Expenses Breakdown, #105 a); its content 304 wide (x 328–632).
  - The tabs: `MenuTab` at the content's top-left, y 472–504 (32), "All" active (teal, underline x 328–364.5), Revenue and Expenses in Secondary.
  - The rows, from y 516 (12 under the tabs), one every 88: the icon tile x 328–368, y 540–580 (40x40, Gray/06 tile, Gray/01 glyph: `CategoryIcon variant="recent"`), 24 above and below it; the Gray/06 divider (1 px) at y 603, 691, 779 and 867, x 328–632, the 88th row of each row but the last, none under the last row. The last tile ends at y 932, 58 above the card's bottom (24, the card's 24 padding and 10 left over from the grid): the rows sit at the top.
  - The text column from x 384 (16 after the tile): the item, Semibold 16/24, Default Black `#191919` (line y 540–564; "GTR 5" 46.3 in Chromium, 45.5 ink on 104), and under it the shop, Regular 12/16, Gray/03 `#9F9F9F` (line y 564–580; "Gadget & Gear" 83.1, 83 on 104). The right column, right-aligned at x 632: the amount, Semibold 16/24, Secondary `#525256` ("$160.00" 63.3, 63 on 104), and under it the date, Regular 12/16, Gray/03 ("17 May 2023" 72.2, 71.5 on 104). Both columns are 40 high, the tile's height.
  - Figma's rows: GTR 5 / Gadget & Gear / $160.00 / 17 May 2023 (gamepad), Polo Shirt / XL fashions / $20.00 (shopping), Biriyani / Hajir Biriyani / $10.00 (food), Taxi Fare / Uber / $12.00 (transport), Keyboard / Gadget & Gear / $22.00 (shopping). No sign; the date without the comma.
  - With the demo data (#11, #12; Chromium widths): All at the fixed clock: "Jeans" / "Denim House" 76.1 next to `-$266.00` 73.6 over "22 Oct, 2026" 74.5; "Movie ticket" 94.3 next to "21 Oct, 2026" 72.0; "Restaurant bill" 110.6 next to "18 Oct, 2026" 72.1. Revenue: "Freelance payment" 147.7 next to `+$179.20` 72.4; "Design project" 112.2 next to `+$784.00` 76.3; "Dividend" / "AB Bank Ltd" 68.8 next to "15 Oct, 2026" 71.8. `-$1,000,000,000.00` is 158.0.
  - A row needs 40 + 16 + the text + a gap (16, as task 015's `-amount-gap`) + the right column: the widest demo rows about 292 (Freelance payment), 261 (Design project) and 255 (Restaurant bill). The content is 304 at 1440 (299 with a classic scrollbar, #101) and about 246 at 1280 (251 without one). So at 1440 every demo row is on one line, as drawn; at 1280 the Restaurant bill row wraps in All and Expenses, and the three Freelance payment rows and Design project in Revenue (#112).
- Components (`docs/figma/components.md`): `Section`, `Card`, `MenuTab` (with `menuTabId`), `CategoryIcon` (`recent`), `DataState`, `Skeleton` (task 004); `OverviewPage` and its grid, the Recent Transaction section with "View All" to Transactions (task 013). Shared: `moneySchema`, `transactionDirectionSchema`, `expenseCategorySchema` (tasks 000, 008), `formatSignedMoney`, `formatDate` with the browser's zone (task 001), `browserTimeZone()` (`frontend/src/api/client.ts`). Backend: `VisibleTransactions` and `BankDataModule` (task 008: newest first, `occurredAt` then `id` descending; hides entries dated after today in the zone), `@TimeZone()` (task 000), `@CurrentUser()` and the global `SessionGuard` (task 007). Frontend: `apiRequest`, the test support of tasks 009 to 015.
- Decisions: `docs/decisions.md` #6 (loading, empty, error; the empty message's own example "No transactions yet"), #11 (integer cents in the backend; `$160.00`; dates `17 May, 2023`; timestamps in UTC), #12 (one dataset; Transactions' values win; visual checks compare layout, not demo numbers), #19 (income or expense from the backend; `+$160.00` and `-$160.00`; colors as designed; the active Revenue and Expenses tabs in the All style), #27 (newest first; statuses), #36 (code names), #39 and #46 (own data only), #40 (5 rows per tab, newest first; each tab its own latest 5), #49 ("View All" opens Transactions), #53 (fixed dataset; entries dated after today not shown), #54 and #80 (today from the backend's `Clock` in the browser's zone; dates shown in the browser's zone), #56 (the row icon is the category icon; GTR 5 is Entertainment, a known difference; income has the wallet), #57 (all statuses listed), #65 (sizes measured from the PNGs, 4 px grid), #74 (one shared contract), #75 (session guard, scoping through `@CurrentUser()`), #77 (transactions only through the provider, read through `VisibleTransactions`), #87 (tab keyboard and focus ring, built in `MenuTab`), #88 ("Something went wrong."), #89 (a failed refetch keeps the data), #94 (full width; fixed-size parts keep their size), #96 (currency `USD` added in responses; the bill charges' Item), #101 (classic scrollbars), #105 a (Recent Transaction stretches to the bottom of Expenses Breakdown; the card's minimum in every state), #106, #108 b and #111 a (the wrap rule: nothing shrinks, is cut, hidden or overlaps; the right part moves under, right-aligned; the card grows), #107 (paging never moves the page), #112 (closed, Marko, 2026-10-27: (a) the #107 approach, the three tabs' lists in one grid cell, the tallest sets the card's height, switching tabs never moves the page, the hidden lists `visibility: hidden` and `aria-hidden`; added with the answer: the tab panel stays a Tab stop, `tabindex="0"` per the WAI-ARIA tabs pattern since the rows hold no focusable element, with the #87 ring on `:focus-visible` only).
- The wrap rule for this card (Marko's notes for task 016, after #106, #108 b and #111 a): long names and amounts are never cut, hidden or overlapping; where a row does not fit, it grows; when the list makes the card taller, grid rows 2 and 3 grow and Statistics and Expenses Breakdown stretch with them; no inner scroll.
- Transactions are account data: read only through `VisibleTransactions` (#53, #77), never `BANK_DATA_PROVIDER` directly; `bank-data-source.test.ts` keeps `listTransactions` inside `bank-data/` and `demo/`.

## Scope
Choices marked "(#112)" follow #112 (closed, Marko, 2026-10-27: (a) as proposed, with the tab panel as a Tab stop added with the answer). The rest follows the decisions above and Marko's notes for this task.

- **Shared** (`@finebank/shared`), `shared/src/contract/transaction.ts` (extended; the direction and status schemas stay):
  - `recentTransactionSchema`: `{ item, shopName, category, direction, occurredAt, amount }`: `item` and `shopName` strings, `category` `expenseCategorySchema` or `null`, `direction` `transactionDirectionSchema`, `occurredAt` a UTC timestamp (`z.iso.datetime()`, #11), `amount` `moneySchema` with `cents` 0 or more (the direction gives the sign, #19; `formatSignedMoney` rejects a negative amount). An expense has a category and income has none (#56): a refinement rejects either mismatch. No ID, account, receipt or status: no route takes a transaction (no row action is designed), and the Transactions page has its own endpoint (task 020).
  - `recentTransactionsResponseSchema`: `{ all, revenue, expenses }`, one list per tab, each at most 5, newest first (#19, #40).
  - `transactionsContract.recent`: `GET /transactions/recent`, no body. Task 020 adds the Transactions page's entry to this file.
- **Backend** (`backend/src/transactions/`, a `TransactionsModule` registered in `AppModule`, importing `BankDataModule`; no table, column or migration):
  - `transactions.service.ts`: `TransactionsService.recent(userId, timeZone)`: three reads through `VisibleTransactions.list(userId, timeZone, filter)`: `{ limit: 5 }`, `{ direction: 'income', limit: 5 }` and `{ direction: 'expense', limit: 5 }`. So nothing dated after today in the zone shows (#53, #54, #80), every status is listed (#57), and the order is the provider's: newest first, the same instant with the later stored first (#27, #40). Each row mapped to the contract's keys, the amount as `{ cents, currency: 'USD' }` (#11, #96), `occurredAt` as its ISO string.
  - `transactions.controller.ts`: `TransactionsController`, the path from `transactionsContract.recent`, the user from `@CurrentUser()` (#39, #75), the zone from `@TimeZone()` (400 when missing or not a zone). Behind the global `SessionGuard` (401 signed out). Responds 200 with `recentTransactionsResponseSchema`: only the contract's keys.
  - The user ID comes only from the session; nothing in a request names a user, an account or a transaction.
- **Frontend**:
  - `frontend/src/api/transactions.ts`: `useRecentTransactions()`, a query on `transactionsContract.recent` under `['transactions', 'recent']`, with the app's query defaults (refetch on window focus, 3 retries); removed with the other queries when a session starts or ends or the user changes (task 014's `clearUserData`, unchanged).
  - `OverviewPage`: the Recent Transaction card gets its content inside the existing section (title and "View All" unchanged), the card stretched to the bottom of Expenses Breakdown as now (#105 a): `RecentTransaction`.
  - Components in `frontend/src/components/<CodeName>/` (tokens only, values measured on 104 at 2x and halved, #65; new size and spacing tokens added to `tokens.md` and `tokens.css` with their source), with rows in `docs/figma/components.md` (Code-only, except `RecentTransactionItem`, which has its Figma row) and gallery sections:
    - `RecentTransaction` (Figma section `Recent Transaction` `66:4747`, no component): the card content.
      - `MenuTab` at the top, labelled "Recent Transaction", the tabs All (`all`), Revenue (`revenue`) and Expenses (`expenses`); All selected on every visit; the selected tab in the designed Active style, whichever it is (#19). The tabs show in every state: loading, error, empty and data.
      - Under them, 12 below as drawn, the `tabpanel` labelled by the selected tab (`menuTabId`), rendered by `RecentTransaction` (`MenuTab` unchanged). It is a Tab stop, `tabindex="0"`, per the WAI-ARIA tabs pattern, since the rows hold no focusable element (#112): Tab goes from the selected tab to the panel, then on to the next card; in the error state Retry follows the panel. Keyboard focus shows the #87 teal ring (`--border-width-focus-ring`, `--color-primary`, `--space-focus-ring-offset`) on `:focus-visible` only; a mouse click in the panel shows none. Inside it, `DataState` on `useRecentTransactions()`: `RecentTransactionSkeleton` while loading; "Something went wrong." above Retry when the first load fails; the data kept when a later refetch fails (#6, #88, #89); when every list is empty, "No transactions yet" (#6's own example).
      - The list of the selected tab's key in the response: the frontend selects the list by the tab and filters, sorts, counts and calculates nothing (#11, #19, #40). A tab whose list is empty, while another tab has rows, shows "No transactions yet" in the `DataState` empty-message style in its place.
      - The three tabs' heights (#112 a, as #107): the three lists (or a tab's empty message) are laid out in one grid cell inside the panel, so the card takes the tallest tab's height and switching tabs never moves the page; the inactive ones are `visibility: hidden` and `aria-hidden`. Pure CSS, no measuring in JavaScript.
      - The rows stay at the top of the card in a card the grid has made taller.
    - `RecentTransactionItem` (Figma component `Item` `407:5649`): one row as drawn in 104, an `li`:
      - `CategoryIcon variant="recent"` of the category, the wallet for income (#56), named by the category ("Entertainment", "Income"), since the row shows no category text.
      - The text column: the item (Semibold 16/24, Default Black) over the shop (Regular 12/16, Gray/03).
      - The right column, right-aligned: `formatSignedMoney(amount, direction)` (`+$179.20`, `-$266.00`; Semibold 16/24, Secondary for both directions, #19) over the date, a `time` element with the `occurredAt` value showing `formatDate(occurredAt, browserTimeZone())` (`22 Oct, 2026`, Regular 12/16, Gray/03; #11, #54).
      - The Gray/06 divider between rows, none under the last (US-08 criterion 4).
      - Wider columns (#94): the tile and the columns keep their sizes, the space between the text and the right column grows, the right column at the content's right edge.
      - Narrow columns, long items, shops and amounts (Marko's notes, after #106, #108 b and #111 a): nothing shrinks, is cut, hidden or overlaps. The tile and the text keep their line; where the text and the right column do not fit side by side, the right column moves under the text, right-aligned, 12 below (as #111 a); an item or a shop longer than the text column wraps inside it (long words break). The row grows, and the card with it; where the card's content is taller than grid rows 2 and 3, they grow and Statistics and Expenses Breakdown stretch to them. No inner scroll.
      - Nothing in a row is focusable or clickable, and there is no hover style (no row action is designed; general rule).
    - `RecentTransactionSkeleton`: the loading skeleton for `DataState` (#6, frontend-design, existing tokens only): five rows of a tile block, two lines on the left and two right-aligned lines, the divider between them, under the real tabs.
  - `frontend/test/support/app.tsx`: `recentTransactions` handlers (the demo: the three lists a first login gets at the fixed clock; all empty; Revenue empty only; fewer than 5; pending; failing), the demo answer in `signedInDefaults()`, so every test that opens Overview has an answer.
- **Tests** in `shared/test/`, `backend/test/` (Vitest, Supertest, the real SQLite test database with seeded users), `frontend/test/` (Vitest, Testing Library, MSW) and `e2e/tests/overview-recent-transaction.spec.ts` (Playwright, real stack, `FIXED_NOW` 2026-10-22T10:00:00Z, Europe/Belgrade, users from `e2e/helpers.ts`, the backend clock through `/api/test/clock`; a user signed up after the clock moves, so the session is valid at that clock; task 014 note).
- **Existing tests changed by this task's Scope** (none weakened): task 013's "cards still empty" check (`frontend/test/app/overview.test.tsx` T13) keeps Statistics and Expenses Breakdown and leaves Recent Transaction to this task's tests; `frontend/test/app/sign-up.test.tsx`, which lists the new session's cached queries exactly, adds `transactions recent`; `e2e/tests/overview-total-balance.spec.ts` T20 at 1280, where the demo rows wrap: Statistics and Expenses Breakdown at least 260 and 212, the two stretched by the same rows 2 and 3, Recent Transaction still ending with Expenses Breakdown (at 1440 and wider the 260 and 212 stay exact); the `openOverview` helpers wait for the transaction rows where a check depends on the layout. The Tab order before the tablist is unchanged.

## Out of scope
- The Transactions page (task 020): its list, its tabs, Load More, the receipt, the account type, the status column, its endpoint and the query parameters a contract entry would need for them.
- Any row action, click or hover (not designed).
- The content of Statistics (017) and Expenses Breakdown (018), and the chart inside a stretched Statistics card (017).
- Changes to `MenuTab`, `CategoryIcon`, `Section`, `Card`, `DataState`, `Skeleton`, `TotalBalance`, `Goals`, `UpcomingBill`, `VisibleTransactions`, `BankDataProvider`, the session and cache logic of tasks 009 to 015, the data model, the migrations or the demo dataset; any change to the shell.
- Mobile (#4).

## Acceptance criteria
1. Given a user signed up at the fixed clock (2026-10-22T10:00:00Z, Europe/Belgrade), when Overview opens, then the Recent Transaction card shows the tabs All, Revenue and Expenses, All active (teal text with the teal underline), and 5 rows, newest first: Jeans, Denim House, `-$266.00`, 22 Oct, 2026 (Shopping icon); Movie ticket, Inox, `-$17.64`, 21 Oct, 2026 (Entertainment); Pizza, Pizza Hit, `-$24.64`, 20 Oct, 2026 (Food); Taxi fare, Uber, `-$10.64`, 19 Oct, 2026 (Transportation); Restaurant bill, Spice Garden, `-$147.84`, 18 Oct, 2026 (Food); a divider between rows and none under the last. The title "Recent Transaction" and "View All" with the chevron stay (US-08 criteria 1 to 4; #11, #12, #19, #40, #56; `demo-data.md`).
2. Given I click Revenue, then it becomes active in the All style and All does not, and the rows are, newest first: Freelance payment, Bright Studio, `+$179.20`, 17 Oct, 2026; Dividend, AB Bank Ltd, `+$84.00`, 15 Oct, 2026; Freelance payment `+$179.20` 10 Oct, 2026; Freelance payment `+$179.20` 3 Oct, 2026; Design project, Acme Ltd., `+$784.00`, 1 Oct, 2026; each with the wallet icon. Given I click Expenses, then it becomes active and the rows are the 5 of AC1. Given All again, the rows of AC1 (US-08 criteria 2, 5; #19, #40, #56).
3. Given each tab, then its rows are the user's latest 5 of that kind (All any direction, Revenue income, Expenses expense) of any status, dated up to today in the user's zone, newest first, the same instant with the later stored first; a Failed or Pending transaction is listed like a Complete one. With fewer than 5, only those show (#27, #40, #53, #57).
4. Given the backend clock at 2026-10-23T22:30:00Z, then in Europe/Belgrade (24 Oct there) All shows Gift `-$21.28` and Freelance payment `+$179.20` (both 24 Oct, Gift first, stored later), Biriyani `-$14.78` (23 Oct), Jeans and Movie ticket, and Revenue starts with the Freelance payment of 24 Oct; in America/New_York (23 Oct there) All shows Biriyani, Jeans, Movie ticket, Pizza and Taxi fare, and Revenue starts with the Freelance payment of 17 Oct. Nothing dated after today in the zone shows; the backend reads "now" only from `Clock` (#53, #54, #80).
5. Given a transaction at 2026-10-22T23:30:00Z in the response, then its date shows 23 Oct, 2026 in a Belgrade browser and 22 Oct, 2026 in a New York browser (US-08 criterion 3; #11, #54).
6. Given every list empty (the backend clock at 2021-12-31T10:00:00Z, before the dataset), then the card shows the tabs and "No transactions yet" (#6) in place of the rows, at the card's height from the grid. Given only the selected tab's list empty (MSW), then that message in its place and the other tabs' rows when selected (US-08 States; #6, #105 a).
7. Given I click "View All", then Transactions opens (US-08 criterion 6; #49; built in task 013, kept).
8. Given `GET /api/transactions/recent` with a session and a valid `X-Time-Zone`, then it answers 200 with `recentTransactionsResponseSchema`: three lists of at most 5, newest first, timestamps in UTC, amounts in integer cents 0 or more with `USD`, the category `null` exactly for income; the body holds only the contract's keys (no ID, account, receipt, status or user ID). Without a session, 401; without the header or with one that is not a zone, 400 in the shared error shape (#11, #19, #54, #74, #75, #96).
9. Given two users, when one user's transactions change in the database, then the other's answer is as before; a `userId` or `accountId` in the query changes nothing; no route takes a user, account or transaction ID (#39, #46).
10. Given the backend source, then the transactions module reads transactions only through `VisibleTransactions` and "now" only from `Clock`; the source guards pass with `transactions/` scanned (#53, #77, #80).
11. Given the request is still running, then the tabs show and the panel shows the skeleton (`aria-busy`), the card at its grid height. Given it fails after its retries, then "Something went wrong." and Retry show in the panel, the rest of the page keeps working, and Retry loads the rows. Given the rows are shown and a later refetch fails, then they stay with no message (#6, #88, #89, #105 a).
12. Given the card, then the frontend shows the list of the selected tab's key as sent, formats the cents with `formatSignedMoney` and the dates with `formatDate` in the browser's zone, and filters, sorts, counts or calculates nothing (#11, #19, #40, #74).
13. Given the keyboard and a screen reader, then the tabs are a tablist named "Recent Transaction" with one tab stop: Tab goes from Recent Transaction's "View All" to the selected tab, then to the panel (`tabindex="0"`), then to the next card's first focusable element (Statistics and Expenses Breakdown hold none until tasks 017 and 018, so focus leaves the page's content), and Shift+Tab goes back the same way; inside the tablist Left and Right (wrapping), Home and End select and activate. The teal ring (#87) shows on the selected tab and on the panel with keyboard focus only; a mouse click on a tab or in the panel shows none. The panel is a tabpanel named by the selected tab; the rows are a list of 5 items, each icon an image named by its category ("Income" for the wallet), each date a `time` element with the `occurredAt` value; the hidden tabs' lists are not in the accessibility tree; nothing in the rows is focusable (#19, #87, #112).
14. Given Overview at 1440x1024 with the demo data, then the Recent Transaction card is at x 304, y 448 + the top row's growth (task 015), 352 wide, ending with Expenses Breakdown; every row on one line as drawn, the right column at the content's right edge, on every tab; Statistics and Expenses Breakdown 260 and 212 high. At 1920x1080 and 2560x1440 the same, the rows wider (#94). At 1280x1024, and at 1440 with a 120-character item and shop and an amount of `$1,000,000,000.00`, nothing overlaps, is cut or leaves the card's content box, there is no horizontal scroll and no scroll inside the card; the card ends with Expenses Breakdown, which with Statistics stretches where the rows need it (#94, #101, #106, #108 b, #111 a; Marko's notes).
15. Given switching tabs at 1280x1024 with the demo data (All, then Revenue, then Expenses), then the card takes the tallest tab's height (Revenue's) on every tab, the selected tab's rows at its top, and the card, Statistics, Expenses Breakdown and the page end do not move (#107, #112 a).
16. Given Overview at 1440x1024, then the Recent Transaction card matches `docs/figma/104. Overview.png`, with the differences listed in Validation step 4.

## Test scenarios
| ID | Type | Scenario | Expected | Covers AC |
|----|------|----------|----------|-----------|
| T1 | unit | `recentTransactionSchema` and `recentTransactionsResponseSchema` on valid and invalid bodies: an unknown category, an expense with `null`, income with a category, a plain date as `occurredAt`, a float amount, negative cents, `EUR`, 6 rows in a list, a missing list, an extra `id` | Valid ones parse; invalid ones fail; the extra key is not in the output | 8 |
| T2 | unit | `TransactionsService.recent` on the test database: a seeded user at the fixed clock (Belgrade); at 2026-10-23T22:30:00Z in Belgrade and New York; a Failed and a Pending row moved to the top; a user with 3 transactions | AC1 and AC2 lists (All, Revenue, Expenses); AC4 lists, Gift before the Freelance payment of the same instant; statuses listed; 3 rows | 1, 2, 3, 4 |
| T3 | unit | Boundaries in Belgrade for the rows of 24 Oct 2026 (12:00 UTC): the clock at 2026-10-23T21:59:59Z (23:59:59 on 23 Oct) and 2026-10-23T22:00:00Z (00:00 on 24 Oct) | Not shown; shown (All and Revenue) | 4 |
| T4 | unit | `GET /api/transactions/recent` on a seeded user at the fixed clock; at 2021-12-31T10:00:00Z; without a session; without `X-Time-Zone`; with `+01:00` | 200 with AC1 and AC2 lists, plain-cents `USD`, UTC timestamps, only the contract's keys; three empty lists; 401; 400 twice in the shared shape | 1, 2, 6, 8 |
| T5 | unit | Two seeded users: the second's transactions deleted; a `userId` and an `accountId` of the second in the query of the first; a path with an ID | The first's answer unchanged, the second's lists empty; the query ignored; 404 | 9 |
| T6 | unit | `bank-data-source.test.ts` and `no-direct-time.test.ts` over `backend/src` with `transactions/`; the controller's path read from `transactionsContract` | Pass: `VisibleTransactions` and `Clock` only | 10 |
| T7 | unit | Render Overview signed in (MSW demo) | The tablist named "Recent Transaction", All selected; the AC1 rows in order: icons named by category, items, shops, `-$…` amounts, `time` values and dates; 4 dividers; a list of 5 items | 1, 13 |
| T8 | unit | Click Revenue, Expenses, All; the keyboard: Right, Left, Home, End; Tab and Shift+Tab from "View All" | The selected tab and its list each time (AC2); `aria-selected`, the tabpanel labelled by the tab, `tabindex="0"`; the other tabs' lists `aria-hidden`, so only 5 list items are found; one tab stop in the tablist; Tab order "View All", the selected tab, the panel, and nothing after it in `main`; Shift+Tab back | 2, 13, 15 |
| T9 | unit | MSW answers: lists of 3, 1 and 0 rows; Revenue empty only; all empty; a transaction at 2026-10-22T23:30:00Z with the browser zone Belgrade and New York | 3 rows and 2 dividers, 1 row and none; "No transactions yet" in Revenue only; the empty message with the tabs; 23 Oct, 2026 and 22 Oct, 2026 | 3, 5, 6 |
| T10 | unit | MSW pending; 500 on every try, then 200 after Retry; 200 then 500 on the next focus | Tabs and the skeleton with `aria-busy`; the error state, then the rows; the rows kept after the failed refetch | 11 |
| T11 | unit | The source of `RecentTransaction` and `RecentTransactionItem` | No arithmetic on cents or dates, no filter or sort of rows; only `formatSignedMoney` and `formatDate` with `browserTimeZone()` | 12 |
| T12 | unit | Token guards: `tokens.test.ts` with the new tokens; Stylelint over the new CSS; the component name guard with the new rows; the gallery sections | Pass | 14 |
| T13 | e2e | Sign up (`signUp(page.request)`), open Overview at the fixed clock; click each tab; Tab from "View All" into the tablist, use the arrows, Tab to the panel and on, Shift+Tab back; click a tab and a row | AC1 and AC2 rows on each tab; the active style on the selected tab; one tab stop in the tablist; the panel focused after the tab, then focus outside the page's content; the ring on the tab and the panel with the keyboard (`expectRing`), none after the clicks; nothing focusable in the rows | 1, 2, 13 |
| T14 | e2e | Backend clock at 2026-10-23T22:30:00Z, Overview in a Belgrade context, then a New York context (a user signed up at that clock) | AC4 lists on All and Revenue | 4 |
| T15 | e2e | `page.route` answering a transaction at 2026-10-22T23:30:00Z, in a Belgrade and a New York context | AC5 dates | 5 |
| T16 | e2e | Backend clock at 2021-12-31T10:00:00Z (a user signed up at that clock) | The tabs and "No transactions yet"; the card ends with Expenses Breakdown | 6 |
| T17 | e2e | Click "View All" | `/transactions` | 7 |
| T18 | e2e | `page.route` holds the request, then answers 500 to every try, then lets Retry through | Tabs and the skeleton, the other sections in place; the error state; after Retry the rows | 11 |
| T19 | e2e | Overview at 1440x1024, 1920x1080, 2560x1440 and 1280x1024 on each tab; at 1440 with `page.route` answering a 120-character item and shop and `$1,000,000,000.00`; at 1280 switching All, Revenue, Expenses | AC14 boxes: one-line rows at 1440 and wider, the right column at the right edge; no text or box overlapping another or leaving the card's content box; no horizontal scroll, no scroll inside the card; Recent Transaction ending with Expenses Breakdown; AC15 heights unchanged across tabs | 14, 15 |

## Validation steps (in this order, stop on first failure)
1. Lint + typecheck pass (`npm run lint`, `npm run typecheck`).
2. Unit tests pass (`npm test`).
3. E2E tests pass (`npm run e2e`). Ports 3000 and 5173 free first.
4. Visual: Playwright MCP screenshots at 1440x1024 (device scale 2, scrollbars hidden, as in tasks 013 to 015), signed up at the fixed clock on the demo data: `/overview` compared with `docs/figma/104. Overview.png`, the Recent Transaction card in detail (the tabs, the tiles and icons, the items, shops, amounts and dates, the dividers, the insets, the rows' positions). Expected differences: the rows' content (the demo items, shops, amounts and dates against Figma's, #12); the signs on the amounts (#19); the date with the comma (`22 Oct, 2026` against `17 May 2023`, #11); the icons of the demo categories (no gamepad, #56); the card's position moved down by the top row's growth (task 015, #111 a); the rest of the page as listed in tasks 013 to 015. Also, as evidence only: the Revenue and Expenses tabs at 1440, full-page renders at 1920x1080 and 1280x1024 on each tab (#94, #112), the long item and amount at 1440, the skeleton, the error state, the empty card and a tab with fewer than 5 rows. Save to `.claude/tasks/evidence/016/` and list every difference.
5. Manual browser checks with Playwright MCP on `npm run dev` (headed Chromium on Windows, with classic scrollbars):
   - Sign up, land on Overview; read the Recent Transaction card; click Revenue, Expenses, All; Tab from "View All" into the tabs, use the arrows, Home and End; Tab to the panel (the ring) and on (no stop in the rows); Shift+Tab back; click "View All".
   - Resize to 1920, 1280 and back to 1440; at 1280 switch the tabs and watch the card and the right column.
   - Stop the backend: reload Overview inside the app for the skeleton and the error state; start it and Retry.

## Human checkpoint (only if Gate: human)
- The Recent Transaction card matches 104 at 1440x1024, with the listed differences; the Revenue and Expenses tabs active in the All style.
- The wrap rule as built: the rows at 1440, 1920 and 1280 on each tab, the long item, shop and amount; Statistics and Expenses Breakdown stretched where the rows need it; #112 a: switching tabs at 1280 moves nothing, the card at Revenue's height on every tab.
- The keyboard: Tab from "View All" to the selected tab, the panel, then on; the ring on the panel with the keyboard only.
- The undesigned states: the skeleton under the tabs, the error state, "No transactions yet", a tab with fewer than 5 rows.
- Choices made at detailing (accepted by Marko, 2026-10-27, with the task file; one changed, below):
  - one endpoint `GET /api/transactions/recent` answers all three tabs' lists (`{ all, revenue, expenses }`, each `[{ item, shopName, category, direction, occurredAt, amount }]`, no ID, account, receipt or status), so switching tabs sends no request and has no loading state of its own; the backend applies every tab's filter;
  - the date as a UTC timestamp formatted in the browser's zone (#54), not a date the backend formats;
  - the same instant in the order the provider gives (the later stored first, task 008), for example Gift before the Freelance payment of 24 Oct;
  - the tabs show in every state, and `DataState` covers the panel under them; All selected on every visit;
  - changed by Marko: the tab panel is a Tab stop (`tabindex="0"`, the WAI-ARIA tabs pattern, since the rows hold no focusable element), with the #87 ring on `:focus-visible` only; the detailing had proposed it outside the Tab sequence, as task 004's gallery (#112);
  - "No transactions yet" (#6's example) for every tab;
  - the code names `RecentTransaction`, `RecentTransactionItem` (Figma `Item`) and `RecentTransactionSkeleton`; the query key `['transactions', 'recent']`; the tab values `all`, `revenue`, `expenses`, the response's keys;
  - the gap between the text and the right column 16 and the wrap gap 12, as task 015's bill rows.
- The security review findings and their fixes.

## Log
<!-- Claude appends: date, what was done, decisions, issues, validation results, review findings -->

### 2026-10-27, detailing (`/next-task 016`)
- Detailed from the outline row with Marko's notes: the Recent Transaction card per US-08, #19 #40 #49 #56, inside task 013's grid (rows 2 and 3 to the bottom of Expenses Breakdown; "View All" already built); a read-only `GET` in the shared contract (#74), user-scoped from the session only (#39), transactions only through `VisibleTransactions` (#53), never the provider; nothing dated after today in the user's zone (Clock and `X-Time-Zone`, #54, #80); every tab's filter in the backend, the frontend only formatting (integer cents with `USD`, `formatSignedMoney`, `formatDate`); the midnight change in Belgrade against New York, as in tasks 013 and 015, with the first-login list of `demo-data.md`; long names and amounts per the #106, #108 b and #111 wrap rule, the card growing and the right column stretching, no inner scroll; states through `DataState` (#6, #89); keyboard and screen reader names for the tabs (#87); the visual check against 104; `security-review` in Skills.
- Read before detailing: US-08, `brief.md` (Layout, Lists, Navigation), `demo-data.md` (Transactions, first login, review points), the decisions cited, `components.md`, `inventory.md`, the PNG 104, task 015 (the pattern), `VisibleTransactions`, `BankDataProvider` and its TypeORM provider, the transaction, category, money and bill contracts, the shared formatters, `apiRequest`, `OverviewPage`, `MenuTab`, `CategoryIcon`, `DataState`, `UpcomingBill`, the bills module, the source guards, the e2e tests that check the grid and the Tab order.
- Checked against the seed (`backend/src/demo/demo-dataset.json`): the first-login All list of `demo-data.md`; Revenue at the fixed clock (Freelance payment 17, 10 and 3 Oct `+$179.20`, Dividend 15 Oct `+$84.00`, Design project 1 Oct `+$784.00`); Expenses the same as All (no income from 18 to 22 Oct); on 24 Oct the Freelance payment is stored before Gift, so the provider lists Gift first.
- Measured on 104 and in headless Chromium (the values in References). The row weights: the item's and the amount's ink matches Semibold 16 (the item 1336 against Semibold 1299 and Bold 1472; the amount 1122 against 1097 and 1237). Every demo row fits the 1440 card on one line, but at 1280 the rows wrap, differently per tab: All and Expenses 1 row, Revenue 4. With the wrap rule the card would be about 584 high on All and about 740 on Revenue, so switching tabs would move the right column and the page end by about 156 px, in windows from 1280 to about 1419 wide and at any width with long data.
- Raised **#112 (open)** in `docs/decisions.md`: whether switching tabs may move the page (#107 settled it for Total Balance paging). The decisions header records it.
- INDEX: row 016 cites the decisions this file uses; the open questions line lists #112. Status stays todo; the build waits for #112 (step 2 of `/next-task`).
- Not started. No Figma calls.

### 2026-10-27, #112 closed, task file approved
- Marko's answer, recorded in `docs/decisions.md` #112 (closed, Marko, 2026-10-27): (a) as proposed, the #107 approach: the three lists in one grid cell, the tallest sets the card's height, switching tabs never moves the page; the hidden lists `visibility: hidden` and `aria-hidden`.
- One detailing choice changed with the answer: the tab panel stays a Tab stop (`tabindex="0"`, the WAI-ARIA tabs pattern; also Radix Tabs' default), since the rows hold no focusable element, with the #87 ring on `:focus-visible` only. `MenuTab` is the project's own component, not Radix, and leaves the panel to the widget, so `RecentTransaction` sets it; `MenuTab` is unchanged. Recorded in #112 with the answer.
- Updated: References (#112 closed), the Scope note on #112, Scope (the panel as a Tab stop with its ring and the Tab order; the one-cell layout as decided), AC13 (Tab order: the tabs, the panel, then the next card; Shift+Tab back; the ring on keyboard focus only; the hidden lists out of the accessibility tree), AC15 (the card at the tallest tab's height), T8 and T13 (the Tab order, the panel's ring, no ring after a click), Validation step 5, the Human checkpoint (choices accepted, the changed one marked).
- Every other choice in the Human checkpoint accepted.
- INDEX: open questions none; row 016 cites the one-cell tabs and the panel Tab stop.
- Not started: Marko asked for the detailing commit only. No Figma calls.

### 2026-10-27, build (`/next-task 016`)
- Decisions checked before the start: all 112 closed.
- Built test first (TDD). Each unit and API test was watched failing for the right reason before the code: missing exports, 404s, a missing module, a missing component.
  - **Shared** (`shared/src/contract/transaction.ts`):
    - `recentTransactionSchema`: UTC `z.iso.datetime()`; `moneySchema` refined to 0 or more cents; a refinement that an expense has a category and income has none; unknown keys dropped.
    - `recentTransactionsResponseSchema` (`all`, `revenue`, `expenses`, each `.max(5)`) and `transactionsContract.recent` (`GET /transactions/recent`).
    - After the code review, `RECENT_TRANSACTIONS_PER_TAB` (5) and the row type `RecentTransactionRow` are exported and used by the service, the row component, the gallery and the test support.
  - **Backend** (`backend/src/transactions/`, `TransactionsModule` in `AppModule`, importing `BankDataModule` only):
    - `TransactionsService.recent` makes three `VisibleTransactions.list` reads (`{ limit }`, plus `direction` `income` and `expense`) in parallel. It maps each row to the six contract keys, with `occurredAt.toISOString()` and `{ cents, currency: 'USD' }`.
    - `TransactionsController` reads its path from the contract, the user from `@CurrentUser()` and the zone from `@TimeZone()`.
    - No table, column or migration.
  - **Frontend**:
    - `useRecentTransactions()` on `['transactions', 'recent']`. `OverviewPage` passes it to `RecentTransaction` inside the existing card.
    - `RecentTransaction`: `MenuTab` in every state; a panel (`role="tabpanel"`, `tabIndex={0}`, labelled by the selected tab, the #87 ring on `:focus-visible`) holding `DataState` (`RecentTransactionSkeleton`; "No transactions yet" when every list is empty). The three lists share one grid cell (`grid-area: 1 / 1`), the hidden ones `visibility: hidden` and `aria-hidden`; a tab's own empty list shows "No transactions yet".
    - `RecentTransactionItem`: the `recent` icon, the item over the shop, `formatSignedMoney` over a `time` with `formatDate(occurredAt, browserTimeZone())`; the #111 a wrap rule as task 015's bill rows. The divider is a bottom border on every row but the last, with the padding 24 less the border, so each row stays 88 and the divider is its last pixel row as in 104.
    - `RecentTransactionSkeleton` (frontend-design, existing tokens): five rows on the rows' grid.
    - Gallery sections for the three; Code-only rows for `RecentTransaction` and `RecentTransactionSkeleton` in `components.md` (`RecentTransactionItem` has its Figma row).
  - **Tokens**, each in `tokens.md` with its source and in `tokens.css`:
    - Measured on 104 at 2x, halved: `--space-recent-transaction-list-gap` 12, `-row-padding-y` 24, `-icon-gap` 16.
    - From Marko's notes, as task 015: `-amount-gap` 16 and `-wrap-gap` 12. The amount-gap note first said 104 leaves "60 px or more"; measured again, it is 91.5. Corrected before the gate.
- **Existing tests changed**, none weakened:
  - Listed in Scope:
    - `overview.test.tsx` T13 keeps Statistics and Expenses Breakdown empty.
    - `sign-up.test.tsx` adds `['transactions', 'recent']`.
    - `overview-total-balance.spec.ts` T20: 260 and 212 exact from 1440, at least that at 1280, Expenses Breakdown placed from Statistics' real height.
    - Both specs' `openOverview` wait for the panel (`waitForRecentTransactions` in `e2e/helpers.ts`).
  - Not listed, a follow-on of the same change: `app-shell.test.tsx` found the header date by bare text ("22 Oct, 2026"), which the Jeans row now also shows on Overview (5 tests failed with "multiple elements"). Its date queries are now scoped to the header (`banner`), which is what they assert.
  - Extended: `bank-data-source.test.ts` and `no-direct-time.test.ts` expect `transactions/`; `gallery.test.tsx` checks the new samples.
  - Changed at the gate (Marko's request, see the gate entries below): this task's T3 in `transactions-service.test.ts`. The `it.each` of the two midnight cases became two tests.
    - 21:59:59Z now checks the exact top rows: All starting with Biriyani of 23 Oct, Revenue with the Freelance payment of 17 Oct, and no row from 00:00 on 24 Oct in Belgrade in any list. It was only "the 24 Oct rows are not at the top".
    - 22:00:00Z keeps its assertions.
    - Strengthened, not weakened.
- **E2E proven able to fail**: with the hidden lists set to `display: none` instead of sharing the cell, the 1280 tab-switch test failed ("Revenue: the card, Statistics, Expenses Breakdown and the page end"). Restored, it passes.
- **Validation** (final runs, after the review fixes):
  1. `npm run lint` exit 0, `npm run typecheck` exit 0.
  2. `npm test`: 2,163 passed (shared 720, backend 619, frontend 824).
  3. `npm run e2e`: 169 passed (13 new), exit 0.
  4. Visual (`evidence/016/visual-differences.txt`, `compare-104-recent-transaction.png`): against 104 at 2x, relative to the card's top, the tiles, the four dividers and the "All" underline are identical and the text starts at the same x.
     - Differences: the demo content (#12), the signs (#19), the dates with the comma (#11), the demo icons (#56), the card 101 lower (the top row's growth, task 015) and 544 high (#93), the right column's ink 1.5 px further right (right-aligned at the content's edge), the inactive tab labels 1 px narrower (task 004), 36 under the last row against 34.
     - Also rendered: Revenue and Expenses at 1440; 1920 (rows on one line, no scroll); 1280 (the card 740 on every tab, Revenue's; Statistics 358, Expenses Breakdown 310; no sideways scroll); the long item, shop and amount; the skeleton, the error state, the empty card, 3, 1 and 0 rows.
  5. Manual (`evidence/016/manual-checks.txt`):
     - Sign up through the form; the three tabs by mouse; Tab from "View All" to the tab, the arrows, Home and End, the panel with the ring, out of the content, Shift+Tab back; no ring after a click; "View All" to Transactions.
     - The resizes: 1920, 1280 with the tab switches, 1440 with the classic scrollbar, every row on one line.
     - The backend stopped (skeleton, then the error state after 7.6 s, the card 544, still signed in), started again, and Retry.
- **Security review**: no findings (`evidence/016/security-review.md`). The new files were marked intent-to-add so the diff covered them.
- **Code review**: 0 critical, 0 important, 4 minor.
  1. The per-tab 5 was declared in the contract and the service. It is now exported once (`RECENT_TRANSACTIONS_PER_TAB`), with a test.
  2. The row type was spelled `RecentTransactionsResponse['all'][number]` in three places. It is now `RecentTransactionRow` from the contract.
  3. The per-tab empty message copies `DataState`'s empty-message CSS (the same tokens). Kept: `DataState` is out of scope. For the gate.
  4. The demo lists are written in both backend test files. Kept, as task 015's bills tests do.
  - Its "declined to judge" items, for the gate:
    - After a keyboard Retry, focus falls to the body, because `DataState` replaces the button (existing behavior; `DataState` out of scope).
    - An amount near the largest safe integer would overflow the right column at 1280 (AC14's bound is $1,000,000,000.00).
    - At 1280 the page grows once when the rows arrive (the skeleton at the grid's height, then Revenue's height; #112 covers tab switches).
    - No `Cache-Control: no-store` (no endpoint sets it).
    - The Clock read once per list in the same tick.
    - No zone in the query key, as every query.
    - Below 1280 (#4).
  - Its optional recommendation, a contract refinement that `revenue` holds only income and `expenses` only expenses, was not added: neither T1 nor the Scope asks for it, and the backend tests cover it.
- Rework loops: 2.
  1. Validation step 1: oxlint found 5 problems in the new tests: an unused helper, function scoping twice, and `expect` with a message argument twice.
  2. The new e2e spec's first run: 12 of 13 passed. A visibility check also matched the icon SVGs' own `aria-hidden`; it now checks the three list cells.
- Wrong tests caught before the code was trusted:
  - The service test's status check counted every future row; it is now narrowed to 22 Oct.
  - A gallery caption equal to the empty message; renamed "Every list empty".
- No Figma calls.

### 2026-10-27, at the gate: the midnight tests against a read that bypasses `VisibleTransactions` (Marko's request)
- **Mutation**: `TransactionsService` read through `BANK_DATA_PROVIDER.listTransactions(userId, filter)` directly, with the same `{ limit }` and `{ direction, limit }` filters and no today cap. Nothing else changed. The file was backed up first, and the SHA-256 of `git diff HEAD` (`5c592e5d…10cdb8`) and of `git status --short` (`a0aff776…1eb6096`) were recorded.
- **Result**: `npx vitest run test/transactions-service.test.ts test/transactions.test.ts` (backend) exited 1, with 11 failed and 13 passed of 24. The bypass answers the dataset's last rows (28 to 31 Dec 2028) instead of those up to today:
  - `answers a first login’s three lists…` (service) and `answers 200 with the three lists…` (API): expected `occurredAt` `2026-10-22T12:00:00.000Z` to `2026-10-18…`, got `2028-12-31T12:00:00.000Z` to `2028-12-28…`.
  - `at 2026-10-23T22:30:00Z in Belgrade (24 Oct)…` and `…in New York (23 Oct) lists up to 23 Oct` (AC4): the lists differ in the same way.
  - `at 2026-10-23T22:00:00Z (00:00 on 24 Oct) lists the rows of 24 Oct: true` (T3): "expected false to be true".
  - `lists a Failed and a Pending transaction like a Complete one`: expected `['Polo shirt 10-22', …]`, got `['Biriyani 12-31', …]`.
  - `answers three empty lists before the dataset begins` (service and API): expected three empty lists, got rows.
  - `answers only the user’s own transactions` and `answers each user from their own rows…`: the lists differ.
  - `reads transactions only through VisibleTransactions, never the provider` (source check): the service matched `BANK_DATA_PROVIDER`.
  - Also run on the mutation: `bank-data-source.test.ts` failed `uses listTransactions only in bank-data/, demo/ and its allowed files` (offender `transactions/transactions.service.ts`).
- **Weak spot**: the other midnight case, `at 2026-10-23T21:59:59Z (23:59:59 on 23 Oct) lists the rows of 24 Oct: false`, still **passed** under the bypass. It checks only that the 24 Oct rows are not at the top, and under the bypass they are not there either, because the 2028 rows are. So that case alone does not catch the bypass; its partner (`…22:00:00Z… true`) and the AC4 lists do. A stronger form would assert the exact top rows at 21:59:59Z (All starting with Biriyani 23 Oct, Revenue with the Freelance payment of 17 Oct). It was not changed here; for Marko to decide. Marko asked for it: done in the next entry.
- **Restored** from the backup: the file's SHA-256 is the original (`188a42a5…4072928`). Re-run: the two files passed 24 of 24 (exit 0), and `bank-data-source.test.ts` 13 of 13.
- **Byte-identical**: after the restore, `git diff HEAD` and `git status --short` hashed to the same values as before. This Log entry is the only change made after them.

### 2026-10-27, at the gate: the 21:59:59Z midnight test strengthened (Marko's request)
- **Test change** (`backend/test/transactions-service.test.ts`, T3; the only file changed besides this Log):
  - The `it.each` of the two midnight cases became two tests.
  - `at 2026-10-23T21:59:59Z (23:59:59 on 23 Oct) lists up to 23 Oct: All from Biriyani, Revenue from 17 Oct` asserts:
    - `all[0]` equals the whole Biriyani row of 23 Oct (`2026-10-23T12:00:00.000Z`, 1478 cents);
    - `revenue[0]` equals the Freelance payment of 17 Oct;
    - no row in any of the three lists is at or after `2026-10-23T22:00:00.000Z` (00:00 on 24 Oct in Belgrade).
  - `at 2026-10-23T22:00:00Z (00:00 on 24 Oct) lists the rows of 24 Oct` keeps its two assertions: Gift in All's first two, Revenue starting with the Freelance payment of 24 Oct.
- **On the real code**: both pass. The service's SHA-256 before the mutation was `188a42a5…4072928`.
- **The same bypass mutation** as the entry above: `listTransactions` through `BANK_DATA_PROVIDER`, the same filters, no today cap. Mutated file `64930350…63c2d86`.
- **The test alone** (`npx vitest run test/transactions-service.test.ts -t "21:59:59Z"`) exited 1, with 1 failed and 8 skipped. It fails at its first assertion (line 134), "expected { item: 'Biriyani', …(5) } to deeply equal { item: 'Biriyani', …(5) }":
  - `occurredAt` expected `2026-10-23T12:00:00.000Z`, got `2028-12-31T12:00:00.000Z`;
  - `cents` expected 1478, got 1800.
  - The dataset's last row is also a Biriyani, so a check on the item name alone would have passed. The test compares the whole row.
- **Restored** from the backup: SHA-256 `188a42a588c08052b0ad96b1029c4c49eea7639c25ac32921d7dc246a4072928`, matching `188a42a5…`.
- **Re-run on the restored code**:
  - `transactions-service.test.ts` and `transactions.test.ts`: 24 of 24 passed, exit 0, both midnight tests among them. The count is unchanged: one `it.each` of 2 became 2 tests.
  - `bank-data-source.test.ts`: 13 of 13, exit 0.
  - `npm run lint`: exit 0.

### 2026-10-27, approved by human (`/approve-task`)
- Approved by Marko. His notes: "Checked by Marko in the browser: Recent Transaction card at 1440 against 104, tab switching with nothing moving, keyboard (tabs, arrow keys, panel as a Tab stop with the ring on keyboard only), 1280 with the right column stretched to 358 and 310 (accepted), bottom inset at 1440 and 1280: all good. Gate checks logged: the bypass mutation, and the 21:59:59Z midnight test strengthened to fail on its own. Code review items: accepted as is: the page growing once when rows arrive at 1280; overflow only beyond the tested $1,000,000,000.00 bound; the query key without the time zone (like every other query). Two follow-ups, added to INDEX row 017 so its detailing includes them in Scope with tests: (1) Cache-Control: no-store on every /api response, set once globally (authenticated financial data must not stay in the browser cache), applied to all existing endpoints; (2) DataState Retry by keyboard: after Retry, focus moves to the widget's content or its region, not the page body, fixed once in the shared DataState for every widget."
- INDEX row 017 cites both follow-ups.
- Status done. Human interventions: 4:
  - the #112 answer at detailing;
  - the bypass mutation check Marko asked for at the gate;
  - the 21:59:59Z test strengthening he asked for;
  - this approval.
- Before the commit, `npm test` passed 2,163 of 2,163 (shared 720, backend 619, frontend 824).

## Metrics
- Started: 2026-10-27 17:56
- Finished: 2026-10-27 19:00
- Human interventions: 4
- Rework loops: 2
- Notes on prompts that failed: none. The `security-review` skill's diff was empty for uncommitted work again; marking the new files intent-to-add (`git add -N`) and giving its sub-task `git diff HEAD` covered them.
