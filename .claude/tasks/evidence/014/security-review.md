# Security review: task 014 (savings goal read and write)

Run 2026-10-26 with the `security-review` skill on the uncommitted changes of task 014: one sub-task identified
vulnerabilities (read-only, with the framework code in node_modules: Nest 12.2.0 CSRF protection and
`StandardSchemaValidationPipe`, TypeORM 1.1.2 `upsert`). It reported no finding at confidence 0.7 or above, so no
false-positive filtering sub-task was needed.

**No high-confidence vulnerabilities found.**

## Checked, and what makes each area safe

1. **User scoping.** Both routes take the user only from the session (`@CurrentUser()`, filled by the global
   `SessionGuard`; no `@Public()` on the new controller, so no session is a 401). No user or goal ID in the body, query
   or path. The read is `findOneBy({ userId, month })`; the write is `upsert({ userId, month, targetCents,
   presentCents }, { conflictPaths: ['userId', 'month'] })` against `UNIQUE("user_id", "month")`, with `user_id` always
   the session user, so the conflict can only hit the caller's own row. The upsert overwrites only `target_cents` and
   `present_cents`; `id` is never set.
2. **Mass assignment.** The row is built field by field: `userId` from the session, `month` from the server clock,
   only the two `cents` from the body. `z.object` drops unknown keys, and each amount is rebuilt as `{ cents,
   currency }`. The global pipe returns the parsed output and strips prototype keys first.
3. **Amount validation.** `moneySchema` requires safe-integer cents and `USD`; negatives are rejected, the Target must
   be above 0, both at most 100,000,000,000 cents; the database CHECK constraints repeat the rules.
4. **Month.** It must match `YYYY-MM` with a month 01 to 12; the server only compares it with its own current month
   (409 otherwise) and never stores the client's value. The time zone header is checked against an IANA pattern and
   `Intl`.
5. **SQL injection.** Only TypeORM `findOneBy`, `findOneByOrFail` and `upsert` with bound parameters; no raw SQL; the
   `where` values are a session number and a server-made string.
6. **CSRF on the new PUT.** `app.enableCsrfProtection()` covers every method but GET, HEAD and OPTIONS (Fetch
   Metadata, then an Origin-to-Host check); `backend/test/csrf.test.ts` covers the goal PUT cross-site and
   same-origin. CORS is not enabled; the API listens on 127.0.0.1.
7. **Data in responses.** Only `{ month, goal: { target, present, progress } }`, no row or user ID; the 409 carries a
   fixed message; validation errors carry rule messages and field paths, never input values; 500s are generic and log
   only the message and stack.
8. **XSS.** No `dangerouslySetInnerHTML`, `innerHTML` or `eval` in `frontend/src`; the new components render text
   through React; responses are parsed with the contract's Zod schema before use.
9. **Cache leaks between users.** `clearUserData` removes every query but the session and every mutation but the
   session's own, and counts the session; a save's `onSuccess` writes to the cache only if the count is unchanged, so a
   save answered after a logout, a 401 or a user switch changes nothing. A 401 from any request, and a session check
   that finds another email, clear the data; the page is keyed on the user, so a popup being typed in remounts empty.
10. **Dev gallery.** The route exists only when `import.meta.env.DEV` is true.

## Considered and dismissed (below the bar)

- A tab that has not yet re-checked the session after another tab signed in someone else: a Save clicked there before
  the check answers is sent with the new user's cookie and writes the new user's goal. No privilege boundary is
  crossed (that browser already holds the new user's session); stale data in an unfocused tab is not new here.
- A save paused offline and resumed later with another user's cookie: needs one tab offline and another online in the
  same profile, which `navigator.onLine` does not allow.
- Request size and body limits: out of scope (denial of service).

## Fixes

None needed.
