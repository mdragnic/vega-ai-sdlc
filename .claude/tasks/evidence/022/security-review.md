# Security review, task 022 (2026-11-02)

Run with `security-review` on `git diff HEAD`, new files intent-to-add (46 files). Step 1, a review sub-task with the
repository read-only; step 2, false-positive filtering of each finding (none to filter); step 3, findings below 8 dropped.

## Result: no vulnerabilities found

No HIGH or MEDIUM finding with real exploitation potential.

## Checked
1. Cross-user access through `PATCH /api/accounts/:accountId`: the user only from `@CurrentUser()` (the session guard);
   the ID through `accountIdFrom` (strict rule, one 404); the provider's one `update({ id: accountId, userId })`; the
   read-back and the transactions scoped to the user; `/api/accounts//` the same 404.
2. Mass assignment: `accountDetailsRequestSchema` strips unknown keys; the validation pipe returns the parsed value; the
   service and the provider copy only `bankName`, `branchName`, `accountType`.
3. The write guard: in the global session guard, after the 401, before pipes and handlers; no method override; HEAD and
   OPTIONS do not reach the write handlers; the public routes are the existing auth, Google and test-only ones. It is a
   stale-tab protection; authorization stays the session plus user-scoped queries. CSRF covers PATCH (Nest exempts only
   GET, HEAD and OPTIONS); no CORS.
4. The `X-Expected-User` value is never logged or echoed: fixed messages; the error filter logs only non-HTTP errors'
   message and stack.
5. The response holds exactly the five contract fields; no full number, opening balance, card network or ID.
6. The frontend path parameter: parsed with `accountIdSchema`, sent through `pathWith` (params schema, encoded, `.` and
   `..` refused); same-origin; the extra header cannot override `Accept` or `X-Time-Zone`.
7. Injection and XSS: parameterized TypeORM update; names rendered as React text, no `dangerouslySetInnerHTML`; control
   characters refused, 100 code points at most.
8. `UsersService.emailOf`: parameterized `findOne` by ID, the email only, never in a response.
9. `sendWrite` and the 409 handling: the tab's own user's email to its own backend; a 409 only re-checks the session.

Findings fixed: none needed.
