# Task 012 security review (2026-10-26)

Scope: the uncommitted task 012 changes (`git diff HEAD` plus the new files under `backend/src/auth/google/`,
`shared/src/routes/`, `frontend/src/api/google.ts` and the tests). Run with the `security-review` skill: one
review sub-task read the diff, every new file, the auth, session, guard, filter, config and users code they use,
the Vite proxy, decisions #2, #75, #102 and #103, and the ID token checks of google-auth-library 11.3.1.

## Findings

No HIGH or MEDIUM vulnerability above the confidence bar (8 of 10). Nothing to fix; no false-positive filter pass
was needed.

## Attack paths checked

- Login CSRF through the callback: the state is 256 random bits in an httpOnly cookie, compared in constant time
  with a `state` that must be one string (`google-sign-in.service.ts`). The cookie is cleared on every callback,
  and a code only works with the verifier in the browser's own cookie. Another site cannot read the state or plant
  its cookie. (E2E: another browser's unused code fails in the victim's browser and still works in its own.)
- Forcing a victim through `/api/auth/google`: signs them in as themselves at most, never as the attacker.
- Open redirect through `returnTo`: checked at the start, again when read back from the cookie, and by
  `returnTarget` before the redirect. The shared rule wants one leading `/`, refuses `//`, `/\` and control
  characters, parses against a fixed origin and re-checks the decoded pathname (`/..//evil`, `/%2f%2fevil`,
  `/%5cevil`, `/a\..\\evil`, `/%09/evil` all give none). Login also passes the value through `returnTarget`.
- Header injection through `Location`: only Google's authorization URL or a URL-serialized, percent-encoded path
  built with `URLSearchParams`; control characters are refused, and Node refuses CR/LF in headers.
- An edited sign-in cookie: base64url, then a strict schema with two 43-character tokens; `returnTo` re-checked.
  Editing it affects only the editor's own browser.
- Email matching: `email_verified` must be exactly `true`; `verifyIdToken` checks signature, audience (the client
  ID), issuer and expiry; the email passes `emailSchema` (its ASCII-only check runs before lowercasing). Matching
  by lowercased email is decision #2.
- Session fixation: the presented session is deleted and a new 256-bit token issued in the same transaction.
- Client secret and library errors: `GoogleAuthLibraryClient` replaces every library error with its own message,
  without a cause; the service logs one fixed reason; `AppConfig` is never logged.
- The fake Google page: registered only with `NODE_ENV=test` (trusted), test database, loopback server; the
  reflected `state` and `code_challenge` are HTML-escaped; its POST redirects only to the fixed redirect URI.
- Repeated query parameters: `state`, `code` and `returnTo` must be strings, so arrays are refused.
- `returnTo` naming an `/api` GET route: a redirect to the user's own data at most; Logout is a CSRF-protected POST.
- Frontend XSS: the message is a constant rendered by React; `window.location.assign` gets a relative `/api` URL.

## Noted, below the bar (not a finding of this task)

Password sign-up never verifies the email (#15: no verification step). Someone could sign up first with another
person's address; when that person later uses Google with it, #2 signs them into that account ("pre-account
hijacking"). Accepted by #2 and #15 as decided; both servers are loopback-only (#73). Listed for the human gate.

# Re-run after the gate rejection (#104), 2026-10-26

Same skill and scope, focused on #104 (an existing password user matched by Google: all their sessions deleted and
`password_hash` set to NULL in the same transaction). One review sub-task, then one false-positive filter sub-task
for its one candidate.

## Findings

None at or above the bar (8 of 10).

## Below the bar, for the gate (kept by the filter at 7 of 10, MEDIUM or LOW-MEDIUM)

A password login already in flight when the takeover commits still gets a 30-day session.
`AuthService.login` (task 007, `backend/src/auth/auth.service.ts:59-66`) reads the user outside a transaction, then
waits for scrypt (`PasswordHasher.verify`, hundreds of milliseconds at N=2^17), then opens a transaction and inserts
the session for that user without checking that `password_hash` is still the one it verified. If the victim's
Google transaction (`startUserSession`) commits in between, the attacker's login inserts its session after the
deletion, and `SessionGuard` accepts it for 30 days. An attacker who signed up first with the victim's email and keeps
logging in, one request after another (no rate limits, #14), has a login in that window almost all the time and can
tell which token survived. Limits: the loop must run until the victim's first Google sign-in; the app runs on
loopback only (#73). Suggested fix: in the login transaction, re-read the user and require `passwordHash` to equal
the verified hash before inserting the session, otherwise the usual 401 (or a credentials version on sessions); plus
a test that runs the Google round trip while a login's verify is pending. Not changed: it touches task 007's login,
outside the gate feedback; Marko decides.

## Attack paths checked, not exploitable

- #104 in one transaction: `findOneBy`, `deleteAllOf`, `removePassword` and `startSession` all use the transaction's
  manager; a failed session insert rolls everything back (T32 trigger test).
- Session check caching: `SessionGuard` reads the database on every request; deleted sessions get 401 at once.
- Other credentials or tokens after the takeover: none exist (no reset tokens, email change, API keys or stored
  Google tokens). The username is generated from the email; no endpoint writes data an attacker could plant.
- Triggering the wipe on someone else's account: needs a verified Google ID token for that email (signature,
  audience, issuer, expiry checked); the fake client exists only with NODE_ENV=test (trusted).
- Forcing a victim through `/api/auth/google`: signs them in as themselves; at most removes their own password.
- Login CSRF, open redirect through `returnTo`, the sign-in cookie, logging, the fake page: as in the first run.

# Second re-run, after the login race fix, 2026-10-26

Same skill and scope, focused on `AuthService.login` re-reading `password_hash` in its transaction after scrypt
(#104 note), then #104 and the rest. One review sub-task; no candidate, so no filter sub-task.

## Findings

None at or above the bar; nothing reached 7 of 10.

## Checked

- The re-check closes the race: with better-sqlite3 every statement runs synchronously on the one shared query
  runner, so BEGIN, the re-read, the comparison, the presented-session delete, the insert and COMMIT settle in
  microtasks within the turn the scrypt callback starts; no other request runs in between, and the Google
  transaction (opened only after Google answered) cannot interleave. Google committing during scrypt: the re-read
  finds NULL, 401, nothing written. Google committing after the login: `deleteAllOf` removes that session. A login
  after the takeover: fails against the dummy hash. The hash cannot come back (salted; no route sets a password).
- No new leak: the same 401 "Email or password is incorrect" in the same shape; the branch is reachable only with
  the right password, so its timing tells nothing about which emails exist; the rollback leaves the presented
  session as any failed login does.
- #104, login CSRF and PKCE, the ID token checks, open redirect and Location, session fixation, the test-only
  surface, logging, cookie decoding, the frontend: as in the earlier runs.

## Below the bar or excluded

- Forced Google sign-in (low): another site can send a signed-in victim to `GET /api/auth/google`; if Google
  completes without asking, the victim's own password account becomes Google-only and their other sessions end
  (#104). No one else gains access; the victim's own account, close to DoS.
- Cookie tossing from another app on localhost: such an app could set `finebank_session` as well; not new.
- Gmail dot and plus aliases make separate accounts, not a takeover (#2, #15).
