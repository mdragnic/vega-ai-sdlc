# Security review, task 021 (Account Details), 2026-11-02

`/security-review` on the uncommitted task changes (`git diff HEAD`, new files intent-to-add), run as a sub-task with the
skill's full instructions; a false-positive filter sub-task per finding was not needed, since no finding was raised.

## Result: no vulnerabilities

No finding with more than 80% confidence of real exploitability. Checked and ruled out:

1. **IDOR on `GET /api/accounts/:accountId`.** The global `SessionGuard` runs before every pipe and param decorator;
   neither route is `@Public()`. The user comes only from `@CurrentUser()`. `details` reads the account only through
   `getAccount(userId, accountId)` (`findOneBy({ id: accountId, userId })`, one query) and returns before reading any
   transaction when it is null; the balance's transactions come from `VisibleTransactions.list(userId, zone, { accountId })`,
   whose query holds `a.userId = :userId AND t.accountId = :accountId`: scoped twice.
2. **IDOR on `GET /api/accounts/:accountId/transactions`.** `hasAccount` (the same provider query) runs before anything
   is read; every page's query still filters by the session user and the account, so without the check another user's
   account gives no rows (T6's double case, T7, and the break-on-purpose run 2b).
3. **The cursor.** At most 64 characters by the shared schema; `decodeCursor` accepts only a cursor that re-encodes to the
   same text, and binds its values as parameters. It only sets a position inside the already-scoped query: a foreign
   cursor cannot widen the result or tell anything about other users' rows. No injection. (The cursor carries a global
   transaction ID, as task 020's `/api/transactions` already does: not new.)
4. **Probing account IDs.** Another user's, an unknown, a malformed (`^[1-9][0-9]*$`, safe integer) ID, an empty segment and
   an encoded slash all answer the same `404 {"message":"Account not found"}` with the same headers. The zone and query
   400s come before the account check, so they are the same for every ID; a bad cursor is a 400 only on the user's own
   account (another's is the 404 first). The error filter returns only `{ message }`. Only query timing remains:
   theoretical, excluded.
5. **Data in responses.** `details` builds exactly five fields, the number through `maskAccountNumber`; `toHistoryRow` picks
   only `occurredAt`, `status`, `direction`, `receipt`, `amount`. No full number, ID, opening balance or card network.
6. **The optional-group routes** (`{:accountId}`, path-to-regexp 8, checked with node): they match only the empty segment
   forms and the account paths, cannot shadow another route, and share the guarded handler.
7. **Frontend path building** (`apiRequest`'s `pathWith`): params parsed with the entry's schema to a safe integer, then
   `encodeURIComponent`; the page parses the route param with `accountIdSchema` first. A crafted URL cannot reach another
   API path; the backend validates on its own anyway.
8. **XSS.** Receipt, Bank Name and Branch Name render as React text nodes; no `dangerouslySetInnerHTML`, no `href` from data.
9. **Cross-user cache.** The new query keys are removed with every query when the session changes (existing
   `removeQueries`).
10. **CSRF and cross-origin reads.** Read-only GETs, no CORS enabled, `Cache-Control: no-store` on `/api`, and the required
    `X-Time-Zone` header forces a preflight.

Files reviewed: `backend/src/accounts/{account-not-found,accounts.controller,accounts.service}.ts`,
`backend/src/transactions/{transactions.controller,transactions.service}.ts`, `backend/src/bank-data/{typeorm-bank-data-provider,visible-transactions}.ts`,
`backend/src/auth/{session.guard,current-user.decorator}.ts`, `backend/src/common/errors/api-exception.filter.ts`,
`backend/src/{app.module,app.setup}.ts`, `shared/src/contract/{account,transaction,entry}.ts`,
`frontend/src/api/{client,accounts,transactions}.ts`, `frontend/src/app/pages/AccountDetailsPage.tsx` and the new components.

Fixes: none needed.
