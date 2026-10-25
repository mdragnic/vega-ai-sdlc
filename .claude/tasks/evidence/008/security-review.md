# Task 008: security review

2026-10-25, `security-review` skill on the task's uncommitted changes against HEAD `eb7da64`. One review sub-task read the diff, every new non-test file and the relevant TypeORM 1.1.2 internals. A false-positive filter pass was not needed: it reported no finding.

## Result

No HIGH or MEDIUM vulnerabilities. No findings to fix.

## What was checked

- **SQL injection** (`backend/src/bank-data/typeorm-bank-data-provider.ts`): every query-builder condition uses named parameters; `limit` is checked to be a safe positive integer; repository calls take object criteria, and TypeORM 1.1.2 throws on `undefined` where-values (`invalidWhereValuesBehavior` defaults to throw), so a missing value cannot widen a query.
- **User scoping:** `listAccounts` uses `where: { userId }`; `getAccount` uses `findOneBy({ id, userId })`; `updateAccountDetails` uses `update({ id, userId }, …)` with only the three named fields (no mass assignment); `listTransactions` inner-joins `accounts` with `a.userId = :userId`, and every filter is ANDed onto that. The cursor's OR is parenthesised, so precedence cannot bypass the user filter. Another user's `accountId` returns nothing.
- **Cursor crafting:** a strict pattern, a safe-integer ID and a re-encode comparison. A crafted valid cursor only moves the start of the page, inside the signed-in user's rows.
- **Leaks during sign up:** `ApiExceptionFilter` logs only message and stack, and the client gets "Internal server error". `QueryFailedError` messages hold the SQLite text, not the values. TypeORM query, failed-query and slow-query logging are off. The seeder's own error has no data. The response is still `toCurrentUser` only.
- **Loader and seeder:** a committed file at a fixed path, read once at startup, `JSON.parse` plus a Zod `strictObject` schema (unknown keys such as `userId` or `__proto__` are rejected). The session user's `userId` is spread last, so the dataset cannot override it. `accountIndex` is bounds-checked. Nothing here is reachable from a request.
- **Generator script:** a developer-only command. Its only input is an optional output path from argv.
- **Time zone:** `Intl.DateTimeFormat` treats the zone as data; the `@TimeZone()` decorator already validates the header and gives the canonical IANA name.
- **Attack surface:** no new controllers, routes or `@Public()`; the global `SessionGuard` is unchanged; Zod keeps the same version; the migration has only schema statements.

## For later tasks (not a finding)

`BankAccount.accountNumber` carries the full 16 digits. Masking it, and keeping provider rows out of logs and responses, belongs to the tasks that add HTTP endpoints (#25, task 013).
