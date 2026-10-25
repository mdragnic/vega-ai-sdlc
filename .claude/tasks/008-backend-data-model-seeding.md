# Task 008: Backend: data model, BankDataProvider, demo dataset generator and sign-up seeding

- Status: done
- Gate: human
- Depends on: 007
- Size: L
- Skills: `superpowers:test-driven-development`, `superpowers:verification-before-completion`, `superpowers:requesting-code-review`, `security-review` (money columns, user scoping of every query, full account numbers stored but never returned or logged, the sign-up transaction: run it on the task's changes and fix every finding before the gate)

## Goal
The backend has the tables for accounts, transactions, bills, savings goals and category limits, a `BankDataProvider` that reads and updates account and transaction data scoped to one user, a committed demo dataset generated from `docs/spec/demo-data.md`, and a sign up that copies that dataset into the new user's rows inside the sign-up transaction from task 007. No new API endpoint and no frontend.

## References
- Spec: `docs/spec/demo-data.md` (all of it: accounts, categories, monthly template, factors and rounding, receipts, bills, savings goals, "What a first login shows"); `docs/spec/brief.md` Data; `docs/spec/stories.md` US-02 criterion 4 (demo dataset on sign up), and the data the model must hold for US-05 criteria 1 and 2, US-07 criterion 2, US-08 criterion 3, US-11 criterion 2, US-12 criteria 2, 11 and 12, US-13 criteria 3 and 4, US-14 criteria 3, 6 and 7, US-16 criteria 2 and 7
- Figma: none, no UI in this task. Budget 0, no MCP calls.
- Decisions: `docs/decisions.md` #1 (own backend, demo dataset per user), #11 and #85 (integer cents, NOT NULL, "nothing" is no row), #12 (one consistent set), #19 (direction), #24 (card network, card order), #25 (full numbers never returned), #26 (Account Type values, editable details), #27 (statuses, Credit and Debit, receipts, cursor pages), #28 and #41 (bills, logos and descriptions from the backend), #32 (category limits), #39 and #46 (own data only), #53 (fixed dataset 2022 to 2028), #54 and #80 (UTC timestamps, Clock), #56 (one transaction entity, 6 categories, bill charges), #57 (one account per transaction, balance rule, Complete only), #58 (one savings goal per month), #74 (shared contract), #75 (scoping through `@CurrentUser()`), #77 (BankDataProvider), #78 (generator, JSON, seeding in the sign-up transaction, first-login test), #79 (migrations only), #96 (bill charge Item is the bill title, no currency column)

## Scope
- **Shared contract** (`shared/src/contract/`, #74), enums only, no contract entries (no endpoint in this task). The entities, the dataset schema and the later API shapes use these, never a copy:
  - `account.ts`: `accountTypeSchema` `credit-card`, `checking`, `savings`, `investment`, `loan` (#26, in that order, the keys the task 005 gallery already uses); `cardNetworkSchema` `mastercard`, `visa` (#24).
  - `transaction.ts`: `transactionDirectionSchema` `income`, `expense` (#19); `transactionStatusSchema` `complete`, `pending`, `failed` (#27). Credit and Debit are the direction (#27) and Payment Method is the account's type (#57): neither is stored.
  - `bill.ts`: `billLogoSchema` `figma`, `adobe` (#28), the key the frontend maps to its brand SVG (`frontend/src/assets/brand/`).
  - `expenseCategorySchema` (task 004) is reused for categories.
  - Tests in `shared/test/` for each enum's values and order.
- **Database** (#79): one migration, `npm run migration:generate -- CreateFinanceTables`, from the entities, listed in `backend/src/database/migrations/index.ts`. Every money column is `integer` cents, NOT NULL (#11, #85). No column is REAL, FLOAT, DECIMAL or NUMERIC. Enum columns are `simple-enum` from the shared enums, so SQLite enforces them with CHECK constraints.
  - `accounts` (`bank-data/account.entity.ts`, `Account`): `id`; `user_id` FK to `users` ON DELETE CASCADE, indexed; `account_type`; `bank_name`; `branch_name`; `card_network` nullable (NULL is "none", #24); `account_number`, the full 16 digits without spaces; `opening_balance_cents`. Card order is creation order, `id` ascending (#24).
  - `transactions` (`bank-data/transaction.entity.ts`, `Transaction`): `id`; `account_id` FK to `accounts` ON DELETE CASCADE; `occurred_at` (UTC, #11); `direction`; `status`; `category` nullable; `item`; `shop_name`; `receipt`; `amount_cents`, CHECK `>= 0` (the direction gives the sign, as `formatSignedMoney` requires). CHECK: an expense has a category, income has none (#56). Index on (`account_id`, `occurred_at`). No `user_id`: a transaction belongs to its account, and every query reaches the user through `accounts.user_id`, so a transaction can never point at another user's account.
  - `bills` (`bills/bill.entity.ts`, `Bill`): `id`; `user_id` FK CASCADE; `title`; `description`; `logo`; `due_date` and `last_charge_date` as plain dates (`YYYY-MM-DD`, #11); `amount_cents` CHECK `>= 0`. Index on (`user_id`, `due_date`). No category column: no screen shows a bill's category, and its charge transaction carries Others (#56).
  - `savings_goals` (`goals/savings-goal.entity.ts`, `SavingsGoal`): `id`; `user_id` FK CASCADE; `month` as `YYYY-MM`; `target_cents` CHECK `> 0`; `present_cents` CHECK `>= 0` (#31). UNIQUE (`user_id`, `month`): at most one per month (#58). A month without a goal has no row (#85).
  - `category_limits` (`goals/category-limit.entity.ts`, `CategoryLimit`): `id`; `user_id` FK CASCADE; `category`; `limit_cents` CHECK `> 0` (#31). UNIQUE (`user_id`, `category`) (#32).
  - Currency (#96 b): no currency column. Every stored amount is USD; the backend adds the currency code `USD` in API responses, in the shared `moneySchema` shape (#74).
  - Relations with `Relation<T>` (CLAUDE.md). `databaseOptions` lists the new entities.
  - Existing tests that list tables get the new tables: `database-schema.test.ts` ("creates the users and sessions tables") and `reset-database.test.ts`. That is the new correct outcome, not a weaker test.
- **Demo dataset generator** (#78), `backend/scripts/generate-demo-data.ts`:
  - Applies `demo-data.md` as constants in the script: the 5 accounts, the income and expense template, the year and category-month factors, half-up rounding in integer cents (`round_half_up(base × year% × month% / 10000)`, income without the month factor, bill charges unscaled), rows on days 29 to 31 only in months that have them, the 14 bills and their 14 charge transactions, the 84 savings goals and the 6 limits.
  - Bill charges (#56, #96 a): an expense on Credit Card, category Others, shop "Figma" or "Adobe Inc", status Complete (the approved first-login values count them: Total Balance $130,254.67 includes the charges up to 2026, it would be $133,799.67 without them), Item the bill's title, "Figma - Yearly Plan" or "Adobe Inc - Yearly Plan" (#96 a).
  - Every timestamp is 12:00 UTC on its date. Rows are ordered by date, then within a day: income in template order, expenses in template order, bill charges last. That order becomes the insert order, so rows with the same timestamp keep it (newest first is `occurred_at` descending, then `id` descending).
  - Receipts: 11 characters from `A`–`Z`, `a`–`z`, `0`–`9`, drawn from a small seeded PRNG in the script (fixed seed, no dependency), unique; the Freelance payment of 17 Apr 2023 on Checking gets `8C52d5DKDJ5` and no other row gets it (#27).
  - Writes `backend/src/demo/demo-dataset.json`: account number and money as in the schema below, accounts referenced by their index (0 to 4), one record per line so a change reads as a diff. Added to `.prettierignore` (generated, like the migrations).
  - Runs with Node 24's built-in TypeScript type stripping: `npm run demo:generate -w backend` (`node scripts/generate-demo-data.ts`). The script imports only `node:` modules and types; it exports the generation and serialization functions for the tests and writes the file only when run directly (`import.meta.main`). `backend/tsconfig.json` includes `scripts/` so typecheck and lint cover it.
  - Rerun only when `demo-data.md` changes. A test regenerates in memory and requires the committed file to match byte for byte.
- **Dataset loading** (`backend/src/demo/demo-dataset.ts`): a Zod schema for the JSON built from the shared enums (integer cents, ISO instants at 12:00 UTC, `YYYY-MM-DD` dates, `YYYY-MM` months). The file is read and validated once when the app starts (a provider factory), never during a request; an invalid file stops the app with a clear error. `nest-cli.json` copies the JSON into `dist/` as an asset. Zod moves from the backend's `devDependencies` to `dependencies` (same version 4.6.7, already a runtime dependency of `shared`; not a new package).
- **Seeding** (`backend/src/demo/demo-seeder.ts`, `DemoSeeder`, in `DemoModule`):
  - `seed(manager, userId)` inserts, through the given transaction's `EntityManager` (#78): the 5 accounts one by one in order (to get their IDs), the 3,411 transactions mapped to those IDs in batches (a named batch size that keeps each statement under SQLite's 32,766 bound variables; `updateEntity(false)`, no reload), the 14 bills, 84 savings goals and 6 limits in batches.
  - `AuthService.signUp` calls it inside the existing `dataSource.transaction`, right after the user insert and before the session. If any insert fails, the transaction rolls back: no user, no session, no cookie, no rows; 500 in the shared error shape. The task 012 Google sign up reuses `seed`.
  - No real I/O inside the transaction (task 007 note: better-sqlite3 shares one connection, so an `await` on files, timers or the thread pool would let other requests' queries run inside it). The dataset is already in memory; every await in `seed` is a better-sqlite3 call that settles in microtasks.
  - The ApiExceptionFilter (task 007) already logs only an error's message and stack, so a failed insert never logs a row (account numbers included).
- **BankDataProvider** (#77), `backend/src/bank-data/`:
  - `bank-data-provider.ts`: the interface and the injection token `BANK_DATA_PROVIDER`; `BankDataModule` binds it to `TypeOrmBankDataProvider`, the only implementation (TypeORM repositories), and is imported by `AppModule`.
  - Raw data only, no totals, balances, masks or derived fields:
    - `BankAccount`: `id`, `accountType`, `bankName`, `branchName`, `cardNetwork` (or `null`), `accountNumber` (full), `openingBalanceCents`.
    - `BankTransaction`: `id`, `accountId`, `occurredAt` (`Date`, UTC), `direction`, `status`, `category` (or `null`), `item`, `shopName`, `receipt`, `amountCents`.
  - Methods, each taking the signed-in user's ID first and scoping every query to it (#39, #46, #75):
    - `listAccounts(userId)`: the user's accounts, oldest first (#24).
    - `getAccount(userId, accountId)`: the account, or `null` when it does not exist or belongs to another user (#39).
    - `updateAccountDetails(userId, accountId, { bankName, branchName, accountType })`: stores the three fields (#26) and returns the updated account, or `null` (nothing changed) when it does not exist or belongs to another user. Validation of the fields is task 022's request schema.
    - `listTransactions(userId, filter)`: filters `accountId`, `direction`, `occurredFrom` (inclusive) and `occurredBefore` (exclusive) instants, `cursor`, `limit` (#77); newest first (`occurred_at` descending, then `id` descending). Returns `{ transactions, nextCursor }`; without `limit` it returns every match and `nextCursor` is `null`. The cursor is an opaque string made by the provider from the last row's timestamp and ID; a malformed one throws `InvalidCursorError` (task 020 maps it to 400). A `limit` that is not a positive integer throws a `RangeError`.
  - Complete-only sums, balances, totals and masking are app-service calculations of later tasks over this raw data (#57, #77). Hiding entries dated after today is the `VisibleTransactions` service below (added at the start, see Log).
- **Visible transactions** (added by Marko at the start of the build, #53, #54, #77, #80), `backend/src/bank-data/visible-transactions.ts`, `VisibleTransactions` in `BankDataModule`:
  - One app service that wraps `BankDataProvider.listTransactions` and always applies `occurredBefore` = the start of tomorrow in the user's time zone (the `X-Time-Zone` value, #54), from the injected Clock (#80), so entries dated after today are never shown or counted (#53). A caller's own `occurredBefore` is kept when it is earlier.
  - Later tasks read transactions through it, never through the provider directly. A source test fails if code outside `src/bank-data/` and `src/demo/` calls `listTransactions` on the provider.
- **E2E** (`e2e/tests/demo-seeding.spec.ts`): sign ups through the Vite proxy with the seeding in place.

## Out of scope
- Every endpoint that returns or changes accounts, transactions, bills, goals or limits, and the services that calculate from the raw data: balances and Total Balance (013, 019), Upcoming Bill and Bills (015, 023), Recent Transaction and Transactions (016, 020), Statistics (017), Expenses Breakdown and the Expenses page (018, 024), Account Details and its edit (021, 022), Goals (014, 025 to 027). Masking account numbers (#25) is task 013's.
- Request schemas and validation for edits: goals (014, 025, 027), account details (022).
- Calling the seeder from Google sign-in (task 012).
- Profile fields: phone, country code, photo (028, 029).
- Backfilling demo data for users created before this task (only development databases have them).
- Rate limits on sign up (#14), although each sign up now writes about 3,500 rows.
- Any frontend.

## Acceptance criteria
1. Given the migration, then `accounts`, `transactions`, `bills`, `savings_goals` and `category_limits` exist with the columns, foreign keys (ON DELETE CASCADE), indexes, unique and CHECK constraints in Scope; every money column (`opening_balance_cents`, `amount_cents`, `target_cents`, `present_cents`, `limit_cents`) is INTEGER NOT NULL, and no column in the database is REAL, FLOAT, DECIMAL or NUMERIC; an expense without a category, income with one, an unknown enum value, a second goal for the same month or a second limit for the same category is rejected; TypeORM finds no drift between the entities and the migrations; the migration is listed in `migrations/index.ts` (#11, #24, #56, #58, #79, #85).
2. Given `npm run demo:generate -w backend`, then it writes `backend/src/demo/demo-dataset.json`, and a test that regenerates the dataset in memory finds the committed file identical, byte for byte (#78).
3. Given the committed dataset, then it holds what `demo-data.md` says (#53, #56, #78):
   - 5 accounts in the order and with the values of the Accounts table, account numbers without spaces, Credit Card Mastercard, Checking VISA, the others none, opening balances $25,000.00;
   - 3,411 transactions from 1 Jan 2022 to 31 Dec 2028, each at 12:00 UTC; the template rows of every month, day 29 to 31 rows only in months that have the day (Feb 2024 has the day 29 Taxi fare, Feb 2023 does not); amounts by the factors with half-up rounding (GTR 5 $160.00 on 17 May 2023; Taxi fare $10.64 in Oct 2026; Freelance payment $160.00 × year factor);
   - every income without a category, every expense with one of the 6; every day from 2022 to 2028 with at least one Complete expense; each Pending or Failed row with a Complete expense on the same day;
   - unique 11-character receipts from `A`–`Z`, `a`–`z`, `0`–`9`, with `8C52d5DKDJ5` on the Freelance payment of 17 Apr 2023 on Checking only;
   - 14 bills (Figma - Yearly Plan $150.00 due 15 May with last charge 14 May of the year before; Adobe Inc - Yearly Plan $559.00 due 16 Jun with last charge 17 Jun of the year before; 2022 to 2028; logos `figma` and `adobe`; the Bills description), and 14 Complete charge expenses on Credit Card, Others, on 14 May and 17 Jun of each due year, unscaled, with the bill's title as Item (#96 a);
   - 84 savings goals (one per month 2022 to 2028, target $20,000.00, the present amounts of the table by calendar month) and 6 limits of $250.00;
   - every account balance (opening plus Complete transactions) stays positive to the end of 2028, the lowest being Loan at $15,932.45 in Dec 2028.
4. Given a valid sign up, then the response is still 201 with the current user, and the new user owns 5 accounts (IDs ascending in the dataset's order), 3,411 transactions mapped to those accounts as in the dataset, 14 bills, 84 savings goals and 6 limits; a second user gets a separate copy with equal values (#1, #53, #78; US-02 criterion 4).
5. Given the seeding fails part way (an insert is rejected), when I sign up, then the response is 500 in the shared error shape, no `Set-Cookie` is sent, and no user, session, account, transaction, bill, goal or limit row of that sign up exists; the log line holds no account number or row value (#78).
6. Given the app has started, then the dataset was read and validated once; when a sign up seeds, it reads no file and does not yield to the event loop (a `setImmediate` callback queued just before `seed` has not run when `seed` resolves). Given 3 sign ups and a `me` request sent at the same time, then all succeed, and each new user owns exactly their own 5 accounts and 3,411 transactions (task 007 note on the shared connection).
7. Given a sign up, then the transactions are inserted in `ceil(3,411 / batch size)` INSERT statements, not one per row, and the seeding takes under 3,000 ms on a file database in the unit test, a ceiling that leaves room for a loaded machine; the measured time is printed and recorded in the Log (#78).
8. Given the `BankDataProvider` from `BANK_DATA_PROVIDER`, then `listAccounts` returns the user's accounts oldest first; `getAccount` returns one account; `updateAccountDetails` stores Bank Name, Branch Name and Account Type and returns the updated account; `listTransactions` filters by account, direction and the `occurredFrom`/`occurredBefore` range, newest first with ties by ID descending. Each result holds only the raw fields in Scope: the full account number and opening balance, never a balance, total, mask, Transaction Type or Payment Method (#26, #57, #77).
9. Given two seeded users A and B, then every provider call with A's ID returns only A's rows; `getAccount(A, an account of B)` and `updateAccountDetails(A, an account of B, …)` return `null` and B's account is unchanged; `listTransactions(A, { accountId: an account of B })` returns no rows (#39, #46).
10. Given `listTransactions` with `limit` 10, when I follow `nextCursor` to the end, then I get all 3,411 of the user's transactions once each, newest first, and the last page has `nextCursor` `null`; the same holds with an account or direction filter; a malformed cursor throws `InvalidCursorError` and a `limit` of 0 throws (#27, #74, #77).
11. Given the Clock fixed at 2026-10-22T10:00:00Z and dates read in UTC, when a new user's seeded data is read through the provider and the repositories and summed in the test, then it gives the "What a first login shows" values of `demo-data.md` (#78):
    - balances Credit Card $21,019.18, Checking $33,362.48, Savings $27,356.80, Investment $29,503.00, Loan $19,013.21, Total $130,254.67 (opening plus Complete transactions dated up to today);
    - Savings, Investment and Loan with 57 or 58 transactions up to today, every account more than 10, and income rows present;
    - the Oct 2026 goal: target $20,000.00, present $16,250.00;
    - upcoming bills (due today or later): Figma - Yearly Plan 15 May 2027 $150.00, then Adobe Inc - Yearly Plan 16 Jun 2027 $559.00, 4 in all;
    - the latest 5 transactions up to today: Jeans $266.00 (22 Oct), Movie ticket $17.64, Pizza $24.64, Taxi fare $10.64, Restaurant bill $147.84;
    - Complete expenses per day this week Mon 19 to Thu 22 Oct all above $0, nothing after 22 Oct counted, and the highest day of both weeks last Thursday 15 Oct at $322.00;
    - per category, 1 to 22 Oct vs all of Sep: Housing $252.00 (−17%), Food $510.04 (+7%), Transportation $53.20 (−32%), Entertainment $282.24 (+16%), Shopping $658.00 (+14%), Others $138.32 (−31%);
    - daily savings (Complete income minus Complete expenses) from 1 to 22 Oct 2026 between −$283.36 and +$552.16, both reached.
12. Given a seeded user, then no response body of the existing routes (sign up, login, me) and no log line written during sign up contains any of the 5 full account numbers; outside `src/bank-data/` and `src/demo/`, no backend source reads `accountNumber` (a source guard; task 013 adds its masking function as the one other reader) (#25).
13. Given the shared contract, then the five enums exist once in `shared/src/contract/`, and the entities' enum columns, the dataset schema and the provider types use them (#74).
14. Given a user with seeded data, when the user row is deleted, then all their accounts, transactions, bills, goals and limits are deleted with it (foreign keys enforced).
15. Given the real stack through the Vite proxy, when 3 users sign up at the same time, then all get 201 and each `me` returns its own user; each sign up's time is printed (#73, #78).
16. Given `VisibleTransactions` with the Clock and a time zone, then it returns the provider's transactions dated up to today in that zone and none after: a transaction late in the evening today in Europe/Belgrade is listed and one just after midnight (tomorrow) is not, around midnight in two zones; a caller's earlier `occurredBefore` is kept; outside `src/bank-data/` and `src/demo/`, no backend source calls `listTransactions` (#53, #54, #77, #80).

## Test scenarios
| ID | Type | Scenario | Expected | Covers AC |
|----|------|----------|----------|-----------|
| T1 | unit | Shared enums: values and order of `accountTypeSchema`, `cardNetworkSchema`, `transactionDirectionSchema`, `transactionStatusSchema`, `billLogoSchema`; an unknown value | The values in Scope, in order; the unknown value fails | 13 |
| T2 | unit | Migrations on an empty database: `PRAGMA table_info`, `index_list`, `foreign_key_list` for the 5 tables; every column type in the database; schema drift; `migrations/index.ts` lists every file | The columns, keys and indexes in Scope; every `*_cents` INTEGER NOT NULL; no REAL, FLOAT, DECIMAL or NUMERIC; no pending change; every migration listed | 1 |
| T3 | unit | Raw inserts that break a rule: expense without category, income with one, `direction` `transfer`, `card_network` `amex`, negative `amount_cents`, `target_cents` 0, a second goal for a month, a second limit for a category | Each rejected by SQLite | 1 |
| T4 | unit | Generator: `serialize(generate())` vs the committed JSON file; two runs | Identical bytes; the same output twice | 2 |
| T5 | unit | Dataset content (the committed JSON, parsed with the dataset schema): counts, accounts, the spot amounts, days 29 to 31, the Feb 2023 and Feb 2024 day 29, categories, every day's Complete expense, Pending and Failed rows, 12:00 UTC, receipts, bills, charges, goals, limits, running balances to the end of 2028 | The AC3 values | 3 |
| T6 | unit | Dataset schema: a valid copy; a float amount, a non-12:00 timestamp, an unknown category, a missing field; the loader with a broken file | Valid passes; each broken one fails with the field's path; the app does not start with a broken file | 3, 6 |
| T7 | unit | Sign up through supertest, then the new user's rows through the repositories; a second sign up | 201 and the current user; 5 accounts in dataset order, 3,411 transactions per account as in the dataset, 14 bills, 84 goals, 6 limits; the second user has their own rows with equal values | 4 |
| T8 | unit | A SQLite trigger rejects the 14th bill insert (and, separately, the first transaction batch); sign up; a logger that records every line | 500 in the shared shape; no `Set-Cookie`; no user, session or finance rows for that email; no account number or row value in the log | 5, 12 |
| T9 | unit | `seed` inside a transaction with a `setImmediate` flag queued just before; `fs.readFileSync` and `fs.promises.readFile` spied during sign up | The flag is still unset when `seed` resolves; no file read during sign up | 6 |
| T10 | unit | 3 sign ups and a `me` of an existing user sent concurrently on one test app | All 201 and 200; each new user has exactly 5 accounts and 3,411 transactions; no transaction error | 6 |
| T11 | unit | A TypeORM logger counts `INSERT INTO "transactions"` statements during one sign up; the seed time measured on a file database (temp folder) | `ceil(3,411 / batch size)` statements; under 3,000 ms; the time printed | 7 |
| T12 | unit | Provider on a seeded user: `listAccounts`, `getAccount`, `updateAccountDetails` (then `getAccount` again), `listTransactions` with each filter and a range; the keys of each returned object | Oldest first; the update stored and returned; filters and order as AC8; only the raw keys in Scope | 8 |
| T13 | unit | Two seeded users: every provider method with A's ID and B's account IDs | A sees only A's rows; `null` for B's account on get and update, B's row unchanged; no transactions for B's account | 9 |
| T14 | unit | Page through with `limit` 10 (all, one account, income only); a cursor of random text; `limit` 0 and 1.5 | All rows once, newest first, ties by ID; `nextCursor` `null` at the end; `InvalidCursorError`; `RangeError` | 10 |
| T15 | unit | First login: test app with the default fixed clock (2026-10-22T10:00:00Z), sign up, read through the provider (with the UTC range filters) and repositories, sum in the test | Every AC11 value | 11 |
| T16 | unit | Account numbers: the bodies of sign up, login and `me` for a seeded user; the log of T8; a source guard over `backend/src` | None contains a full account number; the guard finds `accountNumber` only in `bank-data/` and `demo/` | 12 |
| T17 | unit | Delete a seeded user's row | Their accounts, transactions, bills, goals and limits are gone; another user's rows stay | 14 |
| T18 | e2e | `request` fixture through the Vite proxy: 3 sign ups with `Promise.all`, then `me` with each cookie jar | 201 each, `me` returns each own user; the times printed | 15 |
| T19 | unit | `VisibleTransactions` on a user with transactions just before and after midnight: Clock and zone Europe/Belgrade (late evening today, just after midnight tomorrow), the same rows in America/New_York, the Clock moved past midnight in one zone only, a caller's `occurredBefore` earlier and later than tomorrow; the start of the next day across DST changes (one with no midnight) | Today's late evening listed, tomorrow's not, in both zones; the earlier `occurredBefore` kept, the later one capped; DST days start at their first instant | 16 |
| T20 | unit | Source guard over `backend/src`: `listTransactions` outside `bank-data/` and `demo/`; sample code | No offenders; the sample calls are flagged | 16 |

## Validation steps (in this order, stop on first failure)
1. Lint + typecheck pass (`npm run lint`, `npm run typecheck`).
2. Unit tests pass (`npm test`).
3. E2E tests pass (`npm run e2e`).
4. Visual: none. This task has no UI, so there is nothing to compare with `docs/figma/`; the Log says so.
5. Manual checks:
   - `npm run demo:generate -w backend` leaves `git diff --exit-code backend/src/demo/demo-dataset.json` clean.
   - `npm run migrate` applies `CreateFinanceTables` to the development database, and a second run applies nothing.
   - With `npm run dev` and Playwright MCP on `http://localhost:5173`: sign up with `fetch` from the page and time it (scrypt N 2^17 plus seeding, development settings); then count the new user's rows per table in `backend/data/finebank.sqlite` with a read-only query. Save the outputs to `.claude/tasks/evidence/008/`.

## Human checkpoint (only if Gate: human)
- #96 as applied: the bill charge transactions have the bill's title as Item; no currency column (USD added in API responses).
- The data model: the 5 tables, their columns and constraints; enum keys in kebab case from the shared contract; account numbers stored as 16 digits without spaces; `card_network` NULL for none; savings goal months as `YYYY-MM`; bills without a category column; transactions reaching their user only through their account (no `user_id` column).
- The `BankDataProvider` interface as built: method signatures, raw fields only, the opaque cursor, newest first with ties by ID (JSON order within a day: income, expenses, bill charges).
- The dataset file: one record per line, about 750 KB, Prettier-ignored, generated by `node scripts/generate-demo-data.ts` with Node's type stripping, the receipt PRNG and its fixed seed.
- Seeding inside the sign-up transaction: the measured time (unit test and development, recorded in the Log), the 3,000 ms ceiling, and that every other request waits for it while the single connection is busy.
- Package and config changes: Zod from backend `devDependencies` to `dependencies` (approved at detailing); `nest-cli.json` assets; `backend/tsconfig.json` includes `scripts/`; `.prettierignore`; the `demo:generate` script.
- The two existing tests changed for the new tables (`database-schema.test.ts`, `reset-database.test.ts`).
- `VisibleTransactions` (added at the start): the start of tomorrow in the user's zone from the Clock, the cap on a caller's later `occurredBefore`, and the source guard on `listTransactions`.
- The security review findings and their fixes.

## Log
<!-- Claude appends: date, what was done, decisions, issues, validation results, review findings -->

### 2026-10-25, detailing (`/next-task 008`)
- Detailed from the outline row with Marko's notes: #56, #57, #24, #28, #41, #58, #32 for the model; #11 and #85 (integer cents, NOT NULL, "nothing" is no row); #77 (raw data, no totals) and #39 (every query scoped); #53 and #78 with `demo-data.md` (generator, committed JSON, seeding in the task 007 transaction, first-login values with the fixed clock); the task 007 note on the shared connection (no real I/O in the transaction), batched inserts and a measured seeding time; full account numbers stored, never returned (#25); migrations listed in `migrations/index.ts`; `security-review` in Skills.
- Checked without Figma calls:
  - Recomputed the "What a first login shows" values from the `demo-data.md` rules in a scratch script: 3,411 transactions; every balance, Total Balance $130,254.67, the 57 and 58 counts, the lowest balance (Loan $15,932.45, Dec 2028), the latest 5 rows, the $322.00 day, the 6 category totals and changes, and the −$283.36 to +$552.16 daily savings all match. They match only with the bill charges counted as Complete (without them Total Balance would be $133,799.67), so Complete is taken from the approved values.
  - TypeORM 1.1.2 exports no `Transaction`, so the entity can use that name. Node is 24.20.0, which runs the generator's TypeScript directly. `.gitattributes` forces LF, so the byte-for-byte test is stable on Windows.
- Scope choices (for review with the task):
  - Transactions have no `user_id`: scoping goes through `accounts.user_id`, so a row cannot point at another user's account.
  - The five enums go into the shared contract now, so the entities and the later API shapes share them (#74).
  - `updateAccountDetails` is built now, because #77 defines it as part of the interface; its endpoint and validation stay with task 022.
  - The dataset is validated with Zod at startup; Zod moves to the backend's runtime dependencies (already installed, used by `shared` at runtime).
  - A ceiling for the seeding in the unit test, so a slow seed fails a test rather than only a log line (1,000 ms proposed; changed to 3,000 ms, see below).
- Raised **#96 (open)** in `docs/decisions.md`:
  - (a) the Item of the 14 bill charge transactions, which `demo-data.md` does not give;
  - (b) whether #11's "currency code on every amount" means a stored currency column, while #78 and #85 name only integer cent columns.
  This task waits for #96.
- INDEX: row 008 now cites #11, #25, #39, #85 and #96; open questions list #94 and #96.
- Not started. No Figma calls.

### 2026-10-25, #96 closed
- Marko's answers, recorded in `docs/decisions.md` #96 (closed, Marko, 2026-10-25):
  - (a) The bill charge transactions use the bill's title as Item: "Figma - Yearly Plan" and "Adobe Inc - Yearly Plan".
  - (b) No currency column: every stored amount is USD; the backend adds the currency `USD` in API responses.
- Also decided by Marko:
  - Zod moves to the backend's runtime dependencies (approved: it is already used at runtime).
  - Accepted: `updateAccountDetails` built now, the dataset JSON excluded from Prettier, and the table lists in `database-schema.test.ts` and `reset-database.test.ts` updated for the new tables.
  - The seeding time ceiling in the unit test is 3,000 ms, not 1,000 ms, so the test does not fail under load; the measured time goes into this Log.
- Updated: References, Scope (currency, bill charge Item), AC3, AC7, T11 and the human checkpoint.
- INDEX: open questions #94 only.
- Not started, as Marko asked. No Figma calls.

### 2026-10-25, build started (`/next-task 008`)
- Every decision the task cites is closed (#94 is open but not cited). Status `in-progress`.
- **Addition to Scope by Marko** at the start: one app service, `backend/src/bank-data/visible-transactions.ts`, that wraps `BankDataProvider.listTransactions` and always applies `occurredBefore` = the start of tomorrow in the user's time zone (the `X-Time-Zone` value, #54) using the injected Clock (#80), so entries dated after today are never shown or counted (#53). Later tasks read transactions through it, never through the provider directly; a source test fails if code outside `bank-data/` and `demo/` calls `listTransactions` on the provider. Unit tests: a transaction today (late evening in Europe/Belgrade) is visible, one tomorrow is not, around midnight in two zones.
  - Added to Scope ("Visible transactions"), AC16, T19 and T20, and the human checkpoint. The Scope line that left hiding future entries to later tasks now points at this service.
  - Choices: the service method is `list(userId, timeZone, filter)`, not `listTransactions`, so the guard can flag every `listTransactions` outside `bank-data/` and `demo/`; a caller's `occurredBefore` earlier than tomorrow is kept (later tasks need past ranges such as last week or last month), a later one is capped; the start of tomorrow is computed with `Intl` (no new backend dependency), DST changes included.

### 2026-10-25, build, validation and reviews (`/next-task 008`)
- **Built** with TDD (each test file written and run red before its code):
  - Shared enums: `shared/src/contract/{account,transaction,bill}.ts` (`accountTypeSchema`, `cardNetworkSchema`, `transactionDirectionSchema`, `transactionStatusSchema`, `billLogoSchema`).
  - Entities: `bank-data/account.entity.ts`, `bank-data/transaction.entity.ts`, `bills/bill.entity.ts`, `goals/savings-goal.entity.ts`, `goals/category-limit.entity.ts`; migration `1792930295195-CreateFinanceTables` (generated, listed in `migrations/index.ts`).
  - Generator `backend/scripts/generate-demo-data.ts` (`npm run demo:generate -w backend`), dataset `backend/src/demo/demo-dataset.json` (742,150 bytes, one record per line), loader `demo/demo-dataset.ts`, `DemoSeeder` and `DemoModule`; `AuthService.signUp` calls `seed` between the user insert and the session.
  - `BankDataProvider`, `TypeOrmBankDataProvider`, `VisibleTransactions`, `BankDataModule` (imported by `AppModule`), `common/time-zone/start-of-next-day.ts`.
  - Config: Zod moved to backend `dependencies` (same 4.6.7); `nest-cli.json` copies the JSON to `dist/demo/`; `backend/tsconfig.json` includes `scripts/`; `.prettierignore` has the JSON.
  - Tests changed: `database-schema.test.ts` and `reset-database.test.ts` list the 5 new tables (the planned new outcome); `CapturingLogger` moved from `auth-logging.test.ts` into `test/helpers/capturing-logger.ts` to share it (no assertion changed).
- **Decisions while building:**
  - The transaction category CHECK is `("direction" = 'income') = ("category" IS NULL)`. The first form, `(expense AND category IS NOT NULL) OR (income AND category IS NULL)`, gave schema drift: the migration formatter (`--pretty`) wraps any CHECK over 50 characters, and TypeORM 1.1.2 reads back only a CHECK written on one line, so it saw the check as missing. The same rule in one comparison stays on one line; the drift test is green.
  - The receipt PRNG is mulberry32 with the fixed seed `20221017`; the Figma row draws nothing and its ID is reserved, so no other row gets it.
  - Seeding inserts the 5 accounts one by one (to get IDs), then multi-row INSERTs of `INSERT_BATCH_SIZE` = 1,000 rows: 4 statements for the transactions, one each for bills, goals and limits, with `updateEntity(false)`.
  - The generator takes an optional output path argument, so a test runs it under Node's type stripping into a temp folder and compares the bytes with the committed file.
  - `listTransactions` also throws a `RangeError` for an invalid `occurredFrom` or `occurredBefore` date (code review, see below); `VisibleTransactions` passes an invalid `occurredBefore` on to fail instead of replacing it with tomorrow.
  - Vitest 5 defaults to `clearMocks: true`, so the "dataset read once at start" test starts its own app inside the test; the seeding time is printed with `process.stdout.write`, because Vitest 5's default reporter hides console output of passing tests.
- **Measured seeding time (AC7):** 42 to 94 ms in the unit test on a file database over 5 runs (58, 42, 94, 70 and, in the final run, 63 ms), under the 3,000 ms ceiling. Whole sign ups: 273 ms on the development stack (scrypt N 2^17 plus seeding, through the Vite proxy); 103, 228 and 165 ms for the 3 concurrent E2E sign ups (scrypt N 2^14, `NODE_ENV=test`). Every other request waits while a sign up's transaction holds the single connection.
- **Acceptance criteria to tests:** AC1 `finance-schema.test.ts`, `database-schema.test.ts` (drift, registered migrations); AC2 `demo-generator.test.ts` and the manual rerun; AC3 `demo-dataset-content.test.ts`, `demo-dataset-schema.test.ts`; AC4 and AC14 `demo-seeding.test.ts`; AC5 `demo-seeding.test.ts` (triggers on the 14th bill and the first transaction batch); AC6 `demo-seeding-io.test.ts`, `demo-seeding.test.ts` (concurrency), `demo-dataset-schema.test.ts` (broken file stops the app); AC7 `demo-seeding-io.test.ts`; AC8 to AC10 `bank-data-provider.test.ts`; AC11 `first-login.test.ts` (every value of "What a first login shows"); AC12 `demo-seeding.test.ts` and `bank-data-source.test.ts`; AC13 `finance-enums.test.ts`, the entities, dataset schema and provider types import them (typecheck); AC15 `e2e/tests/demo-seeding.spec.ts`; AC16 `visible-transactions.test.ts`, `start-of-next-day.test.ts`, `bank-data-source.test.ts`.
- **Validation** (final run after the review fixes; outputs in `.claude/tasks/evidence/008/`):
  1. `npm run lint` exit 0; `npm run typecheck` exit 0. Rework loop 1: the first lint run had 16 oxlint findings in the new code (function scoping, `vi.fn` type parameters, error `cause`, two unsafe type assertions in `src/` replaced by type guards, sort compare, base-to-string, unnecessary assertions); fixed and re-run.
  2. `npm test`: shared 503/503, backend 330/330, frontend 474/474.
  3. `npm run e2e`: 51/51 (1 new). The "Money must be integer cents, got 12.5" console line comes from the component gallery's deliberate "Render a bad amount" button, also present in task 007's run.
  4. Visual: none. This task has no UI, so nothing was compared with `docs/figma/`. No Figma calls.
  5. Manual: `npm run demo:generate -w backend` left the staged JSON unchanged (same SHA-256, `git diff --exit-code` 0, `demo-generate.txt`); `npm run migrate` applied `CreateFinanceTables1792930295195` to the development database and a second run reported no pending migrations (`migrate.txt`); with `npm run dev` and Playwright MCP, a sign up by `fetch` from the page took 273 ms and the new user has 5 accounts, 3,411 transactions, 14 bills, 84 goals, 6 limits (read-only count, `dev-session-check.md`, `dev-row-counts.txt`). `npm run build` exit 0 (`build.txt`), `dist/demo/demo-dataset.json` present. The dev servers' leftover node processes on ports 3000 and 5173 were stopped before E2E.
- **Security review** (`security-review.md`): no findings. Checked SQL parameterisation, scoping of every provider method, cursor crafting, logs and responses during a failed sign up, the loader and seeder, the generator, the time zone input, and the attack surface (no new routes).
- **Code review** (`superpowers:requesting-code-review`): ready with fixes; 0 critical, 2 important, 4 minor.
  - Important: (1) this Log entry with the measured times was missing; added. (2) No security-review record on disk; the review had run with no findings, its report is now `evidence/008/security-review.md`.
  - Minor, all fixed: an invalid `occurredFrom` date silently returned no rows (now a `RangeError`, tests added, `VisibleTransactions` passes an invalid `occurredBefore` on); `TRANSACTION_BATCH_SIZE` renamed `INSERT_BATCH_SIZE`, its comment corrected (TypeORM writes numbers into the SQL, so a row binds at most 9 values); tests added for clocks going back at midnight (Santiago 5 Apr 2026, Cairo 29 Oct 2026; the code already handled them); the T10 check that could not fail now compares each concurrent user's rows with the whole dataset.
  - The reviewer cross-checked `startOfNextDay` against a brute-force scan of 23,360 instants in 16 zones (0 mismatches) and the generator constants line by line against `demo-data.md`.
  - Notes for later tasks: compare `bills.due_date` with a `YYYY-MM-DD` string of today in the user's zone, never a `Date` parameter (a `Date` binds as `YYYY-MM-DD HH:MM:SS.SSS`, which sorts after the plain date and would drop the bill due today), added to rows 015 and 023 in INDEX; a `Date` passed to raw `dataSource.query` throws in better-sqlite3, so keep date filters on the QueryBuilder.
- No Figma calls. Gate: human, status `awaiting-human`.

### 2026-10-25, approved (`/approve-task 008 approve`)
- Approved by human (Marko), with one check before the commit: the password hash in `AuthService.signUp` (task 007 code) must be computed before `dataSource.transaction` opens, so no thread-pool await happens inside the transaction on the single shared SQLite connection; if it were inside, stop without committing.
- **Checked:** it is outside. `backend/src/auth/auth.service.ts` awaits `this.passwords.hash(fields.password)` on the line before `this.dataSource.transaction(...)`; the transaction holds only the user insert, `DemoSeeder.seed` and the session, which are better-sqlite3 calls settling in microtasks.
- **Test added** in `backend/test/auth-signup.test.ts`, "hashes the password before the transaction opens, and the transaction never yields to the event loop". On a real sign up it records better-sqlite3's `inTransaction` when `PasswordHasher.hash` starts and when it resolves (both must be `false`), and wraps `dataSource.transaction` to queue a `setImmediate` when the transaction opens, which must not have run when it ends (any thread-pool or timer await inside the transaction fails this, not only the hash).
  - Red check: with the hash moved inside the transaction, the test failed with `expected [ true, true ] to deeply equal [ false, false ]`, and with that assertion skipped, the second one failed with `expected [ true ] to deeply equal [ false ]`. The code was restored (the diff of `auth.service.ts` against HEAD holds only the task 008 seeding lines) and the test passes.
- Re-validated after the test: `npm run lint` exit 0, `npm run typecheck` exit 0, `npm test` shared 503/503, backend 331/331, frontend 474/474 (seeding 70 ms), `npm run e2e` 51/51.
- Status `done`.

## Metrics
- Started: 2026-10-25 13:02
- Finished: 2026-10-25 14:34
- Human interventions: 3
- Rework loops: 1
- Notes on prompts that failed: the `security-review` skill asks for a reply with "the markdown report and nothing else", which ended the turn mid-task; Marko had to ask to continue. Interventions: the scope addition at the start (`VisibleTransactions`), that resume, and the approval with the hash-before-transaction check (a test added). Rework: 1 lint loop (16 oxlint findings in new code).
