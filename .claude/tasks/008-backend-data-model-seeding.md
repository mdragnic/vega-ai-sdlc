# Task 008: Backend: data model, BankDataProvider, demo dataset generator and sign-up seeding

- Status: todo
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
  - Hiding entries dated after today, Complete-only sums, balances, totals and masking are app-service calculations of later tasks over this raw data (#57, #77).
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

## Metrics
- Started:
- Finished:
- Human interventions: 0
- Rework loops: 0
- Notes on prompts that failed:
