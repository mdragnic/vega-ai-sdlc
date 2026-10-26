# Security review, task 011 (2026-10-26)

`security-review` on the task's uncommitted changes. The full diff (modified files against HEAD plus every new file, 2,252 lines) was reviewed by a sub-task, with repository context read for the guard, the auth controller, the time zone parser, the session client and the return target. Test and e2e files are out of scope.

**Result: no vulnerabilities at or above the bar (high or medium, confidence 8 or more). No findings to filter or fix.**

## Checked

- **`GET /api/calendar/today`**: behind the global `SessionGuard` (`APP_GUARD`), no `@Public()`; signed out, 401 (tested). Returns only `{ today }` from the injected Clock; reads no user data, no database access.
- **`X-Time-Zone` as input**: `parseTimeZone` (unchanged) accepts a strict IANA-name pattern, then canonicalises it with `Intl.DateTimeFormat`. Anything else gets a 400 with a fixed message, so the header is never echoed. The value reaches only `Intl.DateTimeFormat`: no SQL, file system, shell or template. The formatter cache is a `Map` keyed by canonical zone names, so it holds only real zones and allows no prototype pollution.
- **Logout**: the server side is unchanged (deletes the session row, clears the httpOnly cookie; a POST covered by `enableCsrfProtection()`). The client counts as signed out only after the 204 passes the contract schema. It then cancels in-flight session checks, sets the session to null and removes every other cached query. On a failure the session and cache stay and the user is told they are still signed in, which matches the server. If the server ended the session but its answer was lost, the message errs on the safe side.
- **Redirects and guard**: `/`, `/settings` and `*` go to fixed internal paths. After a logout Login has no return target; otherwise the existing `loginPathFor`, validated at Login by `returnTarget()`. No open redirect. The `loginPath` state in `RequireAuth` is discarded when Login opens and never carries over to another session.
- **XSS and sinks**: the name, first name, date and failure message are rendered as React text. No `dangerouslySetInnerHTML`, `innerHTML`, `eval` or `new Function` in `frontend/src`, `backend/src` or `shared/src`.
- **Logging, storage, secrets**: no new `console`, `Logger`, `localStorage` or `sessionStorage` use. `ScrollRestoration` stores scroll positions only, in `sessionStorage`. No hardcoded secrets. The evidence folder holds screenshots and text notes only.
- **Contract**: the path and the response schema exist once, in `shared/src/contract/calendar.ts`.

## Below the bar (not findings)

- Logout CSRF and the test-only `@Public` clock route already existed before this task.
- Memory or ReDoS through the zone header: excluded as DoS, and not exploitable here (bounded cache, no backtracking regex).
- A `today` request still in flight when the cache is cleared can return only a date, never user data.
