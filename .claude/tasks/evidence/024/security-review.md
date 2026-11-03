# Task 024 security review (`security-review`, 2026-11-03)

Run on the task's changes (`git diff HEAD`, the new files intent-to-add so the diff sees them; .claude/ and docs/
left out), after the visual and manual checks, before the gate. One sub-task identified issues; it found none, so no
false-positive sub-tasks ran. Read only: nothing changed, the app not run.

**Result: no findings** (none at confidence 8 or higher, none lower worth reporting).

What was checked, and why each area is safe:

1. **Authentication and authorization.** `GET /api/expenses/monthly-comparison` (`ExpensesController`) has no
   `@Public()`, so the global `SessionGuard` (`APP_GUARD`, `backend/src/auth/auth.module.ts`) answers 401 without a
   session. Its handler takes only `@CurrentUser()` and `@TimeZone()`: no route parameter, query or body chooses a
   user, account, category or period. The new route is in `cache-control.test.ts`'s list, so it carries `no-store`.
2. **User scoping.** `ExpensesService`'s one read is `VisibleTransactions.list(userId, timeZone, …)`, which reaches
   `TypeOrmBankDataProvider.listTransactions`: an inner join to the account with `a.userId = :userId`. The breakdown's
   new `recent` items and the chart's 24 months come from that read only, so only the session user's rows.
3. **SQL injection.** None: the only values passed down are `Date`s from `startOfMonth`, built from the Clock and a
   validated zone, bound as named parameters by the existing provider; no SQL is concatenated.
4. **"Now" and the zone.** "Now" only from the injected `CLOCK`; the zone only from `X-Time-Zone` through
   `parseTimeZone` (a strict IANA-name pattern and `Intl.DateTimeFormat`, 400 otherwise). The `plain-date.ts` helpers
   work only on dates the server derived.
5. **Data exposure.** `breakdown` maps each item explicitly to `{ item, amount: usd(amountCents), occurredAt }`: no
   transaction ID, account, shop, receipt, status or direction. `monthlyComparison` returns only `{ month, lastYear,
   thisYear }` and `ticks`. `expenseLineItemSchema` picks only those three keys; the frontend parses every response
   with the contract (`frontend/src/api/client.ts`). Money is integer cents with `USD` throughout.
6. **XSS.** Item names (transaction text) render as React text children (`ExpensesLineItem`); `occurredAt` goes into
   `<time dateTime>` (an escaped attribute, its format checked by `z.iso.datetime()`); the chart labels come from
   `formatMonthAxisLabel`, which rejects anything but `YYYY-MM`. No `dangerouslySetInnerHTML`, `innerHTML`, `eval` or
   `new Function` in `frontend/src`; the new CSS has no `url()` or `@import`.
7. **Other categories.** No new dependency, file operation, deserialization, crypto, secret, logging or debug output.

Excluded by the rules (noted, not a finding): the monthly comparison reads up to 24 months of the user's own
transactions with no limit: resource use only (DoS out of scope), no data exposure.
