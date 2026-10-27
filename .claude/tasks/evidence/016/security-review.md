# Security review: task 016 (Recent Transaction)

2026-10-27, `security-review` skill on the uncommitted changes. The skill's own diff was empty for uncommitted work, so
the new files were marked intent-to-add (`git add -N`) and the review sub-task read `git diff HEAD -- . ':!.claude'`
(34 files). Step 1 (identify) returned no candidate at or above 0.7 confidence, so step 2 (false-positive filtering)
had nothing to filter.

## Findings

None.

## What was checked, and why it is safe

- **Route authentication:** `TransactionsController` has no `@Public()`; `SessionGuard` is the global `APP_GUARD`
  (`backend/src/auth/auth.module.ts`), so `GET /api/transactions/recent` needs a valid session cookie (401 without one,
  covered by `backend/test/transactions.test.ts`).
- **User scoping:** the user ID comes only from `@CurrentUser()`, which the guard fills from the session token. Nothing
  in the route, query or body names a user; the provider joins through the account and filters `a.userId = :userId`.
  A `userId` or `accountId` in the query changes nothing, and no route takes an ID (tested, 404).
- **Data access path:** the service reads only through `VisibleTransactions.list` (entries after today in the user's
  zone hidden, today from the injected Clock); the module imports only `BankDataModule`, never the provider or a
  repository (source guards `bank-data-source.test.ts`, `no-direct-time.test.ts` and `transactions.test.ts`).
- **Injection:** the only values reaching the query are the literal directions, the constant limit 5 and a computed
  date, all bound as TypeORM parameters. No client-supplied cursor or account.
- **`X-Time-Zone`:** validated by the existing `@TimeZone()` (IANA name and `Intl`), 400 otherwise; unchanged.
- **Response exposure:** `toRecent` maps only `item`, `shopName`, `category`, `direction`, `occurredAt` and `amount`
  (integer cents, USD); no ID, account, receipt, status, user ID or account number. The Zod contract has the same keys.
- **CSRF / CORS:** a read-only GET with no side effects; CORS is not enabled; the existing Fetch Metadata CSRF
  protection is unchanged.
- **XSS:** the frontend renders the strings as React text and `occurredAt` only as a `<time dateTime>` attribute; the
  icon comes from a fixed map keyed by the category enum. No `dangerouslySetInnerHTML`, `innerHTML`, `eval` or
  data-built URLs.
- **Dev gallery:** the new samples are local fixtures behind `import.meta.env.DEV`, with no API calls.
- **Secrets and debug output:** none added.

No fixes needed.
