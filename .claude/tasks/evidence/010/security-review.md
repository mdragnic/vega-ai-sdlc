# Security review: task 010 changes

Run with the `security-review` skill on 2026-10-25 over the uncommitted changes against `044d9c5` (the skill's own
diff against `origin/main` was empty, so the sub-task read `git diff HEAD` and the untracked files).

No vulnerabilities at or above the reporting threshold (confidence 8 of 10). The review sub-task found no candidate
above 0.7, so no false-positive filtering was needed.

Checked:
- XSS: server messages (now from any 4xx in `serverFieldErrors`) reach React only as text children (`FormError`,
  `FieldError`); no `dangerouslySetInnerHTML`, `innerHTML` or `eval` in `frontend/src`.
- Redirect after sign up: always `paths.overview`; `returnTo` is never read on Sign up. Login keeps `returnTarget`.
- An earlier user's cached data (#39): `useSignUp` goes through the shared `useSessionStart`, whose `onSuccess`
  calls `setSessionUser`, which removes every other cached query.
- The password in the mutation cache: `gcTime: 0` on sign up too; no other observer of either mutation key; no
  React Query Devtools and no `console.log` in `frontend/src`.
- A 401 from sign up: the `MutationCache` exemption still covers only login; a 401 would set signed out and clear
  the cache, which fails safe (the backend answers 201, 400 or 409).
- Routes: Sign up and Forgot Password under `GuestOnly`; the backend sign up API is unchanged.
- CSRF: sign up uses the same `apiRequest` as login (same origin, JSON), so the Fetch Metadata protection of
  `backend/src/app.setup.ts` applies.
- Forgot Password (#16): the submit handler sends nothing; no endpoint, no reset token.
- E2E helpers: the only credential is the throwaway test password with random UUID emails on the test database.
- The email-taken message (409 with `fieldErrors.email`): the account discovery accepted by #15, not reported.

## Gate rework (2026-10-25), my own check

The skills were not run again; the feedback asked for two changes only.
- `GuestOnly` now lets a sign up in progress finish (`useSessionStartInProgress`, the login and sign up mutation
  keys, exact match). A signed-in user who opens `/sign-up` or `/forgot-password` has no such mutation and still
  goes to Overview (unit T9 and T12, E2E T17). The sign up mutation has `gcTime: 0`, so its success state goes
  with the screen and cannot keep a later visit from being redirected. The server still decides every request.
- After a 409 focus moves to Email. Only focus changes: the message is still React text in `FieldError`, linked
  with `aria-describedby`; no new markup, no live region.
