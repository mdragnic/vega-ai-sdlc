# Security review: task 018 (`GET /api/expenses/breakdown`)

Run on 2026-10-29 with the `security-review` skill, on the uncommitted changes. The task's new files were marked
intent-to-add so `git diff HEAD` included them. A sub-task read the whole diff (45 files) and the code it depends on.
It had read-only access.

**Result: no vulnerabilities found.** No finding reached the report threshold (HIGH or MEDIUM, confidence 0.8 or more),
so the false-positive filtering step had nothing to filter.

## What was checked

- **User from the session only.**
  - `expenses.controller.ts:17-19` takes only `@CurrentUser()` and `@TimeZone()`. It has no `@Param`, `@Query` or `@Body`.
  - The global `SessionGuard` is registered as `APP_GUARD` (`auth.module.ts:32`), and the route is not `@Public()`.
  - `CurrentUser` reads a WeakMap that only the guard fills.
- **Transactions only through `VisibleTransactions`.**
  - The service calls `visibleTransactions.list(userId, timeZone, …)` (`expenses.service.ts:41-45`).
  - The module never injects the provider or a repository.
  - The provider scopes queries with `a.userId = :userId` and bound parameters, so there is no SQL injection. The request carries no filter values anyway.
- **Time.**
  - "Now" comes from `@Inject(CLOCK)` (`expenses.service.ts:38`).
  - The month edges come from `startOfDay`, which throws for anything that is not a plain date.
  - The zone goes through `parseTimeZone`: an allowlist regex plus `Intl` resolution, with a 400 when the zone is missing or invalid.
- **Money.** Totals are integer cents with `USD` (`expenses.service.ts:51, 60`). The contract refines `cents >= 0`.
- **Percentage.**
  - The change is computed with BigInt integer arithmetic (`percent-change.ts:17-28`).
  - Both inputs are checked as safe integers of 0 or more, and so is the result.
  - Last month at 0 returns `null`, so there is no division by zero.
- **Response keys.**
  - The service builds `{ category, total: { cents, currency }, change }` literally.
  - No IDs, item or shop names, receipts or account numbers leave the backend.
  - Categories come from the fixed `expenseCategorySchema.options`.
- **Caching.** The global `Cache-Control: no-store` middleware covers the route, and `cache-control.test.ts` lists it.
- **Errors.** The new `RangeError`s become a generic 500 ("Internal server error"). The details are logged only on the server.
- **XSS.**
  - The new components use no `dangerouslySetInnerHTML`, `innerHTML` or `eval`.
  - Labels come from fixed maps, the link target is the constant `paths.expenses`, and values render as React text.
- **Secrets and surface.** The diff adds no secrets, no new dependencies, no `@Public` routes and no `process.env` reads. The gallery changes are static demo props.

## Findings and fixes

None.
