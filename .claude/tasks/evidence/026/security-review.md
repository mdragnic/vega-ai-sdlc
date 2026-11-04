# Task 026: security review

2026-11-04, `security-review` on the task's uncommitted changes (`git diff HEAD`, the new files intent-to-add): one review sub-task over the diff and the codebase's security model, then the false-positive filter (only findings at confidence 8 or more would be kept).

## Findings

None. No HIGH or MEDIUM finding with a concrete exploit path; nothing reached the filter, and nothing needed fixing.

## What was checked

1. **Authentication.** `SessionGuard` is the global `APP_GUARD` (`backend/src/auth/auth.module.ts:32`). It passes a route without a session only when the route is `@Public()` (`session.guard.ts:35`). `saving-summary.controller.ts` is not public, so a request without a session gets 401, as tested in `backend/test/saving-summary.test.ts`.
2. **The user comes from the session only.** The controller reads it with `@CurrentUser()` (`saving-summary.controller.ts:20`), which the guard fills from the session token. The query schema is `z.object({ month })`, so a `userId` key is dropped, and no path names a user. The two-user test and break 5 prove this.
3. **SQL and user scoping.** `GoalMonths.check` runs first. The one read then goes through `VisibleTransactions.list(userId, …)` to the provider's query, which has `a.userId = :userId` and bound date edges (`typeorm-bank-data-provider.ts:61, 66-67`). `GoalMonths.range` (moved unchanged) also binds its parameters. No raw SQL is built.
4. **Injection through the month or the zone.** The month passes the global validation pipe against `^\d{4}-(0[1-9]|1[0-2])$` and is only compared as a string or turned into dates; it never reaches SQL as text. The zone passes `parseTimeZone` (an IANA name, checked with `Intl`) and is used only for date arithmetic.
5. **Data exposure.**
   - The response is a literal `{ month, days, ticks }`, each day exactly `{ date, thisMonth, lastMonth }` in integer cents with USD. No row, ID, shop or account is sent, and the API test checks the key sets on the raw body.
   - A 409 carries only `goalMessages.monthUnavailable`. An unexpected error becomes the generic 500 body through `ApiExceptionFilter`, with the stack logged only.
6. **Money.** Daily sums are integer `amountCents`, signed by direction. The ticks are safe integers, checked in `signedAxisTicks`. The frontend computes only drawing positions.
7. **XSS and the SVG.**
   - There is no `dangerouslySetInnerHTML`, `innerHTML`, `href` or `xlink` anywhere.
   - Server values render only as React text through `formatChartDayLabel`, `formatMoney` and `formatCompactMoney`.
   - The `d` and `viewBox` attributes are built from numbers only.
   - `url(#…)` names a `useId()` id, never input.
8. **Caching.**
   - Every `/api` response carries `Cache-Control: no-store` (`app.setup.ts:10`), and the cache-control test covers the new route.
   - The frontend query `['saving-summary', month]` is removed by `clearUserData` when a session starts or ends or the user changes (`frontend/src/api/session.ts:59`; Goals test "is removed with the rest of the cached data at a logout").
   - Nothing is kept in browser storage.
