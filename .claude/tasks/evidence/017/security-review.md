# Security review, task 017 (2026-10-28)

Run with the `security-review` skill on the uncommitted changes. Its built-in diff was empty for uncommitted work, so the
new files were marked intent-to-add (`git add -N`) and the review sub-task read `git diff HEAD` (`.claude/`, `docs/` and
test-only files left out). No findings reached the false-positive filter: none at High or Medium.

**Result: no vulnerabilities found.**

## Checked

- **User scoping** (`backend/src/statistics/statistics.controller.ts`, `statistics.service.ts`): no `@Public()`; the
  global `SessionGuard` (`APP_GUARD`, `backend/src/auth/auth.module.ts`) answers 401 without a valid session. The user
  ID comes only from `@CurrentUser()` (a WeakMap the guard fills). The route takes no path, query or body parameter;
  a `userId` or `accountId` in the query is never read. Transactions only through `VisibleTransactions.list(userId, ...)`
  into `TypeOrmBankDataProvider.listTransactions`, which joins each transaction to its account and filters
  `a.userId = :userId`, parameterized. No `accountId`, `cursor` or `limit` passed; the range comes from the Clock and the
  zone on the server.
- **Response**: built field by field, `{ days: [{ date, lastWeek: {cents, currency}, thisWeek }], ticks }`; no
  transaction, account or user ID, item, shop or receipt.
- **`X-Time-Zone`**: through the existing `parseTimeZone` (IANA name pattern, accepted by `Intl.DateTimeFormat`, the
  resolved name returned); used only as an `Intl` `timeZone` option (`wallClock`, `todayIn`, `startOfDay`). It never
  reaches SQL, file paths, HTML or logs. `startOfDay` gets only server-computed dates and rejects anything that is not a
  strict `YYYY-MM-DD`.
- **`Cache-Control: no-store`** (`backend/src/app.setup.ts`), against the installed Nest 12.2.0:
  `NestApplication.use()` registers with Express at once; `enableCsrfProtection()` installs Nest's security hook at the
  moment it is called, after the middleware, so the CSRF 403 carries the header. The body parser, the routes, the
  404 and the error filter come later, at `init()`; the error filter does not clear headers. Nothing else in
  `backend/src` sets or removes `Cache-Control` or serves static files; the only global prefix is `api`.
- **The Google controllers without their own header**: every route is under `/api` (`/api/auth/google`, its callback,
  `/api/test/google/authorize` with `NODE_ENV=test` only); the middleware runs before any handler, so the 302s that set
  session cookies and the fake HTML page keep `no-store`.
- **Frontend and shared**: no `dangerouslySetInnerHTML`, `innerHTML`, `eval` or storage use added; the chart labels
  come from `formatDayLabel` (validates the date) and render through React; the `DataState` focus change and the
  `comparison` Dropdown variant have no security effect. The query key `['statistics', 'weekly-comparison']` is removed
  on sign-in, sign-out and user switch (`clearUserData` in `frontend/src/api/session.ts` removes every query but the
  session's). `shared/src/contract/statistics.ts` holds only Zod schemas.

## Set aside (excluded by the review's rules)

- The endpoint reads two weeks of the user's own transactions with no limit: a resource-use concern, out of the
  review's scope, and limited to the user's own rows.

## Fixes

None needed.
