# Security review, task 013 (2026-10-26)

`security-review` on the uncommitted change set of task 013 (the new `GET /api/accounts`, `AccountsService`,
`maskAccountNumber`, the shared account contract, and the Overview frontend). A sub-task read the changed and new
files against the repository's security model. Findings above confidence 8 would go to a false-positive filter; none
were raised.

**Result: no findings.**

What was checked:

- **Authentication on the new endpoint.** `SessionGuard` is the global `APP_GUARD` (`backend/src/auth/auth.module.ts`),
  under the `api` prefix. `AccountsController` and `list()` are not `@Public()`, so a session is required (401
  without one, e2e and API tests). The user comes only from `@CurrentUser()`, which reads the WeakMap the guard fills;
  nothing in the query, path or body selects a user. Module order in `AppModule` does not affect the global guard.
- **Authorization (one user's data only, #39, #46).** `listAccounts(userId)` filters `where: { userId }`;
  `VisibleTransactions.list(userId, timeZone)` joins the account and filters `a.userId = :userId`. Balances only for
  the user's own account IDs; any other `accountId` is skipped. No user-supplied IDs, filters or cursors: no IDOR.
- **Data exposure (#25).** The response is built field by field (`id`, `accountType`, `cardNetwork`, `maskedNumber`,
  `balance`); never `accountNumber`, the opening balance, Bank or Branch Name, or a transaction. `maskAccountNumber`
  keeps the last 4 digits only and throws with fewer than 4; the shared `maskedAccountNumberSchema` enforces
  `**** **** **** dddd`. The thrown `RangeError`s (mask, unsafe sums) reach `ApiExceptionFilter`, which logs the
  message and stack only (no account number) and answers a generic 500. Future-dated rows stay hidden
  (`VisibleTransactions`, #53).
- **Input validation and injection.** The only user input is `X-Time-Zone`, parsed by `parseTimeZone` (strict pattern
  plus `Intl.DateTimeFormat`), 400 otherwise. All queries are TypeORM `find` or the query builder with bound
  parameters; no raw SQL added.
- **Frontend.** `OverviewPage`, `TotalBalance`, `AccountTypeSlide`, `SliderOption`, `TotalBalanceSkeleton` render the
  response as React text; no `dangerouslySetInnerHTML`, no URL built from response data; logo `src` from static
  imports keyed by the enum. `apiRequest` is same-origin. Overview sits under `RequireAuth`. The gallery additions use
  hard-coded, already masked demo data on a development-only route.
- **Secrets and crypto.** None added.

Out of scope as instructed: tests (`backend/test`, `frontend/test`, `e2e`, `shared/test`) and documentation.
