# Task 012: Google sign-in

- Status: done
- Gate: human
- Depends on: 010, 011
- Size: L
- Skills: `superpowers:test-driven-development`, `superpowers:verification-before-completion`, `superpowers:requesting-code-review`, `security-review` (auth, sessions, a new way into the app: the OAuth state and PKCE verifier cookie, login CSRF through the callback, the open redirect through `returnTo`, account matching by email with `email_verified`, the client secret in config and logs, Google library errors in logs: run it on the task's changes and fix every finding before the gate), `frontend-design:frontend-design` (undesigned states only: the Google failure message above "Login", which reuses `FormError`)

## Goal
"Continue with Google" on Login and Sign up signs a user in through Google's authorization code flow with PKCE (#75): a verified Google email signs in the user with that email, or creates one with the demo dataset (#2, #78), with a 30-day session (#63), and the browser opens the page asked for or Overview (#3). Cancel returns to Login with no message, failure to Login with "Google sign-in failed. Please try again." (#81). It is built and tested against the fake Google client (#75); with no real client configured outside tests, it fails safely to Login with that message (#102).

## References
- Spec: `docs/spec/stories.md` US-01 criteria 13 and 16, US-02 criteria 9 and 15; `docs/spec/brief.md` Screen flow (Auth), Not designed (Auth, Session)
- Figma: Login `137:7477`, PNG `docs/figma/101. Login.png`; Signup `137:8071`, PNG `docs/figma/102. Signup.png`. No screen changes: the Google button is built (tasks 009, 010); the Google pages are Google's. Budget 0, no MCP calls.
- Code to reuse:
  - Backend (task 007, 008): `AuthService` (`startSession`, the transaction pattern of `signUp`), `UsersService.create` (username #62, #67; `EmailTakenError`), `toCurrentUser`, `DemoSeeder.seed`, `sessionCookieOptions(true)`, `SESSION_COOKIE`, `@Public()`, `ClockModule`'s test-only controller pattern (`TestClockController`), `readConfig` and `backend/.env.example`, `createTestApp` and `backend/test/helpers/auth.ts`, `financeRows`, `userIdOf` and `tableCounts` (`backend/test/helpers/finance.ts`).
  - Shared: `emailSchema`, `authMessages` (`shared/src/contract/auth.ts`).
  - Frontend (tasks 009, 010): `LoginPage.tsx`, `SignUpPage.tsx`, `FormError`, `ButtonSecondary` with the `Google` image, `returnTarget`, `RETURN_TO_PARAM` and `loginPathFor` (`frontend/src/routes/return-to.ts`), `paths` (`frontend/src/routes/paths.ts`), `GuestOnly`.
  - E2E: `e2e/helpers.ts` (`newUser`, `signUp`, `sessionCookie`, `collectErrors`).
  - Dependency: `google-auth-library` 11.3.1, already in `backend/package.json`. No new dependency.
- Decisions: `docs/decisions.md` #2 (Google in scope, matched by email, Google-only users have no password), #3 (return to the page asked for, else Overview; signed-in users on Login and Sign up go to Overview), #15 (email trimmed and lowercased), #39 (never another user's data), #62 and #67 (name from the Google profile, generated username), #63 (30-day session after Google sign-in), #74 (shared contract, nothing redeclared), #75 (code flow with PKCE, state and verifier in a 10-minute httpOnly cookie, scopes `openid email profile`, `email_verified` required, fake client with `NODE_ENV=test`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `backend/.env`), #78 (new users seeded in the sign-up transaction, no real I/O inside it), #80 (no `X-Time-Zone` on browser navigations; nothing here needs the zone), #81 (cancel and failure), #97 (the message above "Login" and its lifetime), #102 (built against the fake client; unset variables fail safely), #103 (the name of a new Google user: the part of the email before `@` when the profile has no name, cut to 100 characters when longer; Google never changes an existing user's name), #104 (an existing user with a password, matched by Google: their other sessions deleted and the password removed in the same transaction, no message)

## Scope
- **Reuse first** (one rule, one place, #74):
  - `paths` and `accountDetailsPath` move to `shared/src/routes/paths.ts`, exported from `@finebank/shared`; `frontend/src/routes/paths.ts` re-exports them, so no frontend import changes and `frontend/test/routes/paths.test.ts` passes unchanged. The backend redirects to `paths.login` and `paths.overview` from there, never to its own copies.
  - The return-target rule moves to `shared/src/routes/return-to.ts`: `RETURN_TO_PARAM` and `returnTarget(value)` with its helpers (safe relative path, control characters, decoding, auth screens). It parses against a fixed base origin instead of `window.location.origin`: only a value that starts with one `/` gets that far, so every input gives the same result as today. `frontend/src/routes/return-to.ts` re-exports both and keeps `loginPathFor`; `frontend/test/routes/return-to.test.ts` passes unchanged, and the same table runs in `shared/test/return-to.test.ts`. The backend uses this one rule when it stores `returnTo` and again before it redirects (task 009 rule: a relative in-app path only, never an open redirect).
  - `AuthService.startSession` (replaces the presented session), `UsersService.create` and `DemoSeeder.seed` are reused as they are.
- **Shared contract** (`shared/src/contract/auth.ts`):
  - `authMessages.googleFailed`: "Google sign-in failed. Please try again." (#81).
  - `googleSignIn`: the two browser routes, relative to `/api` like contract entries, `start: '/auth/google'` and `callback: '/auth/google/callback'`, plus the Login marker for a failed sign-in, the query parameter `googleSignIn` with the value `failed`. They are page navigations that answer with redirects, not JSON endpoints, so they are not `ContractEntry` objects.
- **Config** (`backend/src/config/config.ts`, `backend/.env.example`):
  - `readConfig` reads `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. `AppConfig.google` is `{ clientId, clientSecret, redirectUri }`, or `null` when either variable is unset or empty (#102).
  - The redirect URI is the #75 value, `http://localhost:5173/api/auth/google/callback`: a constant in config built from the app origin and `googleSignIn.callback`, not a variable.
  - `backend/.env.example` lists both variables empty, with a comment: create a Google OAuth client with that redirect URI; empty means "Continue with Google" fails to Login with the #81 message; tests always use the fake (#102). The existing config test (every variable read is listed) covers them.
- **Google client** (`backend/src/auth/google/`), an interface injected by the token `GOOGLE_CLIENT` (#75):
  - `GoogleClient.authorizationUrl({ state, codeChallenge }): string`: Google's authorization URL with the client ID, the redirect URI, `response_type=code`, `scope=openid email profile`, `state`, `code_challenge` and `code_challenge_method=S256`. No `prompt` and no offline access: Google shows its account chooser when it needs to, and no refresh token is asked for.
  - `GoogleClient.profile({ code, codeVerifier }): Promise<GoogleProfile>`: exchanges the code with the verifier, verifies the ID token (signature, audience = the client ID, issuer, expiry) and returns `{ email, emailVerified, name }` from its claims, with `email` and `name` possibly missing. It throws on any failure. Google's tokens are used once and never stored.
  - `GoogleAuthLibraryClient`: `OAuth2Client` from `google-auth-library` (`generateAuthUrl`, `getToken` with the `codeVerifier`, `verifyIdToken`).
  - `FakeGoogleClient`, used whenever `NODE_ENV=test`, whatever the variables say (#75, #102):
    - Its authorization URL is the test-only page `GET /api/test/google/authorize` (`FakeGoogleController`, registered only with `NODE_ENV=test`, public, like `/api/test/clock`).
    - The page is a plain HTML form titled "Fake Google", prefilled with a fixed profile: name "Google Tester", email `google.tester@example.com`, "Email verified" checked. Tests change the fields (a unique email per test, an unverified email, a name).
    - "Continue" redirects to the callback with a one-time code and the state. "Cancel" redirects with `error=access_denied`, as Google does when the user cancels. "Fail" redirects with `error=server_error`.
    - The code maps in memory to the profile entered and the code challenge. `profile` accepts a code once and only with the verifier whose S256 hash is that challenge, so the tests prove the PKCE wiring end to end. It redirects only to the configured redirect URI.
  - No client (`NODE_ENV` not `test` and `AppConfig.google` null): `GOOGLE_CLIENT` provides `null` (#102).
- **Routes** (`backend/src/auth/google/google-auth.controller.ts` and a `GoogleSignInService`), both `@Public()` and `GET` (Nest's CSRF protection lets GET pass; the state check protects the callback), both answering `302` with `Cache-Control: no-store`. Neither needs `X-Time-Zone` (#80); "now" only from the Clock, through `SessionsService`.
  - `GET /api/auth/google?returnTo=<path>`:
    - No client (#102): `302` to Login with the failure marker and the valid `returnTo`, no cookie, nothing sent to Google.
    - Otherwise: a random 256-bit `state`, a PKCE verifier (32 random bytes, base64url, 43 characters) and its S256 challenge. `returnTo` is kept only when it is one string that `returnTarget` accepts as given (a repeated parameter, an unsafe value or an auth screen keeps none).
    - The cookie `finebank_google_signin` holds `{ state, verifier, returnTo? }` as base64url JSON: `HttpOnly`, `SameSite=Lax` (Google's redirect back is a top-level GET, which carries it), `Path=/api/auth/google`, `Max-Age=600` (#75), no `Secure` (plain HTTP on localhost, as the session cookie).
    - `302` to `authorizationUrl`.
  - `GET /api/auth/google/callback`:
    - The sign-in cookie is cleared in every outcome, with the same path.
    - Cancel (#81): `error=access_denied` gives `302` to Login with the cookie's `returnTo` (if any) and no marker. No session, no user.
    - Failure (#81): `302` to Login with the cookie's `returnTo` (if any) and `googleSignIn=failed`. No session, no user, no rows. It covers:
      - any other `error`;
      - a missing, unreadable or malformed cookie (expired after 10 minutes, another browser, a second sign-in started in another tab);
      - `state` missing, or not equal to the cookie's (compared in constant time); this also stops login CSRF, since another site cannot plant its own state in the victim's browser;
      - `code` missing;
      - the code exchange or the ID token verification fails (a wrong verifier included);
      - `email_verified` not `true` (#75);
      - the email missing or failing the shared `emailSchema`;
      - no client (#102);
      - the transaction fails, seeding included (#78).
    - Success: the email from `emailSchema` (trimmed, lowercased, #15). The Google calls (code exchange, ID token verification and its key fetch) finish before the transaction opens, never inside it (#78; SQLite has one connection). Then one transaction:
      - the user with that email (#2), a password user or a Google-only one, whose name and username stay as they are. Changed by #104: when that user has a password, the same transaction deletes all of their sessions and sets `password_hash` to NULL, so a password set by someone else stops working; they are Google-only from then on. No message (not designed). A Google-only user's other sessions stay. Login (task 007, `AuthService.login`) closes the race with a login already running: after the scrypt verification, its transaction re-reads `password_hash` and creates the session only if it is exactly the hash just verified, otherwise 401 "Email or password is incorrect" (#104); or
      - a new user from `UsersService.create`: the name below, the email, `passwordHash: null` (#2), the generated username (#62, #67); then `DemoSeeder.seed` (#78). A race that inserts the same email first (`EmailTakenError`) counts as a failure; the next try finds the user.
        - The name (#62, #103), from `newUserName(profile)` in `backend/src/auth/google/new-user-name.ts`, a pure function:
          - the profile's `name`, trimmed;
          - when it is missing or only spaces, the part of the email before `@`, as Google gives it;
          - then, when longer than 100 characters as `fullNameSchema` counts them, its first 100 (never splitting a surrogate pair), trimmed again.
          - The result always passes `fullNameSchema`. An existing user's name is never changed (#103).
      - `startSession`, which deletes the session the browser presented (as login does) and creates a new one.
    - Then the session cookie with `sessionCookieOptions(true)`, 30 days (#63, #75), and `302` to the cookie's `returnTo`, checked with `returnTarget` again (a cookie edited by hand gives Overview), or Overview (#3).
  - Logging: one warning line per failed sign-in that names its reason, such as "Google sign-in failed: state mismatch". Never the code, state, verifier, ID or access token, client secret, email, name or the library error's details: a `google-auth-library` error can carry the token request, client secret included.
  - No migration: `users.password_hash` is already nullable (task 007). Google's `sub` is not stored: #75 matches by email.
- **Frontend**:
  - `frontend/src/api/google.ts`: `googleSignInUrl(returnTo?)` builds `/api` + `googleSignIn.start`, with `returnTo` as a query parameter when given. `startGoogleSignIn(returnTo?)` opens it in the same tab with `window.location.assign`: a full page load, not a fetch.
  - Login: "Continue with Google" stays the `ButtonSecondary` with the G, `type="button"`, with no visual change. A click calls `startGoogleSignIn` with the Login page's return target when the page has a `returnTo` (the value `returnTarget` gives for it), or without one. "Keep me signed in" does not apply: a Google session always lasts 30 days (#63).
  - Login opened with `googleSignIn=failed`:
    - shows `authMessages.googleFailed` above "Login" (`FormError`, as other server errors; US-01 criterion 16);
    - removes the marker from the URL with `replace`, keeping `returnTo`, so a reload or Back does not show it again;
    - keeps the message until the next login submit starts, as other messages on Login (task 009). A failed login then shows its own message. Any other marker value is ignored.
  - Sign up: the same button calls `startGoogleSignIn()` without `returnTo`, so Overview opens (US-02 criterion 9).
  - No loading state on the Google button (none designed): the browser shows its own page load.
  - `GuestOnly` is unchanged: a signed-in user who opens `/login?googleSignIn=failed` goes to Overview (#3).
  - The task 009 and 010 tests that assert "Continue with Google does nothing" (`login.test.tsx` T14, the Google half of `sign-up.test.tsx` T8, `login.spec.ts` and `sign-up.spec.ts`) are replaced by this task's tests. They were written for "visual only until task 012" (task 009 AC17, task 010 AC11), so this is a changed requirement, not a weakened test.
- **Tests**:
  - Backend `backend/test/` (Vitest, supertest, `createTestApp`):
    - `auth-google.test.ts`: the routes through the fake;
    - `google-client.test.ts`: `GoogleAuthLibraryClient` with `OAuth2Client` stubbed, no network;
    - `config.test.ts` extended.
    - `createTestApp` takes provider overrides, for a `GoogleClient` stub and for a development config without Google.
  - Shared: `shared/test/return-to.test.ts`, `shared/test/auth-contract.test.ts` extended.
  - Frontend: `frontend/test/app/login.test.tsx`, `sign-up.test.tsx`, `frontend/test/api/google.test.ts`, the source guard `auth-source.test.ts` extended.
  - E2E: `e2e/tests/google-sign-in.spec.ts` against the fake page. `e2e/helpers.ts` gets `googleSignIn(page, profile?)`, which fills and submits the fake page.

## Out of scope
- A real Google OAuth client and a check against it: a later manual test with no code change (#102).
- The Settings Security tab, where Google-only users have no password section (#2, task 030). The `CurrentUser` response is unchanged.
- Linking or unlinking Google accounts, storing Google's `sub`, tokens or refresh tokens; the Google profile photo (profile photos are task 029).
- Changing an existing user's name or username from Google. (Their password: removed, #104.)
- Brute-force protection and rate limits (#14). One Tap, `prompt`, `login_hint`, `hd`.
- Any visual change to Login or Sign up, and new components. Overview's content (task 013).
- Logout, the app shell and route protection, used as built (tasks 009, 011).

## Acceptance criteria
1. Given I am on Login opened with `returnTo=/bills`, when I click "Continue with Google", then the browser loads `/api/auth/google?returnTo=%2Fbills` in the same tab, which answers `302` to Google's authorization URL. That URL has the client ID, the redirect URI `http://localhost:5173/api/auth/google/callback`, `response_type=code`, `scope=openid email profile`, a `state`, a `code_challenge` and `code_challenge_method=S256`. The response sets `finebank_google_signin` with `HttpOnly`, `SameSite=Lax`, `Path=/api/auth/google` and `Max-Age=600`, holding the state and the PKCE verifier, whose S256 hash is the challenge. On Sign up, or on Login without `returnTo`, the URL has no `returnTo` (US-01 criterion 13, US-02 criterion 9; #75).
2. Given a Google account with a verified email that no user has, when I finish the Google sign-in from Sign up, then:
   - a user is created with that email trimmed and lowercased, a username generated from the email (`marko-d@…` gives `markod`, or `markod2` when taken) and no password;
   - its name is the profile's name, trimmed; with no name or only spaces, the part of the email before `@`; a name over 100 characters is cut to its first 100 (#103);
   - the demo dataset is seeded in the same transaction: 5 accounts, 3,411 transactions, 14 bills, 84 savings goals and 6 category limits;
   - a session cookie is set that expires 30 days later;
   - Overview opens through a full page load, so nothing cached before shows (#39), and the header shows the new user's name.
   (US-01 criterion 13, US-02 criteria 9 and 12; #2, #15, #39, #62, #63, #67, #75, #78, #103)
3. Given a user already has the email of my verified Google account (in any case), when I finish the Google sign-in, then I am signed in as that user: no user is added, nothing is seeded again, and their name and username are unchanged (also when the Google name differs). Changed by #104: when that user has a password, it is removed and all of their other sessions are deleted in the same transaction, with no message, so a password set by someone else (who signed up first with my email) no longer logs in and their session gets 401; a password login already running when this happens starts no session. The name chosen at that earlier sign up stays (accepted, editable in Settings, task 028). The session lasts 30 days (#2, #63, #103, #104).
4. Given I started from Login with `returnTo=/bills?x=1#y`, when the Google sign-in succeeds, then `/bills?x=1#y` opens. Given `returnTo` is any of these, then Overview opens and no response ever names another host:
   - an absolute URL, or one on the app origin;
   - `//host`, `/\host`;
   - a tab, newline or encoded slash or backslash trick;
   - `javascript:`;
   - a path without the leading slash;
   - Login, Sign up or Forgot Password;
   - a repeated `returnTo`;
   - a cookie edited to hold any of these.
   (#3, task 009 rule)
5. Given I clicked "Continue with Google", when I cancel on Google (it returns `error=access_denied`), then Login opens with no message and with the `returnTo` I started with, if any. No session and no user are created, and the sign-in cookie is cleared (US-01 criterion 16, US-02 criterion 15; #81).
6. Given I clicked "Continue with Google", when the sign-in fails, then Login opens with "Google sign-in failed. Please try again." above "Login" and the `returnTo` I started with, if any. No session, no user and no rows are created, and the sign-in cookie is cleared. A failure is any of:
   - another `error` from Google;
   - no sign-in cookie, or one that cannot be read;
   - a missing or different `state`;
   - a missing `code`;
   - a code that cannot be exchanged, or a wrong PKCE verifier;
   - an ID token that fails verification;
   - `email_verified` not `true`;
   - a missing or invalid email;
   - seeding or any insert failing, which rolls everything back.
   A callback opened without the browser's own sign-in cookie never signs anyone in (login CSRF).
   (US-01 criterion 16, US-02 criterion 15; #75, #78, #81)
7. Given Login opened with the failure marker, then the message shows above "Login" in the `FormError` style and the marker is gone from the URL, with `returnTo` kept. A reload shows no message. The message stays while I type and goes when my next login submit starts (#81, #97).
8. Given `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` is unset or empty and `NODE_ENV` is not `test`, when I click "Continue with Google", then Login opens with the #81 message, with no request to Google and no sign-in cookie. With `NODE_ENV=test` the fake is used whatever the variables say. `backend/.env.example` lists both, empty (#102).
9. Given a new Google user, then the code exchange and the ID token verification finish before the sign-up transaction opens; nothing inside the transaction waits on Google (#78).
10. Given the browser presented a session when the callback succeeds, then that session row is deleted and only the new session is valid (#75, as login).
11. Given any Google sign-in, successful, cancelled or failed, then no response body, redirect URL of ours or log line holds the code, the state, the verifier, an ID or access token or the client secret. A failure's log line holds no email or name (#75).
12. Given a user created by Google sign-in, when they log in with their email and any password, then the response is the usual 401 "Email or password is incorrect" (#2, #14; task 007 unchanged).
13. Given `NODE_ENV` is not `test`, then `/api/test/google/authorize` does not exist (404), as `/api/test/clock`.
14. Given I am signed in, when I open `/login?googleSignIn=failed`, then Overview opens and the Login form never shows (#3).
15. Given Login and Sign up at 1440x1024, then they look as in tasks 009 and 010: the Google button keeps its look, position and tab order, and no other element moves.
16. Given the source, then `paths`, the return-target rule, the Google routes, the marker and the failure message each exist once in `@finebank/shared`. The frontend and backend import them, and the frontend redeclares no rule or text (#74).

## Test scenarios
| ID | Type | Scenario | Expected | Covers AC |
|----|------|----------|----------|-----------|
| T1 | unit (backend) | `GET /api/auth/google?returnTo=/bills` with the fake, and with a `GoogleAuthLibraryClient` (fake credentials, nothing fetched) | `302`; `Location` has the AC1 parameters; `Cache-Control: no-store`; cookie attributes as AC1; the decoded cookie's verifier hashes (S256) to `code_challenge`; its `returnTo` is `/bills`; without `returnTo` the cookie has none | 1 |
| T2 | unit (backend) | Fake round trip for a new verified email (`New.Person@Example.com `), then `me` with the cookie | `302` to `/overview`; session cookie `Max-Age` 30 days; `me` gives the lowercased email, the profile name, the generated username; `password_hash` NULL; `financeRows` for the user: 5 accounts, 3,411 transactions, 14 bills, 84 savings goals, 6 category limits | 2 |
| T3 | unit (backend) | Username from the Google email: `marko-d@x.com` twice (second with another domain), `jo@x.com` | `markod`, `markod2`, `jo1` (#62, #67) | 2 |
| T4 | unit (backend) | Sign up with a password, then Google with the same email in capitals and another name | Same user id; user count unchanged; finance counts unchanged; name and username unchanged; `password_hash` NULL; the sign-up session deleted, only the Google one left (#104) | 3 |
| T32 | unit (backend) | An attacker signs up with the victim's email and logs in on a second browser; the victim signs in with Google | The attacker's password login gets 401; both attacker sessions get 401 on `me`; the victim's session works; with a `sessions` insert that fails, nothing changes: hash and attacker sessions kept (one transaction); a Google-only user's other session stays on a second Google sign-in (#104) | 3 |
| T5 | unit (backend) | Callback success for each `returnTo` in AC4, set at the start and, separately, written into a hand-made cookie | `/bills?x=1#y` kept; every unsafe value gives `Location: /overview`; no `Location` with a host | 4 |
| T6 | unit (backend) | Callback `error=access_denied` with a valid cookie holding `returnTo`; and with no cookie | `302` to `/login?returnTo=…` and to `/login`; no `googleSignIn`; the sign-in cookie cleared; no session cookie; user count unchanged | 5 |
| T7 | unit (backend) | Each AC6 failure: `error=server_error`; no cookie; garbage cookie; `state` missing and different; no `code`; unknown code; code used twice; wrong verifier in the cookie; `email_verified` false; email missing; a `users` trigger that aborts the insert; a `GoogleClient` stub whose `profile` throws | `302` to `/login?googleSignIn=failed` (with the cookie's `returnTo` when there is one); cookie cleared; no session cookie; users and table counts unchanged | 6 |
| T8 | unit (backend) | App with `nodeEnv: 'development'` and `google: null`: start, and callback with a code | Both `302` to `/login?googleSignIn=failed`; no sign-in cookie; `Location` never a Google URL | 8 |
| T9 | unit (backend) | `readConfig`: both variables set; one empty; none; `NODE_ENV=test` with both set | `google` with the #75 redirect URI; `null`; `null`; the module provides the fake in test regardless | 8 |
| T10 | unit (backend) | A `GoogleClient` stub that records its calls, with a spy on `DataSource.transaction`, for a new user | The order is `profile` resolved, then the transaction starts; no Google call while it is open | 9 |
| T11 | unit (backend) | Log in with a password (cookie A), then Google as another user presenting A | Session row A deleted; `me` with A gives 401; the new cookie works | 10 |
| T12 | unit (backend) | `CapturingLogger` over a success, a cancel and every T7 failure, with a known client secret in the stub's error | No body, `Location` or log line contains the code, state, verifier, tokens or secret; failure lines name a reason without the email or name | 11 |
| T13 | unit (backend) | Log in with the email of a Google-created user and any password | `401`, `{ message: "Email or password is incorrect" }`, no cookie | 12 |
| T14 | unit (backend) | `/api/test/google/authorize` with `NODE_ENV` development and test | 404; 200 HTML with the prefilled form | 13 |
| T15 | unit (backend) | `GoogleAuthLibraryClient.profile` with `getToken` and `verifyIdToken` stubbed: a good token; `getToken` rejecting; `verifyIdToken` rejecting; a payload without `email_verified` | Calls carry the code, the verifier, the redirect URI and the client ID as audience; profile mapped; failures throw an error without the request details | 1, 6, 11 |
| T16 | unit (shared) | `returnTarget` table (the task 009 cases) in Node | Same results as in `frontend/test/routes/return-to.test.ts`, which passes unchanged | 4, 16 |
| T17 | unit (shared) | `authMessages.googleFailed`, `googleSignIn` paths and marker | The #81 text; `/auth/google`, `/auth/google/callback`; `googleSignIn=failed` | 6, 16 |
| T18 | unit (frontend) | `googleSignInUrl()`, `googleSignInUrl('/bills?x=1#y')` | `/api/auth/google`; `/api/auth/google?returnTo=%2Fbills%3Fx%3D1%23y` | 1 |
| T19 | unit (frontend) | Click "Continue with Google" on `/login?returnTo=%2Fbills`, on `/login`, on `/login?returnTo=https://evil.example`, on `/sign-up`, with `startGoogleSignIn` mocked and a request spy | Called with `/bills`, with nothing, with `/overview`, with nothing; no fetch; the button is `type="button"` with the G | 1, 15 |
| T20 | unit (frontend) | `/login?returnTo=%2Fbills&googleSignIn=failed`; then type; then submit a login answered 401; also `googleSignIn=other` | The alert with the #81 text above "Login"; URL `/login?returnTo=%2Fbills`; the alert stays while typing; after the submit only "Email or password is incorrect"; `other` shows nothing | 7 |
| T21 | unit (frontend) | `me` 200 on `/login?googleSignIn=failed` | Overview; the form never renders | 14 |
| T22 | unit (frontend) | Source guard (`auth-source.test.ts`) extended to the #81 text, `googleSignIn`, `/auth/google` and the return-target helpers | No literal outside `@finebank/shared`; `frontend/src/routes/paths.ts` and `return-to.ts` only re-export (plus `loginPathFor`) | 16 |
| T23 | e2e | Signed out, open `/bills`; Login with its `returnTo`; "Continue with Google"; the fake page with a new email; "Continue" | URL `/bills`; the header shows the profile name; `finebank_session` expires about 30 days later; `GET /api/auth/me` gives the lowercased email; a marker set on `window` before the click is gone (full page load) | 1, 2, 4 |
| T24 | e2e | From Sign up, "Continue with Google" with a new email | `/overview`; the new user's name in the header | 2 |
| T34 | unit (backend) | Log in while the password is removed, and separately replaced, between the scrypt verification and the session creation | 401 "Email or password is incorrect"; no Set-Cookie; no new session row (#104) | 3 |
| T25 | e2e | Sign up a password user through `e2e/helpers.ts`, log out, then Google with that email in capitals | Signed in; the header shows the password user's name, not the Google one; after logging out, the password gets "Email or password is incorrect" (#104) | 3 |
| T33 | e2e | An attacker signs up with the victim's email in one browser; the victim signs in with Google in another | The victim on Overview; the attacker's open page gets 401 on its next request and Login opens; the attacker's password login shows "Email or password is incorrect" (#104) | 3 |
| T26 | e2e | "Cancel" on the fake page, from `/login?returnTo=%2Fbills` | `/login?returnTo=%2Fbills`; no alert; `me` 401 | 5 |
| T27 | e2e | "Fail" on the fake page; "Email verified" unchecked; the callback opened directly in a fresh context | Login with the #81 alert, URL without the marker; reload: no alert; a sign up with the unverified email then succeeds (no user was made) | 6, 7 |
| T28 | e2e | Signed in, open `/login?googleSignIn=failed` | `/overview`; the form never visible | 14 |
| T29 | e2e | Login and Sign up at 1440x1024; Tab through both | Google button boxes as in tasks 009 and 010 (Login y 644–692, Sign up y 736–784, x 520–920), within 2px; focus order unchanged | 15 |
| T30 | unit (backend) | `newUserName`: `"  Tanzir Rahman "`; missing name with `Marko.D@gmail.com`; `"   "` with `jo@x.com`; 150 ASCII letters; 99 letters, a space, then more; 99 letters then an emoji (a surrogate pair at 100 and 101) | `Tanzir Rahman`; `Marko.D`; `jo`; its first 100; the first 99 (cut, then trimmed); the first 99 (the pair is not split); every result passes `fullNameSchema` | 2 |
| T31 | unit (backend) | Fake round trip for new users with no name, with only spaces and with a 150-character name; then Google again for the 150-character user with another name | Names `<local part>`, `<local part>`, the first 100 characters; the second sign-in leaves the name unchanged | 2, 3 |

## Validation steps (in this order, stop on first failure)
1. Lint + typecheck pass (`npm run lint`, `npm run typecheck`).
2. Unit tests pass (`npm test`).
3. E2E tests pass (`npm run e2e`). Ports 3000 and 5173 free first.
4. Visual: Playwright MCP screenshots at 1440x1024:
   - `/login` and `/sign-up`, compared with `docs/figma/101. Login.png` and `docs/figma/102. Signup.png` and with the task 009 and 010 renders in `.claude/tasks/evidence/009/` and `010/`: no element moves (pixel diff against those renders).
   - `/login` after a failed Google sign-in (the #81 message above "Login"), an undesigned state in the `FormError` style of task 009.
   - The fake Google page, as evidence only (test infrastructure, not a product screen).
   - Save to `.claude/tasks/evidence/012/` and list every difference.
5. Manual browser checks with Playwright MCP:
   - On the test stack (`npm run start:e2e -w backend` with `NODE_ENV=test`, plus `npm run dev -w frontend`), through the fake page:
     - Login with `returnTo=/bills`, "Continue", lands on `/bills`;
     - Sign up with a new email, lands on Overview with the name in the header;
     - an existing email;
     - "Cancel" and "Fail";
     - "Email verified" unchecked;
     - the callback with an edited `state`;
     - the cookie attributes (`finebank_google_signin`, then `finebank_session` 30 days);
     - Back after a sign-in.
   - On `npm run dev` without Google variables in `backend/.env`: "Continue with Google" returns to Login with the #81 message; the network log shows no request to Google (#102).
   - Save screenshots of the states to `.claude/tasks/evidence/012/`.

## Human checkpoint (only if Gate: human)
- #103 as applied: a new Google user without a profile name (or with only spaces) is named after the part of the email before `@`; a name over 100 characters is cut to its first 100; an existing user's name never changes.
- The flow in the browser through the fake Google page:
  - new user: Overview, the name, the 30-day session, the demo dataset (Overview content from task 013);
  - existing user, matched by email, keeps their name; their password is removed and their other sessions end (#104);
  - `returnTo` kept, unsafe values give Overview;
  - cancel: Login with no message;
  - failure: Login with "Google sign-in failed. Please try again."
- #102 as applied: without Google variables, "Continue with Google" returns to Login with the message, and `backend/.env.example` lists both variables empty. Checking with a real Google client stays a later manual test.
- Choices made at detailing, accepted by Marko (2026-10-26), as built:
  - `paths` and the return-target rule move to `@finebank/shared`, so the backend redirects with the same rule and paths as the frontend; the frontend files re-export them.
  - Cancel keeps the `returnTo` the user started with (#3): the next login still opens the page asked for.
  - The failure message comes from a marker in the Login URL, `googleSignIn=failed`, never from text in the URL. Login removes the marker and keeps the message until the next submit.
  - "Continue with Google" stays a button (role and look unchanged) that loads the start route in the same tab.
  - `error=access_denied` counts as cancel whatever the state, since it signs no one in. Every other problem is a failure.
  - A Google sign-in replaces a session the browser presented, as login does.
  - The fake Google page is prefilled with a fixed profile (#75), and tests change its fields. Its codes check PKCE.
  - No `prompt` parameter, no stored Google tokens or `sub`.
  - Failed sign-ins log one line with the reason only.
- The security review findings and their fixes.

## Log
<!-- Claude appends: date, what was done, decisions, issues, validation results, review findings -->

### 2026-10-26, detailing (`/next-task 012`)
- Recorded **#102 (closed, Marko, 2026-10-26)** in `docs/decisions.md`:
  - Google sign-in is built and tested now against the fake client (#75);
  - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are empty placeholders in `backend/.env.example`;
  - unset outside tests, "Continue with Google" fails safely to Login with the #81 message;
  - a real client is a later manual test, with no code change.
- Detailed from the outline row with Marko's notes:
  - #2 (match by email, Google-only users have no password);
  - #75 (code flow with PKCE, state in a short httpOnly cookie, `email_verified`, scopes `openid email profile`);
  - #81 (cancel and failure), #63 (30 days), #62 and #67 (name and username);
  - #78 (seeding in the sign-up transaction, no real I/O inside it);
  - #3 and the task 009 rule (`returnTo` a relative in-app path only), #39;
  - US-01 criteria 13 and 16, US-02 criteria 9 and 15;
  - `security-review` in Skills.
- Read the existing code this task builds on: `AuthService`, `AuthController`, `UsersService`, `username.ts`, `session-cookie.ts`, `config.ts`, `app.setup.ts` (CSRF lets GET pass), `TestClockController`, `return-to.ts`, `paths.ts`, `LoginPage.tsx`, `SignUpPage.tsx`, `GuestOnly.tsx`, `client.ts`, `ButtonSecondary.tsx`, the Vite proxy and the Playwright config. `google-auth-library` 11.3.1 is already a dependency; `users.password_hash` is already nullable.
- Raised **#103 (open)** in `docs/decisions.md`: the name of a new Google user when the profile has no name (Google documents the `name` claim as never guaranteed) or one longer than #15's 100 characters. This task waits for #103.
- Scope choices for review are in the Human checkpoint ("Choices made at detailing").
- INDEX: row 012 cites the decisions this file uses, with #103 open; the open questions line lists #103.
- Not started. No Figma calls.

### 2026-10-26, #103 closed
- Marko's answers, recorded in `docs/decisions.md` #103 (closed, Marko, 2026-10-26):
  - (a) As proposed: with no profile name, or only spaces, the name is the part of the email before `@`.
  - (b) As proposed: a name over 100 characters is cut to 100.
  - An existing user's name is never changed by Google.
- Also accepted by Marko: every choice listed in the Human checkpoint ("Choices made at detailing").
- Updated:
  - References (#103);
  - Scope (the name rule, `newUserName` in `backend/src/auth/google/new-user-name.ts`);
  - AC2 and AC3;
  - T30 and T31 (new);
  - the Human checkpoint.
- INDEX: row 012 cites #103 as closed; the open questions line says none.
- Not started: Marko asked for the detailing commit only. No Figma calls.

### 2026-10-26, build and gate (`/next-task 012`)
- Every cited decision closed; status in-progress at 13:34. Built test first (each new test watched failing, then
  passing), shared, then backend, frontend, e2e.
- **Shared**: `paths` and `accountDetailsPath` moved to `shared/src/routes/paths.ts`; the return-target rule to
  `shared/src/routes/return-to.ts`, parsed against a fixed origin (`http://finebank.invalid`). Added
  `inAppReturnTarget(value)` (the target, or null when unsafe), with `returnTarget` = it or Overview: the backend
  needs "keep none" at the start and on cancel or failure, not Overview. `authMessages.googleFailed` and
  `googleSignIn` (`start`, `callback`, `failureParam`, `failureValue`). The frontend files only re-export (plus
  `loginPathFor`); `frontend/test/routes/paths.test.ts` and `return-to.test.ts` pass unchanged.
- **Backend** (`backend/src/auth/google/`): `GoogleClient` and `GOOGLE_CLIENT`; `GoogleAuthLibraryClient` (library
  errors replaced by ours, without a cause); `FakeGoogleClient` and `FakeGoogleController` (registered only with
  NODE_ENV=test; the page refuses an authorization request that is not this app's; POST answers to the fixed
  redirect URI; codes once, S256 checked); `GoogleSignInService`, `GoogleAuthController` (302, `no-store`, no body);
  the sign-in cookie (`sign-in-cookie.ts`, strict schema); `pkce.ts`; `newUserName`;
  `google-client.providers.ts` (fake in test, real when both variables are set, otherwise null). `readConfig` reads
  both variables, `GOOGLE_REDIRECT_URI` is built from the app origin and `googleSignIn.callback`; `.env.example`
  lists both empty. `AuthService.startSession` made public (unchanged otherwise). `createTestApp` takes `overrides`.
  No migration.
- **Frontend**: `api/google.ts` (`googleSignInUrl`, `startGoogleSignIn` with `window.location.assign`); Login starts
  Google with its return target and shows `authMessages.googleFailed` in `FormError` from the marker, which it
  removes with `replace`, until the next submit starts; Sign up starts Google without returnTo. No visual change.
- **Replaced tests** (changed requirement, as Scope directs): `login.test.tsx` T14, the Google half of
  `sign-up.test.tsx` T8, `login.spec.ts` "does nothing on Continue with Google", the Google half of `sign-up.spec.ts`
  T8/T11 (the "terms of service." half kept).
- **Undesigned state** (`frontend-design`): the message reuses `FormError` as-is; same box, type and color as the
  wrong-credentials message (measured), the same 34px move of Login as any server error. No new token.
- **Validation** (final run after all fixes):
  1. `npm run lint` exit 0, `npm run typecheck` exit 0. First run failed (rework loop 1): an unused import,
     helpers in inner scopes, tests asserting only through a helper (`expect-expect`), untyped `vi.fn`, two needless
     casts. Fixed at the cause: helpers moved out, `redirectOf()` returns the Location so tests use `expect(...)`.
  2. `npm test`: shared 18 files 544 tests, backend 32 files 462, frontend 42 files 714, all passed.
  3. `npm run e2e`: 113 passed (2.4m), new spec `google-sign-in.spec.ts` (T23 to T29, plus login CSRF with another
     browser's unused code).
  4. Visual (`evidence/012/visual-differences.txt`): 2x renders of Login and Sign up identical to tasks 009 and 010
     (0 pixels); 1x renders differ by at most 1 color unit on 21 and 32 anti-aliased corner pixels of the input
     boxes (two 1x renders of this build are identical; no element moved). The failure state and the fake page
     saved.
  5. Manual (`evidence/012/manual-checks.txt`): returnTo, sign up, existing email, cancel, fail, unverified, edited
     state, both cookies' attributes, Back after a sign-in, and `npm run dev` without Google variables (#102: the
     message, no request to Google, one warning line; test routes 404).
- **Security review** (`evidence/012/security-review.md`): no finding at or above the bar. Noted below the bar, for
  the gate: password sign-up never verifies the email (#15), so an account made first with someone's address is the
  one their later Google sign-in opens (#2), "pre-account hijacking". Left as is: Marko decides it at the gate.
- **Code review** (requesting-code-review): "With fixes"; no Critical.
  - Important, fixed: the frontend source guard banned the literal `'failed'`, also a transaction status (#27), so
    a later task would fail on correct code. Rule removed (the `googleSignIn` rules pin the marker), with a test that
    `status === 'failed'` passes; the generic `controlCharacter` rule removed too.
  - Minor, fixed: T7 checks each failure's log line for no email, name or long token; a failed save logs the error's
    class (`QueryFailedError`), never its message (test red first); names: `started`, `StartedSignIn`,
    `completeSignIn`, `startUserSession`, the controller's `signInService`.
  - Minor, not changed: no timeout on the real client's Google calls. Only the real client is affected, which is
    out of scope (#102); listed for the later manual test with a real client.
  - Set aside by the reviewer, accepted as built: the 10 minutes rest on the cookie's Max-Age (#75); a returnTo over
    about 3 KB would not fit the cookie (no app URL is that long); grapheme clusters may be cut (#103 names surrogate
    pairs); the start is a cross-site GET (#75); a GOOGLE_CLIENT_ID of only spaces counts as set; wrong credentials
    end on Google's error page (real client, #102); cancel whatever the state (accepted at detailing); the fake's
    code map grows (tests only).
- Status `awaiting-human`. No Figma calls.

### 2026-10-26, gate: rejected (`/approve-task 012 reject`)
Feedback, verbatim:

> Pre-account hijacking: option B. Record #104 as closed (Marko, 2026-10-26): when a Google sign-in matches an
> existing user who has a password, inside the same transaction delete all of that user's other sessions and set
> password_hash to NULL, so a password set by someone else stops working; the user is Google-only from then on (#2:
> the Settings password section is hidden). No message (not designed). Add tests: an attacker signs up with the
> victim's email, the victim signs in with Google, then the attacker's password login gets 401 and the attacker's
> session gets 401. Update the AC and the manual check "existing user keeps name and password" (name kept, password
> removed). Also add to #102: a timeout on the real Google calls is part of the later real-client test. Re-run all
> validation and the security review, then stop at the gate again.

Status back to in-progress.

### 2026-10-26, rework for #104, gate again
- **Decisions**: #104 recorded closed in `docs/decisions.md` (Marko, 2026-10-26), the answer in Marko's words. #102
  extended: "a timeout on the real Google calls (the code exchange and the ID token check) is part of that later
  real-client test". Note for the gate: #102 still says "a manual test only, no code change", and a timeout needs code.
- **Task file**: References (#104), Scope (the existing-user bullet, "Changed by #104"), Out of scope (password
  removed, #104), AC3, T4 and T25 changed, T32 and T33 added, the Human checkpoint line for the existing user.
  INDEX row 012 cites #104.
- **Code**: `GoogleSignInService.startUserSession`: for an existing user with a password, in the sign-in
  transaction, `SessionsService.deleteAllOf` (new) and `UsersService.removePassword` (new), then `startSession` as
  before. A Google-only user is left as is. No message, no screen change, no migration.
- **Tests, red first**: T4 rewritten (name and username kept, `password_hash` NULL, only the Google session left);
  T32 (attacker's password login 401 and both attacker sessions 401; a failing `sessions` insert keeps hash and
  sessions; a Google-only user's other session stays); e2e T25 (the old password gets "Email or password is
  incorrect") and T33 (attacker in one browser, victim in another: the attacker's next request opens Login, their
  password login fails). The e2e two were run against the code without #104 and failed, then passed. Mutation
  checks: the removal moved before the transaction fails T32's transaction case; dropping the "has a password"
  condition fails T32's Google-only case.
- **Validation** (final run):
  1. `npm run lint` exit 0 after one failure (rework loop 3: the T32 helper in an inner scope, moved out),
     `npm run typecheck` exit 0.
  2. `npm test`: shared 18 files 544 tests, backend 32 files 465, frontend 42 files 714, all passed.
  3. `npm run e2e`: 114 passed (2.5m).
  4. Visual: re-renders 0 differing pixels from the first renders and, at 2x, from tasks 009 and 010
     (`visual-differences.txt`, re-run section). No screen changed.
  5. Manual (`manual-checks.txt`, re-run section): all checks again; the existing password user keeps the name and
     loses the password; attacker first, two browsers: the attacker's page goes to Login, their password fails, the
     victim stays signed in. The account keeps the attacker's chosen name and generated username (#103, #104).
- **Security review re-run** (`evidence/012/security-review.md`, re-run section): no finding at or above the bar.
  Below the bar, kept by the filter at 7 of 10: a password login already running when the takeover commits still
  creates a 30-day session (task 007's `login` checks the hash before scrypt and inserts after it, without a
  re-check), so an attacker logging in back to back can keep access. Not changed (task 007 code, outside the
  feedback); for Marko at the gate, with the suggested fix.
- No second code review: the gate feedback limits this rework to #104; the security re-review covered the change.
- Status `awaiting-human`. No Figma calls.

### 2026-10-26, gate: rejected again (`/approve-task 012 reject`)
Feedback, verbatim:

> Fix the login race (changes task 007 login, approved): after the scrypt verification (outside the transaction, as
> now), open the login transaction and re-read the user's password_hash; create the session only if it is exactly
> the hash that was just verified, otherwise 401 "Email or password is incorrect". No hashing inside the transaction.
> Add a test that removes the password between the verification and the session creation and expects 401 with no
> session row. Note it under #104. Also correct #102: the real-client check needs a small code change (the timeout),
> not "no code change". The attacker-chosen name staying after a takeover is accepted (editable in Settings, task
> 028). Re-run all validation and the security review, then stop at the gate again.

Status back to in-progress.

### 2026-10-26, rework for the login race, gate again
- **Code** (`AuthService.login`, task 007, approved by Marko): the scrypt verification stays outside the
  transaction; the login transaction re-reads the user (`findOneBy`) and starts the session only if `passwordHash`
  is exactly the hash just verified, otherwise the usual 401 "Email or password is incorrect". No hashing inside
  the transaction. `User` is now a value import there.
- **Test, red first**: T34 in `backend/test/auth-login.test.ts`: the password removed, and separately replaced,
  after the real verification resolves and before the session is created: 401, the message, no Set-Cookie, no new
  session row. Failed with 200 before the change, passes after.
- **Decisions**: #104 notes the login re-check and Marko's acceptance of the name kept after a takeover (editable in
  Settings, task 028). #102 corrected: the real-client check is a manual test plus a small code change, the timeout.
- **Task file**: Scope (the #104 bullet names the login re-check), AC3 (a login already running starts no session;
  the name kept), T34 added.
- **Validation** (final run): 1. `npm run lint` exit 0, `npm run typecheck` exit 0. 2. `npm test`: shared 18 files
  544, backend 32 files 467, frontend 42 files 714, all passed. 3. `npm run e2e`: 114 passed (2.4m). 4. Visual:
  `*-rerun2.png`, 0 differing pixels (2x against tasks 009 and 010, 1x against this task's first renders). 5.
  Manual (`manual-checks.txt`, second re-run): a plain password login still opens Overview; the Google flows, the
  attacker case and `npm run dev` without Google variables as before; the race itself is covered by T34.
- **Security review, second re-run** (`evidence/012/security-review.md`): no finding; nothing reached 7 of 10. The
  re-check closes the race (better-sqlite3 runs the whole login transaction within one turn; no request or Google
  transaction runs in between) and leaks nothing new. Below the bar, for the gate: another site can send a
  signed-in victim through `GET /api/auth/google`; if Google completes without asking, #104 makes the victim's own
  password account Google-only and ends their other sessions. No one else gains access.
- Status `awaiting-human`. No Figma calls.

### 2026-10-26, gate
- Approved by human (`/approve-task 012 approve`). Marko's instruction before the commit, applied: #104 gets a
  "Known limitation" note: another site can start "Continue with Google" for a user already signed in to Google;
  #104 then makes their account Google-only and ends their other sessions; nobody gains access. Fix later by making
  the start route a POST form (CSRF-protected).
- Status `done`.

## Metrics
- Started: 2026-10-26 13:34
- Finished: 2026-10-26 15:41
- Human interventions: 4 (the turn ended after the security review's report; Marko asked to continue to the gate;
  gate rejected for #104; gate rejected for the login race; approval at the gate)
- Rework loops: 4 (validation step 1: lint; gate rejection: #104; validation step 1 again: lint; gate rejection:
  the login race)
- Notes on prompts that failed: the `security-review` skill asks for a final reply of only its report, which ended the
  turn in the middle of `/next-task`. Save the report to the evidence folder and continue in the same turn.
