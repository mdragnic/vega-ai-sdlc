# Security review, task 009 (2026-10-25)

`security-review` on the uncommitted task 009 changes (Login, route protection, session state, return target,
`ButtonPrimary` loading). A subagent reviewed the production files read-only; the bar was more than 80% confidence of
a real exploit.

## Result: no findings

## What was checked and why each concern does not hold

1. **`returnTo` as an open redirect** (`frontend/src/routes/return-to.ts`, `returnTarget`; `LoginPage.tsx`)
   - The raw value must start with `/`, must not be `//` or `/\`, and must contain no C0 or DEL character, so
     absolute URLs, `javascript:`, a missing slash and `/\t/host` or `/\n/host` fail first.
   - It is then parsed with `new URL(value, origin)`. The origin is compared, and the percent-decoded pathname is
     checked again. That catches `/.//evil.com`, `/%2e//evil.com` and `/a/..//evil.com`, which the parser turns
     into `//evil.com`, and encoded `%2F` and `%5C`. A malformed `%` gives Overview.
   - The result is the parser's own path, query and hash, so it always starts with `/` and then a character that is
     not `/` or `\`. Navigation is only React Router's `navigate(..., { replace: true })`, never `window.location`.
   - Fuzzed: about 2.45 million strings of `/`, `\`, `.`, `..`, `%2e`, `%2f`, `%5c`, `%252f`, tab, newline, `%09`,
     `%00`, `@`, `:`, `?`, `#`, `javascript:`, `http:`, unicode slashes and dots, `login` and `LOGIN`, raw and after
     `URLSearchParams` decoding, then through React Router 8.5.0 `resolveTo` and `new URL(..., origin)`. None left
     the origin; none reached an auth screen.
   - Not a security issue: `/login;x` and `/login%20` pass the auth-screen check, but React Router does not match
     them to Login.
2. **Another user's cached data (#39)** (`frontend/src/api/session.ts`)
   - A 401 from any query or mutation, except the login mutation (exact key), sets the session to signed out and
     removes every other query. Removing a query cancels its request, so a request still in flight cannot refill
     the cache.
   - A successful login removes every other query too, which covers a failed (non-401) session check that signed
     out without clearing.
   - `useSession` fails closed: an error or `null` counts as signed out.
   - The login mutation (its variables hold the password) has `gcTime: 0`.
   - The client guards only decide what renders; the server's `SessionGuard` is the authorization boundary.
3. **XSS and data exposure**
   - No `dangerouslySetInnerHTML`, `innerHTML` or `window.location` write in `frontend/src`. Server messages render
     as React text; a 5xx or a response without the shared shape shows "Something went wrong."
   - The form always calls `preventDefault`, so credentials never go into a GET query string.
   - `loginPathFor` encodes the return path with `URLSearchParams`. The CSS and token changes load nothing external.

## Hardening notes, below the bar (no change in task 009)

- A session that changes from user A to user B **without a 401 in this tab** (A logs out in tab 2, B logs in there,
  tab 1 gets focus back and its check returns B) keeps A's cached queries until they refetch. No data queries exist
  yet (app pages render the empty frame), so there is no impact today. Raised as a follow-up for the screen tasks.
- The mutation cache is not cleared when a session ends. It matters only once later mutations carry user data and a
  screen reads it with `useMutationState`. Raised as a follow-up (also code review Minor 3).

## Addendum after the gate (#98, 2026-10-25)

Marko answered #98: only the first session check counts a failure other than a 401 as signed out; after that only a
401 ends the session. `useSession` now keeps the last known state when a re-check fails with a 500 or a network
failure, so "`useSession` fails closed" above now holds for the first check only. The `security-review` skill was not
run again for this change. My own check of it: the server's `SessionGuard` still decides every request, and any 401
still ends the session and removes the cached queries. A failed re-check only keeps on screen what was already there,
and the first check still fails closed.
