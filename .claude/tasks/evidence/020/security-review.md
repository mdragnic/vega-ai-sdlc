# Security review, task 020 (2026-10-30)

Skill `security-review` on the pending changes (`git diff HEAD`, the new files intent-to-add). Step 1: one sub-task read the whole diff and the code it depends on (the provider, `VisibleTransactions`, the session guard, `@CurrentUser`, `@TimeZone`, the error filter, `validationException`, `app.module.ts`, `app.setup.ts`, `main.ts`, Nest's `StandardSchemaValidationPipe`). Step 2 (false-positive filtering) had nothing to filter. Step 3: nothing at confidence 8 or more.

## Result

No findings.

## What was checked

- **User only from the session.** No `@Public()` on the route, so the global `SessionGuard` answers 401 without a valid session; `userId` from `@CurrentUser()` (`transactions.controller.ts:35`). The query schema has no user or account key and drops unknown keys: `?userId=` and `?accountId=` are ignored.
- **Query validation.** `@Query({ schema: transactionsContract.list.query })` through the global `StandardSchemaValidationPipe` (strips `__proto__` keys, returns the parsed value). `tab` an enum, `cursor` an optional string of 1 to 64 characters; arrays, objects and unknown tabs answer 400 in the shared shape.
- **Transactions only through `VisibleTransactions`.** `transactions.service.ts:70`; `occurredBefore` always capped at the start of tomorrow from the injected Clock and the parsed zone; the cap is applied apart from the cursor, so no crafted cursor reaches a row dated after today.
- **Account types only through `AccountsService`.** `accountTypes(userId)` reads `listAccounts(userId)` (`where: { userId }`); a transaction whose account is not the user's would answer a generic 500 (the filter logs only message and stack).
- **Page size fixed in the backend.** `limit: TRANSACTIONS_PAGE_SIZE`; no client input reaches it.
- **A cursor the backend did not make answers 400.** `decodeCursor` checks a strict pattern and that the cursor re-encodes to the same text; `InvalidCursorError` becomes `BadRequestException('The cursor is not valid')`. Values bound as parameters: no SQL injection path.
- **No cursor reaches another user's rows.** The cursor is not signed but only names a position; every query is scoped by `a.userId = :userId`. A forged or another user's cursor pages through the requester's own rows (tested: `transactions-list.test.ts`, T8). The cursor carries the internal transaction ID, which reveals nothing exploitable.
- **Money and keys.** Only item, shopName, category, direction, occurredAt, `{ cents, currency: 'USD' }` and paymentMethod are sent; no ID, account, receipt or status.
- **Caching and CSRF.** `Cache-Control: no-store` on `/api`; a read-only GET under Nest's CSRF protection, SameSite=Lax cookie, no CORS; the required `X-Time-Zone` header and a top-level JSON object rule out script inclusion.
- **Frontend.** `apiRequest` parses the query with the contract schema and sets it with `URLSearchParams` (encoded); item and shop rendered as React text; no `dangerouslySetInnerHTML`, `innerHTML`, `eval` or dynamic `href` in the changed files.

No fixes needed.
